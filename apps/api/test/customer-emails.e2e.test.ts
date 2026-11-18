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
