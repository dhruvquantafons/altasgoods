import { describe, expect, it } from "vitest";
import { toUiOrder } from "@/lib/api/account-orders";
import type { Order } from "@/lib/api/types";
import order from "./fixtures/order.json";

describe("API order to the account screens", () => {
  const o = order as unknown as Order;
  const ui = toUiOrder(o);

  it("converts paise to rupees and keeps every item", () => {
    expect(ui.id).toBe(o.id);
    expect(ui.items).toHaveLength(o.items.length);
    expect(ui.total).toBe(o.totalPaise / 100);
    expect(ui.items[0]!.price).toBe(o.items[0]!.unitPricePaise / 100);
  });

  it("derives the header status from the items", () => {
    expect(ui.status).toBe("shipped");
  });

  it("builds a timeline without repeated events", () => {
    // both items move through the same states; the customer sees each step once
    const labels = ui.timeline.map((e) => e.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(o.events.length).toBeGreaterThan(ui.timeline.length);
    expect(ui.timeline.every((e) => e.label && !e.label.includes("_"))).toBe(true);
  });
});
