import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { categories, orderItems, products, storeSettings } from "../src/db/schema.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import { SettingsService } from "../src/modules/admin/settings.service.js";
import { parseCsv } from "../src/modules/catalog/csv.js";
import { taxIncludedPaise } from "../src/modules/catalog/gst.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

/** GST rates set in the admin, GST kept on every order line, and the store-wide cash on delivery switch. */

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let auditor: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const A = "/v1/admin";

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  await t.http.post(`${A}/staff`).set(staff).send({ name: "Audit Or", email: "audit.gst@altasgoods.in", roles: ["AUDITOR"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
  await t.http.post("/v1/me/password").set((await signIn(t.http, "audit.gst@altasgoods.in", "temporary-pass-1")).auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
  auditor = (await signIn(t.http, "audit.gst@altasgoods.in", "chosen-password-1")).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(async () => {
  t.clock.reset();
  await t.http.put(`${A}/settings`).set(staff).send(DEFAULT_SETTINGS).expect(200);
  await db.update(categories).set({ gstRateBp: null, hsn: null });
  await db.update(products).set({ gstRateBp: null, hsn: null });
});

const offerOf = async (slug: string) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body.offerId as string;
const place = (body: object) => t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, ...body });
const saveSettings = (patch: object) => t.http.put(`${A}/settings`).set(staff).send({ ...DEFAULT_SETTINGS, ...patch });
/** Places one of a product and returns what was stored on its line. */
async function lineOf(slug: string, extra: object = {}) {
  const placed = await place({ paymentMethod: "UPI", lines: [{ offerId: await offerOf(slug), qty: 1, variant: "" }], ...extra }).expect(201);
  const [row] = await db.select().from(orderItems).where(eq(orderItems.orderId, placed.body.order.id));
  return { order: placed.body.order, row: row! };
}
const productRow = async (slug: string) => (await db.select().from(products).where(eq(products.slug, slug)))[0]!;

describe("settings", () => {
  it("fills in the tax group and the cash on delivery switch for a row saved before they existed", async () => {
    const old = { ...DEFAULT_SETTINGS, cod: { maxOrderPaise: 123_400 } } as Record<string, unknown>;
    delete old.tax;
    await db.update(storeSettings).set({ value: old as never }).where(eq(storeSettings.id, "store"));
    (t.app.get(SettingsService) as unknown as { cache: unknown }).cache = null;
    const r = await t.http.get(`${A}/settings`).set(staff).expect(200);
    expect(r.body.tax).toEqual({ defaultGstRateBp: 1800, defaultHsn: null });
    expect(r.body.cod).toEqual({ enabled: true, maxOrderPaise: 123_400 });
    const pub = await t.http.get("/v1/storefront/settings").expect(200);
    expect(pub.body).not.toHaveProperty("tax");
  });

  it("refuses a rate over 40% and an HSN that is not 4, 6 or 8 digits", async () => {
    await saveSettings({ tax: { defaultGstRateBp: 4001, defaultHsn: null } }).expect(422);
    await saveSettings({ tax: { defaultGstRateBp: 1800, defaultHsn: "12345" } }).expect(422);
    await saveSettings({ tax: { defaultGstRateBp: 12.5, defaultHsn: null } }).expect(422);
    await saveSettings({ tax: { defaultGstRateBp: 4000, defaultHsn: "85171200" } }).expect(200);
    await t.http.post(`${A}/categories`).set(staff).send({ name: "Bad Tax", hsn: "12345" }).expect(422);
    await t.http.patch(`${A}/products/${(await productRow("cookware-pan")).id}`).set(staff).send({ gstRateBp: 5000 }).expect(422);
  });

  it("is read-only for an auditor", async () => {
    await t.http.put(`${A}/settings`).set(auditor).send(DEFAULT_SETTINGS).expect(403);
    const cat = (await db.select().from(categories).where(eq(categories.id, (await productRow("cookware-pan")).categoryId)))[0]!;
    await t.http.patch(`${A}/categories/${cat.id}`).set(auditor).send({ gstRateBp: 500 }).expect(403);
    await t.http.patch(`${A}/products/${(await productRow("cookware-pan")).id}`).set(auditor).send({ hsn: "7323" }).expect(403);
    await t.http.get(`${A}/settings`).set(auditor).expect(200);
  });
});

describe("the rate an order line is sold at", () => {
  it("is the store default when nothing else is set", async () => {
    const { row } = await lineOf("cookware-pan");
    expect(row).toMatchObject({ gstRateBp: 1800, hsn: null });
    expect(row.taxPaise).toBe(taxIncludedPaise(row.unitPricePaise, 1800));
  });

  it("follows product, then subcategory, then category, then the store default", async () => {
    const p = await productRow("cookware-pan");
    await saveSettings({ tax: { defaultGstRateBp: 1800, defaultHsn: "9999" } }).expect(200);
    expect((await lineOf("cookware-pan")).row).toMatchObject({ gstRateBp: 1800, hsn: "9999" });

    // the category (set through the admin API) beats the default
    await t.http.patch(`${A}/categories/${p.categoryId}`).set(staff).send({ gstRateBp: 1200, hsn: "7323" }).expect(200);
    expect((await lineOf("cookware-pan")).row).toMatchObject({ gstRateBp: 1200, hsn: "7323" });

    // a subcategory with its own rate beats its parent, and takes the parent's HSN when it has none
    await db.update(categories).set({ gstRateBp: 500 }).where(eq(categories.name, p.subcategory));
    expect((await lineOf("cookware-pan")).row).toMatchObject({ gstRateBp: 500, hsn: "7323" });

    // the product beats both, and a rate of 0 is a rate, not "unset"
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ gstRateBp: 0, hsn: "73239990" }).expect(200);
    const { row } = await lineOf("cookware-pan");
    expect(row).toMatchObject({ gstRateBp: 0, hsn: "73239990", taxPaise: 0 });

    // clearing the override goes back to the subcategory, and clearing that to its parent
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ gstRateBp: null, hsn: null }).expect(200);
    expect((await lineOf("cookware-pan")).row).toMatchObject({ gstRateBp: 500, hsn: "7323" });
    await db.update(categories).set({ gstRateBp: null }).where(eq(categories.name, p.subcategory));
    expect((await lineOf("cookware-pan")).row).toMatchObject({ gstRateBp: 1200 });
  });

  it("is shown to the admin as what a product or category inherits", async () => {
    const p = await productRow("cookware-pan");
    const cat = await t.http.patch(`${A}/categories/${p.categoryId}`).set(staff).send({ gstRateBp: 1200 }).expect(200);
    expect(cat.body).toMatchObject({ gstRateBp: 1200, inheritedGst: { gstRateBp: 1800, rateFrom: "the store default" } });
    const prod = await t.http.get(`${A}/products/${p.id}`).set(staff).expect(200);
    expect(prod.body).toMatchObject({ gstRateBp: null, hsn: null, inheritedGst: { gstRateBp: 1200, rateFrom: cat.body.name } });
  });

  it("keeps the rate it was sold at when the settings change later", async () => {
    const { row } = await lineOf("cookware-pan");
    await saveSettings({ tax: { defaultGstRateBp: 500, defaultHsn: null } }).expect(200);
    const [after] = await db.select().from(orderItems).where(eq(orderItems.id, row.id));
    expect(after).toMatchObject({ gstRateBp: 1800, taxPaise: row.taxPaise });
  });
});

