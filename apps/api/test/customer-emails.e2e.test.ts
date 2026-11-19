import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PROVIDER, LOGISTICS_PROVIDER } from "../src/common/tokens.js";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { careAgentEmail } from "../src/db/demo.js";
import { emailLog, jobs, orderItems, payments, users } from "../src/db/schema.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import type { EmailMessage, EmailProvider } from "../src/modules/auth/email.provider.js";
import { EMAIL_JOB, NotificationsService } from "../src/modules/commerce/notifications/notifications.service.js";
import { PaymentsService } from "../src/modules/commerce/payments/payments.service.js";
import type { Booking, LogisticsProvider } from "../src/modules/commerce/shipping/provider.js";
import { ShippingService } from "../src/modules/commerce/shipping/shipping.service.js";
import { courierStatus } from "../src/modules/commerce/shipping/shiprocket.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, runJobs, signIn, signUp, type TestContext } from "./helpers.js";

/** Keeps every email; `failures` makes the next sends throw, like an SMTP server that is down. */
class OutboxEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  failures = 0;
  async send(message: EmailMessage) {
    if (this.failures > 0) {
      this.failures--;
      throw new Error("SMTP connection timed out");
    }
    this.sent.push(message);
    return { messageId: `<${randomUUID()}@outbox.test>` };
  }
}

/** A courier with tracking pages, whose scans the test sets. */
const scans = new Map<string, string>();
let booked = 0;
const courier = {
  name: "SHIPROCKET" as const,
  book: vi.fn(async (_r: unknown, _done: Booking, save: (b: Booking) => Promise<void>) => {
    const n = ++booked;
    await save({ carrierOrderRef: `so-${n}` });
    return { carrierOrderRef: `so-${n}`, awb: `MAILAWB${n}`, courier: "Delhivery" };
  }),
  cancel: vi.fn(async () => {}),
  track: vi.fn(async (awb: string) => (scans.has(awb) ? { awb, raw: scans.get(awb)!, status: courierStatus(scans.get(awb)!) } : null)),
  parseWebhook: () => null,
  trackingUrl: (awb: string) => `https://track.test/${awb}`,
} satisfies LogisticsProvider;

const outbox = new OutboxEmailProvider();
const { db, pool } = createDb(env().TEST_DATABASE_URL);
let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let addressId: string;
const WEB = env().WEB_ORIGIN;

beforeAll(async () => {
  t = await createTestApp([
    { provide: EMAIL_PROVIDER, useValue: outbox },
    { provide: LOGISTICS_PROVIDER, useValue: courier },
  ]);
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(async () => {
  t.clock.reset();
  await drain();
  outbox.sent = [];
  outbox.failures = 0;
});

/** Runs jobs until none are due (a refund job queues its own email job). */
async function drain() {
  for (let i = 0; i < 10 && (await runJobs(t)) > 0; i++);
}
/** Emails sent since the test started, by subject. */
const subjects = () => outbox.sent.map((m) => m.subject);
const only = (pattern: RegExp) => {
  const found = outbox.sent.filter((m) => pattern.test(m.subject));
  expect(found, `emails matching ${pattern}: ${subjects().join(" | ")}`).toHaveLength(1);
  return found[0]!;
};

async function place(slug: string, paymentMethod: string, auth = shopper, address = addressId) {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  const placed = await t.http.post("/v1/orders").set(auth).set("Idempotency-Key", randomUUID()).send({ addressId: address, paymentMethod, lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] }).expect(201);
  const orderId = placed.body.order.id as string;
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  return { orderId, itemId: item!.id, paymentId: placed.body.payment.id as string };
}
const pay = (paymentId: string, outcome: "SUCCESS" | "FAILURE" = "SUCCESS", auth = shopper) =>
  t.http.post(`/v1/payments/${paymentId}/sandbox/complete`).set(auth).send({ outcome }).expect(200);
const transition = (ids: string[], to: string, reason?: string) => t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids, to, reason }).expect(200);
const awbOf = async (itemId: string) => (await db.select({ awb: orderItems.awb }).from(orderItems).where(eq(orderItems.id, itemId)))[0]!.awb!;
/** A paid line handed to the courier, and its AWB. */
async function readyLine(slug: string, paymentMethod = "UPI") {
  const line = await place(slug, paymentMethod);
  if (paymentMethod !== "COD") await pay(line.paymentId);
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await transition([line.itemId], to);
  return { ...line, awb: await awbOf(line.itemId) };
}
async function scan(awb: string, raw: string) {
  scans.set(awb, raw);
  await t.app.get(ShippingService).pollTracking();
}
async function deliveredLine(slug: string) {
  const line = await readyLine(slug);
  await scan(line.awb, "Delivered");
  return line;
}

