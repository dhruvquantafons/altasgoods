import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPORT_ROW_CAP } from "../src/common/tokens.js";
import { parseCsv } from "../src/modules/catalog/csv.js";
import { createTestApp, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

/** The row cap on exports, with a small cap standing in for 50,000. */

let t: TestContext;
let staff: Record<string, string>;

beforeAll(async () => {
  t = await createTestApp([{ provide: EXPORT_ROW_CAP, useValue: 3 }]);
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
});
afterAll(() => t.close());

const get = (kind: string, q: Record<string, string> = {}) =>
  t.http.get(`/v1/admin/exports/${kind}`).set(staff).query(q).buffer(true).parse((res, cb) => {
    let data = "";
    res.setEncoding("utf8");
    res.on("data", (c: string) => (data += c));
    res.on("end", () => cb(null, data));
  });

describe("export cap", () => {
  it("stops at the cap, adds a note row and flags the response", async () => {
    // each export writes an audit row, so the log has plenty by now
    for (let i = 0; i < 4; i++) await get("customers").expect(200);
    const r = await get("audit").expect(200);
    expect(r.headers["x-export-truncated"]).toBe("true");
    const all = parseCsv(r.body);
    expect(all).toHaveLength(1 + 3 + 1);
    expect(all.at(-1)).toEqual(["# truncated at 3 rows; narrow the date range"]);
    const log = await t.http.get("/v1/admin/audit").query({ action: "export.audit" }).set(staff).expect(200);
    expect(log.body.items[0].summary).toContain("3 rows");
    expect(log.body.items[0].summary).toContain("truncated");
  });

  it("does not flag an export that fits", async () => {
    const fits = await get("order-items", { q: "no-such-line" }).expect(200);
    expect(fits.headers["x-export-truncated"]).toBeUndefined();
    expect(parseCsv(fits.body)).toHaveLength(1);
  });
});
