import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { offers } from "../src/db/schema.js";
import { PaymentsService } from "../src/modules/commerce/payments/payments.service.js";
import { signSandbox } from "../src/modules/commerce/payments/sandbox.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  addressId = addresses.body.find((a: { isDefault: boolean }) => a.isDefault).id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(() => t.clock.reset());

/** The store's offer for a product. */
async function offerOf(slug: string) {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  return { id: p.body.offerId as string, pricePaise: p.body.pricePaise as number };
}
const stockOf = async (offerId: string) => (await db.select({ stock: offers.stock }).from(offers).where(eq(offers.id, offerId)))[0]!.stock;
const place = (body: object, key = randomUUID()) => t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", key).send({ addressId, ...body });

describe("cart", () => {
  it("adds, updates, saves for later and removes lines", async () => {
    const o = await offerOf("headphones-studio");
    let cart = await t.http.post("/v1/cart/items").set(shopper).send({ offerId: o.id, qty: 1, variant: "Graphite" }).expect(200);
    cart = await t.http.post("/v1/cart/items").set(shopper).send({ offerId: o.id, qty: 2, variant: "Graphite" }).expect(200);
    expect(cart.body.lines).toHaveLength(1);
    expect(cart.body.lines[0].qty).toBe(3);
    expect(cart.body.summary.subtotalPaise).toBe(o.pricePaise * 3);

    const lineId = cart.body.lines[0].id;
    cart = await t.http.patch(`/v1/cart/items/${lineId}`).set(shopper).send({ savedForLater: true }).expect(200);
    expect(cart.body.summary.itemCount).toBe(0);
    await t.http.patch(`/v1/cart/items/${lineId}`).set(shopper).send({ qty: 11 }).expect(422);
    cart = await t.http.delete(`/v1/cart/items/${lineId}`).set(shopper).expect(200);
    expect(cart.body.lines).toHaveLength(0);
  });

  it("is private to each user", async () => {
    await t.http.get("/v1/cart").expect(401);
  });
});

