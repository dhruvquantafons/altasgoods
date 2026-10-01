import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { isProduction } from "../../../config/env.js";
import type { Db, Tx } from "../../../db/client.js";
import { coupons, orderEvents, orders, paymentEvents, payments, refunds } from "../../../db/schema.js";
import { conflict, forbidden, notFound } from "../../../common/errors.js";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, PAYMENT_PROVIDER } from "../../../common/tokens.js";
import { PAYMENT_WINDOW_MS } from "../pricing.js";
import { OrderWorkflow, type OrderRow } from "../workflow.service.js";
import type { PaymentProvider, ProviderEvent } from "./provider.js";
import { SANDBOX_SIGNATURE_HEADER, SandboxPaymentProvider, signSandbox } from "./sandbox.provider.js";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  /** Opens a payment attempt with the provider for an unpaid order. */
  async startAttempt(tx: Tx, order: OrderRow) {
    const [payment] = await tx
      .insert(payments)
      .values({ orderId: order.id, provider: this.provider.name, method: order.paymentMethod, amountPaise: order.totalPaise, status: "CREATED" })
      .returning();
    const session = await this.provider.createSession({ paymentId: payment!.id, orderId: order.id, amountPaise: order.totalPaise, method: order.paymentMethod });
    await tx.update(payments).set({ providerRef: session.providerRef }).where(eq(payments.id, payment!.id));
    return { payment: { ...payment!, providerRef: session.providerRef }, nextAction: { type: "REDIRECT" as const, url: session.redirectUrl } };
  }

  /** Entry point for provider webhooks. Verifies the signature, then processes. */
  receiveWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    return this.process(this.provider.parseWebhook(rawBody, headers));
  }

  /** Idempotent: an event id that was already processed is acknowledged and ignored. */
  async process(event: ProviderEvent) {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.providerRef, event.providerRef)).for("update");
      if (!payment) throw notFound("Payment");
      const inserted = await tx.insert(paymentEvents).values({ id: event.id, paymentId: payment.id, type: event.type, payload: event }).onConflictDoNothing().returning({ id: paymentEvents.id });
      if (!inserted.length) return { duplicate: true, status: payment.status };

      const now = this.clock.now();
      const { order } = await this.workflow.lockOrder(tx, payment.orderId);

      if (event.type === "payment.captured") {
        if (payment.status === "CAPTURED" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") return { duplicate: false, status: payment.status };
        await tx.update(payments).set({ status: "CAPTURED", capturedAt: now, failureReason: null }).where(eq(payments.id, payment.id));

        if (order.status === "ABANDONED" || order.status === "CANCELLED") {
          // money arrived after the order expired: give it straight back
          const result = await this.provider.refund({ providerRef: payment.providerRef ?? "", amountPaise: payment.amountPaise });
          await tx.insert(refunds).values({ paymentId: payment.id, orderId: order.id, amountPaise: payment.amountPaise, status: result.status, reason: "Payment received after the order expired", completedAt: result.status === "COMPLETED" ? now : null });
          await tx.update(payments).set({ status: "REFUNDED" }).where(eq(payments.id, payment.id));
          await tx.update(orders).set({ paymentStatus: "REFUNDED" }).where(eq(orders.id, order.id));
          this.logger.warn(`Late capture on ${order.id} refunded`);
          return { duplicate: false, status: "REFUNDED" as const };
        }

        await tx.update(orders).set({ paymentStatus: "CAPTURED", paymentDueBy: null }).where(eq(orders.id, order.id));
        await this.workflow.transition(tx, { orderId: order.id, to: "NEW", actor: "PAYMENT", note: "Payment received" });
        return { duplicate: false, status: "CAPTURED" as const };
      }

      // payment.failed
      if (payment.status !== "CREATED" && payment.status !== "PENDING") return { duplicate: false, status: payment.status };
      await tx.update(payments).set({ status: "FAILED", failureReason: event.failureReason ?? "Payment failed" }).where(eq(payments.id, payment.id));
      if (order.status === "PAYMENT_PENDING") {
        await tx.update(orders).set({ status: "PAYMENT_FAILED", paymentStatus: "FAILED" }).where(eq(orders.id, order.id));
        await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: "PAYMENT_FAILED", actor: "PAYMENT", note: event.failureReason });
      }
      return { duplicate: false, status: "FAILED" as const };
    });
  }

  /** Sandbox only: simulates the customer finishing payment on the hosted page. */
  async sandboxComplete(userId: string, paymentId: string, outcome: "SUCCESS" | "FAILURE") {
    if (isProduction()) throw forbidden("The payment sandbox is disabled in production");
    const payment = await this.ownPayment(userId, paymentId);
    if (!payment.providerRef) throw conflict("PAYMENT_NOT_STARTED", "This payment has not started");
    const body = JSON.stringify(SandboxPaymentProvider.event(payment.providerRef, outcome));
    await this.receiveWebhook(Buffer.from(body), { [SANDBOX_SIGNATURE_HEADER]: signSandbox(body) });
    return this.get(userId, paymentId);
  }

  /** Starts a new attempt for an order whose payment failed, within the payment window. */
  async retry(userId: string, orderId: string) {
    return this.db.transaction(async (tx) => {
      const { order } = await this.workflow.lockOrder(tx, orderId);
      if (order.userId !== userId) throw notFound("Order");
      if (order.status !== "PAYMENT_PENDING" && order.status !== "PAYMENT_FAILED") throw conflict("ORDER_NOT_PAYABLE", "This order does not need payment");
      if (order.paymentDueBy && order.paymentDueBy < this.clock.now()) throw conflict("PAYMENT_WINDOW_CLOSED", "The time to pay for this order has ended");
      await tx.update(payments).set({ status: "CANCELLED" }).where(and(eq(payments.orderId, orderId), inArray(payments.status, ["CREATED", "PENDING"])));
      if (order.status === "PAYMENT_FAILED") {
        await tx.update(orders).set({ status: "PAYMENT_PENDING", paymentStatus: "CREATED" }).where(eq(orders.id, orderId));
        await tx.insert(orderEvents).values({ orderId, fromStatus: "PAYMENT_FAILED", toStatus: "PAYMENT_PENDING", actor: "CUSTOMER", note: "Payment retried" });
      }
      const attempt = await this.startAttempt(tx, order);
      return { id: attempt.payment.id, method: attempt.payment.method, status: attempt.payment.status, amountPaise: attempt.payment.amountPaise, nextAction: attempt.nextAction };
    });
  }

  async get(userId: string, paymentId: string) {
    const payment = await this.ownPayment(userId, paymentId);
    const [order] = await this.db.select({ status: orders.status }).from(orders).where(eq(orders.id, payment.orderId));
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      amountPaise: payment.amountPaise,
      failureReason: payment.failureReason,
      orderStatus: order!.status,
    };
  }

  private async ownPayment(userId: string, paymentId: string) {
    const [row] = await this.db
      .select({ payment: payments, userId: orders.userId })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.id, paymentId));
    if (!row || row.userId !== userId) throw notFound("Payment");
    return row.payment;
  }

  /** Abandons orders left unpaid past the window: items cancelled, stock and coupon released. */
  async expireStale() {
    const now = this.clock.now();
    const stale = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(inArray(orders.status, ["PAYMENT_PENDING", "PAYMENT_FAILED"]), lt(orders.paymentDueBy, now)));
    for (const { id } of stale) {
      await this.db.transaction(async (tx) => {
        const { order } = await this.workflow.lockOrder(tx, id);
        if (order.status !== "PAYMENT_PENDING" && order.status !== "PAYMENT_FAILED") return;
        await this.workflow.transition(tx, { orderId: id, to: "CANCELLED", actor: "SYSTEM", note: "Payment not completed within 30 minutes" });
        await tx.update(payments).set({ status: "EXPIRED" }).where(and(eq(payments.orderId, id), inArray(payments.status, ["CREATED", "PENDING", "FAILED"])));
        await tx.update(orders).set({ paymentStatus: "EXPIRED" }).where(eq(orders.id, id));
        if (order.couponCode) await tx.update(coupons).set({ usageCount: sql`greatest(${coupons.usageCount} - 1, 0)` }).where(eq(coupons.code, order.couponCode));
      });
    }
    return stale.length;
  }
}

export { PAYMENT_WINDOW_MS };
