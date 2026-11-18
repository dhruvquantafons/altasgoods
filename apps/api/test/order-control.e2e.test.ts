import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { offers, orderItems, orders, payments, refunds, returns } from "../src/db/schema.js";
import { LOGISTICS_PROVIDER } from "../src/common/tokens.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import type { Booking, ShipmentRequest } from "../src/modules/commerce/shipping/provider.js";
import { ShippingService } from "../src/modules/commerce/shipping/shipping.service.js";
import { SimulatedLogisticsProvider } from "../src/modules/commerce/shipping/simulated.provider.js";
import { createTestApp, DEMO_AGENT, DEMO_CUSTOMER, DEMO_STAFF, runJobs, signIn, type TestContext } from "./helpers.js";

/** Admin control over an order: refunds, the delivery address, internal notes, lost and returned parcels. */

/** The simulated courier, with a hook into booking so a test can pause it or play a partial booking. */
class SteerableCourier extends SimulatedLogisticsProvider {
  onBook: ((request: ShipmentRequest, save: (step: Booking) => Promise<void>) => Promise<void>) | null = null;
  cancelled: { carrierOrderRef: string | null; awb: string | null }[] = [];
  override async book(request?: ShipmentRequest, _done?: Booking, save?: (step: Booking) => Promise<void>) {
    if (this.onBook) await this.onBook(request!, save!);
    return super.book();
  }
  override async cancel(booking?: { carrierOrderRef: string | null; awb: string | null }) {
    this.cancelled.push(booking!);
  }
}
const courier = new SteerableCourier();

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let auditor: Record<string, string>;
let agent: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const A = "/v1/admin";
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  t = await createTestApp([{ provide: LOGISTICS_PROVIDER, useValue: courier }]);
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  agent = (await signIn(t.http, DEMO_AGENT)).auth;
  await t.http.post(`${A}/staff`).set(staff).send({ name: "Audit Or", email: "audit.orders@altasgoods.in", roles: ["AUDITOR"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
  await t.http.post("/v1/me/password").set((await signIn(t.http, "audit.orders@altasgoods.in", "temporary-pass-1")).auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
  auditor = (await signIn(t.http, "audit.orders@altasgoods.in", "chosen-password-1")).auth;
  const a = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  addressId = a.body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

const offerOf = async (slug: string) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body.offerId as string;

/** An order of one unit of each product; prepaid orders are paid in the sandbox. */
async function order(slugs: string[], paymentMethod: "UPI" | "COD" = "UPI") {
  const lines: { offerId: string; qty: number; variant: string }[] = [];
  for (const slug of slugs) lines.push({ offerId: await offerOf(slug), qty: 1, variant: "" });
  const placed = await t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, paymentMethod, lines }).expect(201);
  if (paymentMethod !== "COD") await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  const orderId = placed.body.order.id as string;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const ids = slugs.map((_, i) => items.find((x) => x.offerId === lines[i]!.offerId)!.id);
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  return { orderId, ids, order: o!, items };
}

const transition = (ids: string[], to: string, reason?: string) => t.http.post(`${A}/order-items/transition`).set(staff).send({ ids, to, reason });
const scan = (orderItemId: string, to: string) => t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId, to }).expect(200);

async function shipped(itemId: string) {
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) expect((await transition([itemId], to).expect(200)).body.results[0]).toMatchObject({ ok: true });
  await scan(itemId, "SHIPPED");
}
async function delivered(itemId: string) {
  await shipped(itemId);
  await scan(itemId, "OUT_FOR_DELIVERY");
  await scan(itemId, "DELIVERED");
}

const refundsOf = (orderId: string) => db.select().from(refunds).where(eq(refunds.orderId, orderId));
const stockOf = async (offerId: string) => (await db.select({ stock: offers.stock }).from(offers).where(eq(offers.id, offerId)))[0]!.stock;
const refund = (orderId: string, body: object, who = staff) => t.http.post(`${A}/orders/${orderId}/refunds`).set(who).send(body);

