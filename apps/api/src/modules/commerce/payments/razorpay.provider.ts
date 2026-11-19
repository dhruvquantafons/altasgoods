import { createHmac, timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { z } from "zod";
import { ApiError, conflict } from "../../../common/errors.js";
import { fetchText, OutboundFailure, parseJson } from "../../../common/outbound.js";
import { AmbiguousRefundError, type CheckoutDetails, type PaymentProvider, type ProviderEvent, type ProviderRefund, type RefundState } from "./provider.js";

export const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";
const API = "https://api.razorpay.com/v1";
/** Longest we wait for Razorpay on any call. */
export const RAZORPAY_TIMEOUT_MS = 10_000;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  webOrigin: string;
  /** injectable for tests */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** What Razorpay Checkout hands the browser after a successful payment. */
export const razorpayConfirmBody = z.object({
  razorpayPaymentId: z.string().min(1).max(100),
  razorpayOrderId: z.string().min(1).max(100),
  razorpaySignature: z.string().min(1).max(200),
});

interface RazorpayPayment {
  id: string;
  order_id: string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  error_description?: string | null;
}

interface RazorpayRefund {
  id: string;
  receipt?: string | null;
  status: "pending" | "processed" | "failed";
}

/**
 * A Razorpay answer with an error status; `upstreamStatus` is what Razorpay
 * replied. Its 5xx and 429 answers are worth retrying, its other 4xx are not.
 */
class RazorpayError extends ApiError {
  readonly transient: boolean;

  constructor(
    readonly upstreamStatus: number,
    message: string,
  ) {
    super(502, "PAYMENT_GATEWAY_ERROR", message);
    this.transient = upstreamStatus >= 500 || upstreamStatus === 429;
  }
}

/** How Razorpay words a refund refused because its receipt was used already. */
const DUPLICATE_RECEIPT = /receipt|duplicate|already exists/i;

const refundState = (status: RazorpayRefund["status"]): RefundState => (status === "processed" ? "COMPLETED" : status === "failed" ? "FAILED" : "PROCESSING");

const hmac = (secret: string, data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");

const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Razorpay Standard Checkout. A payment attempt is a Razorpay order (its id is
 * our providerRef); the customer pays in Razorpay's checkout on our pay page,
 * and the result reaches us twice: from the browser (signature verified, then
 * re-read from Razorpay) and as a signed webhook. Both produce the same event
 * id, so whichever arrives second is a no-op.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "RAZORPAY" as const;
  private readonly logger = new Logger("Razorpay");
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: RazorpayConfig) {
    this.fetch = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs ?? RAZORPAY_TIMEOUT_MS;
  }

  async createSession(input: { paymentId: string; orderId: string; amountPaise: number }) {
    const order = await this.call<{ id: string }>("POST", "/orders", {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.paymentId.slice(0, 40),
      notes: { orderId: input.orderId, paymentId: input.paymentId },
    });
    return { providerRef: order.id, redirectUrl: `${this.config.webOrigin}/checkout/pay/${input.paymentId}` };
  }

  checkout(providerRef: string): CheckoutDetails {
    return { gateway: "RAZORPAY", keyId: this.config.keyId, orderRef: providerRef, currency: "INR" };
  }

  async confirm(providerRef: string, payload: unknown): Promise<ProviderEvent> {
    const parsed = razorpayConfirmBody.safeParse(payload);
    if (!parsed.success) throw new ApiError(400, "PAYMENT_CONFIRMATION_MALFORMED", "Unrecognised payment confirmation");
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = parsed.data;
    if (razorpayOrderId !== providerRef) throw new ApiError(400, "PAYMENT_CONFIRMATION_MISMATCH", "This confirmation is for a different payment");
    if (!sameHex(razorpaySignature, hmac(this.config.keySecret, `${razorpayOrderId}|${razorpayPaymentId}`))) {
      throw new ApiError(401, "PAYMENT_SIGNATURE_INVALID", "Payment signature does not match");
    }

    // the signature proves Razorpay issued it; the payment itself tells us whether money moved
    let payment = await this.call<RazorpayPayment>("GET", `/payments/${encodeURIComponent(razorpayPaymentId)}`);
    if (payment.order_id !== providerRef) throw new ApiError(400, "PAYMENT_CONFIRMATION_MISMATCH", "This confirmation is for a different payment");
    if (payment.status === "authorized") {
      // automatic capture is off on the account, so capture it ourselves
      payment = await this.call<RazorpayPayment>("POST", `/payments/${encodeURIComponent(payment.id)}/capture`, { amount: payment.amount, currency: "INR" });
    }
    if (payment.status === "captured" || payment.status === "refunded") return { id: `${payment.id}:payment.captured`, type: "payment.captured", providerRef };
    if (payment.status === "failed") return { id: `${payment.id}:payment.failed`, type: "payment.failed", providerRef, failureReason: payment.error_description ?? "Payment failed" };
    throw conflict("PAYMENT_IN_PROGRESS", "Razorpay has not finished processing this payment yet");
  }

  async lookup(providerRef: string): Promise<ProviderEvent | null> {
    const { items } = await this.call<{ items: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(providerRef)}/payments`);
    let paid = items.find((p) => p.status === "captured" || p.status === "refunded" || p.status === "authorized");
    if (!paid) return null;
    if (paid.status === "authorized") paid = await this.call<RazorpayPayment>("POST", `/payments/${encodeURIComponent(paid.id)}/capture`, { amount: paid.amount, currency: "INR" });
    return { id: `${paid.id}:payment.captured`, type: "payment.captured", providerRef };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent | null {
    const given = String(headers[RAZORPAY_SIGNATURE_HEADER] ?? "");
    if (!sameHex(given, hmac(this.config.webhookSecret, rawBody))) {
      throw new ApiError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature does not match");
    }
    let body: { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new ApiError(400, "WEBHOOK_MALFORMED", "Unrecognised webhook payload");
    }
    const payment = body.payload?.payment?.entity;
    // order.paid carries the same payment as payment.captured, so both map to one event id
    const type = body.event === "payment.captured" || body.event === "order.paid" ? "payment.captured" : body.event === "payment.failed" ? "payment.failed" : null;
    if (!type) return null;
    if (!payment?.id || !payment.order_id) throw new ApiError(400, "WEBHOOK_MALFORMED", "Unrecognised webhook payload");
    return {
      id: `${payment.id}:${type}`,
      type,
      providerRef: payment.order_id,
      ...(type === "payment.failed" ? { failureReason: payment.error_description ?? "Payment failed" } : {}),
    };
  }

  /**
   * Refunds part or all of the order's captured payment, tagged with
   * `receipt` (our refund id). Our protection against refunding twice is the
   * lookup first: a refund Razorpay already holds with this receipt (made on
   * an earlier attempt whose answer we lost) is returned instead. The caller
   * holds the refund row lock, so two attempts never overlap. If Razorpay
   * rejects the POST with a 400, the receipt is looked up again in case the
   * refund exists after all; a 400 about the receipt itself that the lookup
   * cannot match is ambiguous (AmbiguousRefundError), never a refusal.
   */
  async refund(input: { providerRef: string; amountPaise: number; receipt: string }): Promise<ProviderRefund> {
    const captured = await this.capturedPayment(input.providerRef);
    if (!captured) throw conflict("NOT_REFUNDABLE", "Razorpay has no captured payment for this order");
    const earlier = await this.refundByReceipt(captured.id, input.receipt);
    if (earlier) return { providerRefundId: earlier.id, status: refundState(earlier.status) };
    let refund: RazorpayRefund;
    try {
      refund = await this.call<RazorpayRefund>("POST", `/payments/${encodeURIComponent(captured.id)}/refund`, {
        amount: input.amountPaise,
        speed: "normal",
        receipt: input.receipt,
        notes: { refundId: input.receipt },
      });
    } catch (e) {
      // a receipt Razorpay has already seen: the refund exists, so report it
      const raced = e instanceof RazorpayError && e.upstreamStatus === 400 ? await this.refundByReceipt(captured.id, input.receipt) : null;
      if (!raced) {
        // Razorpay says the receipt exists but its list does not show it yet: the refund may have been made
        if (e instanceof RazorpayError && e.upstreamStatus === 400 && DUPLICATE_RECEIPT.test(e.message)) throw new AmbiguousRefundError(e.message);
        throw e;
      }
      refund = raced;
    }
    return { providerRefundId: refund.id, status: refundState(refund.status) };
  }

  async findRefund(input: { providerRef: string; receipt: string }): Promise<ProviderRefund | null> {
    // without a captured payment there is nothing a refund could have been made against
    const captured = await this.capturedPayment(input.providerRef);
    const refund = captured ? await this.refundByReceipt(captured.id, input.receipt) : null;
    return refund ? { providerRefundId: refund.id, status: refundState(refund.status) } : null;
  }

  async refundStatus(providerRefundId: string): Promise<RefundState> {
    const refund = await this.call<RazorpayRefund>("GET", `/refunds/${encodeURIComponent(providerRefundId)}`);
    return refundState(refund.status);
  }

  private async capturedPayment(providerRef: string) {
    const { items } = await this.call<{ items: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(providerRef)}/payments`);
    return items.find((p) => p.status === "captured" || p.status === "refunded") ?? null;
  }

  private async refundByReceipt(razorpayPaymentId: string, receipt: string) {
    const { items } = await this.call<{ items?: RazorpayRefund[] }>("GET", `/payments/${encodeURIComponent(razorpayPaymentId)}/refunds?count=100`);
    return (items ?? []).find((r) => r.receipt === receipt) ?? null;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res: Response;
    let text: string;
    try {
      ({ res, text } = await fetchText(
        this.fetch,
        `${API}${path}`,
        {
          method,
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64")}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        this.timeoutMs,
      ));
    } catch (e) {
      if (!(e instanceof OutboundFailure)) throw e;
      this.logger.error(`${method} ${path} ${e.message}`);
      if (e.timedOut) throw new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT", "The payment gateway took too long to answer. Please try again.");
      throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", "The payment gateway could not be reached");
    }
    const json = parseJson<T & { error?: { code?: string; description?: string } }>(text);
    if (!res.ok) {
      this.logger.error(`${method} ${path} failed with ${res.status}: ${json.error?.code ?? ""} ${json.error?.description ?? ""}`);
      throw new RazorpayError(res.status, json.error?.description ?? "The payment gateway could not be reached");
    }
    return json;
  }
}
