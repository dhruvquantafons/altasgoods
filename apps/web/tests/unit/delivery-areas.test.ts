import { describe, expect, it } from "vitest";
import { areasToText, parseAreas } from "@/components/admin/delivery-areas";

describe("delivery areas textareas", () => {
  it("parses one entry per line and ignores blanks and repeats", () => {
    const r = parseAreas({ blocked: "6825\n\n 110001 \n6825", noCod: "79", extraDays: "6825 3\n79, 4\n6825 5" });
    expect(r).toEqual({ ok: true, areas: { blocked: ["6825", "110001"], noCod: ["79"], extraDays: [{ prefix: "6825", days: 5 }, { prefix: "79", days: 4 }] } });
  });

  it("accepts empty lists", () => {
    expect(parseAreas({ blocked: "", noCod: "  \n", extraDays: "" })).toEqual({ ok: true, areas: { blocked: [], noCod: [], extraDays: [] } });
  });

  it("names the line and the problem", () => {
    const r = parseAreas({ blocked: "6825\n5\nabc", noCod: "1234567", extraDays: "6825\n79 16\n79 x" });
    expect(r).toMatchObject({
      ok: false,
      errors: {
        blocked: 'Line 2: "5" is not a 6 digit pincode or a 2 to 5 digit prefix',
        noCod: 'Line 1: "1234567" is not a 6 digit pincode or a 2 to 5 digit prefix',
        extraDays: expect.stringContaining("Line 1"),
      },
    });
  });

  it("round-trips through the text", () => {
    const areas = { blocked: ["6825"], noCod: ["79", "110001"], extraDays: [{ prefix: "7910", days: 2 }] };
    expect(parseAreas(areasToText(areas))).toEqual({ ok: true, areas });
  });
});
