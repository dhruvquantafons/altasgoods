import { ApiError } from "../../../common/errors.js";
import type { PaymentMethod } from "../../../db/schema.js";

export interface ProviderEvent {
  /** provider's unique event id; redelivery of the same id is ignored */
  id: string;
  type: "payment.captured" | "payment.failed";
  providerRef: string;
  failureReason?: string;
}

/** What the browser needs to open the gateway's own checkout for a session. */
export interface CheckoutDetails {
  gateway: "RAZORPAY";
  keyId: string;
  orderRef: string;
  currency: "INR";
}

/** Where a refund stands at the gateway. */
export type RefundState = "COMPLETED" | "PROCESSING" | "FAILED";

/**
 * Whether a failed gateway call is worth retrying: timeouts, network failures,
 * gateway 5xx and rate limits are; a 4xx refusal (validation, nothing to
 * refund) is not. An error may say so itself with a boolean `transient`;
 * anything that is not an ApiError (a bug, the database) is retried.
 */
export function isTransientGatewayError(e: unknown) {
  const own = (e as { transient?: unknown } | null)?.transient;
  if (typeof own === "boolean") return own;
  if (e instanceof ApiError) return [429, 502, 503, 504].includes(e.getStatus());
  return true;
}

export interface ProviderRefund {
  /** the gateway's id for the refund, used to ask about it later */
  providerRefundId: string;
  status: RefundState;
}

/**
 * Payment aggregator boundary. The sandbox and Razorpay implement it; the
 * rest of the API never talks to a gateway directly.
 */
export interface PaymentProvider {
  readonly name: "SANDBOX" | "RAZORPAY";
  createSession(input: { paymentId: string; orderId: string; amountPaise: number; method: PaymentMethod }): Promise<{ providerRef: string; redirectUrl: string }>;
  /** Verifies the signature and parses a webhook. Throws on a bad signature; null for events we do not act on. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent | null;
  /**
   * Refunds against a captured session. `receipt` is our refund id: before
   * creating a refund the provider looks for one it already made with that
   * receipt and returns it, so a retry after a lost answer does not refund
   * twice (the caller holds the refund row lock, so two runs never overlap).
   * Throws when the gateway could not be asked or refused; see
   * isTransientGatewayError for which throws are worth retrying.
   */
  refund(input: { providerRef: string; amountPaise: number; receipt: string }): Promise<ProviderRefund>;
  /**
   * The refund made with this receipt, or null when the gateway confirms there
   * is none. Throws when the gateway cannot be asked.
   */
  findRefund(input: { providerRef: string; receipt: string }): Promise<ProviderRefund | null>;
  /** Re-reads a refund the gateway is still processing. */
  refundStatus(providerRefundId: string): Promise<RefundState>;
  /** Gateways with a client side checkout: the details the browser opens it with. */
  checkout?(providerRef: string): CheckoutDetails;
  /** Gateways with a client side checkout: verifies what the browser reports back after paying. */
  confirm?(providerRef: string, payload: unknown): Promise<ProviderEvent>;
  /** Asks the gateway whether a session was paid, for when its webhook may not arrive. Null while unpaid. */
  lookup?(providerRef: string): Promise<ProviderEvent | null>;
}
