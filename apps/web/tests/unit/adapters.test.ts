import { describe, expect, it } from "vitest";
import { toUiOrder } from "@/lib/api/account-orders";
import type { Order, SellerApplication } from "@/lib/api/types";
import { constitutionNoun, fileSize, formatPhone, stepDone, stepForFlag, STEPS } from "@/lib/onboarding";
import order from "./fixtures/order.json";
import application from "./fixtures/application-action-required.json";

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

describe("seller registration steps", () => {
  const app = application as unknown as SellerApplication;
  const me = { name: "Lakshmi Nair", emailVerified: true };

  it("judges each step from the saved application", () => {
    expect(stepDone("account", app, me)).toBe(true);
    expect(stepDone("account", app, { name: "Lakshmi Nair", emailVerified: false })).toBe(false);
    expect(stepDone("business", app, me)).toBe(true);
    expect(stepDone("bank", app, me)).toBe(true);
    // the reviewer rejected the address proof
    expect(stepDone("documents", app, me)).toBe(false);
    expect(stepDone("review", app, me)).toBe(false);
    expect(stepDone("business", null, me)).toBe(false);
  });

  it("sends flagged items to the step that fixes them", () => {
    const at = (key: string) => STEPS[stepForFlag(key)]!.key;
    expect(at("ADDRESS_PROOF")).toBe("documents");
    expect(at("SIGNATURE")).toBe("signature");
    expect(at("TRADEMARK")).toBe("brand");
    expect(at("bank")).toBe("bank");
    expect(at("unknown")).toBe("account");
  });

  it("formats for display", () => {
    expect(constitutionNoun("LLP")).toBe("limited liability partnership (LLP)");
    expect(formatPhone("+919845012345")).toBe("+91 98450 12345");
    expect(fileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(fileSize(300)).toBe("1 KB");
  });
});
