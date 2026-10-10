import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { samplePdf, sampleSignaturePng } from "../src/db/sample-files.js";
import { createTestApp, DEMO_AGENT, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let shopper: Record<string, string>;
let agent: Record<string, string>;

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  agent = (await signIn(t.http, DEMO_AGENT)).auth;
});
afterAll(() => t.close());

const A = "/v1/admin";

/** A valid new product in Home, with an uploaded image. Build it before starting the request that sends it. */
async function draft(extra: object = {}) {
  const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng("lamp"), "lamp.png").expect(201);
  return {
    title: "Brass Table Lamp",
    sku: "AG-LAMP-001",
    description: "A warm brass lamp for the bedside.",
    highlights: ["Solid brass", "E27 holder"],
    images: [img.body.url],
    categoryId: "cat-home",
    subcategory: "Lighting",
    brandId: "br-hearth",
    pricePaise: 249_900,
    mrpPaise: 299_900,
    stock: 12,
    ...extra,
  };
}

/** Posts a product; supertest starts listening when a request is created, so the image upload must finish first. */
async function createProduct(extra: object, status: number) {
  const body = await draft(extra);
  return t.http.post(`${A}/products`).set(staff).send(body).expect(status);
}

describe("products", () => {
  it("creates a product the storefront sells straight away", async () => {
    const created = await createProduct({}, 201);
    expect(created.body).toMatchObject({ id: "p-brass-table-lamp", slug: "brass-table-lamp", active: true, stock: 12, pricePaise: 249_900 });

    const pub = await t.http.get("/v1/products/brass-table-lamp").expect(200);
    expect(pub.body).toMatchObject({ title: "Brass Table Lamp", pricePaise: 249_900, inStock: true, offerId: expect.any(String), category: { id: "cat-home" } });
    expect(pub.body).not.toHaveProperty("offers");
    const search = await t.http.get("/v1/products?q=brass%20lamp").expect(200);
    expect(search.body.items.map((i: { id: string }) => i.id)).toContain("p-brass-table-lamp");
    // the list never exposes exact stock
    expect(search.body.items[0]).not.toHaveProperty("stock");

    // a second product with the same title gets its own address
    const twin = await createProduct({ sku: "AG-LAMP-002" }, 201);
    expect(twin.body.slug).toBe("brass-table-lamp-2");
  });

  it("checks prices, placement and images", async () => {
    const tooDear = await createProduct({ title: "Too Dear", pricePaise: 400_000 }, 422);
    expect(tooDear.body.errors[0].message).toMatch(/MRP/);
    const wrongSub = await createProduct({ title: "Wrong Sub", subcategory: "Headphones" }, 422);
    expect(wrongSub.body.code).toBe("SUBCATEGORY_UNKNOWN");
    await createProduct({ title: "No Brand", brandId: "br-nope" }, 422);
    await createProduct({ title: "Outside Image", images: ["https://example.com/x.jpg"] }, 422);
  });

  it("edits price and stock, and takes products off sale", async () => {
    const edited = await t.http.patch(`${A}/products/p-brass-table-lamp`).set(staff).send({ pricePaise: 199_900, stock: 0 }).expect(200);
    expect(edited.body).toMatchObject({ pricePaise: 199_900, stock: 0, slug: "brass-table-lamp" });
    expect((await t.http.get("/v1/products/brass-table-lamp").expect(200)).body).toMatchObject({ pricePaise: 199_900, inStock: false });
    await t.http.patch(`${A}/products/p-brass-table-lamp`).set(staff).send({ mrpPaise: 100_000 }).expect(422);

    await t.http.patch(`${A}/products/p-brass-table-lamp`).set(staff).send({ active: false }).expect(200);
    await t.http.get("/v1/products/brass-table-lamp").expect(404);
    const inactive = await t.http.get(`${A}/products?status=inactive&q=brass`).set(staff).expect(200);
    expect(inactive.body.items.map((i: { id: string }) => i.id)).toContain("p-brass-table-lamp");
    const out = await t.http.get(`${A}/products?stock=out`).set(staff).expect(200);
    expect(out.body.items.every((i: { stock: number }) => i.stock === 0)).toBe(true);
  });

  it("is for catalog and operations staff only", async () => {
    await t.http.get(`${A}/products`).expect(401);
    await t.http.get(`${A}/products`).set(shopper).expect(403);
    await t.http.get(`${A}/products`).set(agent).expect(403);
    await t.http.post(`${A}/brands`).set(agent).send({ name: "Sneaky" }).expect(403);
  });
});