describe("the GST stored on a line", () => {
  it("is taken from the line's amount after its share of the coupon", async () => {
    const a = await offerOf("headphones-studio");
    const b = await offerOf("speaker-boom");
    const placed = await place({ paymentMethod: "UPI", couponCode: "BIGDAYS10", lines: [{ offerId: a, qty: 2, variant: "" }, { offerId: b, qty: 1, variant: "" }] }).expect(201);
    const order = placed.body.order;
    expect(order.couponDiscountPaise).toBeGreaterThan(0);
    const rows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(rows).toHaveLength(2);
    let sum = 0;
    for (const r of rows) {
      const gross = r.unitPricePaise * r.qty;
      const net = gross - Math.round((order.couponDiscountPaise * gross) / order.subtotalPaise);
      expect(net).toBeLessThan(gross);
      expect(r.taxPaise).toBe(Math.round((net * 1800) / 11_800));
      sum += r.taxPaise;
    }
    // what the customer sees: per line and in total (delivery carries none)
    expect(order.items.map((i: { taxPaise: number }) => i.taxPaise).sort()).toEqual(rows.map((r) => r.taxPaise).sort());
    expect(order.gstIncludedPaise).toBe(sum);
  });

  it("leaves a cancelled line out of the total GST", async () => {
    const a = await offerOf("headphones-studio");
    const b = await offerOf("speaker-boom");
    const placed = await place({ paymentMethod: "COD", lines: [{ offerId: a, qty: 1, variant: "" }, { offerId: b, qty: 1, variant: "" }] }).expect(201);
    const [first, second] = placed.body.order.items;
    const cancelled = await t.http.post(`/v1/me/orders/${placed.body.order.id}/cancel`).set(shopper).send({ itemIds: [first.id], reason: "Changed my mind" }).expect(200);
    expect(cancelled.body.gstIncludedPaise).toBe(second.taxPaise);
    const admin = await t.http.get(`${A}/orders/${placed.body.order.id}`).set(staff).expect(200);
    expect(admin.body.gstIncludedPaise).toBe(second.taxPaise);
    expect(admin.body.items.find((i: { id: string }) => i.id === second.id)).toMatchObject({ gstRateBp: 1800, taxPaise: second.taxPaise });
  });
});

