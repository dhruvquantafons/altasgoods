import { describe, expect, it } from "vitest";
import { paise, toPaise, uiItemStatus, uiOrderStatus } from "@/lib/api/format";
import { ORDER_STATUS, ORDER_TRANSITIONS, ORDER_TRACKING_STEPS } from "@/lib/status";
import { discountPercent, formatCompact, formatINR, initials, slugify } from "@/lib/utils";

describe("money and numbers", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatINR(124999)).toBe("₹1,24,999");
    expect(formatINR(1499.5, { paise: true })).toBe("₹1,499.50");
    expect(paise(1299900)).toBe("₹12,999");
    expect(toPaise(12.345)).toBe(1235);
  });

  it("uses lakh and crore for compact figures", () => {
    expect(formatCompact(4_50_000)).toBe("4.5L");
    expect(formatCompact(3_10_00_000, true)).toBe("₹3.1Cr");
    expect(formatCompact(1200)).toBe("1.2K");
    expect(formatCompact(-1500)).toBe("-1.5K");
  });

  it("works out discounts, initials and slugs", () => {
    expect(discountPercent(749, 999)).toBe(25);
    expect(initials("Ananya Sharma")).toBe("AS");
    expect(slugify("Kaveri Home Studio!")).toBe("kaveri-home-studio");
  });
});

describe("status mapping from the API", () => {
  const apiItemStatuses = [
    "PENDING", "NEW", "ACCEPTED", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLATION_REQUESTED",
    "CANCELLED", "RTO_IN_TRANSIT", "RTO_RECEIVED", "LOST", "RETURN_REQUESTED", "RETURN_IN_PROGRESS", "RETURNED", "REPLACED", "CLOSED",
  ] as const;
  const apiOrderStatuses = ["PAYMENT_PENDING", "PAYMENT_FAILED", "ABANDONED", "CONFIRMED", "IN_PROGRESS", "PARTIALLY_SHIPPED", "SHIPPED", "PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED", "CLOSED"] as const;

  it("maps every API item status to a UI status with a badge", () => {
    for (const s of apiItemStatuses) expect(ORDER_STATUS[uiItemStatus(s)], s).toBeDefined();
    expect(uiItemStatus("NEW")).toBe("placed");
    expect(uiItemStatus("ACCEPTED")).toBe("confirmed");
  });

  it("maps every API order status to a UI status with a badge", () => {
    for (const s of apiOrderStatuses) expect(ORDER_STATUS[uiOrderStatus(s)], s).toBeDefined();
  });
});

describe("UI order state machine", () => {
  it("only moves between known states", () => {
    for (const [from, tos] of Object.entries(ORDER_TRANSITIONS)) {
      expect(ORDER_STATUS[from as keyof typeof ORDER_STATUS], from).toBeDefined();
      for (const to of tos) expect(ORDER_STATUS[to], `${from} -> ${to}`).toBeDefined();
    }
  });

  it("has terminal states and no way back from delivery to packing", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.returned).toEqual([]);
    expect(ORDER_TRANSITIONS.delivered).not.toContain("packed");
  });

  it("tracks orders through real states", () => {
    for (const step of ORDER_TRACKING_STEPS) expect(ORDER_STATUS[step.key]).toBeDefined();
  });
});
