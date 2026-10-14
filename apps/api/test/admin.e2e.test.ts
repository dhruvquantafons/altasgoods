import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { careAgentEmail } from "../src/db/demo.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let shopper: Record<string, string>;
let agent: Record<string, string>;
const A = "/v1/admin";

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  agent = (await signIn(t.http, careAgentEmail(0))).auth;
});
afterAll(() => t.close());

async function quoteFor(slug: string) {
  const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  return (await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId: addresses.body[0].id, lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] }).expect(200)).body;
}

describe("settings", () => {
  it("starts from the defaults and is for admins only", async () => {
    const r = await t.http.get(`${A}/settings`).set(staff).expect(200);
    expect(r.body).toMatchObject({ ...DEFAULT_SETTINGS, updatedAt: null, updatedBy: null });
    await t.http.get(`${A}/settings`).set(shopper).expect(403);
    await t.http.get(`${A}/settings`).set(agent).expect(403);
    const pub = await t.http.get("/v1/storefront/settings").expect(200);
    expect(pub.body.company.legalName).toBe(DEFAULT_SETTINGS.company.legalName);
    expect(pub.body).not.toHaveProperty("reviews");
  });

  it("changes what checkout charges for delivery, and the cash on delivery limit", async () => {
    // tea is well under the free delivery threshold, so it pays the fee
    const before = await quoteFor("tea-assam");
    expect(before.deliveryFeePaise).toBe(DEFAULT_SETTINGS.delivery.feePaise);

    const next = { ...DEFAULT_SETTINGS, delivery: { feePaise: 9_900, freeFromPaise: 1_000_000 }, cod: { maxOrderPaise: 100 } };
    const saved = await t.http.put(`${A}/settings`).set(staff).send(next).expect(200);
    expect(saved.body).toMatchObject({ delivery: next.delivery, updatedBy: "Kavya Iyer" });

    const after = await quoteFor("tea-assam");
    expect(after.deliveryFeePaise).toBe(9_900);
    expect(after.cod).toMatchObject({ available: false, reason: "Pay on delivery is available for orders up to ₹1" });

    await t.http.put(`${A}/settings`).set(staff).send({ ...next, company: { ...next.company, email: "not-an-email" } }).expect(422);
    await t.http.put(`${A}/settings`).set(staff).send(DEFAULT_SETTINGS).expect(200);
  });

  it("shows the storefront notice only while it is on", async () => {
    await t.http.put(`${A}/settings`).set(staff).send({ ...DEFAULT_SETTINGS, notice: { enabled: true, message: "Diwali dispatch: orders after 2 pm ship tomorrow" } }).expect(200);
    const pub = await t.http.get("/v1/storefront/settings").expect(200);
    expect(pub.body.notice).toEqual({ enabled: true, message: "Diwali dispatch: orders after 2 pm ship tomorrow" });
    await t.http.put(`${A}/settings`).set(staff).send(DEFAULT_SETTINGS).expect(200);
  });
});

describe("audit log", () => {
  it("records who changed what, with the fields that changed", async () => {
    const product = (await t.http.get(`${A}/products/p-headphones-studio`).set(staff).expect(200)).body;
    await t.http.patch(`${A}/products/p-headphones-studio`).set(staff).send({ stock: product.stock + 3 }).expect(200);
    await t.http.post(`${A}/brands`).set(staff).send({ name: `Audit Brand ${randomUUID().slice(0, 6)}` }).expect(201);

    const log = await t.http.get(`${A}/audit`).set(staff).expect(200);
    const edit = log.body.items.find((e: { action: string }) => e.action === "product.update");
    expect(edit).toMatchObject({ actorName: "Kavya Iyer", entityType: "product", entityId: "p-headphones-studio", changes: { stock: [product.stock, product.stock + 3] } });
    expect(log.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["brand.create", "settings.update"]));
    expect(log.body.actors).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Kavya Iyer" })]));

    const products = await t.http.get(`${A}/audit`).query({ action: "product" }).set(staff).expect(200);
    expect(products.body.items.every((e: { action: string }) => e.action.startsWith("product."))).toBe(true);
    const settings = await t.http.get(`${A}/audit`).query({ entityType: "settings" }).set(staff).expect(200);
    expect(settings.body.items[0].changes).toHaveProperty("notice.enabled");
    await t.http.get(`${A}/audit`).set(shopper).expect(403);
  });

  it("does not log an edit that changes nothing", async () => {
    const product = (await t.http.get(`${A}/products/p-tea-assam`).set(staff).expect(200)).body;
    const before = (await t.http.get(`${A}/audit`).query({ entityId: "p-tea-assam" }).set(staff).expect(200)).body.total;
    await t.http.patch(`${A}/products/p-tea-assam`).set(staff).send({ stock: product.stock }).expect(200);
    const after = (await t.http.get(`${A}/audit`).query({ entityId: "p-tea-assam" }).set(staff).expect(200)).body.total;
    expect(after).toBe(before);
  });
});

