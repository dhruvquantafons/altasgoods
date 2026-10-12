import { createHmac, timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { z } from "zod";
import { ApiError, conflict } from "../../../common/errors.js";
import type { CheckoutDetails, PaymentProvider, ProviderEvent } from "./provider.js";

export const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";
const API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  webOrigin: string;
  /** injectable for tests */
  fetch?: typeof fetch;
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

  constructor(private readonly config: RazorpayConfig) {
    this.fetch = config.fetch ?? fetch;
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

  async refund(input: { providerRef: string; amountPaise: number }) {
    const { items } = await this.call<{ items: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(input.providerRef)}/payments`);
    const captured = items.find((p) => p.status === "captured" || p.status === "refunded");
    if (!captured) throw conflict("NOT_REFUNDABLE", "Razorpay has no captured payment for this order");
    const refund = await this.call<{ id: string; status: "pending" | "processed" | "failed" }>("POST", `/payments/${encodeURIComponent(captured.id)}/refund`, {
      amount: input.amountPaise,
      speed: "normal",
    });
    if (refund.status === "failed") throw conflict("REFUND_FAILED", "Razorpay could not process this refund");
    return { status: refund.status === "processed" ? ("COMPLETED" as const) : ("PROCESSING" as const) };
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; description?: string } };
    if (!res.ok) {
      this.logger.error(`${method} ${path} failed with ${res.status}: ${json.error?.code ?? ""} ${json.error?.description ?? ""}`);
      throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", json.error?.description ?? "The payment gateway could not be reached");
    }
    return json;
  }
}
