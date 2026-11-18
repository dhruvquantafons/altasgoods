import { describe, expect, it } from "vitest";
import { slugProblem, slugify } from "@/lib/product-slug";

describe("product slug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(slugProblem("brass-table-lamp")).toBeNull();
    expect(slugProblem("lamp-2")).toBeNull();
    expect(slugProblem("abc")).toBeNull();
    expect(slugProblem("a".repeat(80))).toBeNull();
  });

  it("rejects short, long and malformed slugs with a reason", () => {
    expect(slugProblem("ab")).toMatch(/at least 3/);
    expect(slugProblem("a".repeat(81))).toMatch(/at most 80/);
    for (const bad of ["Brass-Lamp", "brass lamp", "-lamp", "lamp-", "brass--lamp", "brass_lamp", "lámp"]) expect(slugProblem(bad), bad).toMatch(/lowercase/);
  });

  it("makes a valid slug from any title", () => {
    expect(slugify("Linen Cushion Covers (Set of 2)")).toBe("linen-cushion-covers-set-of-2");
    expect(slugProblem(slugify("  ***  "))).toBeNull();
    expect(slugProblem(slugify("x".repeat(200)))).toBeNull();
  });
});