describe("prepaid checkout", () => {
  it("quotes, places, pays and confirms an order", async () => {
    const o = await offerOf("headphones-studio");
    const stockBefore = await stockOf(o.id);
    await t.http.put("/v1/cart").set(shopper).send({ lines: [{ offerId: o.id, qty: 1, variant: "Graphite" }] }).expect(200);

    const quote = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, couponCode: "BIGDAYS10" }).expect(200);
    expect(quote.body.canPlaceOrder).toBe(true);
    expect(quote.body.coupon).toMatchObject({ code: "BIGDAYS10", applied: true });
    expect(quote.body.totalPaise).toBe(quote.body.subtotalPaise - quote.body.couponDiscountPaise + quote.body.deliveryFeePaise);

    const key = randomUUID();
    const placed = await place({ paymentMethod: "UPI", couponCode: "BIGDAYS10" }, key).expect(201);
    const order = placed.body.order;
    expect(order.status).toBe("PAYMENT_PENDING");
    expect(order.totalPaise).toBe(quote.body.totalPaise);
    expect(placed.body.payment.nextAction.url).toContain(`/checkout/pay/${placed.body.payment.id}`);
    expect(await stockOf(o.id)).toBe(stockBefore - 1);
    // the ordered line leaves the cart
    expect((await t.http.get("/v1/cart").set(shopper)).body.lines).toHaveLength(0);
    // unpaid orders are not ready to fulfil
    const before = await t.http.get("/v1/admin/order-items").set(staff).expect(200);
    expect(before.body.items.find((i: { orderId: string }) => i.orderId === order.id)).toBeUndefined();

    // retrying the same request returns the same order
    const replay = await place({ paymentMethod: "UPI", couponCode: "BIGDAYS10" }, key).expect(201);
    expect(replay.body.order.id).toBe(order.id);

    const paid = await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    expect(paid.body).toMatchObject({ status: "CAPTURED", orderStatus: "CONFIRMED" });

    const detail = await t.http.get(`/v1/me/orders/${order.id}`).set(shopper).expect(200);
    expect(detail.body.paymentStatus).toBe("CAPTURED");
    expect(detail.body.items[0]).toMatchObject({ status: "NEW", canCancel: true });

    const storeView = await t.http.get(`/v1/admin/orders/${order.id}`).set(staff).expect(200);
    const item = storeView.body.items[0];
    expect(item.allowedActions).toEqual(["ACCEPTED", "CANCELLED"]);
    expect(item).not.toHaveProperty("fees");
    expect(storeView.body.shipTo.name).toBe("Ananya Sharma");
  });

  it("lets a failed payment be retried, then confirms", async () => {
    const o = await offerOf("serum-glow");
    const placed = await place({ paymentMethod: "CARD", lines: [{ offerId: o.id, qty: 2, variant: "" }] }).expect(201);
    const failed = await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "FAILURE" }).expect(200);
    expect(failed.body).toMatchObject({ status: "FAILED", orderStatus: "PAYMENT_FAILED" });

    const retry = await t.http.post(`/v1/me/orders/${placed.body.order.id}/payments`).set(shopper).expect(201);
    expect(retry.body.id).not.toBe(placed.body.payment.id);
    const paid = await t.http.post(`/v1/payments/${retry.body.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    expect(paid.body.orderStatus).toBe("CONFIRMED");
  });

  it("abandons orders left unpaid for 30 minutes and releases stock", async () => {
    const o = await offerOf("tea-assam");
    const stockBefore = await stockOf(o.id);
    const placed = await place({ paymentMethod: "UPI", lines: [{ offerId: o.id, qty: 3, variant: "" }] }).expect(201);
    expect(await stockOf(o.id)).toBe(stockBefore - 3);

    t.clock.advance(31 * 60_000);
    expect(await t.app.get(PaymentsService).expireStale()).toBeGreaterThanOrEqual(1);
    const detail = await t.http.get(`/v1/me/orders/${placed.body.order.id}`).set(shopper).expect(200);
    expect(detail.body).toMatchObject({ status: "ABANDONED", paymentStatus: "EXPIRED" });
    expect(await stockOf(o.id)).toBe(stockBefore);

    // a payment that lands after expiry is refunded, never silently kept
    const late = await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    expect(late.body.status).toBe("REFUNDED");
  });
});

describe("webhooks", () => {
  it("rejects bad signatures and ignores duplicate events", async () => {
    await t.http.post("/v1/payments/webhooks/sandbox").set("x-sandbox-signature", "nope").set("content-type", "application/json").send('{"id":"x"}').expect(401);

    const o = await offerOf("mugs-stone");
    const placed = await place({ paymentMethod: "UPI", lines: [{ offerId: o.id, qty: 1, variant: "" }] }).expect(201);
    const [payment] = (await db.query.payments.findMany({ where: (p, { eq: e }) => e(p.id, placed.body.payment.id) })) as { providerRef: string }[];
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.captured", providerRef: payment!.providerRef });
    const send = () => t.http.post("/v1/payments/webhooks/sandbox").set("x-sandbox-signature", signSandbox(body)).set("content-type", "application/json").send(body);
    expect((await send().expect(200)).body).toEqual({ received: true, duplicate: false });
    expect((await send().expect(200)).body).toEqual({ received: true, duplicate: true });
  });
});

describe("inventory", () => {
  it("never oversells the last unit under concurrent orders", async () => {
    const o = await offerOf("bag-leather");
    await db.update(offers).set({ stock: 1 }).where(eq(offers.id, o.id));
    const [a, b] = await Promise.all([
      place({ paymentMethod: "COD", lines: [{ offerId: o.id, qty: 1, variant: "" }] }),
      place({ paymentMethod: "COD", lines: [{ offerId: o.id, qty: 1, variant: "" }] }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await stockOf(o.id)).toBe(0);
  });

  it("refuses orders it cannot fulfil", async () => {
    const o = await offerOf("bag-leather");
    const r = await place({ paymentMethod: "UPI", lines: [{ offerId: o.id, qty: 1, variant: "" }] }).expect(409);
    expect(r.body.code).toBe("OUT_OF_STOCK");
  });
});

describe("store fulfilment and delivery (cash on delivery)", () => {
  it("moves an order from placed to delivered and collects cash", async () => {
    const o = await offerOf("airfryer-crisp");
    const placed = await place({ paymentMethod: "COD", lines: [{ offerId: o.id, qty: 1, variant: "" }] }).expect(201);
    const orderId = placed.body.order.id;
    expect(placed.body.order).toMatchObject({ status: "CONFIRMED", paymentStatus: "COD_PENDING" });
    expect(placed.body.payment.nextAction).toBeNull();

    const list = await t.http.get("/v1/admin/order-items?status=NEW").set(staff).expect(200);
    const line = list.body.items.find((i: { orderId: string }) => i.orderId === orderId);
    expect(line).toBeDefined();
    expect(list.body.counts.NEW).toBeGreaterThanOrEqual(1);

    // a step cannot be skipped
    const skip = await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [line.id], to: "PACKED" }).expect(200);
    expect(skip.body.results[0]).toMatchObject({ ok: false });
    // staff cannot mark items shipped; only courier scans can
    await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [line.id], to: "SHIPPED" }).expect(422);

    for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) {
      const r = await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [line.id], to }).expect(200);
      expect(r.body.results[0]).toMatchObject({ ok: true, status: to });
    }
    const rts = await t.http.get(`/v1/admin/orders/${orderId}`).set(staff).expect(200);
    expect(rts.body.items[0].awb).toMatch(/^BBL\d{10}$/);
    expect(rts.body.status).toBe("IN_PROGRESS");

    for (const to of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) await t.http.post("/v1/dev/logistics/advance").set(shopper).send({ orderItemId: line.id, to }).expect(200);
    const done = await t.http.get(`/v1/me/orders/${orderId}`).set(shopper).expect(200);
    expect(done.body).toMatchObject({ status: "DELIVERED", paymentStatus: "COD_COLLECTED" });
    expect(done.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(
      expect.arrayContaining(["CONFIRMED", "NEW", "ACCEPTED", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]),
    );
  });

  it("keeps the fulfilment queue to store staff", async () => {
    await t.http.get("/v1/admin/order-items").set(shopper).expect(403);
    await t.http.get("/v1/seller/order-items").set(staff).expect(404);
  });
});

describe("cancellation and refunds", () => {
  it("refunds a cancelled line less its coupon share, then the rest", async () => {
    const a = await offerOf("headphones-studio");
    const b = await offerOf("speaker-boom");
    const placed = await place({ paymentMethod: "UPI", couponCode: "BIGDAYS10", lines: [{ offerId: a.id, qty: 1, variant: "" }, { offerId: b.id, qty: 1, variant: "" }] }).expect(201);
    await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    const order = placed.body.order;
    const speaker = order.items.find((i: { productId: string }) => i.productId === "p-speaker-boom");
    const stockBefore = await stockOf(b.id);

    const one = await t.http.post(`/v1/me/orders/${order.id}/cancel`).set(shopper).send({ itemIds: [speaker.id], reason: "Changed my mind" }).expect(200);
    const couponShare = Math.round((order.couponDiscountPaise * speaker.unitPricePaise) / order.subtotalPaise);
    expect(one.body.refunds[0]).toMatchObject({ amountPaise: speaker.unitPricePaise - couponShare, status: "COMPLETED" });
    expect(one.body.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(await stockOf(b.id)).toBe(stockBefore + 1);

    const rest = await t.http.post(`/v1/me/orders/${order.id}/cancel`).set(shopper).send({ reason: "Found it cheaper" }).expect(200);
    const refunded = rest.body.refunds.reduce((s: number, r: { amountPaise: number }) => s + r.amountPaise, 0);
    expect(refunded).toBe(order.totalPaise);
    expect(rest.body).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
  });

  it("does not cancel items that have shipped", async () => {
    // cash on delivery is capped at ₹50,000
    const camera = await offerOf("camera-mirrorless");
    const refused = await place({ paymentMethod: "COD", lines: [{ offerId: camera.id, qty: 1, variant: "" }] }).expect(409);
    expect(refused.body.code).toBe("COD_UNAVAILABLE");

    const o = await offerOf("cookware-pan");
    const placed = await place({ paymentMethod: "COD", lines: [{ offerId: o.id, qty: 1, variant: "" }] }).expect(201);
    const item = placed.body.order.items[0];
    for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) {
      const r = await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [item.id], to }).expect(200);
      expect(r.body.results[0].ok).toBe(true);
    }
    await t.http.post("/v1/dev/logistics/advance").set(shopper).send({ orderItemId: item.id, to: "SHIPPED" }).expect(200);
    const r = await t.http.post(`/v1/me/orders/${placed.body.order.id}/cancel`).set(shopper).send({ reason: "Too late" }).expect(409);
    expect(r.body.code).toBe("NOT_CANCELLABLE");
  });
});

describe("order history", () => {
  it("lists orders newest first and filters by state", async () => {
    const all = await t.http.get("/v1/me/orders?pageSize=50").set(shopper).expect(200);
    expect(all.body.total).toBeGreaterThan(5);
    const placedAt = all.body.items.map((o: { placedAt: string }) => o.placedAt);
    expect([...placedAt].sort().reverse()).toEqual(placedAt);
    const cancelled = await t.http.get("/v1/me/orders?status=cancelled").set(shopper).expect(200);
    expect(cancelled.body.items.every((o: { status: string }) => ["CANCELLED", "ABANDONED"].includes(o.status))).toBe(true);
  });
});
