import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { sampleSignaturePng } from "../src/db/sample-files.js";
import { orderItems, orders } from "../src/db/schema.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const today = () => new Date().toISOString().slice(0, 10);

/** A delivered UPI order line. */
async function deliveredLine(slug: string) {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);

  const placed = await t.http
    .post("/v1/orders")
    .set(shopper)
    .set("Idempotency-Key", randomUUID())
    .send({ addressId, paymentMethod: "UPI", lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] })
    .expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  const orderId = placed.body.order.id as string;
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [item!.id], to }).expect(200);
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) await t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId: item!.id, to }).expect(200);
  return { orderId, itemId: item!.id };
}

const request = (itemId: string, extra: object = {}) => ({
  orderItemId: itemId,
  qty: 1,
  reasonCode: "DEFECTIVE",
  reasonLabel: "Item is defective or not working",
  fault: "STORE",
  resolution: "REFUND",
  refundTo: "SOURCE",
  pickupDate: today(),
  pickupSlot: "10 AM to 1 PM",
  ...extra,
});
const advance = (id: string, to: string) => t.http.post(`/v1/dev/returns/${id}/advance`).set(staff).send({ to }).expect(200);

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  const a = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  addressId = a.body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

describe("returns", () => {
  it("runs from request through pickup, the store's check and the refund", async () => {
    const { orderId, itemId } = await deliveredLine("airfryer-crisp");
    const photo = await t.http.post("/v1/me/uploads").set(shopper).attach("file", sampleSignaturePng("crack"), "crack.png").expect(201);
    const created = await t.http.post("/v1/me/returns").set(shopper).send(request(itemId, { photoIds: [photo.body.id], comments: "Stops after a minute" })).expect(201);
    const r = created.body;
    expect(r.id).toMatch(/^RT-7\d{4}$/);
    expect(r).toMatchObject({ status: "PICKUP_SCHEDULED", resolution: "REFUND", instantRefund: false, cancellable: true });
    expect(r.awb).toMatch(/^BBR\d{10}$/);
    expect(r.refundAmountPaise).toBeGreaterThan(0);
    expect(r.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(["REQUESTED", "APPROVED", "PICKUP_SCHEDULED"]);
    const [item] = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, itemId));
    expect(item!.status).toBe("RETURN_REQUESTED");
    expect((await t.http.post("/v1/me/returns").set(shopper).send(request(itemId)).expect(409)).body.code).toBe("RETURN_EXISTS");

    // the store sees it, with the customer's photo
    const list = await t.http.get("/v1/admin/returns").set(staff).expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toContain(r.id);
    await t.http.get(`/v1/admin/returns/${r.id}/photos/${photo.body.id}`).set(staff).expect(200);

    await advance(r.id, "OUT_FOR_PICKUP");
    await advance(r.id, "PICKED_UP");
    await t.http.post(`/v1/me/returns/${r.id}/cancel`).set(shopper).expect(409);
    await advance(r.id, "IN_TRANSIT");
    await advance(r.id, "RECEIVED");
    const done = await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(200);
    expect(done.body).toMatchObject({ status: "COMPLETED" });
    expect(["COMPLETED", "PROCESSING"]).toContain(done.body.refundStatus);
    const [after] = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, itemId));
    expect(after!.status).toBe("RETURNED");
    const [order] = await db.select({ paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId));
    expect(order!.paymentStatus).toBe("REFUNDED");
  });

  it("refunds low value returns at the doorstep, once", async () => {
    const { itemId } = await deliveredLine("cookware-pan");
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId, { reasonCode: "NO_LONGER_NEEDED", reasonLabel: "No longer needed", fault: "CUSTOMER" })).expect(201)).body;
    expect(r.instantRefund).toBe(true);
    await advance(r.id, "OUT_FOR_PICKUP");
    const picked = await advance(r.id, "PICKED_UP");
    expect(picked.body.refundStatus).not.toBeNull();
    await advance(r.id, "IN_TRANSIT");
    await advance(r.id, "RECEIVED");
    const done = await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(200);
    expect(done.body.refundStatus).toBe(picked.body.refundStatus);
  });

  it("can be cancelled before pickup, and the item stays delivered", async () => {
    const { itemId } = await deliveredLine("backpack-urban");
    const [before] = await db.select({ deliveredAt: orderItems.deliveredAt }).from(orderItems).where(eq(orderItems.id, itemId));
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId, { resolution: "REPLACEMENT", refundTo: undefined })).expect(201)).body;
    const cancelled = await t.http.post(`/v1/me/returns/${r.id}/cancel`).set(shopper).expect(200);
    expect(cancelled.body.status).toBe("CANCELLED");
    const [item] = await db.select({ status: orderItems.status, deliveredAt: orderItems.deliveredAt }).from(orderItems).where(eq(orderItems.id, itemId));
    expect(item).toMatchObject({ status: "DELIVERED", deliveredAt: before!.deliveredAt });
  });

  it("sends late damage claims to the store and closes late change of mind", async () => {
    const { itemId } = await deliveredLine("speaker-boom");
    await db.update(orderItems).set({ deliveredAt: sql`now() - interval '40 days'` }).where(eq(orderItems.id, itemId));
    const closed = await t.http.post("/v1/me/returns").set(shopper).send(request(itemId, { reasonCode: "NO_LONGER_NEEDED", reasonLabel: "No longer needed", fault: "CUSTOMER" })).expect(422);
    expect(closed.body.code).toBe("RETURN_WINDOW_CLOSED");
    const late = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId)).expect(201)).body;
    expect(late.status).toBe("PENDING_REVIEW");
    await t.http.post(`/v1/admin/returns/${late.id}/decision`).set(staff).send({ approve: false }).expect(422);
    const rejected = await t.http.post(`/v1/admin/returns/${late.id}/decision`).set(staff).send({ approve: false, note: "Physical damage from a fall, not covered" }).expect(200);
    expect(rejected.body).toMatchObject({ status: "REJECTED", decisionNote: "Physical damage from a fall, not covered" });
    const [item] = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, itemId));
    expect(item!.status).toBe("DELIVERED");
  });

  it("records a failed QC with the store's evidence", async () => {
    const { itemId } = await deliveredLine("headphones-studio");
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId)).expect(201)).body;
    for (const to of ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"]) await advance(r.id, to);
    await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: false }).expect(422);
    const failed = await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: false, note: "Jar is missing from the box" }).expect(200);
    expect(failed.body).toMatchObject({ status: "QC_FAILED", qcNote: "Jar is missing from the box", refundStatus: null });
  });

  it("moves a pickup and lists every refund", async () => {
    const { itemId } = await deliveredLine("earbuds-pods");
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId)).expect(201)).body;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const moved = await t.http.post(`/v1/me/returns/${r.id}/reschedule`).set(shopper).send({ pickupDate: tomorrow, pickupSlot: "3 PM to 7 PM" }).expect(200);
    expect(moved.body).toMatchObject({ pickupDate: tomorrow, pickupSlot: "3 PM to 7 PM", status: "PICKUP_SCHEDULED" });
    const refunds = await t.http.get("/v1/me/refunds").set(shopper).expect(200);
    expect(refunds.body.some((f: { source: string; returnId: string }) => f.source === "RETURN" && f.returnId)).toBe(true);
  });

  it("keeps returns private to their customer and the store", async () => {
    const mine = await t.http.get("/v1/me/returns").set(shopper).expect(200);
    const other = (await signIn(t.http, "9700044001", "Someone Else")).auth;
    await t.http.get(`/v1/me/returns/${mine.body[0].id}`).set(other).expect(404);
    await t.http.get("/v1/me/returns").expect(401);
    await t.http.get("/v1/admin/returns").set(shopper).expect(403);
  });
});
