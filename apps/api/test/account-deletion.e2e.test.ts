import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { addresses, auditEvents, cartItems, orderItems, orders, returns, reviews, supportEvents, supportMessages, supportTickets, users, wishlistItems } from "../src/db/schema.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let pincode: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const PASSWORD = "a-long-password";
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  const demo = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  pincode = (await t.http.get("/v1/me/addresses").set(demo).expect(200)).body[0].pincode;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

/** A new shopper with an address and a paid UPI order of one product, delivered. */
async function shopperWithDeliveredOrder(email: string, slug = "serum-glow") {
  const { auth, session } = await signUp(t.http, email, "Priya Nair", PASSWORD);
  const userId = session.user.id as string;
  const address = await t.http.post("/v1/me/addresses").set(auth).send({ name: "Priya Nair", phone: "9845012345", line1: "12 MG Road", line2: "Flat 4", city: "Bengaluru", state: "Karnataka", pincode }).expect(201);
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  const placed = await t.http.post("/v1/orders").set(auth).set("Idempotency-Key", randomUUID()).send({ addressId: address.body.id, paymentMethod: "UPI", lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] }).expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(auth).send({ outcome: "SUCCESS" }).expect(200);
  const orderId = placed.body.order.id as string;
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [item!.id], to }).expect(200);
  return { auth, userId, orderId, itemId: item!.id, productId: p.body.id as string, addressId: address.body.id as string };
}
const deliver = async (itemId: string) => {
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) await t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId: itemId, to }).expect(200);
};
/** Long enough ago that the return window is over. */
const ageDelivery = (itemId: string) => db.update(orderItems).set({ deliveredAt: new Date(Date.now() - 60 * 86_400_000) }).where(eq(orderItems.id, itemId));