describe("the email job", () => {
  const notify = (userId: string, key: string) =>
    db.transaction((tx) => t.app.get(NotificationsService).notify(tx, "DELIVERED", { userId, key, orderId: "BB-TEST", data: { orderId: "BB-TEST", items: [{ title: "Test item", qty: 1 }] } }));
  const demoId = async () => (await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_CUSTOMER)))[0]!.id;

  it("queues an email once per key, and never twice while it waits", async () => {
    const userId = await demoId();
    const key = `test-${randomUUID()}`;
    expect(await notify(userId, key)).toBeTruthy();
    expect(await notify(userId, key)).toBeNull();
    await drain();
    only(/was delivered/);
    // sent: the record stops it being queued again
    expect(await notify(userId, key)).toBeNull();
    const [log] = await db.select().from(emailLog).where(eq(emailLog.dedupeKey, `delivered:${key}`));
    expect(log).toMatchObject({ kind: "DELIVERED", userId, providerMessageId: expect.stringContaining("@outbox.test") });
  });

  it("does not send again when a job that already sent runs a second time", async () => {
    const userId = await demoId();
    const key = `test-${randomUUID()}`;
    const jobId = (await notify(userId, key))!;
    await drain();
    expect(outbox.sent).toHaveLength(1);
    // the worker died after sending and before recording DONE: the job comes round again
    await db.update(jobs).set({ status: "QUEUED", runAfter: new Date(0), lockedAt: null }).where(eq(jobs.id, jobId));
    expect(await runJobs(t)).toBe(1);
    expect(outbox.sent).toHaveLength(1);
    expect((await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId)))[0]!.status).toBe("DONE");
  });

  it("retries when the mail server fails, then sends", async () => {
    const userId = await demoId();
    const jobId = (await notify(userId, `test-${randomUUID()}`))!;
    outbox.failures = 2;
    await runJobs(t);
    expect(outbox.sent).toHaveLength(0);
    let [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect(job).toMatchObject({ status: "QUEUED", attempts: 1, lastError: "SMTP connection timed out" });
    t.clock.advance(31_000);
    await runJobs(t);
    t.clock.advance(61_000);
    await runJobs(t);
    [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect(job).toMatchObject({ status: "DONE", attempts: 3 });
    only(/was delivered/);
  });

  it("sends nothing to a deleted account", async () => {
    const email = `leaving-${randomUUID().slice(0, 8)}@example.com`;
    const me = (await signUp(t.http, email, "Leaving Soon")).auth;
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    // queued while the account was open, sent after it was deleted
    await notify(u!.id, `test-${randomUUID()}`);
    await t.http.delete("/v1/me").set(me).send({ password: "a-long-password" }).expect(204);
    await drain();
    expect(outbox.sent).toHaveLength(0);
  });

  it("queues nothing while customer emails are switched off", async () => {
    await t.http.put("/v1/admin/settings").set(staff).send({ ...DEFAULT_SETTINGS, notifications: { customerEmails: false } }).expect(200);
    try {
      expect((await t.http.get("/v1/admin/settings").set(staff).expect(200)).body.notifications).toEqual({ customerEmails: false });
      await place("serum-glow", "COD");
      expect(await notify(await demoId(), `test-${randomUUID()}`)).toBeNull();
      await drain();
      expect(outbox.sent).toHaveLength(0);
    } finally {
      await t.http.put("/v1/admin/settings").set(staff).send(DEFAULT_SETTINGS).expect(200);
    }
  });
});

