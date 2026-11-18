import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { conflict, notFound } from "../../../common/errors.js";
import { rupees } from "../../../common/money.js";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, PAYMENT_PROVIDER } from "../../../common/tokens.js";
import type { Db, Tx } from "../../../db/client.js";
import { orderItems, orders, payments, refunds, returns, type OrderItemStatus, type PaymentStatus } from "../../../db/schema.js";
import { JobsService } from "../../jobs/jobs.service.js";
import { isTransientGatewayError, type PaymentProvider, type ProviderRefund, type RefundState } from "./provider.js";

/** Job kind that sends one PENDING refund to the gateway. Payload: { refundId }. */
export const REFUND_JOB = "refund.execute";

const PAID: PaymentStatus[] = ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"];

type RefundRow = typeof refunds.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

/** Lines whose parcel reached the customer, so cash on delivery was collected for them. */
const DELIVERED_LIKE: OrderItemStatus[] = ["DELIVERED", "RETURN_REQUESTED", "RETURN_IN_PROGRESS", "RETURNED", "REPLACED", "CLOSED"];

/** A line's share of the order: its amount less its share of the coupon. Every per-line refund uses this. */
export const lineNetPaise = (order: Pick<OrderRow, "subtotalPaise" | "couponDiscountPaise">, line: { unitPricePaise: number; qty: number }) => {
  const gross = line.unitPricePaise * line.qty;
  const couponShare = order.subtotalPaise ? Math.round((order.couponDiscountPaise * gross) / order.subtotalPaise) : 0;
  return gross - couponShare;
};

/** What a customer sees: a refund waiting on the store's check is still on its way. */
export const customerRefundStatus = (s: RefundRow["status"]) => (s === "NEEDS_ATTENTION" ? "PROCESSING" : s);

/**
 * Refunds to the original payment method, made so none is lost or doubled.
 *
 * A business transaction calls `queue()`: it inserts the refund as PENDING
 * and enqueues a `refund.execute` job in that same transaction, and never
 * calls the gateway itself. The job (`execute`) holds the refund row lock and
 * asks the gateway with receipt = refund id; the provider first looks for a
 * refund it already made with that receipt, so a retry after a lost answer
 * finds the same refund instead of making another. It stores the gateway's
 * refund id and status; a COMPLETED refund updates the payment and order to
 * REFUNDED or PARTIALLY_REFUNDED (`settle`). A refund still PROCESSING at the
 * gateway is re-read by `refreshProcessing()`.
 *
 * Only a definite answer frees the amount (FAILED): the gateway refused and
 * confirms it holds no refund for the receipt, or said the refund failed.
 * Transient failures (timeouts, network, 5xx, 429) are retried; when the
 * attempts run out the receipt is looked up once more, and if the gateway
 * still cannot say, the refund becomes NEEDS_ATTENTION, which keeps the amount
 * reserved until someone checks the gateway and calls `retry()`.
 */
