import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { ApiError } from "../../../common/errors.js";
import type { PaymentProvider, ProviderEvent } from "./provider.js";

export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";

export const signSandbox = (body: string) => createHmac("sha256", env().PAYMENTS_WEBHOOK_SECRET).update(body).digest("hex");

/**
 * A local stand-in for a payment gateway. The customer completes payment on a
 * BluBuy hosted sandbox page; the result arrives as a signed webhook exactly
 * like a real aggregator would send it.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "SANDBOX" as const;

  async createSession(input: { paymentId: string }) {
    return { providerRef: `sbx_${randomBytes(9).toString("base64url")}`, redirectUrl: `${env().WEB_ORIGIN}/checkout/pay/${input.paymentId}` };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent {
    const given = String(headers[SANDBOX_SIGNATURE_HEADER] ?? "");
    const expected = signSandbox(rawBody.toString("utf8"));
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new ApiError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature does not match");
    }
    const body = JSON.parse(rawBody.toString("utf8")) as ProviderEvent;
    if (!body.id || !body.providerRef || (body.type !== "payment.captured" && body.type !== "payment.failed")) {
      throw new ApiError(400, "WEBHOOK_MALFORMED", "Unrecognised webhook payload");
    }
    return body;
  }

  async refund() {
    return { status: "COMPLETED" as const };
  }

  /** Builds the event a real gateway would send after the customer acts. */
  static event(providerRef: string, outcome: "SUCCESS" | "FAILURE"): ProviderEvent {
    return outcome === "SUCCESS"
      ? { id: `evt_${randomBytes(9).toString("base64url")}`, type: "payment.captured", providerRef }
      : { id: `evt_${randomBytes(9).toString("base64url")}`, type: "payment.failed", providerRef, failureReason: "Payment declined in the sandbox" };
  }
}
