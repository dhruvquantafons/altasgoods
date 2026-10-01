import type { PaymentMethod } from "../../../db/schema.js";

export interface ProviderEvent {
  /** provider's unique event id; redelivery of the same id is ignored */
  id: string;
  type: "payment.captured" | "payment.failed";
  providerRef: string;
  failureReason?: string;
}

/**
 * Payment aggregator boundary. The sandbox implements it today; a real
 * RBI licensed aggregator (spec decision D5) plugs in behind the same shape.
 */
export interface PaymentProvider {
  readonly name: "SANDBOX";
  createSession(input: { paymentId: string; orderId: string; amountPaise: number; method: PaymentMethod }): Promise<{ providerRef: string; redirectUrl: string }>;
  /** Verifies the signature and parses a webhook. Throws on a bad signature. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent;
  refund(input: { providerRef: string; amountPaise: number }): Promise<{ status: "COMPLETED" | "PROCESSING" }>;
}