describe("DELETE /v1/me", () => {
  it("needs the right password, and is for shoppers only", async () => {
    const { auth } = await signUp(t.http, "wrong.password@example.com", "Wrong Pass", PASSWORD);
    expect((await t.http.delete("/v1/me").set(auth).send({ password: "not-my-password" }).expect(403)).body.code).toBe("PASSWORD_INCORRECT");
    await t.http.delete("/v1/me").set(auth).send({}).expect(422);
    await t.http.delete("/v1/me").send({ password: PASSWORD }).expect(401);
    await t.http.get("/v1/me").set(auth).expect(200);

    const admin = await signIn(t.http, DEMO_STAFF);
    const refused = await t.http.delete("/v1/me").set(admin.auth).send({ password: "anything-at-all" }).expect(409);
    expect(refused.body.code).toBe("STAFF_ACCOUNT");
  });

  it("slows down password guessing", async () => {
    const { auth } = await signUp(t.http, "guesser@example.com", "Guess Er", PASSWORD);
    for (let i = 0; i < 10; i++) await t.http.delete("/v1/me").set(auth).send({ password: `wrong-${i}-password` }).expect(403);
    await t.http.delete("/v1/me").set(auth).send({ password: PASSWORD }).expect(429);
  });

  it("waits while an order or a return is in progress", async () => {
    const mine = await shopperWithDeliveredOrder("in.progress@example.com");
    // shipped but not delivered
    expect((await t.http.delete("/v1/me").set(mine.auth).send({ password: PASSWORD }).expect(409)).body.code).toBe("OPEN_ORDERS");
    await deliver(mine.itemId);
    // delivered and still inside the return window
    expect((await t.http.delete("/v1/me").set(mine.auth).send({ password: PASSWORD }).expect(409)).body.code).toBe("OPEN_ORDERS");
    await ageDelivery(mine.itemId);
    await db.update(orderItems).set({ status: "CLOSED" }).where(eq(orderItems.id, mine.itemId));
    await db.update(orders).set({ status: "CLOSED" }).where(eq(orders.id, mine.orderId));
    // a return that is still moving
    const open = await shopperWithDeliveredOrder("open.return@example.com", "backpack-urban");
    await deliver(open.itemId);
    const r = await t.http
      .post("/v1/me/returns")
      .set(open.auth)
      .send({ orderItemId: open.itemId, qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "SOURCE", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
      .expect(201);
    expect((await t.http.delete("/v1/me").set(open.auth).send({ password: PASSWORD }).expect(409)).body.code).toBe("OPEN_ORDERS");
    await t.http.post(`/v1/me/returns/${r.body.id}/cancel`).set(open.auth).expect(200);
    await ageDelivery(open.itemId);
    await t.http.delete("/v1/me").set(open.auth).send({ password: PASSWORD }).expect(204);
  });

  it("anonymises the account, keeps the records the law needs and ends every session", async () => {
    const mine = await shopperWithDeliveredOrder("leaving@example.com", "tea-assam");
    await deliver(mine.itemId);
    await t.http.post("/v1/me/reviews").set(mine.auth).send({ productId: "tea-assam", rating: 4, title: "Good tea", body: "Fresh and strong." }).expect(201);
    const ticket = await t.http.post("/v1/me/support/tickets").set(mine.auth).send({ subject: "Where is my parcel", category: "Delivery", orderId: mine.orderId, body: "Any update?" }).expect(201);
    const product = await t.http.get("/v1/products/serum-glow").expect(200);
    await t.http.put("/v1/me/wishlist").set(mine.auth).send({ productIds: [product.body.id] }).expect(200);
    await t.http.post("/v1/cart/items").set(mine.auth).send({ offerId: product.body.offerId, qty: 1 }).expect(200);
    expect((await db.select().from(cartItems).where(eq(cartItems.userId, mine.userId))).length).toBe(1);
    // staff blocked and unblocked them once, which quotes their name and email in the audit log
    await t.http.patch(`/v1/admin/customers/${mine.userId}`).set(staff).send({ status: "BLOCKED", reason: "Chargeback check" }).expect(200);
    await t.http.patch(`/v1/admin/customers/${mine.userId}`).set(staff).send({ status: "ACTIVE" }).expect(200);
    const blockEntries = await db.select().from(auditEvents).where(and(eq(auditEvents.entityType, "customer"), eq(auditEvents.entityId, mine.userId)));
    expect(blockEntries).toHaveLength(2);
    expect(JSON.stringify(blockEntries)).toContain("Priya Nair");
    const events = await db.select().from(supportEvents).where(eq(supportEvents.ticketId, ticket.body.id));
    expect(JSON.stringify(events)).toContain("Priya Nair");
    const login = await t.http.post("/v1/auth/login").send({ email: "leaving@example.com", password: PASSWORD }).expect(200);
    const refreshToken = login.body.refreshToken as string;
    mine.auth = { Authorization: `Bearer ${login.body.accessToken}` };

    // delivered a while ago and closed
    await ageDelivery(mine.itemId);
    await t.http.delete("/v1/me").set(mine.auth).send({ password: PASSWORD }).expect(204);

    const [user] = await db.select().from(users).where(eq(users.id, mine.userId));
    expect(user).toMatchObject({ name: "Deleted customer", phone: null, status: "DELETED", emailVerifiedAt: null });
    expect(user!.email).toBe(`deleted+${mine.userId}@invalid.altasgoods`);
    expect(user!.deletedAt).toBeInstanceOf(Date);
    expect(user!.passwordHash).not.toBeNull();

    // nothing personal stays on the account
    expect(await db.select().from(addresses).where(eq(addresses.userId, mine.userId))).toHaveLength(0);
    expect(await db.select().from(cartItems).where(eq(cartItems.userId, mine.userId))).toHaveLength(0);
    expect(await db.select().from(wishlistItems).where(eq(wishlistItems.userId, mine.userId))).toHaveLength(0);

    // the order stays, with the contact details masked and where it went kept
    const [order] = await db.select({ address: orders.address, total: orders.totalPaise }).from(orders).where(eq(orders.id, mine.orderId));
    expect(order!.address).toMatchObject({ name: "Deleted", phone: "Deleted", line1: "Deleted", pincode, city: "Bengaluru", state: "Karnataka" });
    expect(order!.address.line2 ?? "").not.toContain("Flat 4");
    expect(order!.total).toBeGreaterThan(0);

    // the ticket keeps its conversation, not the name
    const [tk] = await db.select({ name: supportTickets.customerName }).from(supportTickets).where(eq(supportTickets.id, ticket.body.id));
    expect(tk!.name).toBe("Deleted customer");

    // no name or email is left in the places staff read: ticket timeline and messages, audit summaries and changes
    const personal = /Priya|Nair|leaving@example\.com/;
    const after = await db.select().from(auditEvents).where(and(eq(auditEvents.entityType, "customer"), eq(auditEvents.entityId, mine.userId)));
    expect(after.map((e) => e.action).sort()).toEqual(["customer.block", "customer.unblock"]);
    expect(after.find((e) => e.action === "customer.block")!.summary).toBe("Blocked Deleted customer: Chargeback check");
    expect(JSON.stringify(after)).not.toMatch(personal);
    expect(JSON.stringify(await db.select().from(supportEvents).where(eq(supportEvents.ticketId, ticket.body.id)))).not.toMatch(personal);
    expect(JSON.stringify(await db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticket.body.id)))).not.toMatch(personal);
    expect(JSON.stringify(await db.select().from(supportTickets).where(eq(supportTickets.id, ticket.body.id)))).not.toMatch(personal);
    expect(JSON.stringify(await db.select().from(orders).where(eq(orders.id, mine.orderId)))).not.toMatch(personal);

    // reviews stay, as Anonymous
    expect((await db.select().from(reviews).where(eq(reviews.userId, mine.userId))).length).toBe(1);
    const shown = await t.http.get("/v1/products/tea-assam/reviews").expect(200);
    expect(shown.body.items.find((r: { title: string }) => r.title === "Good tea")).toMatchObject({ author: "Anonymous" });

    // every way back in is closed
    await t.http.get("/v1/me").set(mine.auth).expect(401);
    await t.http.post("/v1/auth/refresh").send({ refreshToken }).expect(401);
    const again = await t.http.post("/v1/auth/login").send({ email: "leaving@example.com", password: PASSWORD }).expect(401);
    expect(again.body.code).toBe("INVALID_CREDENTIALS");
    const guess = await t.http.post("/v1/auth/login").send({ email: "leaving@example.com", password: "something-else-entirely" }).expect(401);
    expect(guess.body).toEqual(again.body);
    const deletedLogin = await t.http.post("/v1/auth/login").send({ email: `deleted+${mine.userId}@invalid.altasgoods`, password: PASSWORD }).expect(401);
    expect(deletedLogin.body.code).toBe("INVALID_CREDENTIALS");

    // no hint about who had an account
    const forgot = await t.http.post("/v1/auth/password/forgot").send({ email: "leaving@example.com" }).expect(200);
    expect(forgot.body).not.toHaveProperty("devCode");

    // the email can start a new account
    const fresh = await t.http.post("/v1/auth/signup").set("X-Forwarded-For", "10.99.0.1").send({ email: "leaving@example.com", name: "Priya Again", password: PASSWORD }).expect(201);
    expect(fresh.body.user.id).not.toBe(mine.userId);

    // the audit trail says it happened, without personal details
    const [entry] = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "account.delete"), eq(auditEvents.entityId, mine.userId)));
    expect(entry).toMatchObject({ entityType: "user", entityId: mine.userId, actorId: mine.userId });
    expect(JSON.stringify(entry)).not.toMatch(/leaving@example\.com|Priya/);
  });

  it("masks a past return's address and refund UPI id", async () => {
    const mine = await shopperWithDeliveredOrder("returned@example.com", "airfryer-crisp");
    await deliver(mine.itemId);
    const r = await t.http
      .post("/v1/me/returns")
      .set(mine.auth)
      .send({ orderItemId: mine.itemId, qty: 1, reasonCode: "DEFECTIVE", reasonLabel: "Item is defective or not working", fault: "STORE", resolution: "REFUND", refundTo: "BANK", refundUpi: "priya@okbank", pickupDate: today(), pickupSlot: "10 AM to 1 PM" })
      .expect(201);
    await t.http.post(`/v1/me/returns/${r.body.id}/cancel`).set(mine.auth).expect(200);
    await ageDelivery(mine.itemId);
    await t.http.delete("/v1/me").set(mine.auth).send({ password: PASSWORD }).expect(204);
    const [row] = await db.select({ upi: returns.refundUpi, address: returns.address }).from(returns).where(inArray(returns.orderId, [mine.orderId]));
    expect(row!.upi).toBe("Deleted");
    expect(row!.address).toMatchObject({ name: "Deleted", phone: "Deleted", line1: "Deleted", pincode });
  });
});
