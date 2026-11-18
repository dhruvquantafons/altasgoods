import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, PAYMENT_PROVIDER } from "../../../common/tokens.js";
import type { Db, Tx } from "../../../db/client.js";
import { orders, payments, refunds, type PaymentStatus } from "../../../db/schema.js";
import { JobsService } from "../../jobs/jobs.service.js";
import type { PaymentProvider, RefundState } from "./provider.js";

/** Job kind that sends one PENDING refund to the gateway. Payload: { refundId }. */
export const REFUND_JOB = "refund.execute";

const PAID: PaymentStatus[] = ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"];

type RefundRow = typeof refunds.$inferSelect;

/**
 * Refunds to the original payment method, made so none is lost or doubled.
 *
 * A business transaction calls `queue()`: it inserts the refund as PENDING
 * and enqueues a `refund.execute` job in that same transaction, and never
 * calls the gateway itself. The job (`execute`) asks the gateway with
 * receipt = refund id, which the gateway treats as an idempotency key, so a
 * retry after a lost answer finds the same refund instead of making another.
 * It stores the gateway's refund id and status; a COMPLETED refund updates
 * the payment and order to REFUNDED or PARTIALLY_REFUNDED (`settle`). A
 * refund still PROCESSING at the gateway is re-read by `refreshProcessing()`.
 * A job that keeps failing marks its refund FAILED, which frees the amount.
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

  /** Paise already promised back from a payment: every refund except the FAILED ones. */
  async committed(tx: Tx, paymentId: string) {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::bigint` })
      .from(refunds)
      .where(and(eq(refunds.paymentId, paymentId), ne(refunds.status, "FAILED")));
    return Number(row?.total ?? 0);
  }

  /** Records a PENDING refund and queues the job that sends it, inside the caller's transaction. */
  async queue(tx: Tx, input: { paymentId: string; orderId: string; orderItemId?: string | null; amountPaise: number; reason: string }) {
    const [refund] = await tx
      .insert(refunds)
      .values({ ...input, status: "PENDING" })
      .returning();
    await this.jobs.enqueue(tx, REFUND_JOB, { refundId: refund!.id });
    return refund!;
  }

  /**
   * The job. Holds the refund row while it asks the gateway, so two runs never
   * overlap; a refund that is no longer PENDING was handled already. A throw
   * (gateway down or slow) leaves it PENDING for the job's retry.
   */
  async execute(refundId: string) {
    await this.db.transaction(async (tx) => {
      const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
      if (!refund || refund.status !== "PENDING") return;
      const [payment] = await tx.select({ providerRef: payments.providerRef }).from(payments).where(eq(payments.id, refund.paymentId));
      const result = await this.provider.refund({ providerRef: payment?.providerRef ?? "", amountPaise: refund.amountPaise, receipt: refund.id });
      await this.record(tx, refund, result.status, result.providerRefundId);
    });
  }

  /** After the last attempt: the refund did not happen, so its amount can be refunded again. */
  async giveUp(refundId: string, error: Error) {
    await this.db.update(refunds).set({ status: "FAILED" }).where(and(eq(refunds.id, refundId), eq(refunds.status, "PENDING")));
    this.logger.error(`Refund ${refundId} failed after every attempt: ${error.message}`);
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
