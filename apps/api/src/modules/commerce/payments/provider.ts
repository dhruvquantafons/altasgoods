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
   * Refunds against a captured session. `receipt` is our refund id and must make
   * the call idempotent: asking again with the same receipt returns the same
   * refund, never a second one. Throws when the gateway could not be asked
   * (the caller retries).
   */
  refund(input: { providerRef: string; amountPaise: number; receipt: string }): Promise<ProviderRefund>;
  /** Re-reads a refund the gateway is still processing. */
  refundStatus(providerRefundId: string): Promise<RefundState>;
  /** Gateways with a client side checkout: the details the browser opens it with. */
  checkout?(providerRef: string): CheckoutDetails;
  /** Gateways with a client side checkout: verifies what the browser reports back after paying. */
  confirm?(providerRef: string, payload: unknown): Promise<ProviderEvent>;
  /** Asks the gateway whether a session was paid, for when its webhook may not arrive. Null while unpaid. */
  lookup?(providerRef: string): Promise<ProviderEvent | null>;
}
