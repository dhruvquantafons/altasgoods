import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { isProduction } from "../../../config/env.js";
import type { Db, Tx } from "../../../db/client.js";
import { coupons, orderEvents, orders, paymentEvents, payments } from "../../../db/schema.js";
import { conflict, forbidden, notFound } from "../../../common/errors.js";
import type { Clock } from "../../../common/infra.module.js";
import { rupees } from "../../../common/money.js";
import { CLOCK, DB, PAYMENT_PROVIDER } from "../../../common/tokens.js";
import { PAYMENT_WINDOW_MS } from "../pricing.js";
import { OrderWorkflow, type OrderRow } from "../workflow.service.js";
import type { PaymentProvider, ProviderEvent } from "./provider.js";
import { RefundsService } from "./refunds.service.js";
import { SANDBOX_SIGNATURE_HEADER, SandboxPaymentProvider, signSandbox } from "./sandbox.provider.js";

/** Who issued a refund, for which line, and a staff-only remark. */
type RefundExtra = { orderItemId?: string | null; createdBy?: string | null; note?: string | null };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
    @Inject(RefundsService) private readonly refunds: RefundsService,
  ) {}

  /**
   * Goodwill or claim refund to the original payment method of a paid order
   * (Care Desk, returns). Never more than what is still unrefunded, counting
   * refunds still on their way. Queues the refund in the caller's
   * transaction; the gateway is called by the refund job after commit, so the
   * returned row is PENDING.
   */
  async refundToSource(tx: Tx, orderId: string, amountPaise: number, reason: string, extra: RefundExtra = {}) {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order");
    if (order.paymentStatus !== "CAPTURED" && order.paymentStatus !== "PARTIALLY_REFUNDED") throw conflict("NOT_REFUNDABLE", "This order has no captured online payment to refund to");
    const limit = await this.refunds.limit(tx, order);
    if (!limit?.online) throw conflict("NOT_REFUNDABLE", "This order has no captured online payment to refund to");
    if (amountPaise > limit.leftPaise) throw conflict("REFUND_TOO_LARGE", `Only ${rupees(Math.max(limit.leftPaise, 0))} of this order is left to refund`);
    return this.refunds.queue(tx, { paymentId: limit.payment.id, orderId: order.id, amountPaise, reason, ...extra });
  }

  /**
   * Records a refund the store pays itself, by UPI or bank transfer: already
   * paid (with its reference), or waiting for the payout (paid: false). It
   * never reaches the gateway. Capped like any refund: on a prepaid order by
   * what is left of the payment, on cash on delivery by what was collected
   * and not yet refunded, so nothing can be refunded before delivery.
   */
  async refundManually(tx: Tx, orderId: string, input: { amountPaise: number; reason: string; reference?: string | null; paid: boolean } & RefundExtra) {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order");
    const limit = await this.refunds.limit(tx, order);
    if (!limit) throw conflict("NOT_REFUNDABLE", "Nothing has been paid on this order, so there is nothing to refund");
    if (input.amountPaise > limit.leftPaise) {
      throw conflict(
        "REFUND_TOO_LARGE",
        limit.online
          ? `Only ${rupees(Math.max(limit.leftPaise, 0))} of this order is left to refund`
          : limit.leftPaise > 0
            ? `Only ${rupees(limit.leftPaise)} was collected on this cash on delivery order and not yet refunded`
            : "Nothing collected on this cash on delivery order is left to refund. Cash is collected when a parcel is delivered.",
      );
    }
    return this.refunds.recordManual(tx, { ...input, paymentId: limit.payment.id, orderId: order.id });
  }

  /**
   * Records a payment attempt for an unpaid order, inside the caller's
   * transaction. The gateway is not called here: call startSession() once
   * the transaction has committed, so no lock is held while it answers.
   */
  async openAttempt(tx: Tx, order: OrderRow) {
    const [payment] = await tx
      .insert(payments)
      .values({ orderId: order.id, provider: this.provider.name, method: order.paymentMethod, amountPaise: order.totalPaise, status: "CREATED" })
      .returning();
    return payment!;
  }

  /**
   * Opens the gateway session for an attempt recorded by openAttempt(), after
   * its transaction committed. Never throws: when the gateway fails, the
   * attempt stays CREATED without a reference and the customer retries
   * payment (or the order expires with the payment window). Returns where to
   * send the customer, or null.
   */
  async startSession(payment: { id: string; orderId: string; amountPaise: number; method: OrderRow["paymentMethod"] }) {
    try {
      const session = await this.provider.createSession({ paymentId: payment.id, orderId: payment.orderId, amountPaise: payment.amountPaise, method: payment.method });
      const [opened] = await this.db
        .update(payments)
        .set({ providerRef: session.providerRef })
        .where(and(eq(payments.id, payment.id), isNull(payments.providerRef), inArray(payments.status, ["CREATED", "PENDING"])))
        .returning({ id: payments.id });
      return opened ? { type: "REDIRECT" as const, url: session.redirectUrl } : null;
    } catch (e) {
      this.logger.error(`Could not open a gateway session for payment ${payment.id} of ${payment.orderId}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Entry point for provider webhooks. Verifies the signature, then processes. */
  async receiveWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const event = this.provider.parseWebhook(rawBody, headers);
    if (!event) return { duplicate: false };
    // the gateway account may also take payments that are not ours (payment links, other apps)
    const [known] = await this.db.select({ id: payments.id }).from(payments).where(eq(payments.providerRef, event.providerRef));
    if (!known) {
      this.logger.warn(`Ignored webhook for unknown payment ${event.providerRef}`);
      return { duplicate: false };
    }
    return this.process(event);
  }

  /** Gateways with a client side checkout: the browser reports the payment, the provider verifies it. */
  async confirm(userId: string, paymentId: string, payload: unknown) {
    if (!this.provider.confirm) throw conflict("CONFIRM_NOT_SUPPORTED", "This payment is confirmed by the gateway directly");
    const payment = await this.ownPayment(userId, paymentId);
    if (!payment.providerRef || payment.provider !== this.provider.name) throw conflict("PAYMENT_NOT_STARTED", "This payment has not started");
    await this.process(await this.provider.confirm(payment.providerRef, payload));
    return this.get(userId, paymentId);
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

        // an earlier attempt (one the customer retried away from) already paid for this order
        const alreadyPaid = order.paymentStatus === "CAPTURED" || order.paymentStatus === "PARTIALLY_REFUNDED" || order.paymentStatus === "REFUNDED";
        if (order.status === "ABANDONED" || order.status === "CANCELLED" || alreadyPaid) {
          // money arrived after the order expired, or twice: give it straight back. The refund
          // job marks this payment (and, for a late capture, the order) REFUNDED once it completes.
          const reason = alreadyPaid ? "Duplicate payment for an order that was already paid" : "Payment received after the order expired";
          await this.refunds.queue(tx, { paymentId: payment.id, orderId: order.id, amountPaise: payment.amountPaise, reason });
          this.logger.warn(`${alreadyPaid ? "Duplicate" : "Late"} capture on ${order.id}, refund queued`);
          // to the customer this payment is being given back in full (see get())
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
    if (this.provider.name !== "SANDBOX") throw forbidden("The payment sandbox is not the active payment gateway");
    const payment = await this.ownPayment(userId, paymentId);
    if (!payment.providerRef) throw conflict("PAYMENT_NOT_STARTED", "This payment has not started");
    const body = JSON.stringify(SandboxPaymentProvider.event(payment.providerRef, outcome));
    await this.receiveWebhook(Buffer.from(body), { [SANDBOX_SIGNATURE_HEADER]: signSandbox(body) });
    return this.get(userId, paymentId);
  }

  /**
   * Starts a new attempt for an order whose payment failed (or whose gateway
   * session never opened), within the payment window. The gateway session is
   * opened after commit; if that fails, nextAction is null and the customer
   * can retry again.
   */
  async retry(userId: string, orderId: string) {
    const payment = await this.db.transaction(async (tx) => {
      const { order } = await this.workflow.lockOrder(tx, orderId);
      if (order.userId !== userId) throw notFound("Order");
      if (order.status !== "PAYMENT_PENDING" && order.status !== "PAYMENT_FAILED") throw conflict("ORDER_NOT_PAYABLE", "This order does not need payment");
      if (order.paymentDueBy && order.paymentDueBy < this.clock.now()) throw conflict("PAYMENT_WINDOW_CLOSED", "The time to pay for this order has ended");
      await tx.update(payments).set({ status: "CANCELLED" }).where(and(eq(payments.orderId, orderId), inArray(payments.status, ["CREATED", "PENDING"])));
      if (order.status === "PAYMENT_FAILED") {
        await tx.update(orders).set({ status: "PAYMENT_PENDING", paymentStatus: "CREATED" }).where(eq(orders.id, orderId));
        await tx.insert(orderEvents).values({ orderId, fromStatus: "PAYMENT_FAILED", toStatus: "PAYMENT_PENDING", actor: "CUSTOMER", note: "Payment retried" });
      }
      return this.openAttempt(tx, order);
    });
    const nextAction = await this.startSession(payment);
    return { id: payment.id, method: payment.method, status: payment.status, amountPaise: payment.amountPaise, nextAction };
  }

  /**
   * The customer's view of a payment. Refunds on their way count: a captured
   * payment with refunds queued for all of it reads REFUNDED (a late or
   * duplicate capture being given back, or a cancelled order), and with some
   * of it PARTIALLY_REFUNDED, as soon as the refund is queued rather than when
   * the gateway finishes. The payment row itself keeps the gateway's truth.
   */
  async get(userId: string, paymentId: string) {
    const payment = await this.ownPayment(userId, paymentId);
    const [order] = await this.db.select({ status: orders.status }).from(orders).where(eq(orders.id, payment.orderId));
    let status = payment.status;
    if (status === "CAPTURED" || status === "PARTIALLY_REFUNDED") {
      const promised = await this.refunds.committed(this.db, payment.id);
      if (promised >= payment.amountPaise) status = "REFUNDED";
      else if (promised > 0) status = "PARTIALLY_REFUNDED";
    }
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      method: payment.method,
      status,
      amountPaise: payment.amountPaise,
      failureReason: payment.failureReason,
      orderStatus: order!.status,
      // false when the gateway session never opened (the gateway failed at checkout): retry the payment
      sessionOpen: !!payment.providerRef,
      // only an attempt that is still open can be paid in the gateway's checkout
      checkout:
        this.provider.checkout && payment.provider === this.provider.name && payment.providerRef && (payment.status === "CREATED" || payment.status === "PENDING" || payment.status === "FAILED")
          ? this.provider.checkout(payment.providerRef)
          : null,
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

  /**
   * Asks the gateway about every open attempt, so a customer who paid and then
   * closed the tab is confirmed even when webhooks are not set up. Returns how
   * many payments it confirmed.
   */
  async reconcileOpen() {
    if (!this.provider.lookup) return 0;
    const open = await this.db
      .select({ providerRef: payments.providerRef })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.provider, this.provider.name), inArray(payments.status, ["CREATED", "PENDING", "FAILED", "CANCELLED"]), inArray(orders.status, ["PAYMENT_PENDING", "PAYMENT_FAILED"])));
    let confirmed = 0;
    for (const { providerRef } of open) {
      if (!providerRef) continue;
      try {
        const event = await this.provider.lookup(providerRef);
        if (event && !(await this.process(event)).duplicate) confirmed++;
      } catch (e) {
        this.logger.error(`Could not reconcile ${providerRef}: ${(e as Error).message}`);
      }
    }
    return confirmed;
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
