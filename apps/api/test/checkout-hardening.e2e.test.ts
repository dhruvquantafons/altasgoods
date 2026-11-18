import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/common/errors.js";
import { DB, PAYMENT_PROVIDER } from "../src/common/tokens.js";
import { env } from "../src/config/env.js";
import { createDb, type Db } from "../src/db/client.js";
import { offers, orders, payments, refunds } from "../src/db/schema.js";
import { PaymentsService } from "../src/modules/commerce/payments/payments.service.js";
import type { RefundState } from "../src/modules/commerce/payments/provider.js";
import { RefundsService } from "../src/modules/commerce/payments/refunds.service.js";
import { SandboxPaymentProvider } from "../src/modules/commerce/payments/sandbox.provider.js";
import { JOB_MAX_ATTEMPTS, JobsService, retryDelayMs } from "../src/modules/jobs/jobs.service.js";
import { createTestApp, DEMO_CUSTOMER, signIn, type TestContext } from "./helpers.js";

/** The sandbox gateway with knobs: a slow or failing session, failing or slow refunds. */
class FlakyGateway extends SandboxPaymentProvider {
  sessionHook?: () => Promise<void>;
  refundFailures = 0;
  refundResult: "COMPLETED" | "PROCESSING" = "COMPLETED";
  statusAnswer: RefundState = "COMPLETED";
  refundCalls: { receipt: string; amountPaise: number }[] = [];

  override async createSession(input: { paymentId: string }) {
    if (this.sessionHook) await this.sessionHook();
    return super.createSession(input);
  }

  override async refund(input: { providerRef: string; amountPaise: number; receipt: string }) {
    this.refundCalls.push({ receipt: input.receipt, amountPaise: input.amountPaise });
    if (this.refundFailures > 0) {
      this.refundFailures--;
      throw new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT", "The payment gateway took too long to answer");
    }
    return { providerRefundId: `rfnd_${input.receipt}`, status: this.refundResult };
  }

  override async refundStatus() {
    return this.statusAnswer;
  }
}

const gateway = new FlakyGateway();
let t: TestContext;
let shopper: Record<string, string>;
let addressId: string;
let jobs: JobsService;
let appDb: Db;
const { db, pool } = createDb(env().TEST_DATABASE_URL);

