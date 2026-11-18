import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sampleSignaturePng } from "../src/db/sample-files.js";
import { DEFAULT_SETTINGS, settingsPlaceholders } from "../src/modules/admin/admin.schemas.js";
import { createTestApp, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

/** Per-product Legal Metrology declarations, and company details that start out as obvious placeholders. */

let t: TestContext;
let staff: Record<string, string>;
const A = "/v1/admin";

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
});
afterAll(() => t.close());

async function draft(extra: object = {}) {
  const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng("legal"), "legal.png").expect(201);
  return {
    title: "Cotton Tea Towel",
    sku: "AG-TOWEL-001",
    images: [img.body.url],
    categoryId: "cat-home",
    subcategory: "Lighting",
    brandId: "br-hearth",
    pricePaise: 29_900,
    mrpPaise: 39_900,
    stock: 5,
    ...extra,
  };
}
const create = async (extra: object, status: number) => {
  const body = await draft(extra);
  return t.http.post(`${A}/products`).set(staff).send(body).expect(status);
};

describe("product legal declarations", () => {
  const legal = { manufacturer: "Maker Co, 1 Example Road, Pune 411001", consumerCare: "help@maker.example, 1800 000 0000", countryOfOrigin: "India" };

  it("round-trips through the admin API and the storefront", async () => {
    const created = await create({ legal }, 201);
    expect(created.body.legal).toEqual(legal);
    const id = created.body.id as string;

    const admin = await t.http.get(`${A}/products/${id}`).set(staff).expect(200);
    expect(admin.body.legal).toEqual(legal);
    const detail = await t.http.get(`/v1/products/${created.body.slug}`).expect(200);
    expect(detail.body.legal).toEqual(legal);
    const catalog = await t.http.get("/v1/storefront/catalog").expect(200);
    expect(catalog.body.products.find((p: { id: string }) => p.id === id).legal).toEqual(legal);

    // an edit replaces the declarations; blanks are dropped; null clears them
    const edited = await t.http.patch(`${A}/products/${id}`).set(staff).send({ legal: { packer: "  Packer Ltd, Mumbai  ", importer: "   " } }).expect(200);
    expect(edited.body.legal).toEqual({ packer: "Packer Ltd, Mumbai" });
    await t.http.patch(`${A}/products/${id}`).set(staff).send({ stock: 6 }).expect(200);
    expect((await t.http.get(`${A}/products/${id}`).set(staff).expect(200)).body.legal).toEqual({ packer: "Packer Ltd, Mumbai" });
    const cleared = await t.http.patch(`${A}/products/${id}`).set(staff).send({ legal: null }).expect(200);
    expect(cleared.body.legal).toBeNull();
  });

  it("is null for a product that sets none", async () => {
    const created = await create({ sku: "AG-TOWEL-002", title: "Plain Tea Towel" }, 201);
    expect(created.body.legal).toBeNull();
    expect((await t.http.get(`/v1/products/${created.body.slug}`).expect(200)).body.legal).toBeNull();
  });

  it("rejects more than 300 characters", async () => {
    await create({ sku: "AG-TOWEL-003", title: "Long Tea Towel", legal: { manufacturer: "x".repeat(301) } }, 422);
    await create({ sku: "AG-TOWEL-004", title: "Max Tea Towel", legal: { manufacturer: "x".repeat(300) } }, 201);
  });

  it("is read from the import columns, keeping what a blank cell leaves alone", async () => {
    const csv = (rows: string[]) =>
      ["Title,SKU,Category,Brand,Price,Manufacturer,Packer,Importer,Consumer care,Country of origin", ...rows].join("\n");
    const up = (body: string) => t.http.post(`${A}/products/import?dryRun=false`).set(staff).attach("file", Buffer.from(body, "utf8"), "p.csv");
    const first = await up(csv(['Imported Kettle,IMP-KETTLE-1,Home,Hearth,999,"Maker Co, Shenzhen",,"Importer Pvt Ltd, Delhi",care@maker.example,China'])).expect(201);
    expect(first.body.summary).toMatchObject({ created: 1, skipped: 0 });
    const id = first.body.rows[0].productId as string;
    expect((await t.http.get(`${A}/products/${id}`).set(staff).expect(200)).body.legal).toEqual({
      manufacturer: "Maker Co, Shenzhen",
      importer: "Importer Pvt Ltd, Delhi",
      consumerCare: "care@maker.example",
      countryOfOrigin: "China",
    });
    await up(csv(["Imported Kettle,IMP-KETTLE-1,Home,Hearth,999,,Packed Here Ltd,,,"])).expect(201);
    expect((await t.http.get(`${A}/products/${id}`).set(staff).expect(200)).body.legal).toMatchObject({ manufacturer: "Maker Co, Shenzhen", packer: "Packed Here Ltd", countryOfOrigin: "China" });
    const tooLong = await up(csv([`Long One,IMP-LONG-1,Home,Hearth,999,${"y".repeat(301)},,,,`])).expect(201);
    expect(tooLong.body.rows[0].action).toBe("skip");
  });
});

describe("placeholder store details", () => {
  it("list every field on a fresh store and none once they are set", async () => {
    const fresh = await t.http.get(`${A}/settings`).set(staff).expect(200);
    expect(fresh.body.placeholders).toEqual(settingsPlaceholders(DEFAULT_SETTINGS));
    expect(fresh.body.placeholders).toHaveLength(14);
    expect(fresh.body.placeholders).toEqual(expect.arrayContaining(["Company legal name", "CIN", "GSTIN", "Grievance Officer name"]));

    const { placeholders: _p, updatedAt: _a, updatedBy: _b, ...current } = fresh.body;
    const set = {
      ...current,
      company: {
        legalName: "Acme Retail Private Limited",
        cin: "ACME-CIN-1",
        gstin: "ACME-GST-1",
        registeredOffice: "1 Test Street, Test City",
        customerCare: "1800 111 1111",
        customerCareHours: "9 am to 6 pm",
        email: "care@acme.test",
        website: "https://acme.test",
      },
      grievance: { ...current.grievance, name: "A. Officer", designation: "Grievance Officer, Acme", email: "officer@acme.test", phone: "1800 222 2222", hours: "9 to 5", address: "1 Test Street" },
    };
    const saved = await t.http.put(`${A}/settings`).set(staff).send(set).expect(200);
    expect(saved.body.placeholders).toEqual([]);
    expect(settingsPlaceholders(set)).toEqual([]);
  });

  it("no longer look like a real CIN, GSTIN, person or address", () => {
    const text = JSON.stringify([DEFAULT_SETTINGS.company, DEFAULT_SETTINGS.grievance]);
    expect(text).not.toMatch(/U\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}/);
    expect(text).not.toMatch(/\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]/);
    expect(text).not.toMatch(/altasgoods|Meenakshi|Lakeview|Bengaluru/i);
    expect(DEFAULT_SETTINGS.company.email).toMatch(/@example\.com$/);
    expect(DEFAULT_SETTINGS.grievance.email).toMatch(/@example\.com$/);
  });
});