describe("overview, customers and payments", () => {
  async function paidOrder(slug: string) {
    const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
    const p = await t.http.get(`/v1/products/${slug}`).expect(200);
    const placed = await t.http
      .post("/v1/orders")
      .set(shopper)
      .set("Idempotency-Key", randomUUID())
      .send({ addressId: addresses.body[0].id, paymentMethod: "UPI", lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] })
      .expect(201);
    await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    return placed.body.order as { id: string; totalPaise: number };
  }

  it("counts today's sales and the work waiting", async () => {
    const before = (await t.http.get(`${A}/overview`).set(staff).expect(200)).body;
    const order = await paidOrder("tea-assam");
    const after = (await t.http.get(`${A}/overview`).set(staff).expect(200)).body;
    expect(after.today.orders).toBe(before.today.orders + 1);
    expect(after.today.revenuePaise).toBe(before.today.revenuePaise + order.totalPaise);
    expect(after.work.toAccept).toBe(before.work.toAccept + 1);
    expect(after.series).toHaveLength(14);
    expect(after.series.at(-1).orders).toBe(after.today.orders);
    expect(after.latestOrders[0].id).toBe(order.id);
    await t.http.get(`${A}/overview`).set(agent).expect(403);
  });

  it("lists payments with the gateway reference, and refunds", async () => {
    const order = await paidOrder("tea-assam");
    const list = (await t.http.get(`${A}/payments`).query({ q: order.id }).set(staff).expect(200)).body;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ orderId: order.id, status: "CAPTURED", provider: "SANDBOX", customer: { email: DEMO_CUSTOMER } });
    expect(list.summary.capturedTodayCount).toBeGreaterThan(0);
    const captured = (await t.http.get(`${A}/payments`).query({ status: "CAPTURED" }).set(staff).expect(200)).body;
    expect(captured.items.every((p: { status: string }) => p.status === "CAPTURED")).toBe(true);

    await t.http.post(`/v1/me/orders/${order.id}/cancel`).set(shopper).send({ reason: "Ordered by mistake" }).expect(200);
    const refunds = (await t.http.get(`${A}/refunds`).query({ q: order.id }).set(staff).expect(200)).body;
    expect(refunds.items[0]).toMatchObject({ orderId: order.id, amountPaise: order.totalPaise, method: "UPI" });
  });

  it("finds customers and blocks one, which signs them out and stops sign in", async () => {
    const found = (await t.http.get(`${A}/customers`).query({ q: "nikhil" }).set(staff).expect(200)).body;
    const someone = found.items[0] ?? (await t.http.get(`${A}/customers`).set(staff).expect(200)).body.items.find((c: { email: string }) => c.email !== DEMO_CUSTOMER);
    const id = someone.id as string;

    // give them a password we know, then sign them in
    const { hashPassword } = await import("../src/modules/auth/password.js");
    const { createDb } = await import("../src/db/client.js");
    const { users } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { env } = await import("../src/config/env.js");
    const { db, pool } = createDb(env().TEST_DATABASE_URL);
    await db.update(users).set({ passwordHash: await hashPassword("block-me-1234"), status: "ACTIVE" }).where(eq(users.id, id));
    await pool.end();
    const session = await signIn(t.http, someone.email, "block-me-1234");

    const blocked = (await t.http.patch(`${A}/customers/${id}`).set(staff).send({ status: "BLOCKED", reason: "Chargeback abuse" }).expect(200)).body;
    expect(blocked.status).toBe("BLOCKED");
    await t.http.get("/v1/me").set(session.auth).expect(401);
    const refused = await t.http.post("/v1/auth/login").send({ email: someone.email, password: "block-me-1234" }).expect(403);
    expect(refused.body.code).toBe("ACCOUNT_BLOCKED");

    await t.http.patch(`${A}/customers/${id}`).set(staff).send({ status: "ACTIVE" }).expect(200);
    await signIn(t.http, someone.email, "block-me-1234");
    const log = (await t.http.get(`${A}/audit`).query({ entityId: id }).set(staff).expect(200)).body;
    expect(log.items.map((e: { action: string }) => e.action)).toEqual(["customer.unblock", "customer.block"]);
    await t.http.patch(`${A}/customers/${id}`).set(agent).send({ status: "BLOCKED" }).expect(403);
  });
});
