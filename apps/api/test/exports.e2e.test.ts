import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCsv } from "../src/modules/catalog/csv.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

/** CSV exports of orders, order lines, payments, refunds, customers and the audit log. */

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let auditor: Record<string, string>;
let catalog: Record<string, string>;
let addressId: string;
let paidOrderId: string;
const A = "/v1/admin";
const KINDS = ["orders", "order-items", "payments", "refunds", "customers", "audit"] as const;

const HEADERS: Record<(typeof KINDS)[number], string[]> = {
  orders: ["Order ID", "Placed at", "Customer name", "Customer email", "Phone", "Status", "Payment method", "Payment status", "Items", "Subtotal", "Discount", "Delivery fee", "Total", "GST total", "Refunded", "Pincode", "City", "State", "Coupon code"],
  "order-items": ["Order ID", "Item ID", "Product", "SKU", "Variant", "Qty", "Unit price", "Line total", "GST rate %", "HSN", "Taxable value", "GST amount", "Status", "AWB", "Courier", "Delivered at"],
  payments: ["Payment ID", "Order ID", "Created at", "Method", "Provider", "Provider ref", "Status", "Amount"],
  refunds: ["Refund ID", "Order ID", "Payment ID", "Created at", "Completed at", "Amount", "Status", "Method", "Reference", "Reason", "Created by"],
  customers: ["ID", "Name", "Email", "Phone", "Status", "Joined at", "Orders", "Total spent"],
  audit: ["Time", "Actor", "Action", "Entity type", "Entity ID", "Summary", "Changes"],
};

const get = (kind: string, q: Record<string, string> = {}, who = staff) =>
  t.http.get(`${A}/exports/${kind}`).set(who).query(q).buffer(true).parse((res, cb) => {
    let data = "";
    res.setEncoding("utf8");
    res.on("data", (c: string) => (data += c));
    res.on("end", () => cb(null, data));
  });
const rows = (text: string) => parseCsv(text).filter((r) => !r[0]!.startsWith("# "));

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  for (const [email, roles] of [["audit.export@altasgoods.in", ["AUDITOR"]], ["catalog.export@altasgoods.in", ["CATALOG_MANAGER"]]] as const) {
    await t.http.post(`${A}/staff`).set(staff).send({ name: "Staff", email, roles, mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
    await t.http.post("/v1/me/password").set((await signIn(t.http, email, "temporary-pass-1")).auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
  }
  auditor = (await signIn(t.http, "audit.export@altasgoods.in", "chosen-password-1")).auth;
  catalog = (await signIn(t.http, "catalog.export@altasgoods.in", "chosen-password-1")).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;

  const offerId = (await t.http.get("/v1/products/lamp-arc").expect(200)).body.offerId as string;
  const placed = await t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, paymentMethod: "UPI", lines: [{ offerId, qty: 1, variant: "" }] }).expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  paidOrderId = placed.body.order.id;
  const speaker = (await t.http.get("/v1/products/speaker-boom").expect(200)).body.offerId as string;
  await t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, paymentMethod: "COD", lines: [{ offerId: speaker, qty: 1, variant: "" }] }).expect(201);
  await t.http.post(`${A}/orders/${paidOrderId}/refunds`).set(staff).send({ amountPaise: 12_345, reason: "Goodwill, \"late\" parcel", method: "SOURCE" }).expect(201);
  // a customer whose name is a spreadsheet formula
  await signUp(t.http, "formula.person@example.com", '=HYPERLINK("http://evil.example","click")');
});
afterAll(() => t.close());

