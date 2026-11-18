import { describe, expect, it } from "vitest";
import { gstRateBpSchema, hsnSchema, taxIncludedPaise } from "../src/modules/catalog/gst.js";

describe("taxIncludedPaise", () => {
  it("takes the GST out of a GST-inclusive amount", () => {
    expect(taxIncludedPaise(118_000, 1800)).toBe(18_000);
    expect(taxIncludedPaise(100_000, 0)).toBe(0);
    expect(taxIncludedPaise(10_500, 500)).toBe(500);
  });

  it("rounds half up to the nearest paisa", () => {
    // 99900 * 1800 / 11800 = 15238.98...
    expect(taxIncludedPaise(99_900, 1800)).toBe(15_239);
    // 10001 * 500 / 10500 = 476.238 rounds down
    expect(taxIncludedPaise(10_001, 500)).toBe(476);
    // exact halves (0.16%): 313 * 16 / 10016 = 0.5 and 939 * 16 / 10016 = 1.5 both go up
    expect(taxIncludedPaise(313, 16)).toBe(1);
    expect(taxIncludedPaise(939, 16)).toBe(2);
    expect(taxIncludedPaise(3, 1000)).toBe(0); // 0.27
    expect(taxIncludedPaise(6, 1000)).toBe(1); // 0.55
  });

  it("never loses a paisa to floating point on large amounts", () => {
    expect(taxIncludedPaise(99_999_999, 2800)).toBe(Math.round((99_999_999 * 2800) / 12_800));
  });
});

describe("validation", () => {
  it("accepts 0 to 40% as whole basis points", () => {
    for (const ok of [0, 25, 300, 500, 1200, 1800, 2800, 4000, 1234]) expect(gstRateBpSchema.safeParse(ok).success).toBe(true);
    for (const bad of [-1, 4001, 18.5, "1800"]) expect(gstRateBpSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts an HSN of 4, 6 or 8 digits", () => {
    for (const ok of ["8517", "851712", "85171200"]) expect(hsnSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["851", "85171", "8517123", "851712001", "85a7"]) expect(hsnSchema.safeParse(bad).success).toBe(false);
  });
});