beforeAll(async () => {
  t = await createTestApp([{ provide: PAYMENT_PROVIDER, useValue: gateway }]);
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
  addressId = addresses.body.find((a: { isDefault: boolean }) => a.isDefault).id;
  jobs = t.app.get(JobsService);
  appDb = t.app.get(DB);
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(() => {
  t.clock.reset();
  gateway.sessionHook = undefined;
  gateway.refundFailures = 0;
  gateway.refundResult = "COMPLETED";
  gateway.statusAnswer = "COMPLETED";
  gateway.refundCalls = [];
});

async function offerOf(slug: string) {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  return p.body.offerId as string;
}
const stockOf = async (offerId: string) => (await db.select({ stock: offers.stock }).from(offers).where(eq(offers.id, offerId)))[0]!.stock;
const place = (body: object, key = randomUUID()) => t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", key).send({ addressId, ...body });
const orderOf = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0]!;
const refundsOf = (orderId: string) => db.select().from(refunds).where(eq(refunds.orderId, orderId));

/** A UPI order for one unit, paid in the sandbox. */
async function paidOrder(slug: string) {
  const offerId = await offerOf(slug);
  const placed = await place({ paymentMethod: "UPI", lines: [{ offerId, qty: 1, variant: "" }] }).expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  return placed.body.order as { id: string; totalPaise: number };
}

describe("checkout with a payment gateway outside the stock lock", () => {
  it("keeps the order when the gateway cannot open the payment, and the customer can retry", async () => {
    const offerId = await offerOf("tea-assam");
    const before = await stockOf(offerId);
    gateway.sessionHook = async () => {
      throw new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT", "The payment gateway took too long to answer");
    };

    const placed = await place({ paymentMethod: "UPI", lines: [{ offerId, qty: 2, variant: "" }] }).expect(201);
    expect(placed.body.order.status).toBe("PAYMENT_PENDING");
    expect(placed.body.payment).toMatchObject({ status: "CREATED", nextAction: null });
    expect(await stockOf(offerId)).toBe(before - 2);
    const [attempt] = await db.select().from(payments).where(eq(payments.id, placed.body.payment.id));
    expect(attempt!.providerRef).toBeNull();

    gateway.sessionHook = undefined;
    const retry = await t.http.post(`/v1/me/orders/${placed.body.order.id}/payments`).set(shopper).expect(201);
    expect(retry.body.nextAction.url).toContain(`/checkout/pay/${retry.body.id}`);
    const paid = await t.http.post(`/v1/payments/${retry.body.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
    expect(paid.body).toMatchObject({ status: "CAPTURED", orderStatus: "CONFIRMED" });
    expect(await stockOf(offerId)).toBe(before - 2);
  });

  it("holds no lock on the stock while the gateway opens the payment", async () => {
    const offerId = await offerOf("serum-glow");
    let lockError: unknown = null;
    let locked = false;
    gateway.sessionHook = async () => {
      // another checkout for the same item, while this one waits on the gateway
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`set local lock_timeout = '2s'`);
          await tx.select({ id: offers.id }).from(offers).where(eq(offers.id, offerId)).for("update");
          locked = true;
        });
      } catch (e) {
        lockError = e;
      }
    };

    const placed = await place({ paymentMethod: "UPI", lines: [{ offerId, qty: 1, variant: "" }] }).expect(201);
    expect(lockError).toBeNull();
    expect(locked).toBe(true);
    expect(placed.body.payment.nextAction.url).toContain("/checkout/pay/");
  });

  it("answers two simultaneous requests with one Idempotency-Key with one order", async () => {
    const offerId = await offerOf("mugs-stone");
    const before = await stockOf(offerId);
    const key = randomUUID();
    const body = { paymentMethod: "UPI", lines: [{ offerId, qty: 1, variant: "" }] };

    const [a, b] = await Promise.all([place(body, key), place(body, key)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.order.id).toBe(b.body.order.id);
    expect(await stockOf(offerId)).toBe(before - 1);
    const made = await db.select({ id: orders.id }).from(orders).where(eq(orders.idempotencyKey, key));
    expect(made).toHaveLength(1);
  });
});

describe("refunds through the job queue", () => {
  it("retries a refund the gateway did not answer, and refunds exactly once", async () => {
    const order = await paidOrder("headphones-studio");
    gateway.refundFailures = 1;

    const cancelled = await t.http.post(`/v1/me/orders/${order.id}/cancel`).set(shopper).send({ reason: "Changed my mind" }).expect(200);
    expect(cancelled.body.refunds).toEqual([expect.objectContaining({ amountPaise: order.totalPaise, status: "PENDING" })]);
    expect(cancelled.body.paymentStatus).toBe("CAPTURED");

    // the gateway times out: the refund waits for the retry
    await jobs.runDue();
    expect(gateway.refundCalls).toHaveLength(1);
    expect((await refundsOf(order.id))[0]!.status).toBe("PENDING");

    t.clock.advance(retryDelayMs(1) + 1000);
    await jobs.runDue();
    const [refund, ...others] = await refundsOf(order.id);
    expect(others).toHaveLength(0);
    expect(refund).toMatchObject({ status: "COMPLETED", providerRefundId: `rfnd_${refund!.id}` });
    expect(refund!.completedAt).not.toBeNull();
    expect(gateway.refundCalls).toEqual([
      { receipt: refund!.id, amountPaise: order.totalPaise },
      { receipt: refund!.id, amountPaise: order.totalPaise },
    ]);
    expect((await orderOf(order.id)).paymentStatus).toBe("REFUNDED");

    // nothing left to do
    t.clock.advance(3_600_000);
    await jobs.runDue();
    expect(gateway.refundCalls).toHaveLength(2);
  });

  it("marks a refund FAILED after the last attempt, which frees the amount to refund again", async () => {
    const order = await paidOrder("speaker-boom");
    const pay = t.app.get(PaymentsService);
    gateway.refundFailures = 1_000;
    await appDb.transaction((tx) => pay.refundToSource(tx, order.id, order.totalPaise, "Goodwill"));

    // while it is pending, the amount counts as refunded
    await expect(appDb.transaction((tx) => pay.refundToSource(tx, order.id, 1, "Goodwill"))).rejects.toMatchObject({ code: "REFUND_TOO_LARGE" });

    for (let i = 0; i < JOB_MAX_ATTEMPTS + 1; i++) {
      await jobs.runDue();
      t.clock.advance(2 * 3_600_000);
    }
    expect(gateway.refundCalls).toHaveLength(JOB_MAX_ATTEMPTS);
    expect((await refundsOf(order.id))[0]!.status).toBe("FAILED");
    expect((await orderOf(order.id)).paymentStatus).toBe("CAPTURED");

    gateway.refundFailures = 0;
    await appDb.transaction((tx) => pay.refundToSource(tx, order.id, order.totalPaise, "Goodwill, again"));
    await jobs.runDue();
    const rows = await refundsOf(order.id);
    expect(rows.map((r) => r.status).sort()).toEqual(["COMPLETED", "FAILED"]);
    expect((await orderOf(order.id)).paymentStatus).toBe("REFUNDED");
  });

  it("re-checks refunds the gateway is still processing", async () => {
    const order = await paidOrder("cookware-pan");
    gateway.refundResult = "PROCESSING";
    const pay = t.app.get(PaymentsService);
    await appDb.transaction((tx) => pay.refundToSource(tx, order.id, 1000, "Partial goodwill"));
    await jobs.runDue();
    expect((await refundsOf(order.id))[0]).toMatchObject({ status: "PROCESSING", completedAt: null });
    expect((await orderOf(order.id)).paymentStatus).toBe("CAPTURED");

    const sweep = t.app.get(RefundsService);
    gateway.statusAnswer = "PROCESSING";
    expect(await sweep.refreshProcessing()).toBe(0);
    gateway.statusAnswer = "COMPLETED";
    expect(await sweep.refreshProcessing()).toBe(1);
    expect((await refundsOf(order.id))[0]!.status).toBe("COMPLETED");
    expect((await orderOf(order.id)).paymentStatus).toBe("PARTIALLY_REFUNDED");
    const [payment] = await db.select().from(payments).where(and(eq(payments.orderId, order.id), eq(payments.status, "PARTIALLY_REFUNDED")));
    expect(payment).toBeDefined();
  });

  it("runs the refund as soon as the request has committed", async () => {
    const order = await paidOrder("airfryer-crisp");
    jobs.autoKick = true;
    try {
      await t.http.post(`/v1/me/orders/${order.id}/cancel`).set(shopper).send({ reason: "Changed my mind" }).expect(200);
      await vi.waitFor(async () => expect((await refundsOf(order.id))[0]!.status).toBe("COMPLETED"), { timeout: 3000 });
    } finally {
      jobs.autoKick = false;
      await jobs.idle();
    }
  });
});