describe("export files", () => {
  it.each(KINDS)("%s: a CSV download with a BOM, a header row and no-store headers", async (kind) => {
    const r = await get(kind).expect(200);
    expect(r.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(r.headers["content-disposition"]).toMatch(new RegExp(`^attachment; filename="altasgoods-${kind}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`));
    expect(r.headers["cache-control"]).toBe("private, no-store");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-export-truncated"]).toBeUndefined();
    expect(r.body.charCodeAt(0)).toBe(0xfeff);
    expect(r.body).toContain("\r\n");
    expect(parseCsv(r.body)[0]).toEqual(HEADERS[kind]);
  });

  it("accepts an optional .csv suffix and refuses an unknown kind", async () => {
    await get("orders.csv").expect(200);
    await get("secrets").expect(422);
  });

  it("writes money in rupees and times in IST", async () => {
    const orderRow = rows((await get("orders", { q: paidOrderId }).expect(200)).body)[1]!;
    const col = (name: string) => orderRow[HEADERS.orders.indexOf(name)]!;
    expect(col("Order ID")).toBe(paidOrderId);
    expect(col("Total")).toMatch(/^\d+\.\d{2}$/);
    expect(col("Placed at")).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(col("Payment method")).toBe("UPI");
    expect(col("Items")).toBe("1");

    const refundRow = rows((await get("refunds", { q: paidOrderId }).expect(200)).body)[1]!;
    expect(refundRow[HEADERS.refunds.indexOf("Amount")]).toBe("123.45");
    expect(refundRow[HEADERS.refunds.indexOf("Reason")]).toBe('Goodwill, "late" parcel');
    expect(refundRow[HEADERS.refunds.indexOf("Method")]).toBe("SOURCE");

    const line = rows((await get("order-items", { q: paidOrderId }).expect(200)).body)[1]!;
    const unit = Number(line[HEADERS["order-items"].indexOf("Unit price")]);
    expect(line[HEADERS["order-items"].indexOf("Line total")]).toBe(unit.toFixed(2));
    expect(line[HEADERS["order-items"].indexOf("Qty")]).toBe("1");
  });

  it("neutralises a customer name that is a formula", async () => {
    const text = (await get("customers", { q: "formula.person" }).expect(200)).body;
    const r = rows(text)[1]!;
    expect(r[HEADERS.customers.indexOf("Name")]).toBe(`'=HYPERLINK("http://evil.example","click")`);
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});

describe("filters", () => {
  it("narrows by the same filters as the lists", async () => {
    const all = rows((await get("orders").expect(200)).body).length - 1;
    expect(all).toBeGreaterThan(1);
    const one = rows((await get("orders", { q: paidOrderId }).expect(200)).body);
    expect(one).toHaveLength(2);
    const cod = rows((await get("orders", { method: "COD" }).expect(200)).body).slice(1);
    expect(cod.length).toBeGreaterThan(0);
    expect(cod.length).toBeLessThan(all);
    expect(cod.every((r) => r[HEADERS.orders.indexOf("Payment method")] === "COD")).toBe(true);
    const paid = rows((await get("payments", { status: "CAPTURED" }).expect(200)).body).slice(1);
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.every((r) => r[HEADERS.payments.indexOf("Status")] === "CAPTURED")).toBe(true);
    const failedRefunds = rows((await get("refunds", { status: "FAILED" }).expect(200)).body);
    expect(failedRefunds).toHaveLength(1);
    const lines = rows((await get("order-items", { status: "NEW" }).expect(200)).body).slice(1);
    expect(lines.every((r) => r[HEADERS["order-items"].indexOf("Status")] === "NEW")).toBe(true);
    const actions = rows((await get("audit", { action: "refund" }).expect(200)).body).slice(1);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((r) => r[HEADERS.audit.indexOf("Action")]!.startsWith("refund."))).toBe(true);
  });

  it("narrows by from and to on IST days", async () => {
    const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() + 330 * 60_000 - 86_400_000).toISOString().slice(0, 10);
    const today = rows((await get("orders", { from: day, to: day, q: paidOrderId }).expect(200)).body);
    expect(today).toHaveLength(2);
    expect(rows((await get("orders", { from: tomorrow }).expect(200)).body)).toHaveLength(1);
    expect(rows((await get("orders", { to: yesterday, q: paidOrderId }).expect(200)).body)).toHaveLength(1);
    expect(rows((await get("payments", { from: tomorrow }).expect(200)).body)).toHaveLength(1);
    expect(rows((await get("customers", { from: tomorrow }).expect(200)).body)).toHaveLength(1);
    expect(rows((await get("audit", { from: tomorrow }).expect(200)).body)).toHaveLength(1);
    expect(rows((await get("refunds", { from: day }).expect(200)).body).length).toBeGreaterThan(1);
  });

  it("refuses a bad date or a backwards range", async () => {
    await get("orders", { from: "02-03-2026" }).expect(422);
    await get("orders", { from: "2026-02-30" }).expect(422);
    await get("orders", { from: "2026-03-05", to: "2026-03-01" }).expect(422);
    await get("orders", { status: "NOPE" }).expect(422);
  });
});

describe("who may export", () => {
  it("lets an auditor read, and keeps everyone else out", async () => {
    await get("orders", {}, auditor).expect(200);
    await get("audit", {}, auditor).expect(200);
    await get("orders", {}, catalog).expect(403);
    await get("customers", {}, catalog).expect(403);
    await get("orders", {}, shopper).expect(403);
    await t.http.get(`${A}/exports/orders`).expect(401);
  });
});

describe("auditing exports", () => {
  it("records each export with its row count and filters", async () => {
    const before = rows((await get("customers", { q: "formula.person" }).expect(200)).body).length - 1;
    expect(before).toBe(1);
    const log = await t.http.get(`${A}/audit`).query({ action: "export.customers" }).set(staff).expect(200);
    const entry = log.body.items[0];
    expect(entry).toMatchObject({ action: "export.customers", entityType: "export", entityId: "customers" });
    expect(entry.summary).toContain("1 row");
    expect(entry.summary).toContain("formula.person");

    await get("payments", {}, auditor).expect(200);
    const pay = await t.http.get(`${A}/audit`).query({ action: "export.payments" }).set(staff).expect(200);
    expect(pay.body.items[0].actorName).toBe("Staff");
    expect(pay.body.items[0].summary).toMatch(/^Exported \d+ rows? of payments/);
  });
});

describe("text that looks like a number", () => {
  it("escapes a phone number starting with +", async () => {
    await signUp(t.http, "plus.phone@example.com", "Plus Phone");
    await t.http.patch("/v1/me").set((await signIn(t.http, "plus.phone@example.com", "a-long-password")).auth).send({ phone: "9876543210" }).expect(200);
    const r = rows((await get("customers", { q: "plus.phone" }).expect(200)).body)[1]!;
    const phone = r[HEADERS.customers.indexOf("Phone")]!;
    expect(phone).toMatch(/^'\+91/);
  });
});