describe("refunds from the order page", () => {
  it("refunds to the payment method through the refund job, never more than is left, even when two go at once", async () => {
    const { orderId, order: o } = await order(["lamp-arc"]);
    const first = await refund(orderId, { amountPaise: 10_000, reason: "Late delivery goodwill", method: "SOURCE" }).expect(201);
    expect(first.body).toMatchObject({ orderId, amountPaise: 10_000, status: "PENDING", method: "SOURCE", reference: null });
    await runJobs(t);
    expect((await refundsOf(orderId))[0]).toMatchObject({ status: "COMPLETED", method: "SOURCE" });
    expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0]!.paymentStatus).toBe("PARTIALLY_REFUNDED");

    // more than what is left is refused
    const left = o.totalPaise - 10_000;
    const tooMuch = await refund(orderId, { amountPaise: left + 1, reason: "Too much", method: "SOURCE" }).expect(409);
    expect(tooMuch.body.code).toBe("REFUND_TOO_LARGE");

    // two refunds of 60% of what is left at once: only one fits
    const part = Math.ceil(left * 0.6);
    const both = await Promise.all([
      refund(orderId, { amountPaise: part, reason: "Concurrent one", method: "SOURCE" }),
      refund(orderId, { amountPaise: part, reason: "Concurrent two", method: "SOURCE" }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
    const committed = (await refundsOf(orderId)).filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountPaise, 0);
    expect(committed).toBeLessThanOrEqual(o.totalPaise);

    const audit = await t.http.get(`${A}/audit`).query({ action: "refund.create" }).set(staff).expect(200);
    expect(audit.body.items.some((e: { entityId: string }) => e.entityId === first.body.id)).toBe(true);
  });

  it("refuses a reference on a refund to the payment method", async () => {
    const { orderId } = await order(["mugs-stone"]);
    const r = await refund(orderId, { amountPaise: 1_000, reason: "Goodwill", method: "SOURCE", reference: "UTR12345678" }).expect(422);
    expect(r.body.code).toBe("REFERENCE_NOT_ALLOWED");
    expect(await refundsOf(orderId)).toEqual([]);
  });

  it("refuses a refund to the payment method on a cash on delivery order", async () => {
    const { orderId } = await order(["speaker-boom"], "COD");
    const r = await refund(orderId, { amountPaise: 1_000, reason: "Goodwill", method: "SOURCE" }).expect(409);
    expect(r.body.code).toBe("NOT_REFUNDABLE");
  });

  it("records a manual refund only with a reference, and on cash on delivery only what was collected", async () => {
    const { orderId, ids, order: o } = await order(["speaker-boom"], "COD");
    const noRef = await refund(orderId, { amountPaise: 1_000, reason: "Goodwill for the delay", method: "MANUAL" }).expect(422);
    expect(noRef.body.code).toBe("REFERENCE_REQUIRED");
    // nothing collected before delivery
    const early = await refund(orderId, { amountPaise: 1_000, reason: "Goodwill for the delay", method: "MANUAL", reference: "UTR12345678" }).expect(409);
    expect(early.body.code).toBe("REFUND_TOO_LARGE");

    await delivered(ids[0]!);
    const paid = await refund(orderId, { amountPaise: 1_000, reason: "Goodwill for the delay", method: "MANUAL", reference: "UTR12345678" }).expect(201);
    expect(paid.body).toMatchObject({ status: "COMPLETED", method: "MANUAL", reference: "UTR12345678", amountPaise: 1_000 });
    expect(paid.body.completedAt).toEqual(expect.any(String));
    const over = await refund(orderId, { amountPaise: o.totalPaise, reason: "Everything", method: "MANUAL", reference: "UTR12345679" }).expect(409);
    expect(over.body.code).toBe("REFUND_TOO_LARGE");
    // no gateway call and no job for a manual refund
    const [row] = await refundsOf(orderId);
    expect(row).toMatchObject({ method: "MANUAL", status: "COMPLETED", providerRefundId: null });
  });

  it("settles a manual refund on a prepaid order without the gateway", async () => {
    const { orderId, order: o } = await order(["mugs-stone"]);
    const r = await refund(orderId, { amountPaise: o.totalPaise, reason: "Paid back by bank transfer", method: "MANUAL", reference: "NEFT-778812" }).expect(201);
    expect(r.body.status).toBe("COMPLETED");
    const [after] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(after!.paymentStatus).toBe("REFUNDED");
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    expect(pay!.status).toBe("REFUNDED");
    await refund(orderId, { amountPaise: 100, reason: "One more", method: "SOURCE" }).expect(409);
  });

  it("sends a refund that needs attention again, on the same row", async () => {
    const { orderId } = await order(["vase-ceramic"]);
    const r = await refund(orderId, { amountPaise: 5_000, reason: "Goodwill", method: "SOURCE" }).expect(201);
    await db.update(refunds).set({ status: "NEEDS_ATTENTION" }).where(eq(refunds.id, r.body.id));
    const listed = await t.http.get(`${A}/refunds`).query({ status: "NEEDS_ATTENTION" }).set(staff).expect(200);
    expect(listed.body.items.map((x: { id: string }) => x.id)).toContain(r.body.id);
    const overview = await t.http.get(`${A}/overview`).set(staff).expect(200);
    expect(overview.body.work.refundsNeedAttention).toBeGreaterThanOrEqual(1);

    const again = await t.http.post(`${A}/refunds/${r.body.id}/retry`).set(staff).expect(200);
    expect(again.body).toMatchObject({ id: r.body.id, status: "PENDING" });
    await runJobs(t);
    expect((await refundsOf(orderId)).map((x) => [x.id, x.status])).toEqual([[r.body.id, "COMPLETED"]]);
    const twice = await t.http.post(`${A}/refunds/${r.body.id}/retry`).set(staff).expect(409);
    expect(twice.body.code).toBe("REFUND_NOT_RETRYABLE");
  });
});

