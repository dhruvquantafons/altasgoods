import { describe, expect, it } from "vitest";
import { couponDiscount, deliveryFee, dispatchByDate, promiseDate } from "../src/modules/commerce/pricing.js";
import { canTransition, deriveOrderStatus } from "../src/modules/commerce/state.js";

describe("customer pricing", () => {
  const now = new Date("2026-10-01T05:00:00Z"); // 10:30 am IST
  const coupon = { code: "BIGDAYS10", type: "PERCENT" as const, value: 10, maxDiscountPaise: 150_000, minOrderPaise: 99_900, startsAt: new Date("2026-09-26T00:00:00+05:30"), endsAt: new Date("2026-10-05T23:59:00+05:30"), status: "ACTIVE" as const, usageLimit: null, usageCount: 0 };

  it("applies percent coupons with a cap and a minimum order", () => {
    expect(couponDiscount(coupon, 500_000, now).discountPaise).toBe(50_000);
    expect(couponDiscount(coupon, 5_000_000, now).discountPaise).toBe(150_000);
    expect(couponDiscount(coupon, 50_000, now)).toMatchObject({ discountPaise: 0 });
    expect(couponDiscount(coupon, 500_000, new Date("2026-10-06T00:00:00+05:30")).message).toMatch(/expired/);
  });

  it("charges ₹40 delivery only on small shipments", () => {
    expect(deliveryFee(30_000)).toBe(4_000);
    expect(deliveryFee(49_900)).toBe(0);
  });

  it("counts orders before 2 pm IST from today", () => {
    expect(promiseDate(now, 2).toISOString()).toBe("2026-10-03T15:30:00.000Z"); // 3 Oct, 9 pm IST
    expect(promiseDate(new Date("2026-10-01T09:00:00Z"), 2).toISOString()).toBe("2026-10-04T15:30:00.000Z"); // after cut-off
    expect(dispatchByDate(now, 1).toISOString()).toBe("2026-10-01T12:30:00.000Z"); // today 6 pm IST
  });
});

describe("order state machine", () => {
  it("lets store staff accept and pack but leaves shipping to courier scans", () => {
    expect(canTransition("NEW", "ACCEPTED", "STAFF")).toBe(true);
    expect(canTransition("ACCEPTED", "PACKED", "STAFF")).toBe(true);
    expect(canTransition("READY_TO_SHIP", "SHIPPED", "STAFF")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED", "CUSTOMER")).toBe(false);
  });

  it("derives the header from items", () => {
    expect(deriveOrderStatus("CONFIRMED", [{ status: "NEW" }, { status: "PACKED" }])).toBe("IN_PROGRESS");
    expect(deriveOrderStatus("IN_PROGRESS", [{ status: "SHIPPED" }, { status: "PACKED" }])).toBe("PARTIALLY_SHIPPED");
    expect(deriveOrderStatus("SHIPPED", [{ status: "DELIVERED" }, { status: "CANCELLED" }])).toBe("DELIVERED");
    expect(deriveOrderStatus("CONFIRMED", [{ status: "CANCELLED" }])).toBe("CANCELLED");
    expect(deriveOrderStatus("PAYMENT_PENDING", [{ status: "CANCELLED" }])).toBe("ABANDONED");
  });
});
