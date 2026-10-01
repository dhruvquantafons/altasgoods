import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { samplePdf } from "../src/db/sample-files.js";
import { orders, supportTickets, users } from "../src/db/schema.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let revathi: Record<string, string>; // L2, limit Rs 10,000
let kabir: Record<string, string>; // L1, limit Rs 2,000
let arvind: Record<string, string>; // supervisor
let orderId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const S = "/v1/support";
const ME = "/v1/me/support";

/** A paid UPI order of the demo shopper, so refunds go back through the provider. */
async function paidOrder(qty: number) {
  const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  const p = await t.http.get("/v1/products/headphones-studio").expect(200);
  const offer = p.body.offers.find((o: { isFeatured: boolean }) => o.isFeatured);
  const placed = await t.http
    .post("/v1/orders")
    .set(shopper)
    .set("Idempotency-Key", randomUUID())
    .send({ addressId: addresses.body[0].id, paymentMethod: "UPI", lines: [{ offerId: offer.id, qty, variant: "" }] })
    .expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  return placed.body.order.id as string;
}

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  revathi = (await signIn(t.http, "9811020001")).auth;
  kabir = (await signIn(t.http, "9811020002")).auth;
  arvind = (await signIn(t.http, "9811020099")).auth;
  orderId = await paidOrder(1);
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

describe("Care Desk queue", () => {
  it("imports the ticket history with conversations and lets only staff in", async () => {
    await t.http.get(`${S}/tickets`).set(shopper).expect(403);
    const all = await t.http.get(`${S}/tickets`).query({ view: "all" }).set(revathi).expect(200);
    expect(all.body.total).toBe(48);
    expect(all.body.counts.open).toBeGreaterThan(0);
    const mine = await t.http.get(`${S}/tickets`).query({ view: "mine" }).set(revathi).expect(200);
    expect(mine.body.items.every((i: { assignee: { name: string } }) => i.assignee.name === "Revathi Subramanian")).toBe(true);
    const agents = await t.http.get(`${S}/agents`).set(staff).expect(200);
    expect(agents.body.map((a: { name: string }) => a.name)).toEqual(expect.arrayContaining(["Revathi Subramanian", "Arvind Menon", "Kavya Iyer"]));
    const one = await t.http.get(`${S}/tickets/${all.body.items[0].id}`).set(revathi).expect(200);
    expect(one.body.messages.length).toBeGreaterThan(0);
    expect(one.body.you).toMatchObject({ name: "Revathi Subramanian", level: "L2", refundLimitPaise: 1_000_000 });
  });
});

