import { describe, expect, it } from "vitest";
import { exportAreaFor, exportHref, exportSearch } from "@/lib/api/exports";
import { areaForPath, canSeePath } from "@/lib/api/staff";

describe("exportHref", () => {
  it("builds the link from the page's filters, leaving out empty and 'all' ones", () => {
    expect(exportHref("orders", {})).toBe("/admin/exports/orders");
    expect(exportHref("payments", { q: "ORD-1", status: "all", method: undefined, provider: "" })).toBe("/admin/exports/payments?q=ORD-1");
    expect(exportHref("order-items", { status: ["NEW", "ACCEPTED"], q: "lamp" })).toBe("/admin/exports/order-items?q=lamp&status=NEW%2CACCEPTED");
    expect(exportHref("audit", { action: "refund", from: "2026-03-01", to: "2026-03-31" })).toBe("/admin/exports/audit?action=refund&from=2026-03-01&to=2026-03-31");
  });

  it("encodes values", () => {
    expect(exportHref("customers", { q: "a&b=c" })).toBe("/admin/exports/customers?q=a%26b%3Dc");
  });
});

describe("exportSearch", () => {
  it("keeps only the filters an export understands", () => {
    const s = exportSearch(new URLSearchParams("q=x&status=NEW&page=3&pageSize=5&evil=1&from=2026-03-01"));
    expect(s).toBe("?q=x&status=NEW&from=2026-03-01");
    expect(exportSearch(new URLSearchParams("page=2"))).toBe("");
  });
});

describe("who may download an export", () => {
  it("ties each kind to the area of the page that offers it", () => {
    expect(exportAreaFor("orders")).toBe("orders");
    expect(exportAreaFor("order-items")).toBe("orders");
    expect(exportAreaFor("refunds")).toBe("payments");
    expect(exportAreaFor("audit")).toBe("audit");
    expect(exportAreaFor("nope")).toBeNull();
  });

  it("lets the proxy treat the download path like its page", () => {
    expect(areaForPath("/admin/exports/payments")).toBe("payments");
    expect(areaForPath("/admin/exports/mystery")).toBe("unmapped");
    expect(canSeePath("/admin/exports/orders", ["AUDITOR"])).toBe(true);
    expect(canSeePath("/admin/exports/orders", ["OPS_ADMIN"])).toBe(true);
    expect(canSeePath("/admin/exports/orders", ["CATALOG_MANAGER"])).toBe(false);
    expect(canSeePath("/admin/exports/audit", ["SUPPORT_AGENT"])).toBe(false);
  });
});