describe("order and payment emails", () => {
  it("confirms a cash on delivery order", async () => {
    const { orderId } = await place("serum-glow", "COD");
    await drain();
    const m = only(/is confirmed/);
    expect(m).toMatchObject({ to: DEMO_CUSTOMER, subject: `Your AltasGoods order ${orderId} is confirmed` });
    expect(m.text).toContain(`${WEB}/account/orders/${orderId}`);
    expect(m.text).toContain("Hello Ananya,");
    expect(m.text).toContain("cash on delivery");
    expect(m.html).toContain(`${WEB}/account/orders/${orderId}`);
    expect(m.text).not.toMatch(/[—–]/);
  });

  it("confirms a prepaid order once the payment is captured, and only then", async () => {
    const { orderId, paymentId } = await place("serum-glow", "UPI");
    await drain();
    expect(outbox.sent).toHaveLength(0);
    await pay(paymentId);
    await drain();
    expect(only(/is confirmed/).subject).toBe(`Your AltasGoods order ${orderId} is confirmed`);
  });

  it("tells the customer a payment failed, once per attempt", async () => {
    const { orderId, paymentId } = await place("serum-glow", "CARD");
    await pay(paymentId, "FAILURE");
    // the gateway repeats its failure webhook
    await t.app.get(PaymentsService).process({ id: `evt-${randomUUID()}`, type: "payment.failed", providerRef: (await db.select({ ref: payments.providerRef }).from(payments).where(eq(payments.id, paymentId)))[0]!.ref!, failureReason: "Declined" });
    await drain();
    const m = only(/did not go through/);
    expect(m.subject).toBe(`Payment for your AltasGoods order ${orderId} did not go through`);
    expect(m.text).toContain(`${WEB}/account/orders/${orderId}`);
  });

  it("tells the customer an unpaid order expired, without a second cancellation email", async () => {
    const { orderId } = await place("serum-glow", "UPI");
    t.clock.advance(31 * 60_000);
    await t.app.get(PaymentsService).expireStale();
    await drain();
    // (an unpaid order from an earlier test expires too)
    const mine = outbox.sent.filter((m) => m.subject.includes(orderId));
    expect(mine.map((m) => m.subject)).toEqual([`Your AltasGoods order ${orderId} was cancelled`]);
    expect(mine[0]!.text).toContain("did not receive the payment");
  });
});

describe("cancellation and refund emails", () => {
  it("confirms a customer cancellation with the refund amount, then the refund completing: two emails", async () => {
    const { orderId, paymentId } = await place("serum-glow", "UPI");
    await pay(paymentId);
    await drain();
    outbox.sent = [];
    await t.http.post(`/v1/me/orders/${orderId}/cancel`).set(shopper).send({ reason: "Ordered by mistake" }).expect(200);
    await drain();
    const cancelled = only(/is cancelled/);
    expect(cancelled.text).toContain("As you asked");
    expect(cancelled.text).toMatch(/A refund of ₹[\d,.]+ is on its way/);
    const done = only(/is complete$/);
    expect(done.subject).toMatch(new RegExp(`^Your refund of ₹[\\d,.]+ for order ${orderId} is complete$`));
    expect(done.text).toContain(`${WEB}/account/returns?tab=refunds`);
    expect(outbox.sent).toHaveLength(2);
  });

  it("keeps the refund started email for a refund staff issue from the admin", async () => {
    const { orderId, paymentId } = await place("serum-glow", "UPI");
    await pay(paymentId);
    await drain();
    outbox.sent = [];
    await t.http.post(`/v1/admin/orders/${orderId}/refunds`).set(staff).send({ amountPaise: 1000, reason: "Goodwill for the late delivery", method: "SOURCE" }).expect(201);
    await drain();
    expect(only(/has started/).subject).toBe(`Your refund of ₹10 for order ${orderId} has started`);
    expect(only(/is complete$/).subject).toBe(`Your refund of ₹10 for order ${orderId} is complete`);
  });

  it("tells the customer the store cancelled an item, without the internal note", async () => {
    const { orderId, itemId } = await place("serum-glow", "COD");
    await drain();
    outbox.sent = [];
    await transition([itemId], "CANCELLED", "internal: suspected fraud");
    await drain();
    const m = only(/is cancelled/);
    expect(m.subject).toBe(`Your AltasGoods order ${orderId} is cancelled`);
    expect(m.text).toContain("the store had to cancel");
    expect(m.text).toContain("You have not been charged");
    // the staff note is internal
    expect(m.text).not.toContain("suspected fraud");
    expect(m.html).not.toContain("suspected fraud");
    expect(outbox.sent).toHaveLength(1);
  });
});

