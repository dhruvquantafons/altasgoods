import { describe, expect, it } from "vitest";
import { csvField, csvRow, parseCsv, toCsv } from "../src/modules/catalog/csv.js";
import { istDateTime, istDayStart } from "../src/common/time.js";
import { rupeesCsv } from "../src/modules/admin/exports.format.js";

describe("toCsv", () => {
  it("quotes fields with commas, quotes and line breaks, doubling inner quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("cr\rhere")).toBe('"cr\rhere"');
  });

  it("joins rows with CRLF and leaves null and undefined empty", () => {
    expect(toCsv([["a", "b"], [1, null], [undefined, "x,y"]])).toBe('a,b\r\n1,\r\n,"x,y"\r\n');
    expect(csvRow(["a", 2])).toBe("a,2\r\n");
  });

  it("neutralises spreadsheet formulas with a leading apostrophe", () => {
    expect(csvField("=HYPERLINK(\"http://x\",\"y\")")).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvField("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvField("-2+3")).toBe("'-2+3");
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvField("\tTabbed")).toBe("'\tTabbed");
    expect(csvField("\rReturn")).toBe('"\'\rReturn"');
  });

  it("does not escape plain numbers, so negative money stays a number", () => {
    expect(csvField(-12)).toBe("-12");
    expect(csvField("-12.00")).toBe("-12.00");
    expect(csvField("1299.00")).toBe("1299.00");
    expect(csvField("+919876543210")).toBe("+919876543210");
    expect(csvField("-")).toBe("'-");
  });

  it("round-trips through parseCsv", () => {
    const rows = [["name", "note"], ["Asha, K", 'she said "ok"\nthen left'], ["=1+1", "fine"]];
    const back = parseCsv(toCsv(rows));
    expect(back[1]).toEqual(["Asha, K", 'she said "ok"\nthen left']);
    expect(back[2]).toEqual(["'=1+1", "fine"]);
  });
});

describe("export formatting", () => {
  it("writes rupees with two decimals", () => {
    expect(rupeesCsv(129900)).toBe("1299.00");
    expect(rupeesCsv(5)).toBe("0.05");
    expect(rupeesCsv(-1200)).toBe("-12.00");
    expect(rupeesCsv(0)).toBe("0.00");
    expect(rupeesCsv(null)).toBe("");
  });

  it("writes timestamps in IST", () => {
    expect(istDateTime(new Date("2026-03-01T19:00:00Z"))).toBe("2026-03-02 00:30");
    expect(istDateTime(null)).toBe("");
  });

  it("starts an IST day at 18:30 UTC the evening before", () => {
    expect(istDayStart("2026-03-02").toISOString()).toBe("2026-03-01T18:30:00.000Z");
    expect(() => istDayStart("2026-02-30")).toThrow();
  });
});