describe("bank refunds paid by hand", () => {
  it("marks a bank refund of a return paid exactly once", async () => {
    const { orderId, ids } = await order(["speaker-boom"], "COD");
    await delivered(ids[0]!);
    const r = (
      await t.http
        .post("/v1/me/returns")
        .set(shopper)
        .send({ orderItemId: ids[0], qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "BANK", refundUpi: "shopper@okbank", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
        .expect(201)
    ).body;
    const before = (await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200)).body.refundLimit.maxPaise as number;
    // a low value return is refunded at pickup, so its payout is set aside then
    const picked = await t.http.post(`${A}/returns/${r.id}/pickup`).set(staff).send({ to: "RECEIVED" }).expect(200);
    expect(picked.body).toMatchObject({ refundStatus: "INITIATED", refundTo: "BANK", refundUpi: "shopper@okbank" });
    await t.http.post(`${A}/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(200);

    // the payout is set aside on the ledger at once: it counts against the cap and shows as waiting on the order page
    const [pending] = await refundsOf(orderId);
    expect(pending).toMatchObject({ method: "MANUAL", status: "PENDING", amountPaise: r.refundAmountPaise, reason: `Return ${r.id}`, orderItemId: ids[0] });
    const detail = (await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200)).body;
    expect(detail.refundLimit.maxPaise).toBe(before - r.refundAmountPaise);
    expect(detail.refunds.map((x: { id: string; status: string }) => [x.id, x.status])).toEqual([[pending!.id, "PENDING"]]);
    // so a goodwill refund cannot pay the same money twice
    const twice = await refund(orderId, { amountPaise: before - r.refundAmountPaise + 1, reason: "Goodwill for the defect", method: "MANUAL", reference: "UTR55500011" }).expect(409);
    expect(twice.body.code).toBe("REFUND_TOO_LARGE");
    expect((await t.http.get(`/v1/me/returns/${r.id}`).set(shopper).expect(200)).body.refundStatus).toBe("INITIATED");

    await t.http.post(`${A}/returns/${r.id}/refund/mark-paid`).set(staff).send({}).expect(422);
    const [done, again] = await Promise.all([
      t.http.post(`${A}/returns/${r.id}/refund/mark-paid`).set(staff).send({ reference: "UPI-4410029" }),
      t.http.post(`${A}/returns/${r.id}/refund/mark-paid`).set(staff).send({ reference: "UPI-4410029" }),
    ]);
    expect([done.status, again.status].sort()).toEqual([200, 409]);
    const view = await t.http.get(`${A}/returns/${r.id}`).set(staff).expect(200);
    expect(view.body).toMatchObject({ refundStatus: "COMPLETED", refundReference: "UPI-4410029" });
    const rows = await refundsOf(orderId);
    // the same row, completed once
    expect(rows).toEqual([expect.objectContaining({ id: pending!.id, method: "MANUAL", status: "COMPLETED", reference: "UPI-4410029", amountPaise: r.refundAmountPaise, reason: `Return ${r.id}` })]);
    await t.http.post(`${A}/refunds/${pending!.id}/mark-paid`).set(staff).send({ reference: "UPI-4410029" }).expect(409);
    const mine = await t.http.get("/v1/me/refunds").set(shopper).expect(200);
    expect(mine.body.find((x: { id: string }) => x.id === rows[0]!.id)).toMatchObject({ source: "RETURN", status: "COMPLETED" });
  });

  it("sets aside a bank refund on a prepaid order, and refuses to resolve a return the cap cannot cover", async () => {
    const returnOf = async (itemId: string) =>
      (
        await t.http
          .post("/v1/me/returns")
          .set(shopper)
          .send({ orderItemId: itemId, qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "BANK", refundUpi: "shopper@okbank", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
          .expect(201)
      ).body;

    // prepaid, bank refund: reserved against the captured payment, so a SOURCE goodwill for the same money is refused
    const paid = await order(["lamp-arc"]);
    await delivered(paid.ids[0]!);
    const r1 = await returnOf(paid.ids[0]!);
    await t.http.post(`${A}/returns/${r1.id}/pickup`).set(staff).send({ to: "RECEIVED" }).expect(200);
    await t.http.post(`${A}/returns/${r1.id}/qc`).set(staff).send({ pass: true }).expect(200);
    const left = paid.order.totalPaise - r1.refundAmountPaise;
    expect((await t.http.get(`${A}/orders/${paid.orderId}`).set(staff).expect(200)).body.refundLimit).toEqual({ source: true, maxPaise: left });
    expect((await refund(paid.orderId, { amountPaise: left + 1, reason: "Goodwill", method: "SOURCE" }).expect(409)).body.code).toBe("REFUND_TOO_LARGE");
    // marking it paid from the Payments page completes the return too
    const [row] = await refundsOf(paid.orderId);
    await t.http.post(`${A}/refunds/${row!.id}/mark-paid`).set(staff).send({ reference: "UPI-7781" }).expect(200);
    expect((await t.http.get(`${A}/returns/${r1.id}`).set(staff).expect(200)).body).toMatchObject({ refundStatus: "COMPLETED", refundReference: "UPI-7781" });
    await t.http.post(`${A}/returns/${r1.id}/refund/mark-paid`).set(staff).send({ reference: "UPI-7781" }).expect(409);

    // everything already refunded by hand: the check cannot pass and says why
    const full = await order(["mugs-stone"]);
    await delivered(full.ids[0]!);
    const r2 = await returnOf(full.ids[0]!);
    await refund(full.orderId, { amountPaise: full.order.totalPaise, reason: "Refunded in full", method: "MANUAL", reference: "NEFT-1100" }).expect(201);
    // (a low value return resolves at pickup, so that is the step that refuses)
    const refused = await t.http.post(`${A}/returns/${r2.id}/pickup`).set(staff).send({ to: "RECEIVED" }).expect(409);
    expect(refused.body.code).toBe("REFUND_TOO_LARGE");
    expect(refused.body.detail).toContain(`return ${r2.id}`);
    expect((await t.http.get(`${A}/returns/${r2.id}`).set(staff).expect(200)).body).toMatchObject({ status: "PICKUP_SCHEDULED", refundStatus: null });
    expect(await refundsOf(full.orderId)).toHaveLength(1);
  });

  it("marks a return's bank refund paid from both pages at once: one wins, the other is refused, nothing errors", async () => {
    for (const slug of ["speaker-boom", "speaker-boom", "speaker-boom"]) {
      const { orderId, ids } = await order([slug], "COD");
      await delivered(ids[0]!);
      const r = (
        await t.http
          .post("/v1/me/returns")
          .set(shopper)
          .send({ orderItemId: ids[0], qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "BANK", refundUpi: "shopper@okbank", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
          .expect(201)
      ).body;
      await t.http.post(`${A}/returns/${r.id}/pickup`).set(staff).send({ to: "RECEIVED" }).expect(200);
      const [pending] = await refundsOf(orderId);
      const both = await Promise.all([
        t.http.post(`${A}/returns/${r.id}/refund/mark-paid`).set(staff).send({ reference: "UTR10203040" }),
        t.http.post(`${A}/refunds/${pending!.id}/mark-paid`).set(staff).send({ reference: "UTR10203040" }),
      ]);
      expect(both.map((x) => x.status).sort()).toEqual([200, 409]);
      expect(await refundsOf(orderId)).toEqual([expect.objectContaining({ id: pending!.id, status: "COMPLETED", reference: "UTR10203040" })]);
      expect((await t.http.get(`${A}/returns/${r.id}`).set(staff).expect(200)).body.refundStatus).toBe("COMPLETED");
    }
  });

  it("puts a Care Desk refund on a cash on delivery order on the ledger for a manual payout", async () => {
    const { orderId, ids } = await order(["speaker-boom"], "COD");
    await delivered(ids[0]!);
    const ticket = await t.http
      .post("/v1/support/tickets")
      .set(agent)
      .send({ subject: "Wants money back for a scratch", category: "Product quality", customerName: "Demo Shopper", orderId, body: "Customer reports a scratch on the speaker." })
      .expect(201);
    const acted = await t.http.post(`/v1/support/tickets/${ticket.body.id}/actions`).set(agent).send({ kind: "REFUND", amountPaise: 20_000, destination: "SOURCE", reason: "damaged" }).expect(200);
    const action = acted.body.actions.find((a: { kind: string }) => a.kind === "REFUND");
    expect(action.status).toBe("PROCESSING");
    const [pending] = await refundsOf(orderId);
    expect(pending).toMatchObject({ method: "MANUAL", status: "PENDING", amountPaise: 20_000 });

    // finance pays it and records the reference on the payments page
    await t.http.post(`${A}/refunds/${pending!.id}/mark-paid`).set(staff).send({ reference: "UTR99887766" }).expect(200);
    await t.http.post(`${A}/refunds/${pending!.id}/mark-paid`).set(staff).send({ reference: "UTR99887766" }).expect(409);
    expect((await refundsOf(orderId))[0]).toMatchObject({ status: "COMPLETED", reference: "UTR99887766" });
    const later = await t.http.get(`/v1/support/tickets/${ticket.body.id}`).set(agent).expect(200);
    expect(later.body.actions.find((a: { id: string }) => a.id === action.id).status).toBe("COMPLETED");
  });
});

describe("true refund status for staff", () => {
  it("shows staff a refund that needs attention, and the customer that it is processing", async () => {
    const { ids } = await order(["cushions-linen"]);
    await delivered(ids[0]!);
    const r = (
      await t.http
        .post("/v1/me/returns")
        .set(shopper)
        .send({ orderItemId: ids[0], qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "SOURCE", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
        .expect(201)
    ).body;
    await t.http.post(`${A}/returns/${r.id}/pickup`).set(staff).send({ to: "RECEIVED" }).expect(200);
    await t.http.post(`${A}/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(200);
    const [row] = await db.select({ refundId: returns.refundId }).from(returns).where(eq(returns.id, r.id));
    await db.update(refunds).set({ status: "NEEDS_ATTENTION" }).where(eq(refunds.id, row!.refundId!));

    expect((await t.http.get(`${A}/returns/${r.id}`).set(staff).expect(200)).body.refundStatus).toBe("NEEDS_ATTENTION");
    const list = await t.http.get(`${A}/returns`).set(staff).expect(200);
    expect(list.body.find((x: { id: string }) => x.id === r.id).refundStatus).toBe("NEEDS_ATTENTION");
    expect((await t.http.get(`/v1/me/returns/${r.id}`).set(shopper).expect(200)).body.refundStatus).toBe("PROCESSING");
  });
});

describe("delivery address", () => {
  const address = { name: "Demo Shopper", phone: "9845012345", line1: "4th Floor, 22 Residency Road", city: "Bengaluru", state: "Karnataka", pincode: "560025", type: "WORK" };
  const saveAreas = (areas: object) => t.http.put(`${A}/settings`).set(staff).send({ ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery, areas } }).expect(200);

  it("can be changed before the parcel is booked, and is locked once it has an AWB", async () => {
    const { orderId, ids, order: o } = await order(["lamp-arc"]);
    await transition([ids[0]!], "ACCEPTED").expect(200);
    const r = await t.http.patch(`${A}/orders/${orderId}/address`).set(staff).send(address).expect(200);
    expect(r.body.address).toMatchObject({ line1: address.line1, pincode: "560025", type: "WORK" });
    expect(r.body.addressEditable).toBe(true);
    const [saved] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(saved!.address).toMatchObject({ line1: address.line1, pincode: "560025", type: "WORK" });
    const audit = await t.http.get(`${A}/audit`).query({ action: "order.address", entityId: orderId }).set(staff).expect(200);
    expect(audit.body.items[0].changes).toMatchObject({ line1: [o.address.line1, address.line1], pincode: [o.address.pincode, "560025"] });

    // a bad phone or pincode is refused like on a customer address
    await t.http.patch(`${A}/orders/${orderId}/address`).set(staff).send({ ...address, pincode: "012345" }).expect(422);
    await t.http.patch(`${A}/orders/${orderId}/address`).set(staff).send({ ...address, phone: "12" }).expect(422);

    for (const to of ["PACKED", "READY_TO_SHIP"]) await transition([ids[0]!], to).expect(200);
    const locked = await t.http.patch(`${A}/orders/${orderId}/address`).set(staff).send({ ...address, line1: "Somewhere else 1" }).expect(409);
    expect(locked.body.code).toBe("ADDRESS_LOCKED");
    expect((await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200)).body.addressEditable).toBe(false);
  });

  it("is locked while the parcel is being booked, and once the courier has a partial booking", async () => {
    // a booking in flight: the edit is refused until the courier answers
    const inFlight = await order(["lamp-arc"]);
    for (const to of ["ACCEPTED", "PACKED"]) await transition([inFlight.ids[0]!], to).expect(200);
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((r) => (entered = r));
    const gate = new Promise<void>((r) => (release = r));
    courier.onBook = async () => {
      entered();
      await gate;
    };
    try {
      const booking = transition([inFlight.ids[0]!], "READY_TO_SHIP");
      const done = booking.then((r) => r);
      await started;
      const refused = await t.http.patch(`${A}/orders/${inFlight.orderId}/address`).set(staff).send(address).expect(409);
      expect(refused.body.code).toBe("ADDRESS_LOCKED");
      release();
      expect((await done).body.results[0]).toMatchObject({ ok: true, status: "READY_TO_SHIP" });
    } finally {
      courier.onBook = null;
    }

    // the courier made its order, then the AWB step failed: the courier has the old address, so it stays locked
    const partial = await order(["mugs-stone"]);
    for (const to of ["ACCEPTED", "PACKED"]) await transition([partial.ids[0]!], to).expect(200);
    courier.onBook = async (_r, save) => {
      await save({ carrierOrderRef: "CO-PARTIAL-1", shipmentRef: "SH-PARTIAL-1" });
      throw new Error("The courier could not assign an AWB");
    };
    try {
      expect((await transition([partial.ids[0]!], "READY_TO_SHIP").expect(200)).body.results[0]).toMatchObject({ ok: false });
    } finally {
      courier.onBook = null;
    }
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, partial.ids[0]!));
    expect(item).toMatchObject({ status: "PACKED", carrierOrderRef: "CO-PARTIAL-1", awb: null });
    expect((await t.http.patch(`${A}/orders/${partial.orderId}/address`).set(staff).send(address).expect(409)).body.code).toBe("ADDRESS_LOCKED");
    expect((await t.http.get(`${A}/orders/${partial.orderId}`).set(staff).expect(200)).body.addressEditable).toBe(false);
  });

  it("calls a booking off when the address changed after the courier was given it", async () => {
    const o = await order(["vase-ceramic"]);
    for (const to of ["ACCEPTED", "PACKED"]) await transition([o.ids[0]!], to).expect(200);
    courier.cancelled = [];
    courier.onBook = async (request, save) => {
      expect(request.address.line1).toBe(o.order.address.line1);
      // an edit that landed after the courier was handed the old address
      await db.update(orders).set({ address: { ...o.order.address, line1: "Changed meanwhile 9" } }).where(eq(orders.id, o.orderId));
      await save({ carrierOrderRef: "CO-STALE-1", shipmentRef: "SH-STALE-1" });
    };
    try {
      const r = await transition([o.ids[0]!], "READY_TO_SHIP").expect(200);
      expect(r.body.results[0]).toMatchObject({ ok: false, error: expect.stringContaining("address changed") });
    } finally {
      courier.onBook = null;
    }
    expect(courier.cancelled).toEqual([{ carrierOrderRef: "CO-STALE-1", awb: null }]);
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, o.ids[0]!));
    expect(item).toMatchObject({ status: "PACKED", carrierOrderRef: null, shipmentRef: null, awb: null });
    // booking again ships to the new address
    let shippedTo = "";
    courier.onBook = async (request) => {
      shippedTo = request.address.line1;
    };
    try {
      expect((await transition([o.ids[0]!], "READY_TO_SHIP").expect(200)).body.results[0]).toMatchObject({ ok: true });
    } finally {
      courier.onBook = null;
    }
    expect(shippedTo).toBe("Changed meanwhile 9");
  });

  it("refuses a pincode we do not deliver to, and a cash on delivery order where cash is not taken", async () => {
    const prepaid = await order(["mugs-stone"]);
    const cod = await order(["speaker-boom"], "COD");
    await saveAreas({ blocked: ["7820"], noCod: ["79"], extraDays: [] });
    try {
      const blocked = await t.http.patch(`${A}/orders/${prepaid.orderId}/address`).set(staff).send({ ...address, pincode: "782001" }).expect(422);
      expect(blocked.body.code).toBe("PINCODE_UNSERVICEABLE");
      const noCod = await t.http.patch(`${A}/orders/${cod.orderId}/address`).set(staff).send({ ...address, pincode: "791001" }).expect(422);
      expect(noCod.body.code).toBe("COD_UNAVAILABLE");
      // the prepaid order may go there
      await t.http.patch(`${A}/orders/${prepaid.orderId}/address`).set(staff).send({ ...address, pincode: "791001" }).expect(200);
    } finally {
      await saveAreas({ blocked: [], noCod: [], extraDays: [] });
    }
  });
});

