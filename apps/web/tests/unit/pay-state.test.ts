import { describe, expect, it } from "vitest";
import { payState, type PayStateInput } from "@/components/store/pay-state";

const base: PayStateInput = { paymentStatus: "CREATED", orderStatus: "PAYMENT_PENDING", sessionOpen: true, timeUp: false, failed: false };
const kind = (over: Partial<PayStateInput>) => payState({ ...base, ...over });

describe("payState", () => {
  it("asks to pay while the attempt is open", () => {
    expect(kind({})).toEqual({ kind: "pay" });
    expect(kind({ paymentStatus: "PENDING" })).toEqual({ kind: "pay" });
  });

  it("shows a placed, paid order as paid", () => {
    expect(kind({ paymentStatus: "CAPTURED", orderStatus: "CONFIRMED" })).toEqual({ kind: "paid" });
    // captured a moment before the order caught up
    expect(kind({ paymentStatus: "CAPTURED", orderStatus: "PAYMENT_PENDING" })).toEqual({ kind: "paid" });
    // an older attempt of an order another attempt paid for
    expect(kind({ paymentStatus: "FAILED", orderStatus: "CONFIRMED" })).toEqual({ kind: "paid" });
  });

  it("never calls a captured payment on an ended order paid", () => {
    expect(kind({ paymentStatus: "CAPTURED", orderStatus: "ABANDONED" })).toEqual({ kind: "expired-refunded" });
    expect(kind({ paymentStatus: "CAPTURED", orderStatus: "CANCELLED" })).toEqual({ kind: "cancelled-refunded" });
  });

  it("refunds money that arrived after the order expired", () => {
    expect(kind({ paymentStatus: "REFUNDED", orderStatus: "ABANDONED" })).toEqual({ kind: "expired-refunded" });
  });

  it("tells a second payment of a live order from an expired one", () => {
    for (const orderStatus of ["CONFIRMED", "SHIPPED", "DELIVERED"]) {
      expect(kind({ paymentStatus: "REFUNDED", orderStatus })).toEqual({ kind: "duplicate-refunded" });
      expect(kind({ paymentStatus: "PARTIALLY_REFUNDED", orderStatus })).toEqual({ kind: "duplicate-refunded" });
    }
  });

  it("shows a cancelled paid order as cancelled and refunded, with nothing to pay", () => {
    expect(kind({ paymentStatus: "REFUNDED", orderStatus: "CANCELLED" })).toEqual({ kind: "cancelled-refunded" });
    expect(kind({ paymentStatus: "PARTIALLY_REFUNDED", orderStatus: "CANCELLED" })).toEqual({ kind: "cancelled-refunded" });
    expect(kind({ paymentStatus: "CANCELLED", orderStatus: "CANCELLED" })).toEqual({ kind: "cancelled" });
  });

  it("ends the attempt when the time to pay is over", () => {
    expect(kind({ timeUp: true })).toEqual({ kind: "expired" });
    expect(kind({ paymentStatus: "EXPIRED" })).toEqual({ kind: "expired" });
    expect(kind({ orderStatus: "ABANDONED" })).toEqual({ kind: "expired" });
    expect(kind({ failed: true, timeUp: true })).toEqual({ kind: "expired" });
  });

  it("offers to try again after a failure or a session that never opened", () => {
    expect(kind({ paymentStatus: "FAILED", orderStatus: "PAYMENT_FAILED" })).toEqual({ kind: "retry", reason: "failed" });
    expect(kind({ failed: true })).toEqual({ kind: "retry", reason: "failed" });
    expect(kind({ sessionOpen: false })).toEqual({ kind: "retry", reason: "unopened" });
  });
});
