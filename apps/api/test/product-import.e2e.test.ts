import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCsv } from "../src/modules/catalog/csv.js";
import { isInternalAddress } from "../src/modules/catalog/remote-image.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let shopper: Record<string, string>;

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
});
afterAll(() => t.close());

const URL = "/v1/admin/products/import";
const upload = (csv: string, dryRun = false) =>
  t.http
    .post(`${URL}?dryRun=${dryRun}`)
    .set(staff)
    .attach("file", Buffer.from(csv, "utf8"), "products.csv");

const SPICES = [
  "Name,SKU,Category,Sub Category,Brand,Price (INR),MRP,Qty,Description,Origin,Weight,Pack: Material,Image",
  'Kashmiri Red Chilli Powder,SP-CHILLI-200,Spices,Ground Spices,Saffron Fields,"₹1,249",1499,40,"Bright, mild heat",Kashmir,200 g,Glass jar,',
  "Green Cardamom Pods,SP-CARD-100,Spices,Whole Spices,Saffron Fields,899,999,25,,Kerala,100 g,Pouch,http://127.0.0.1/cardamom.jpg",
  "Brass Floor Lamp,HM-LAMP-9,Home,Lighting,Hearth,5999,4999,3,,,,,",
  ",NO-TITLE,Spices,,,100,,1,,,,,",
  "Turmeric Root,SP-CHILLI-200,Spices,,,120,,5,,,,,",
].join("\n");

describe("csv reader", () => {
  it("reads quotes, line breaks inside quotes, BOM and semicolons", () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line\nbreak"\r\n\r\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "line\nbreak"],
    ]);
    expect(parseCsv("name;price\nTea;10,50\n")).toEqual([
      ["name", "price"],
      ["Tea", "10,50"],
    ]);
  });

  it("knows which addresses are internal", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "169.254.169.254", "::1", "::ffff:10.0.0.1", "fd00::1"]) expect(isInternalAddress(a)).toBe(true);
    for (const a of ["8.8.8.8", "142.250.183.14", "2606:4700::1111"]) expect(isInternalAddress(a)).toBe(false);
  });
});

describe("product import", () => {
  it("is for catalog staff only", async () => {
    await t.http.post(`${URL}?dryRun=true`).set(shopper).attach("file", Buffer.from(SPICES), "p.csv").expect(403);
  });

  it("previews without saving anything", async () => {
    const r = await upload(SPICES, true).expect(201);
    expect(r.body.dryRun).toBe(true);
    expect(r.body.summary).toMatchObject({ rows: 5, created: 2, updated: 0, skipped: 3, newCategories: ["Spices"], newBrands: ["Saffron Fields"] });
    expect(r.body.summary.newSubcategories).toEqual(["Spices › Ground Spices", "Spices › Whole Spices"]);
    const [chilli, cardamom, lamp, untitled, twin] = r.body.rows;
    expect(chilli).toMatchObject({ action: "create", errors: [] });
    expect(cardamom.action).toBe("create");
    expect(lamp.errors).toContain("The price cannot be more than the MRP");
    expect(untitled.errors).toContain("Title is empty");
    expect(twin.errors[0]).toMatch(/also on line 2/);
    expect(r.body.columns).toEqual(expect.arrayContaining([{ name: "Origin", use: "spec: Specifications › Origin" }, { name: "Pack: Material", use: "spec: Pack › Material" }, { name: "Price (INR)", use: "price" }]));

    const cats = await t.http.get("/v1/admin/categories").set(staff).expect(200);
    expect(cats.body.map((c: { name: string }) => c.name)).not.toContain("Spices");
  });

  it("adds the products, their category and brand to the storefront", async () => {
    const r = await upload(SPICES).expect(201);
    expect(r.body.summary).toMatchObject({ created: 2, skipped: 3, imagesFailed: 1, imagesDownloaded: 0 });
    // an image link to a private address is never fetched
    expect(r.body.rows[1].warnings.join(" ")).toMatch(/private address/);

    const chilli = await t.http.get(`/v1/admin/products/${r.body.rows[0].productId}`).set(staff).expect(200);
    expect(chilli.body).toMatchObject({
      title: "Kashmiri Red Chilli Powder",
      pricePaise: 124_900,
      mrpPaise: 149_900,
      stock: 40,
      subcategory: "Ground Spices",
      description: "Bright, mild heat",
      images: ["/images/products/placeholder.jpg"],
      active: true,
    });
    expect(chilli.body.specs).toEqual([
      { group: "Specifications", items: [{ label: "Origin", value: "Kashmir" }, { label: "Weight", value: "200 g" }] },
      { group: "Pack", items: [{ label: "Material", value: "Glass jar" }] },
    ]);

    const store = await t.http.get("/v1/storefront/catalog").expect(200);
    const spices = store.body.categories.find((c: { name: string }) => c.name === "Spices");
    expect(spices.children.map((c: { name: string }) => c.name)).toEqual(["Ground Spices", "Whole Spices"]);
    expect(store.body.products.map((p: { sku: string }) => p.sku)).toEqual(expect.arrayContaining(["SP-CHILLI-200", "SP-CARD-100"]));
    expect(store.body.brands.map((b: { name: string }) => b.name)).toContain("Saffron Fields");
  });

  it("updates products by SKU and leaves blank cells as they were", async () => {
    const r = await upload("sku;title;category;price;stock;subcategory;status\nsp-chilli-200;Kashmiri Red Chilli Powder;spices;999;;;yes\nSP-NEW-1;Black Pepper;Spices;450;10;Whole Spices;no\n").expect(201);
    expect(r.body.summary).toMatchObject({ created: 1, updated: 1, skipped: 0, newCategories: [], newBrands: ["Generic"] });
    const chilli = await t.http.get(`/v1/admin/products/${r.body.rows[0].productId}`).set(staff).expect(200);
    expect(chilli.body).toMatchObject({ pricePaise: 99_900, mrpPaise: 149_900, stock: 40, subcategory: "Ground Spices", description: "Bright, mild heat" });
    const pepper = await t.http.get(`/v1/admin/products/${r.body.rows[1].productId}`).set(staff).expect(200);
    expect(pepper.body).toMatchObject({ active: false, mrpPaise: 45_000 });
  });

  it("accepts the template Control offers for download", async () => {
    const template = readFileSync(new globalThis.URL("../../web/public/templates/altasgoods-products-template.csv", import.meta.url), "utf8");
    const r = await upload(template, true).expect(201);
    expect(r.body.rows.flatMap((row: { errors: string[] }) => row.errors)).toEqual([]);
    expect(r.body.summary).toMatchObject({ rows: 3, skipped: 0 });
    expect(r.body.columns).toEqual(expect.arrayContaining([{ name: "Variant: Size", use: "variant: Size" }, { name: "Display: Screen size", use: "spec: Display › Screen size" }]));
  });

  it("explains files it cannot read", async () => {
    const noPrice = await upload("title,category\nTea,Drinks\n", true).expect(422);
    expect(noPrice.body.detail).toMatch(/price column/);
    await upload("title,category,price\n", true).expect(422);
    await t.http.post(`${URL}?dryRun=true`).set(staff).expect(422);
  });
});