describe("internal notes", () => {
  it("are for staff only and never reach the customer", async () => {
    const { orderId } = await order(["vase-ceramic"]);
    const secret = "Customer called twice, sounds annoyed, check the courier";
    const added = await t.http.post(`${A}/orders/${orderId}/notes`).set(staff).send({ body: secret }).expect(201);
    expect(added.body).toMatchObject({ body: secret, authorName: expect.any(String) });
    await t.http.post(`${A}/orders/${orderId}/notes`).set(staff).send({ body: "" }).expect(422);
    await t.http.post(`${A}/orders/${orderId}/notes`).set(staff).send({ body: "x".repeat(2001) }).expect(422);

    const list = await t.http.get(`${A}/orders/${orderId}/notes`).set(auditor).expect(200);
    expect(list.body.map((n: { body: string }) => n.body)).toContain(secret);
    await t.http.get(`${A}/orders/${orderId}/notes`).set(shopper).expect(403);
    await t.http.post(`${A}/orders/${orderId}/notes`).set(shopper).send({ body: "hi" }).expect(403);

    const mine = await t.http.get(`/v1/me/orders/${orderId}`).set(shopper).expect(200);
    expect(mine.body).not.toHaveProperty("notes");
    expect(JSON.stringify(mine.body)).not.toContain(secret);
    const listMine = await t.http.get("/v1/me/orders").set(shopper).expect(200);
    expect(JSON.stringify(listMine.body)).not.toContain(secret);
    const audit = await t.http.get(`${A}/audit`).query({ action: "order.note", entityId: orderId }).set(staff).expect(200);
    expect(audit.body.items).toHaveLength(1);
  });
});

