import { describe, expect, it } from "vitest";
import { adminHome, areaForPath, canEdit, canSee, canSeePath, navFor } from "@/lib/api/staff";

describe("who sees and edits which area", () => {
  it("lets a Super Admin see and edit everything, staff included", () => {
    for (const area of ["overview", "orders", "catalog", "settings", "audit", "staff", "logistics", "support"] as const) {
      expect(canSee(["SUPER_ADMIN"], area)).toBe(true);
    }
    expect(canEdit(["SUPER_ADMIN"], "settings")).toBe(true);
    expect(canEdit(["SUPER_ADMIN"], "staff")).toBe(true);
  });

  it("lets an Auditor read every admin area but change nothing", () => {
    for (const area of ["overview", "orders", "returns", "customers", "catalog", "categories", "brands", "payments", "promotions", "cms", "content", "reviews", "audit", "settings"] as const) {
      expect(canSee(["AUDITOR"], area)).toBe(true);
      expect(canEdit(["AUDITOR"], area)).toBe(false);
    }
    expect(canSee(["AUDITOR"], "staff")).toBe(false);
    expect(canSee(["AUDITOR"], "logistics")).toBe(false);
  });

  it("keeps a Catalog Manager to the catalog, storefront and reviews", () => {
    const roles = ["CATALOG_MANAGER"];
    expect(navFor(roles)).toEqual(["catalog", "categories", "brands", "cms", "content", "reviews"]);
    expect(canEdit(roles, "catalog")).toBe(true);
    expect(canSee(roles, "orders")).toBe(false);
    expect(canSee(roles, "settings")).toBe(false);
    expect(adminHome(roles)).toBe("/admin/catalog");
  });

  it("lets Ops Admin run the store but not manage staff", () => {
    const roles = ["OPS_ADMIN"];
    expect(navFor(roles)).not.toContain("staff");
    expect(navFor(roles)).toContain("settings");
    expect(canEdit(roles, "orders")).toBe(true);
    expect(canSee(roles, "logistics")).toBe(true);
    expect(canSee(roles, "support")).toBe(false);
    expect(adminHome(roles)).toBe("/admin");
  });

  it("keeps the Care Desk out of AltasGoods Control", () => {
    const roles = ["SUPPORT_AGENT"];
    expect(navFor(roles)).toEqual([]);
    expect(adminHome(roles)).toBeNull();
    expect(canSee(roles, "support")).toBe(true);
    expect(canSeePath("/admin/account", roles)).toBe(false);
  });

  it("combines roles", () => {
    expect(canEdit(["AUDITOR", "CATALOG_MANAGER"], "catalog")).toBe(true);
    expect(canEdit(["AUDITOR", "CATALOG_MANAGER"], "orders")).toBe(false);
  });
});

describe("paths", () => {
  it("maps admin paths to their area", () => {
    expect(areaForPath("/admin")).toBe("overview");
    expect(areaForPath("/admin/catalog/123")).toBe("catalog");
    expect(areaForPath("/admin/staff")).toBe("staff");
    expect(areaForPath("/support/tickets")).toBe("support");
    expect(areaForPath("/account/profile")).toBeNull();
  });

  it("closes an admin page nobody mapped yet to everyone but Super Admin", () => {
    expect(areaForPath("/admin/something-new")).toBe("unmapped");
    expect(canSeePath("/admin/something-new", ["OPS_ADMIN"])).toBe(false);
    expect(canSeePath("/admin/something-new", ["SUPER_ADMIN"])).toBe(true);
  });

  it("checks a path against the roles", () => {
    expect(canSeePath("/admin/orders/AG-1", ["CATALOG_MANAGER"])).toBe(false);
    expect(canSeePath("/admin/catalog/new", ["CATALOG_MANAGER"])).toBe(true);
    expect(canSeePath("/admin/account", ["AUDITOR"])).toBe(true);
    expect(canSeePath("/", [])).toBe(true);
  });
});
