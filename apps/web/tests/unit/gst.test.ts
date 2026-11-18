import { describe, expect, it } from "vitest";
import { bpToPercent, gstLabel, isHsn, percentToBp } from "@/lib/gst";

describe("percentToBp", () => {
  it("reads a percentage as exact basis points", () => {
    expect(percentToBp("18")).toBe(1800);
    expect(percentToBp("18%")).toBe(1800);
    expect(percentToBp(" 5 % ")).toBe(500);
    expect(percentToBp("0.25")).toBe(25);
    expect(percentToBp("12.5")).toBe(1250);
    expect(percentToBp("12.05")).toBe(1205);
    expect(percentToBp("0")).toBe(0);
    expect(percentToBp("40")).toBe(4000);
  });

  it("is exact where floats are not", () => {
    // 1.15 * 100 is 114.99999999999999 in floating point
    expect(percentToBp("1.15")).toBe(115);
    expect(percentToBp("8.2")).toBe(820);
  });

  it("refuses what is not a rate from 0 to 40 with up to 2 decimals", () => {
    for (const bad of ["", "abc", "-1", "40.01", "41", "100", "1.234", "1,5", "12.", ".5", "1e1"]) expect(percentToBp(bad)).toBeNull();
  });
});

describe("bpToPercent", () => {
  it("is the reverse of percentToBp", () => {
    for (const bp of [0, 25, 300, 500, 820, 1205, 1250, 1800, 2800, 4000]) expect(percentToBp(bpToPercent(bp))).toBe(bp);
    expect(bpToPercent(1800)).toBe("18");
    expect(bpToPercent(25)).toBe("0.25");
    expect(bpToPercent(1250)).toBe("12.5");
    expect(gstLabel(500)).toBe("5%");
  });
});

describe("isHsn", () => {
  it("takes 4, 6 or 8 digits", () => {
    for (const ok of ["8517", "851712", "85171200"]) expect(isHsn(ok)).toBe(true);
    for (const bad of ["", "851", "85171", "8517123", "85a7"]) expect(isHsn(bad)).toBe(false);
  });
});