describe("images", () => {
  it("serves uploaded images publicly and refuses other files", async () => {
    const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng("x"), "x.png").expect(201);
    expect(img.body.url).toMatch(/^\/media\/[0-9a-f-]{36}$/);
    const served = await t.http.get(`/v1/media/${img.body.id}`).expect(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["cache-control"]).toContain("immutable");

    const pdf = await t.http.post(`${A}/media`).set(staff).attach("file", samplePdf("Not an image"), "x.pdf").expect(415);
    expect(pdf.body.code).toBe("FILE_TYPE");
    await t.http.get(`/v1/media/00000000-0000-4000-8000-000000000000`).expect(404);
  });

  it("never serves a customer's private upload", async () => {
    const photo = await t.http.post("/v1/me/uploads").set(shopper).attach("file", sampleSignaturePng("private"), "p.png").expect(201);
    await t.http.get(`/v1/media/${photo.body.id}`).expect(404);
  });
});

describe("categories and brands", () => {
  it("adds a category with subcategories and keeps used ones", async () => {
    const c = await t.http.post(`${A}/categories`).set(staff).send({ name: "Garden", icon: "Flower", subcategories: ["Planters", "Tools"] }).expect(201);
    expect(c.body).toMatchObject({ id: "cat-garden", slug: "garden", subcategories: [{ name: "Planters" }, { name: "Tools" }] });
    expect((await t.http.get("/v1/categories").expect(200)).body.map((x: { slug: string }) => x.slug)).toContain("garden");

    await createProduct({ title: "Terracotta Planter", sku: "AG-PL-1", categoryId: "cat-garden", subcategory: "Planters" }, 201);
    const blocked = await t.http.patch(`${A}/categories/cat-garden`).set(staff).send({ subcategories: ["Tools"] }).expect(409);
    expect(blocked.body.code).toBe("SUBCATEGORY_IN_USE");
    const renamed = await t.http.patch(`${A}/categories/cat-garden`).set(staff).send({ name: "Garden and Outdoors", subcategories: ["Planters", "Tools", "Seeds"] }).expect(200);
    expect(renamed.body.subcategories.map((x: { name: string }) => x.name)).toEqual(["Planters", "Tools", "Seeds"]);
    // search follows the new name
    const found = await t.http.get("/v1/products?q=outdoors").expect(200);
    expect(found.body.items.map((i: { id: string }) => i.id)).toContain("p-terracotta-planter");

    const inUse = await t.http.delete(`${A}/categories/cat-garden`).set(staff).expect(409);
    expect(inUse.body.code).toBe("CATEGORY_IN_USE");
    await t.http.post(`${A}/categories`).set(staff).send({ name: "Empty Aisle" }).expect(201);
    await t.http.delete(`${A}/categories/cat-empty-aisle`).set(staff).expect(204);
  });

  it("manages brands", async () => {
    const b = await t.http.post(`${A}/brands`).set(staff).send({ name: "Altas Home" }).expect(201);
    expect(b.body).toMatchObject({ id: "br-altas-home", productCount: 0 });
    await t.http.post(`${A}/brands`).set(staff).send({ name: "altas home" }).expect(409);
    await t.http.patch(`${A}/brands/br-altas-home`).set(staff).send({ name: "Altas Living" }).expect(200);
    await t.http.delete(`${A}/brands/br-altas-home`).set(staff).expect(204);
    const used = await t.http.delete(`${A}/brands/br-hearth`).set(staff).expect(409);
    expect(used.body.code).toBe("BRAND_IN_USE");
  });
});

describe("storefront snapshot", () => {
  it("follows the store's edits: prices, stock caps and products taken off sale", async () => {
    await t.http.patch(`${A}/products/p-headphones-studio`).set(staff).send({ pricePaise: 777_700, stock: 40 }).expect(200);
    const snap = await t.http.get("/v1/storefront/catalog").expect(200);
    const hp = snap.body.products.find((p: { id: string }) => p.id === "p-headphones-studio");
    expect(hp.offer).toMatchObject({ pricePaise: 777_700, stock: 10 });
    expect(hp).toMatchObject({ images: expect.any(Array), specs: expect.any(Array), variants: expect.any(Array) });
    expect(snap.body.categories.find((c: { id: string }) => c.id === "cat-home").children.length).toBeGreaterThan(0);
    expect(snap.body.brands.length).toBeGreaterThan(0);

    await t.http.patch(`${A}/products/p-headphones-studio`).set(staff).send({ active: false }).expect(200);
    const after = await t.http.get("/v1/storefront/catalog").expect(200);
    expect(after.body.products.map((p: { id: string }) => p.id)).not.toContain("p-headphones-studio");
  });
});