@Injectable()
export class RefundsService implements OnModuleInit {
  private readonly logger = new Logger("Refunds");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.jobs.register<{ refundId: string }>(REFUND_JOB, (p) => this.execute(p.refundId), { onExhausted: (p, e) => this.giveUp(p.refundId, e) });
  }

  /**
   * The payment that paid for the order: the first one captured. A later
   * capture on the same order is a duplicate that is being given back.
   */
  async paidPayment(tx: Tx, orderId: string) {
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, PAID)))
      .orderBy(sql`${payments.capturedAt} asc nulls last`, asc(payments.createdAt))
      .limit(1);
    return p ?? null;
  }

  /** Paise already promised back from a payment: every refund except the FAILED ones (NEEDS_ATTENTION included). */
  async committed(tx: Tx, paymentId: string) {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::bigint` })
      .from(refunds)
      .where(and(eq(refunds.paymentId, paymentId), ne(refunds.status, "FAILED")));
    return Number(row?.total ?? 0);
  }

  /**
   * What is still refundable on a payment: the amount captured less every
   * refund promised from it. The one cap for refunds to the payment method,
   * their retries, and manual refunds on prepaid orders.
   */
  async refundable(tx: Tx, payment: Pick<PaymentRow, "id" | "amountPaise">) {
    return payment.amountPaise - (await this.committed(tx, payment.id));
  }

  /**
   * How much a refund on this order may be, and which payment it is booked
   * against. Prepaid: what is left of the captured payment. Cash on delivery:
   * what was actually collected (delivered lines; the delivery fee once every
   * booked parcel is delivered, since it travels with one of them) less what
   * was refunded. Null when nothing was paid. Call with the order row locked.
   */
  async limit(tx: Tx, order: OrderRow): Promise<{ payment: PaymentRow; leftPaise: number; online: boolean } | null> {
    if (order.paymentMethod !== "COD") {
      // a fully refunded payment is still the one that paid: nothing is left of it
      const payment = await this.paidPayment(tx, order.id);
      if (!payment) return null;
      return { payment, leftPaise: await this.refundable(tx, payment), online: true };
    }
    const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, order.id), eq(payments.provider, "COD"))).orderBy(asc(payments.createdAt)).limit(1);
    if (!payment) return null;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const delivered = items.filter((i) => DELIVERED_LIKE.includes(i.status));
    const booked = items.filter((i) => i.awb);
    const feeCollected = delivered.length > 0 && booked.every((i) => DELIVERED_LIKE.includes(i.status));
    const collected = Math.min(payment.amountPaise, delivered.reduce((a, i) => a + lineNetPaise(order, i), 0) + (feeCollected ? order.deliveryFeePaise : 0));
    return { payment, leftPaise: collected - (await this.committed(tx, payment.id)), online: false };
  }

  /** Records a PENDING refund and queues the job that sends it, inside the caller's transaction. */
  async queue(tx: Tx, input: { paymentId: string; orderId: string; orderItemId?: string | null; amountPaise: number; reason: string; createdBy?: string | null; note?: string | null }) {
    const [refund] = await tx
      .insert(refunds)
      .values({ ...input, method: "SOURCE", status: "PENDING" })
      .returning();
    await this.jobs.enqueue(tx, REFUND_JOB, { refundId: refund!.id });
    return refund!;
  }

  /**
   * Records money the store pays back itself (UPI or bank transfer), never
   * through the gateway: COMPLETED with its reference when already paid, or
   * PENDING while it waits for someone to pay it (see markPaid). Either way it
   * counts against the cap at once. A completed one settles the payment like
   * a gateway refund. The caller checks the cap (see limit) under the order lock.
   */
  async recordManual(
    tx: Tx,
    input: { paymentId: string; orderId: string; orderItemId?: string | null; amountPaise: number; reason: string; reference?: string | null; createdBy?: string | null; note?: string | null; paid: boolean },
  ) {
    const { paid, ...values } = input;
    const [refund] = await tx
      .insert(refunds)
      .values({ ...values, method: "MANUAL", status: paid ? "COMPLETED" : "PENDING", completedAt: paid ? this.clock.now() : null })
      .returning();
    if (paid) await this.settle(tx, refund!.paymentId);
    return refund!;
  }

  /**
   * Records that a manual refund waiting for its payout has been paid, with
   * the payout's reference. A return whose refund this is shows it COMPLETED
   * too, whichever page it was marked paid from.
   */
  async markPaid(tx: Tx, refundId: string, reference: string, note?: string | null) {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
    if (!refund) throw notFound("Refund");
    if (refund.method !== "MANUAL" || refund.status !== "PENDING") throw conflict("NOT_AWAITING_PAYOUT", "This refund is not waiting for a manual payout");
    const [done] = await tx
      .update(refunds)
      .set({ status: "COMPLETED", reference, completedAt: this.clock.now(), ...(note ? { note } : {}) })
      .where(eq(refunds.id, refundId))
      .returning();
    await tx.update(returns).set({ refundStatus: "COMPLETED", updatedAt: this.clock.now() }).where(eq(returns.refundId, refundId));
    await this.settle(tx, refund.paymentId);
    return done!;
  }

  /**
   * The job. Holds the refund row while it asks the gateway, so two runs never
   * overlap; a refund that is no longer PENDING was handled already. A
   * transient throw (gateway down or slow) leaves it PENDING for the job's
   * retry. A definite refusal fails it at once, but only after the gateway
   * confirms it holds no refund for this receipt.
   */
  async execute(refundId: string) {
    await this.db.transaction(async (tx) => {
      const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
      // a manual refund is paid by the store, never sent to the gateway
      if (!refund || refund.status !== "PENDING" || refund.method !== "SOURCE") return;
      const providerRef = await this.providerRef(tx, refund.paymentId);
      let result: ProviderRefund | null;
      try {
        result = await this.provider.refund({ providerRef, amountPaise: refund.amountPaise, receipt: refund.id });
      } catch (e) {
        if (isTransientGatewayError(e)) throw e;
        // a refusal: free the amount only if no refund exists for this receipt (a transient throw here retries)
        result = await this.provider.findRefund({ providerRef, receipt: refund.id });
        if (!result) {
          await tx.update(refunds).set({ status: "FAILED" }).where(eq(refunds.id, refund.id));
          this.logger.error(`The gateway refused refund ${refund.id} of order ${refund.orderId}: ${(e as Error).message}`);
          return;
        }
      }
      await this.record(tx, refund, result.status, result.providerRefundId);
    });
  }

  /**
   * After the last attempt failed on transient errors: one more look at the
   * gateway. A refund found under the receipt is recorded; a confirmed absence
   * is FAILED; no answer at all is NEEDS_ATTENTION (the amount stays reserved).
   */
  async giveUp(refundId: string, error: Error) {
    await this.db.transaction(async (tx) => {
      const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
      if (!refund || refund.status !== "PENDING" || refund.method !== "SOURCE") return;
      let found: ProviderRefund | null;
      try {
        found = await this.provider.findRefund({ providerRef: await this.providerRef(tx, refund.paymentId), receipt: refund.id });
      } catch (e) {
        await tx.update(refunds).set({ status: "NEEDS_ATTENTION" }).where(eq(refunds.id, refund.id));
        this.logger.error(
          `Refund ${refund.id} of order ${refund.orderId} needs attention: every attempt failed (${error.message}) and the gateway could not say whether it was made (${(e as Error).message}). Check the gateway, then retry it.`,
        );
        return;
      }
      if (found) return this.record(tx, refund, found.status, found.providerRefundId);
      await tx.update(refunds).set({ status: "FAILED" }).where(eq(refunds.id, refund.id));
      this.logger.error(`Refund ${refund.id} of order ${refund.orderId} failed after every attempt: ${error.message}`);
    });
  }

  /**
   * Sends a FAILED or NEEDS_ATTENTION refund again, on the same row and so
   * with the same receipt (for staff, once they have checked the gateway). A
   * FAILED refund had freed its amount, so it is reserved again here under the
   * order lock and refused if something else has been refunded since.
   * A refund the gateway itself marked failed under this receipt stays
   * failed (the gateway reports it again); issue a new refund for that.
   */
  async retry(refundId: string) {
    return this.jobs.scope(() =>
      this.db.transaction(async (tx) => {
        const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
        if (!refund) throw notFound("Refund");
        if (refund.method !== "SOURCE" || (refund.status !== "FAILED" && refund.status !== "NEEDS_ATTENTION")) {
          throw conflict("REFUND_NOT_RETRYABLE", "Only a failed refund, or one that needs attention, can be sent again");
        }
        await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, refund.orderId)).for("update");
        if (refund.status === "FAILED") {
          const [payment] = await tx.select({ id: payments.id, amountPaise: payments.amountPaise }).from(payments).where(eq(payments.id, refund.paymentId));
          const left = payment ? await this.refundable(tx, payment) : 0;
          if (refund.amountPaise > left) throw conflict("REFUND_TOO_LARGE", `Only ${rupees(Math.max(left, 0))} of this payment is left to refund`);
        }
        const [again] = await tx.update(refunds).set({ status: "PENDING", completedAt: null }).where(eq(refunds.id, refund.id)).returning();
        await this.jobs.enqueue(tx, REFUND_JOB, { refundId: refund.id });
        return again!;
      }),
    );
  }

  /** Asks the gateway about refunds it is still processing. Returns how many it settled. */
  async refreshProcessing() {
    const open = await this.db
      .select({ id: refunds.id, providerRefundId: refunds.providerRefundId })
      .from(refunds)
      .where(and(eq(refunds.status, "PROCESSING"), isNotNull(refunds.providerRefundId)));
    let settled = 0;
    for (const r of open) {
      try {
        const status = await this.provider.refundStatus(r.providerRefundId!);
        if (status === "PROCESSING") continue;
        const changed = await this.db.transaction(async (tx) => {
          const [refund] = await tx.select().from(refunds).where(eq(refunds.id, r.id)).for("update");
          if (!refund || refund.status !== "PROCESSING") return false;
          await this.record(tx, refund, status);
          return true;
        });
        if (changed) settled++;
      } catch (e) {
        this.logger.error(`Could not re-check refund ${r.id}: ${(e as Error).message}`);
      }
    }
    return settled;
  }

  private async providerRef(tx: Tx, paymentId: string) {
    const [payment] = await tx.select({ providerRef: payments.providerRef }).from(payments).where(eq(payments.id, paymentId));
    return payment?.providerRef ?? "";
  }

  private async record(tx: Tx, refund: RefundRow, status: RefundState, providerRefundId?: string) {
    await tx
      .update(refunds)
      .set({ status, ...(providerRefundId ? { providerRefundId } : {}), completedAt: status === "COMPLETED" ? this.clock.now() : null })
      .where(eq(refunds.id, refund.id));
    if (status === "COMPLETED") await this.settle(tx, refund.paymentId);
    if (status === "FAILED") this.logger.error(`The gateway refused refund ${refund.id} of order ${refund.orderId}`);
  }

  /**
   * Brings a payment in line with its completed refunds, and the order too
   * when this payment is the one that paid for it.
   */
  private async settle(tx: Tx, paymentId: string) {
    // the order row first, then the payment: the order every refund path takes them in, so none deadlock
    const [owner] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, paymentId));
    if (!owner) return;
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, owner.orderId)).for("update");
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!payment || !PAID.includes(payment.status)) return;
    const [row] = await tx
      .select({ done: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::bigint` })
      .from(refunds)
      .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, "COMPLETED")));
    const done = Number(row?.done ?? 0);
    if (done <= 0) return;
    const status = done >= payment.amountPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.update(payments).set({ status }).where(eq(payments.id, paymentId));
    const paid = await this.paidPayment(tx, payment.orderId);
    if (paid?.id === payment.id) await tx.update(orders).set({ paymentStatus: status }).where(eq(orders.id, payment.orderId));
  }
}