describe("a customer conversation, end to end", () => {
  let id: string;

  it("starts from My Account with the order attached", async () => {
    await t.http.post(`${ME}/tickets`).set(shopper).send({ subject: "Headphones", category: "Product quality", orderId: "BB-NOT-MINE", body: "Left ear cup is silent" }).expect(404);
    const created = await t.http
      .post(`${ME}/tickets`)
      .set(shopper)
      .send({ subject: "Left ear cup has no sound", category: "Product quality", orderId, body: "The left ear cup stopped working on day two." })
      .expect(201);
    id = created.body.id;
    expect(id).toMatch(/^TK-6\d{4}$/);
    expect(created.body).toMatchObject({ status: "NEW", canReply: true });
    const staffView = await t.http.get(`${S}/tickets/${id}`).set(revathi).expect(200);
    expect(staffView.body).toMatchObject({ status: "NEW", priority: "HIGH", assignee: null, allowedStatuses: ["OPEN", "RESOLVED", "CLOSED"] });
    expect(staffView.body.orderSnapshot.items[0].title).toMatch(/Auralis/);
  });

  it("a reply picks the ticket up, notes stay internal, and the customer's answer brings it back", async () => {
    let r = await t.http.post(`${S}/tickets/${id}/messages`).set(revathi).send({ kind: "NOTE", body: "Batch 24B has known driver issues" }).expect(200);
    expect(r.body.status).toBe("NEW");
    r = await t.http.post(`${S}/tickets/${id}/messages`).set(revathi).send({ kind: "REPLY", body: "Sorry about that. Could you share a photo of the serial label?", statusAfter: "PENDING_CUSTOMER" }).expect(200);
    expect(r.body).toMatchObject({ status: "PENDING_CUSTOMER", assignee: { name: "Revathi Subramanian" } });
    expect(r.body.firstResponseAt).not.toBeNull();
    expect(r.body.events.map((e: { type: string; toValue: string }) => `${e.type}:${e.toValue}`)).toEqual(
      expect.arrayContaining(["ASSIGNEE:Revathi Subramanian", "STATUS:OPEN", "STATUS:PENDING_CUSTOMER"]),
    );

    let mine = await t.http.get(`${ME}/tickets/${id}`).set(shopper).expect(200);
    expect(mine.body.messages.map((m: { author: string }) => m.author)).toContain("Revathi from BluBuy");
    expect(JSON.stringify(mine.body)).not.toContain("Batch 24B");

    const upload = await t.http.post(`${ME}/tickets/${id}/attachments`).set(shopper).attach("file", samplePdf("Serial label"), "serial.pdf").expect(201);
    mine = await t.http.post(`${ME}/tickets/${id}/messages`).set(shopper).send({ body: "Photo attached", attachmentIds: [upload.body.id] }).expect(200);
    expect(mine.body.messages.at(-1).attachments[0].name).toBe("serial.pdf");
    await t.http.get(`${ME}/attachments/${upload.body.id}`).set(shopper).expect(200);
    const back = await t.http.get(`${S}/tickets/${id}`).set(revathi).expect(200);
    expect(back.body.status).toBe("OPEN");
  });

  it("follows the spec's state machine", async () => {
    const bad = await t.http.patch(`${S}/tickets/${id}`).set(revathi).send({ status: "CLOSED" }).expect(409);
    expect(bad.body.code).toBe("INVALID_TRANSITION");
    const r = await t.http.patch(`${S}/tickets/${id}`).set(revathi).send({ priority: "URGENT" }).expect(200);
    expect(r.body.priority).toBe("URGENT");
    const fresh = await t.http.get(`${S}/tickets/${id}`).set(revathi).expect(200);
    expect(fresh.body.priority).toBe("URGENT");
  });

  it("refunds to the original payment within the agent's limit", async () => {
    const r = await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "REFUND", amountPaise: 50_000, destination: "SOURCE", reason: "damaged" }).expect(200);
    const refund = r.body.actions.find((a: { kind: string }) => a.kind === "REFUND");
    expect(["COMPLETED", "PROCESSING"]).toContain(refund.status);
    const [order] = await db.select({ paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId));
    expect(order!.paymentStatus).toBe("PARTIALLY_REFUNDED");
    const mine = await t.http.get(`${ME}/tickets/${id}`).set(shopper).expect(200);
    expect(mine.body.messages.map((m: { body: string }) => m.body)).toContain("We have initiated a refund of ₹500 to UPI.");
    const tooMuch = await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "REFUND", amountPaise: 99_999_999, destination: "SOURCE", reason: "damaged" }).expect(422);
    expect(tooMuch.body.code).toBe("AMOUNT_TOO_LARGE");
  });

  it("sends refunds above the limit to a supervisor, who is not the requester", async () => {
    const big = await paidOrder(2);
    const created = await t.http.post(`${ME}/tickets`).set(shopper).send({ subject: "Both units faulty", category: "Product quality", orderId: big, body: "Neither pair turns on." }).expect(201);
    const r = await t.http.post(`${S}/tickets/${created.body.id}/actions`).set(kabir).send({ kind: "REFUND", amountPaise: 300_000, destination: "SOURCE", reason: "damaged" }).expect(200);
    const pending = r.body.actions[0];
    expect(pending).toMatchObject({ status: "PENDING_APPROVAL", canApprove: false });
    await t.http.post(`${S}/actions/${pending.id}/approve`).set(kabir).send({}).expect(403);

    // even a supervisor cannot approve their own request
    const [k] = await db.select({ id: users.id }).from(users).where(eq(users.phone, "+919811020002"));
    await db.update(users).set({ staffRoles: ["SUPPORT_AGENT", "SUPPORT_SUPERVISOR"] }).where(eq(users.id, k!.id));
    const kabirSupervisor = (await signIn(t.http, "9811020002")).auth;
    const own = await t.http.post(`${S}/actions/${pending.id}/approve`).set(kabirSupervisor).send({}).expect(403);
    expect(own.body.detail).toMatch(/your own/);

    const approved = await t.http.post(`${S}/actions/${pending.id}/approve`).set(arvind).send({ note: "Two faulty units, approved" }).expect(200);
    expect(["COMPLETED", "PROCESSING"]).toContain(approved.body.actions[0].status);
    expect(approved.body.actions[0].decidedBy).toBe("Arvind Menon");
  });

  it("records replacements once per item, escalations and claims", async () => {
    const detail = await t.http.get(`${S}/tickets/${id}`).set(revathi).expect(200);
    const itemId = detail.body.orderSnapshot.items[0].id;
    await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "REPLACEMENT", itemId, reason: "defective", collectOriginal: true }).expect(200);
    const again = await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "REPLACEMENT", itemId, reason: "defective", collectOriginal: true }).expect(409);
    expect(again.body.code).toBe("ALREADY_REPLACED");
    const esc = await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "SELLER_ESCALATION", issue: "product", message: "Please confirm the replacement unit is from a newer batch." }).expect(200);
    expect(esc.body.status).toBe("PENDING_INTERNAL");
    const claim = await t.http.post(`${S}/tickets/${id}/actions`).set(revathi).send({ kind: "GUARANTEE_CLAIM", claimType: "damaged" }).expect(200);
    expect(claim.body.actions.map((a: { kind: string; status: string }) => `${a.kind}:${a.status}`)).toEqual(
      expect.arrayContaining(["REPLACEMENT:CREATED", "SELLER_ESCALATION:AWAITING_SELLER", "GUARANTEE_CLAIM:AWAITING_SELLER_RESPONSE"]),
    );
  });

  it("resolves, reopens on a customer reply, and closes for good", async () => {
    await t.http.patch(`${S}/tickets/${id}`).set(revathi).send({ status: "OPEN" }).expect(200);
    let r = await t.http.post(`${S}/tickets/${id}/messages`).set(revathi).send({ kind: "REPLY", body: "Your replacement is on the way.", statusAfter: "RESOLVED" }).expect(200);
    expect(r.body.status).toBe("RESOLVED");
    await t.http.post(`${ME}/tickets/${id}/messages`).set(shopper).send({ body: "The replacement has the same problem" }).expect(200);
    r = await t.http.get(`${S}/tickets/${id}`).set(revathi).expect(200);
    expect(r.body.status).toBe("REOPENED");
    r = await t.http.patch(`${S}/tickets/${id}`).set(revathi).send({ status: "RESOLVED" }).expect(200);
    r = await t.http.patch(`${S}/tickets/${id}`).set(revathi).send({ status: "CLOSED" }).expect(200);
    expect(r.body.allowedStatuses).toEqual([]);
    const closed = await t.http.post(`${ME}/tickets/${id}/messages`).set(shopper).send({ body: "Hello?" }).expect(409);
    expect(closed.body.code).toBe("TICKET_CLOSED");
  });

  it("lets an agent open a ticket for a phone call", async () => {
    const r = await t.http
      .post(`${S}/tickets`)
      .set(revathi)
      .send({ subject: "Called about a late refund", category: "Payment", customerName: "Rahul Verma", customerRef: "c-002", body: "Customer says the refund for a cancelled order has not arrived." })
      .expect(201);
    expect(r.body).toMatchObject({ status: "OPEN", channel: "PHONE", priority: "HIGH", assignee: { name: "Revathi Subramanian" } });
    expect(r.body.messages[0]).toMatchObject({ kind: "NOTE" });
  });

  it("bulk assigns and keeps customers to their own tickets", async () => {
    const open = await t.http.get(`${S}/tickets`).query({ view: "unassigned" }).set(staff).expect(200);
    const ids = open.body.items.slice(0, 2).map((i: { id: string }) => i.id);
    const agents = await t.http.get(`${S}/agents`).set(staff).expect(200);
    const megha = agents.body.find((a: { name: string }) => a.name === "Megha Pillai");
    await t.http.post(`${S}/tickets/assign`).set(staff).send({ ids, assigneeId: megha.id }).expect(200);
    const rows = await db.select({ assigneeId: supportTickets.assigneeId }).from(supportTickets).where(eq(supportTickets.id, ids[0]));
    expect(rows[0]!.assigneeId).toBe(megha.id);
    const customerId = (await signIn(t.http, DEMO_CUSTOMER)).session.user.id;
    const notAgent = await t.http.patch(`${S}/tickets/${ids[0]}`).set(staff).send({ assigneeId: customerId }).expect(422);
    expect(notAgent.body.code).toBe("NOT_AN_AGENT");

    const someoneElse = await t.http.get(`${S}/tickets`).query({ view: "all" }).set(staff).expect(200);
    const notMine = someoneElse.body.items.find((i: { customerName: string }) => i.customerName !== "Ananya Sharma");
    await t.http.get(`${ME}/tickets/${notMine.id}`).set(shopper).expect(404);
  });
});