describe("lost and returned parcels", () => {
  it("refunds a lost prepaid line without restocking it, and wants a note", async () => {
    const { orderId, ids, order: o, items } = await order(["lamp-arc", "mugs-stone"]);
    const lost = items.find((i) => i.id === ids[0])!;
    await shipped(lost.id);
    const before = await stockOf(lost.offerId);

    const noNote = await transition([lost.id], "LOST").expect(422);
    expect(noNote.body.code).toBe("REASON_REQUIRED");
    const r = await transition([lost.id], "LOST", "Courier confirmed the parcel is lost").expect(200);
    expect(r.body.results[0]).toMatchObject({ ok: true, status: "LOST" });
    expect(await stockOf(lost.offerId)).toBe(before);

    const line = lost.unitPricePaise * lost.qty;
    const share = Math.round((o.couponDiscountPaise * line) / o.subtotalPaise);
    const rows = await refundsOf(orderId);
    expect(rows).toEqual([expect.objectContaining({ amountPaise: line - share, orderItemId: lost.id, status: "PENDING" })]);
    await runJobs(t);
    expect((await refundsOf(orderId))[0]!.status).toBe("COMPLETED");
    const detail = await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200);
    expect(detail.body.events.find((e: { toStatus: string }) => e.toStatus === "LOST")).toMatchObject({ note: "Courier confirmed the parcel is lost", actor: "STAFF" });
    const audit = await t.http.get(`${A}/audit`).query({ action: "order.lost" }).set(staff).expect(200);
    expect(audit.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("restocks a parcel back at the store and refunds it when prepaid", async () => {
    const { orderId, ids, items } = await order(["cushions-linen"]);
    const item = items.find((i) => i.id === ids[0])!;
    await shipped(item.id);
    await scan(item.id, "RTO_IN_TRANSIT");
    const before = await stockOf(item.offerId);
    const r = await transition([item.id], "RTO_RECEIVED", "Parcel back at the warehouse, sealed").expect(200);
    expect(r.body.results[0]).toMatchObject({ ok: true, status: "RTO_RECEIVED" });
    expect(await stockOf(item.offerId)).toBe(before + item.qty);
    const rows = await refundsOf(orderId);
    expect(rows).toEqual([expect.objectContaining({ amountPaise: item.unitPricePaise * item.qty, orderItemId: item.id })]);
  });

  it("restocks a returned cash on delivery parcel and refunds nothing", async () => {
    const { orderId, ids, items } = await order(["speaker-boom"], "COD");
    const item = items.find((i) => i.id === ids[0])!;
    await shipped(item.id);
    await scan(item.id, "RTO_IN_TRANSIT");
    const before = await stockOf(item.offerId);
    await transition([item.id], "RTO_RECEIVED", "Customer refused the parcel").expect(200);
    expect(await stockOf(item.offerId)).toBe(before + item.qty);
    expect(await refundsOf(orderId)).toEqual([]);
    const [p] = await db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.provider, "COD")));
    expect(p!.status).toBe("COD_PENDING");
  });

  it("does not restock or refund twice when the courier repeats a scan", async () => {
    const shipping = t.app.get(ShippingService);
    const back = await order(["cushions-linen"]);
    const backItem = back.items.find((i) => i.id === back.ids[0])!;
    await shipped(backItem.id);
    const [{ awb }] = (await db.select({ awb: orderItems.awb }).from(orderItems).where(eq(orderItems.id, backItem.id))) as [{ awb: string }];
    const stock = await stockOf(backItem.offerId);
    for (let i = 0; i < 2; i++) await shipping.apply({ awb, raw: "RTO Delivered", status: "RTO_RECEIVED" });
    expect(await stockOf(backItem.offerId)).toBe(stock + backItem.qty);
    expect(await refundsOf(back.orderId)).toHaveLength(1);

    const lost = await order(["lamp-arc"]);
    await shipped(lost.ids[0]!);
    const [{ awb: lostAwb }] = (await db.select({ awb: orderItems.awb }).from(orderItems).where(eq(orderItems.id, lost.ids[0]!))) as [{ awb: string }];
    const lostStock = await stockOf(lost.items[0]!.offerId);
    for (let i = 0; i < 2; i++) await shipping.apply({ awb: lostAwb, raw: "Lost", status: "LOST" });
    expect(await stockOf(lost.items[0]!.offerId)).toBe(lostStock);
    expect(await refundsOf(lost.orderId)).toHaveLength(1);
    // and staff cannot mark it again either
    expect((await transition([lost.ids[0]!], "LOST", "Lost again").expect(200)).body.results[0]).toMatchObject({ ok: false });
  });

  it("offers Mark lost and Received back to staff", async () => {
    const { orderId, ids } = await order(["vase-ceramic"]);
    await shipped(ids[0]!);
    let detail = await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200);
    expect(detail.body.items[0].allowedActions).toEqual(["LOST"]);
    await scan(ids[0]!, "RTO_IN_TRANSIT");
    detail = await t.http.get(`${A}/orders/${orderId}`).set(staff).expect(200);
    expect(detail.body.items[0].allowedActions).toEqual(["RTO_RECEIVED"]);
  });
});

