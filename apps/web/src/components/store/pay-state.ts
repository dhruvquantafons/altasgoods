/**
 * What the pay screen shows, from the payment and its order as the API
 * reports them. A payment the API reports REFUNDED or PARTIALLY_REFUNDED is
 * being given back (the refund may still be on its way).
 */
export type PayState =
  /** the order is confirmed and paid: go to it */
  | { kind: "paid" }
  /** the order is confirmed (paid by another attempt) and this payment was a second one, being refunded */
  | { kind: "duplicate-refunded" }
  /** the order was cancelled after it was paid; the money is refunded */
  | { kind: "cancelled-refunded" }
  /** the order was cancelled before anything was paid */
  | { kind: "cancelled" }
  /** money arrived after the order had expired, so it went straight back */
  | { kind: "expired-refunded" }
  /** the time to pay ended; nothing was charged */
  | { kind: "expired" }
  /** the attempt failed, or the gateway never opened it: start a new attempt */
  | { kind: "retry"; reason: "failed" | "unopened" }
  /** waiting for the customer to pay */
  | { kind: "pay" };

export interface PayStateInput {
  paymentStatus: string;
  orderStatus: string;
  /** false when the gateway session never opened */
  sessionOpen: boolean;
  /** the payment window's countdown reached zero */
  timeUp: boolean;
  /** this attempt failed (reported by the API or just now in the browser) */
  failed: boolean;
}

const NOT_PLACED = ["PAYMENT_PENDING", "PAYMENT_FAILED", "ABANDONED", "CANCELLED"];
const GIVEN_BACK = ["REFUNDED", "PARTIALLY_REFUNDED"];

export function payState(p: PayStateInput): PayState {
  const refunded = GIVEN_BACK.includes(p.paymentStatus);
  const charged = refunded || p.paymentStatus === "CAPTURED";
  if (p.orderStatus === "CANCELLED") return { kind: charged ? "cancelled-refunded" : "cancelled" };
  if (p.orderStatus === "ABANDONED") return { kind: charged ? "expired-refunded" : "expired" };
  const live = !NOT_PLACED.includes(p.orderStatus);
  if (refunded) return { kind: live ? "duplicate-refunded" : "expired-refunded" };
  // captured before the order caught up, or the order was paid by another attempt
  if (p.paymentStatus === "CAPTURED" || live) return { kind: "paid" };
  if (p.timeUp || p.paymentStatus === "EXPIRED" || p.paymentStatus === "CANCELLED") return { kind: "expired" };
  if (p.failed || p.paymentStatus === "FAILED") return { kind: "retry", reason: "failed" };
  if (!p.sessionOpen && (p.paymentStatus === "CREATED" || p.paymentStatus === "PENDING")) return { kind: "retry", reason: "unopened" };
  return { kind: "pay" };
}