describe("the cash on delivery switch", () => {
  it("turns cash on delivery off in the quote and refuses it at placing", async () => {
    const lines = [{ offerId: await offerOf("cookware-pan"), qty: 1, variant: "" }];
    const open = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200);
    expect(open.body.cod.available).toBe(true);

    await saveSettings({ cod: { enabled: false, maxOrderPaise: DEFAULT_SETTINGS.cod.maxOrderPaise } }).expect(200);
    const quote = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200);
    expect(quote.body.cod).toEqual({ available: false, reason: "Cash on delivery is switched off" });
    const refused = await place({ paymentMethod: "COD", lines }).expect(422);
    expect(refused.body.code).toBe("COD_UNAVAILABLE");
    await place({ paymentMethod: "UPI", lines }).expect(201);

    await saveSettings({ cod: { enabled: true, maxOrderPaise: DEFAULT_SETTINGS.cod.maxOrderPaise } }).expect(200);
    await place({ paymentMethod: "COD", lines }).expect(201);
  });
});

describe("imports and exports", () => {
  it("reads GST rate and HSN columns from a product file", async () => {
    const csv = ["Title,SKU,Category,Brand,Price,Stock,GST rate (%),HSN", "Gst Import Tea,GST-IMP-1,Tea Test,Gst Brand,250,5,12.5,090240", "Gst Bad Rate,GST-IMP-2,Tea Test,Gst Brand,250,5,50,"].join("\n");
    const r = await t.http.post(`${A}/products/import?dryRun=false`).set(staff).attach("file", Buffer.from(csv, "utf8"), "p.csv").expect(201);
    expect(r.body.columns.filter((c: { use: string }) => ["gstRate", "hsn"].includes(c.use))).toHaveLength(2);
    expect(r.body.rows[0]).toMatchObject({ action: "create", errors: [] });
    expect(r.body.rows[1]).toMatchObject({ action: "skip" });
    expect(r.body.rows[1].errors[0]).toContain("GST rate");
    const [p] = await db.select().from(products).where(eq(products.sku, "GST-IMP-1"));
    expect(p).toMatchObject({ gstRateBp: 1250, hsn: "090240" });
  });

  it("writes the rate, HSN, taxable value and GST on each line, and the GST total on each order", async () => {
    const p = await productRow("lamp-arc");
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ gstRateBp: 1200, hsn: "9405" }).expect(200);
    const placed = await place({ paymentMethod: "COD", lines: [{ offerId: await offerOf("lamp-arc"), qty: 1, variant: "" }] }).expect(201);
    const id = placed.body.order.id as string;
    const get = (kind: string) =>
      t.http.get(`${A}/exports/${kind}`).set(staff).query({ q: id }).buffer(true).parse((res, cb) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (data += c));
        res.on("end", () => cb(null, data));
      });
    const read = (text: string) => parseCsv(text).filter((r) => !r[0]!.startsWith("# "));

    const items = read((await get("order-items").expect(200)).body);
    const col = (name: string) => items[1]![items[0]!.indexOf(name)];
    const line = placed.body.order.items[0];
    expect(items[0]).toEqual(expect.arrayContaining(["GST rate %", "HSN", "Taxable value", "GST amount"]));
    expect(col("GST rate %")).toBe("12");
    expect(col("HSN")).toBe("9405");
    expect(col("GST amount")).toBe((line.taxPaise / 100).toFixed(2));
    expect(col("Taxable value")).toBe(((line.unitPricePaise - line.taxPaise) / 100).toFixed(2));

    const orders = read((await get("orders").expect(200)).body);
    expect(orders[1]![orders[0]!.indexOf("GST total")]).toBe((line.taxPaise / 100).toFixed(2));
  });
});