describe("read-only roles", () => {
  it("lets an Auditor read but change nothing", async () => {
    const { orderId } = await order(["mugs-stone"]);
    await t.http.get(`${A}/orders/${orderId}`).set(auditor).expect(200);
    const [r] = await db.insert(refunds).values({ paymentId: (await db.select().from(payments).where(eq(payments.orderId, orderId)))[0]!.id, orderId, amountPaise: 100, status: "NEEDS_ATTENTION", reason: "test" }).returning();
    const writes: [string, () => PromiseLike<{ status: number }>][] = [
      ["refund", () => refund(orderId, { amountPaise: 100, reason: "Goodwill", method: "SOURCE" }, auditor)],
      ["retry", () => t.http.post(`${A}/refunds/${r!.id}/retry`).set(auditor)],
      ["mark paid", () => t.http.post(`${A}/refunds/${r!.id}/mark-paid`).set(auditor).send({ reference: "UTR12345678" })],
      ["return mark paid", () => t.http.post(`${A}/returns/RT-70001/refund/mark-paid`).set(auditor).send({ reference: "UTR12345678" })],
      ["address", () => t.http.patch(`${A}/orders/${orderId}/address`).set(auditor).send({})],
      ["note", () => t.http.post(`${A}/orders/${orderId}/notes`).set(auditor).send({ body: "hello" })],
      ["lost", () => t.http.post(`${A}/order-items/transition`).set(auditor).send({ ids: [randomUUID()], to: "LOST", reason: "Lost it" })],
    ];
    for (const [label, call] of writes) expect([label, (await call()).status]).toEqual([label, 403]);
  });
});
