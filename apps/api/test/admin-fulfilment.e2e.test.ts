import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { orderItems } from "../src/db/schema.js";
import { createTestApp, DEMO_AGENT, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let agent: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  agent = (await signIn(t.http, DEMO_AGENT)).auth;
  const a = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  addressId = a.body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

/** A paid order line for one unit of a product. */
async function paidLine(slug: string) {
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
  return { orderId, itemId: item!.id };
}

const transition = (ids: string[], to: string) => t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids, to }).expect(200);

/** Store staff fulfil the line, then the simulated courier delivers it. */
async function deliveredLine(slug: string) {
  const line = await paidLine(slug);
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await transition([line.itemId], to);
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) await t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId: line.itemId, to }).expect(200);
  return line;
}

const returnRequest = (itemId: string) => ({
  orderItemId: itemId,
  qty: 1,
  reasonCode: "DEFECTIVE",
  reasonLabel: "Item is defective or not working",
  fault: "STORE",
  resolution: "REFUND",
  refundTo: "SOURCE",
  pickupDate: today(),
  pickupSlot: "10 AM to 1 PM",
});

describe("store fulfilment", () => {
  it("lets staff accept, pack and ready any order for pickup", async () => {
    const { orderId, itemId } = await paidLine("lamp-arc");
    const list = await t.http.get("/v1/admin/order-items?status=NEW").set(staff).expect(200);
    const line = list.body.items.find((i: { id: string }) => i.id === itemId);
    expect(line).toBeDefined();

    const order = await t.http.get(`/v1/admin/orders/${orderId}`).set(staff).expect(200);
    expect(order.body.items[0].allowedActions).toEqual(expect.arrayContaining(["ACCEPTED", "CANCELLED"]));
    expect(order.body.address).toMatchObject({ phone: expect.any(String), line1: expect.any(String) });

    const skip = await transition([itemId], "PACKED");
    expect(skip.body.results[0]).toMatchObject({ ok: false });
    for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) expect((await transition([itemId], to)).body.results[0]).toMatchObject({ ok: true, status: to });

    const ready = await t.http.get(`/v1/admin/orders/${orderId}`).set(staff).expect(200);
    expect(ready.body.items[0].awb).toMatch(/^[A-Z]{3}\d{10}$/);
    const events = ready.body.events.filter((e: { actor: string }) => e.actor === "STAFF").map((e: { toStatus: string }) => e.toStatus);
    expect(events).toEqual(["ACCEPTED", "PACKED", "READY_TO_SHIP"]);
  });

  it("asks for a reason before staff cancel a line", async () => {
    const { itemId } = await paidLine("mugs-stone");
    await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [itemId], to: "CANCELLED" }).expect(422);
    const r = await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [itemId], to: "CANCELLED", reason: "Damaged in the warehouse" }).expect(200);
    expect(r.body.results[0]).toMatchObject({ ok: true, status: "CANCELLED" });
  });

  it("is closed to shoppers and care agents", async () => {
    await t.http.get("/v1/admin/order-items").expect(401);
    await t.http.get("/v1/admin/order-items").set(shopper).expect(403);
    await t.http.get("/v1/admin/order-items").set(agent).expect(403);
    await t.http.get("/v1/admin/returns").set(agent).expect(403);
  });
});

describe("store returns", () => {
  it("lets staff decide a late damage claim", async () => {
    const { itemId } = await deliveredLine("vase-ceramic");
    await db.update(orderItems).set({ deliveredAt: sql`now() - interval '40 days'` }).where(eq(orderItems.id, itemId));
    const late = (await t.http.post("/v1/me/returns").set(shopper).send(returnRequest(itemId)).expect(201)).body;
    expect(late.status).toBe("PENDING_REVIEW");

    const queue = await t.http.get("/v1/admin/returns?status=PENDING_REVIEW").set(staff).expect(200);
    expect(queue.body.map((r: { id: string }) => r.id)).toContain(late.id);
    const approved = await t.http.post(`/v1/admin/returns/${late.id}/decision`).set(staff).send({ approve: true, note: "Goodwill, first claim" }).expect(200);
    expect(approved.body.status).toBe("PICKUP_SCHEDULED");
    expect(approved.body.events.some((e: { actor: string; toStatus: string }) => e.actor === "STAFF" && e.toStatus === "APPROVED")).toBe(true);
  });

  it("lets staff pass the quality check and release the refund", async () => {
    const { itemId } = await deliveredLine("cushions-linen");
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(returnRequest(itemId)).expect(201)).body;
    await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(409);
    for (const to of ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"]) await t.http.post(`/v1/dev/returns/${r.id}/advance`).set(staff).send({ to }).expect(200);
    const passed = await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: true }).expect(200);
    expect(passed.body.status).toBe("COMPLETED");
    expect(passed.body.refundStatus).toBe("COMPLETED");
    const [item] = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, itemId));
    expect(item!.status).toBe("RETURNED");
  });
});