describe("staff notes stay internal", () => {
  it("shows the customer no part of a staff cancel note: not in the refund, the line or the timeline", async () => {
    const { orderId, itemId, paymentId } = await place("serum-glow", "UPI");
    await pay(paymentId);
    await transition([itemId], "CANCELLED", "internal: suspected fraud");
    await drain();
    const detail = (await t.http.get(`/v1/me/orders/${orderId}`).set(shopper).expect(200)).body;
    expect(detail.refunds).toEqual([expect.objectContaining({ reason: "Cancelled by the store" })]);
    expect(detail.items[0].cancelReason).toBe("Cancelled by the store");
    const body = JSON.stringify(detail);
    for (const part of ["internal", "suspected", "fraud"]) expect(body).not.toContain(part);
    for (const m of outbox.sent) expect(`${m.text}${m.html}`).not.toContain("fraud");
    // staff still see the note
    const admin = (await t.http.get(`/v1/admin/orders/${orderId}`).set(staff).expect(200)).body;
    expect(JSON.stringify(admin.events)).toContain("internal: suspected fraud");
  });

  it("shows a staff goodwill refund to the customer with a fixed reason", async () => {
    const { orderId, paymentId } = await place("serum-glow", "UPI");
    await pay(paymentId);
    await t.http.post(`/v1/admin/orders/${orderId}/refunds`).set(staff).send({ amountPaise: 500, reason: "internal: goodwill for a VIP", method: "SOURCE" }).expect(201);
    const detail = (await t.http.get(`/v1/me/orders/${orderId}`).set(shopper).expect(200)).body;
    expect(detail.refunds).toEqual([expect.objectContaining({ amountPaise: 500, reason: "Refund from AltasGoods" })]);
    expect(JSON.stringify(detail)).not.toContain("VIP");
  });

  it("keeps the customer's own cancel reason", async () => {
    const { orderId, paymentId } = await place("serum-glow", "UPI");
    await pay(paymentId);
    await t.http.post(`/v1/me/orders/${orderId}/cancel`).set(shopper).send({ reason: "Ordered by mistake" }).expect(200);
    const detail = (await t.http.get(`/v1/me/orders/${orderId}`).set(shopper).expect(200)).body;
    expect(detail.items[0].cancelReason).toBe("Ordered by mistake");
    expect(detail.refunds).toEqual([expect.objectContaining({ reason: "Cancelled at your request" })]);
  });
});

describe("shipping emails", () => {
  it("sends one shipped email with the tracking link however often the courier repeats the scan", async () => {
    const { orderId, awb } = await readyLine("speaker-boom");
    await drain();
    outbox.sent = [];
    await scan(awb, "Picked Up");
    await scan(awb, "In Transit");
    await drain();
    const m = only(/has shipped/);
    expect(m.subject).toBe(`Your AltasGoods order ${orderId} has shipped`);
    expect(m.text).toContain(`https://track.test/${awb}`);
    expect(m.text).toContain(`${WEB}/account/orders/${orderId}`);
    expect(m.text).toContain("Delhivery");
    expect(outbox.sent).toHaveLength(1);
  });

  it("sends out for delivery and delivered, once each", async () => {
    const { orderId, awb } = await readyLine("airfryer-crisp");
    await scan(awb, "Shipped");
    await drain();
    outbox.sent = [];
    await scan(awb, "Out For Delivery");
    await scan(awb, "Out For Delivery");
    await drain();
    expect(only(/out for delivery/).text).toContain(`https://track.test/${awb}`);
    await scan(awb, "Delivered");
    await scan(awb, "Delivered");
    await drain();
    expect(only(/was delivered/).subject).toBe(`Your AltasGoods order ${orderId} was delivered`);
    expect(outbox.sent).toHaveLength(2);
  });

  it("goes straight to delivered when the courier skips the scans in between", async () => {
    const { awb } = await readyLine("cookware-pan");
    await drain();
    outbox.sent = [];
    await scan(awb, "Delivered");
    await drain();
    expect(subjects()).toEqual([expect.stringMatching(/was delivered$/)]);
  });

  it("tells the customer a parcel was lost, with the refund amount in the same email", async () => {
    const { orderId, itemId, awb } = await readyLine("tablet-slate");
    await scan(awb, "Shipped");
    await drain();
    outbox.sent = [];
    await transition([itemId], "LOST", "internal: courier blamed the hub team");
    await drain();
    const m = only(/An update on your AltasGoods order/);
    expect(m.subject).toBe(`An update on your AltasGoods order ${orderId}`);
    expect(m.text).toContain("lost your parcel");
    expect(m.text).toMatch(/A refund of ₹[\d,.]+ is on its way/);
    expect(m.text).not.toContain("hub team");
    // the lost email carries the refund; only its completion follows
    expect(subjects().filter((x) => /has started/.test(x))).toEqual([]);
    only(/is complete$/);
    expect(outbox.sent).toHaveLength(2);
  });
});

describe("return emails", () => {
  const today = () => t.clock.now().toISOString().slice(0, 10);
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

  it("approves, picks up and refunds an in-policy return", async () => {
    const { itemId } = await deliveredLine("serum-glow");
    await drain();
    outbox.sent = [];
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId)).expect(201)).body;
    await drain();
    const approved = only(/is approved/);
    expect(approved.subject).toBe(`Your AltasGoods return ${r.id} is approved`);
    expect(approved.text).toContain(`${WEB}/account/returns#${r.id}`);
    expect(approved.text).toContain("10 AM to 1 PM");

    await advance(r.id, "PICKED_UP");
    await drain();
    expect(only(/We picked up/).subject).toBe(`We picked up your AltasGoods return ${r.id}`);
    // a low value return is refunded at the doorstep: the return's refund email, not a second generic one
    expect(only(/Your refund for AltasGoods return/).subject).toBe(`Your refund for AltasGoods return ${r.id} has started`);
    expect(subjects().filter((s) => /^Your refund of/.test(s) && /has started/.test(s))).toHaveLength(0);
    only(/is complete$/);
  });

  it("reports a failed check, then the rejection", async () => {
    const { itemId } = await deliveredLine("speaker-boom");
    const r = (await t.http.post("/v1/me/returns").set(shopper).send(request(itemId, { resolution: "REPLACEMENT", refundTo: undefined })).expect(201)).body;
    await advance(r.id, "RECEIVED");
    await drain();
    outbox.sent = [];
    await t.http.post(`/v1/admin/returns/${r.id}/qc`).set(staff).send({ pass: false, note: "Water damage inside the case" }).expect(200);
    await drain();
    const failed = only(/An update on your AltasGoods return/);
    expect(failed.text).toContain("did not pass our quality check");
    expect(failed.text).not.toContain("Water damage");
    expect(failed.text).toContain(`${WEB}/account/returns#${r.id}`);
    outbox.sent = [];
    await t.http.post(`/v1/admin/returns/${r.id}/settle`).set(staff).send({ accept: false, note: "Damage is not covered by the return policy" }).expect(200);
    await drain();
    const m = only(/An update on your AltasGoods return/);
    expect(m.subject).toBe(`An update on your AltasGoods return ${r.id}`);
    expect(m.text).toContain("could not accept");
    expect(m.text).toContain("Damage is not covered by the return policy");
  });
});

describe("Care Desk emails", () => {
  it("emails the customer an agent's reply, never an internal note", async () => {
    const agent = (await signIn(t.http, careAgentEmail(0))).auth;
    const ticket = (await t.http.post("/v1/me/support/tickets").set(shopper).send({ subject: "Where is my parcel", category: "Delivery", body: "It has not moved in three days." }).expect(201)).body;
    await drain();
    outbox.sent = [];
    await t.http.post(`/v1/support/tickets/${ticket.id}/messages`).set(agent).send({ kind: "NOTE", body: "Courier says the hub is flooded" }).expect(200);
    await drain();
    expect(outbox.sent).toHaveLength(0);
    await t.http.post(`/v1/support/tickets/${ticket.id}/messages`).set(agent).send({ kind: "REPLY", body: "Sorry for the wait.\n\nYour parcel moves again tomorrow." }).expect(200);
    await drain();
    const m = only(/New reply/);
    expect(m).toMatchObject({ to: DEMO_CUSTOMER, subject: `New reply on your AltasGoods help request ${ticket.id}` });
    expect(m.text).toContain("Revathi from AltasGoods");
    expect(m.text).toContain("Your parcel moves again tomorrow.");
    expect(m.text).not.toContain("flooded");
    expect(m.text).toContain(`${WEB}/account/support`);
  });
});

describe("every trigger sends its email once", () => {
  it("leaves at most one email job per key", async () => {
    const dupes = await db
      .select({ key: jobs.dedupeKey, n: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.kind, EMAIL_JOB)))
      .groupBy(jobs.dedupeKey)
      .having(sql`count(*) > 1`);
    expect(dupes).toEqual([]);
  });
});
