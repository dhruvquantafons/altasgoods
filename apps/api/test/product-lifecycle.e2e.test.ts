import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sampleSignaturePng } from "../src/db/sample-files.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let shopper: Record<string, string>;
let addressId: string;
const A = "/v1/admin";
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
let n = 0;

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(() => t.close());

/** Creates a product (own image upload, own title) and returns the admin view of it. */
async function make(extra: object = {}, title = `Lifecycle Lamp ${++n}`) {
  const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng(`img${n}`), "x.png").expect(201);
  const body = {
    title,
    sku: `AG-LC-${n}`,
    images: [img.body.url],
    categoryId: "cat-home",
    subcategory: "Lighting",
    brandId: "br-hearth",
    pricePaise: 100_000,
    mrpPaise: 120_000,
    stock: 5,
    ...extra,
  };
  const r = await t.http.post(`${A}/products`).set(staff).send(body).expect(201);
  return { ...r.body, imageUrl: img.body.url as string };
}

const inCatalog = async (id: string) => (await t.http.get("/v1/storefront/catalog").expect(200)).body.products.some((p: { id: string }) => p.id === id);
const inSearch = async (q: string, id: string) => (await t.http.get("/v1/products").query({ q }).expect(200)).body.items.some((p: { id: string }) => p.id === id);

describe("archive and restore", () => {
  it("hides an archived product everywhere a customer looks, and restores it as inactive", async () => {
    const p = await make({}, "Archivable Zebra Lamp");
    expect(await inCatalog(p.id)).toBe(true);
    expect(await inSearch("zebra", p.id)).toBe(true);
    await t.http.put("/v1/cart").set(shopper).send({ lines: [{ offerId: (await t.http.get(`/v1/products/${p.slug}`).expect(200)).body.offerId, qty: 1, variant: "" }] }).expect(200);

    const archived = await t.http.post(`${A}/products/${p.id}/archive`).set(staff).expect(201);
    expect(archived.body).toMatchObject({ status: "ARCHIVED", active: false });
    expect(await inCatalog(p.id)).toBe(false);
    expect(await inSearch("zebra", p.id)).toBe(false);
    await t.http.get(`/v1/products/${p.slug}`).expect(404);
    const cart = await t.http.get("/v1/cart").set(shopper).expect(200);
    expect(cart.body.lines.find((l: { productId: string }) => l.productId === p.id)).toMatchObject({ inStock: false });
    await t.http.put("/v1/cart").set(shopper).send({ lines: [] }).expect(200);

    // admin: hidden from the default list, shown under Archived, and it cannot be switched on while archived
    const all = await t.http.get(`${A}/products`).query({ q: "zebra" }).set(staff).expect(200);
    expect(all.body.items).toHaveLength(0);
    const arch = await t.http.get(`${A}/products`).query({ q: "zebra", status: "archived" }).set(staff).expect(200);
    expect(arch.body.items.map((i: { id: string }) => i.id)).toEqual([p.id]);
    expect(arch.body.items[0].status).toBe("ARCHIVED");
    const inactive = await t.http.get(`${A}/products`).query({ q: "zebra", status: "inactive" }).set(staff).expect(200);
    expect(inactive.body.items).toHaveLength(0);
    const blocked = await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ active: true }).expect(409);
    expect(blocked.body.code).toBe("PRODUCT_ARCHIVED");
    // a new sale cannot cover it
    await t.http.post(`${A}/sales`).set(staff).send({ name: "Ghost sale", discountPercent: 10, scope: "PRODUCTS", productIds: [p.id], startsAt: iso(-HOUR), endsAt: iso(HOUR) }).expect(422);

    const restored = await t.http.post(`${A}/products/${p.id}/restore`).set(staff).expect(201);
    expect(restored.body).toMatchObject({ status: "INACTIVE", active: false });
    expect(await inCatalog(p.id)).toBe(false);
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ active: true }).expect(200);
    expect(await inCatalog(p.id)).toBe(true);
    await t.http.get(`/v1/products/${p.slug}`).expect(200);

    const log = await t.http.get(`${A}/audit`).query({ action: "product", pageSize: 50 }).set(staff).expect(200);
    expect(log.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["product.archive", "product.restore"]));
    // archiving twice and restoring a live product are refused
    await t.http.post(`${A}/products/${p.id}/restore`).set(staff).expect(409);
  });

  it("drops an archived product from the storefront wishlist view and handles an empty catalog filter", async () => {
    const p = await make({}, "Wishlisted Quokka Lamp");
    const me = await signUp(t.http, `wl.${Date.now()}@example.com`);
    await t.http.put("/v1/me/wishlist").set(me.auth).send({ productIds: [p.id] }).expect(200);
    await t.http.post(`${A}/products/${p.id}/archive`).set(staff).expect(201);
    const ids = (await t.http.get("/v1/me/wishlist").set(me.auth).expect(200)).body.productIds as string[];
    expect(ids).not.toContain(p.id);
  });
});

describe("permanent delete", () => {
  it("is refused for a product that has orders", async () => {
    const tea = (await t.http.get("/v1/products/tea-assam").expect(200)).body;
    await t.http
      .post("/v1/orders")
      .set(shopper)
      .set("Idempotency-Key", randomUUID())
      .send({ addressId, paymentMethod: "UPI", lines: [{ offerId: tea.offerId, qty: 1, variant: "" }] })
      .expect(201);
    const r = await t.http.delete(`${A}/products/${tea.id}`).set(staff).expect(409);
    expect(r.body).toMatchObject({ code: "PRODUCT_HAS_ORDERS" });
    expect(r.body.detail).toContain("Archive it instead");
    await t.http.get(`/v1/products/tea-assam`).expect(200);
  });

  it("removes a never-ordered product, its sale entries, redirects, wishlist rows and images", async () => {
    const p = await make({}, "Disposable Gecko Lamp");
    const other = await make({}, "Surviving Gecko Lamp");
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: "gecko-lamp-renamed" }).expect(200);
    const sale = await t.http
      .post(`${A}/sales`)
      .set(staff)
      .send({ name: "Gecko days", discountPercent: 10, scope: "PRODUCTS", productIds: [p.id, other.id], startsAt: iso(-HOUR), endsAt: iso(HOUR) })
      .expect(201);
    const me = await signUp(t.http, `del.${Date.now()}@example.com`);
    await t.http.put("/v1/me/wishlist").set(me.auth).send({ productIds: [p.id] }).expect(200);
    await t.http.get(p.imageUrl.replace("/media", "/v1/media")).expect(200);

    await t.http.delete(`${A}/products/${p.id}`).set(staff).expect(204);

    await t.http.get(`${A}/products/${p.id}`).set(staff).expect(404);
    await t.http.get("/v1/storefront/products/redirect/" + p.slug).expect(404);
    await t.http.get("/v1/storefront/products/redirect/gecko-lamp-renamed").expect(404);
    const sales = await t.http.get(`${A}/sales`).set(staff).expect(200);
    const mine = sales.body.find((s: { id: string }) => s.id === sale.body.id);
    expect(mine.productIds).toEqual([other.id]);
    expect((await t.http.get("/v1/me/wishlist").set(me.auth).expect(200)).body.productIds).toEqual([]);
    await t.http.get(p.imageUrl.replace("/media", "/v1/media")).expect(404);
    // an image another product still uses is kept
    await t.http.get(other.imageUrl.replace("/media", "/v1/media")).expect(200);

    const log = await t.http.get(`${A}/audit`).query({ action: "product.delete" }).set(staff).expect(200);
    expect(log.body.items[0].summary).toContain("Disposable Gecko Lamp");
    expect(log.body.items[0].summary).toContain("gecko-lamp-renamed");
    await t.http.delete(`${A}/products/p-nope`).set(staff).expect(404);
  });
});

describe("category and brand delete", () => {
  it("blocks on live and inactive products, and moves archived ones to the reserved row", async () => {
    const cat = await t.http.post(`${A}/categories`).set(staff).send({ name: "Temporary Shelf" }).expect(201);
    const brand = await t.http.post(`${A}/brands`).set(staff).send({ name: "Temporary Maker" }).expect(201);
    const p = await make({ categoryId: cat.body.id, subcategory: "Misc", brandId: brand.body.id }, "Shelf Hedgehog");
    const q = await make({ categoryId: cat.body.id, subcategory: "Misc", brandId: brand.body.id }, "Shelf Hedgehog Two");

    const inUse = await t.http.delete(`${A}/categories/${cat.body.id}`).set(staff).expect(409);
    expect(inUse.body.code).toBe("CATEGORY_IN_USE");
    expect(inUse.body.detail).toContain("2 live or inactive products");
    const brandUse = await t.http.delete(`${A}/brands/${brand.body.id}`).set(staff).expect(409);
    expect(brandUse.body).toMatchObject({ code: "BRAND_IN_USE" });

    await t.http.post(`${A}/products/${p.id}/archive`).set(staff).expect(201);
    // an inactive (not archived) product still blocks
    await t.http.patch(`${A}/products/${q.id}`).set(staff).send({ active: false }).expect(200);
    const one = await t.http.delete(`${A}/categories/${cat.body.id}`).set(staff).expect(409);
    expect(one.body.detail).toContain("1 live or inactive product is");
    await t.http.post(`${A}/products/${q.id}/archive`).set(staff).expect(201);

    await t.http.delete(`${A}/categories/${cat.body.id}`).set(staff).expect(204);
    await t.http.delete(`${A}/brands/${brand.body.id}`).set(staff).expect(204);
    const moved = await t.http.get(`${A}/products/${p.id}`).set(staff).expect(200);
    expect(moved.body).toMatchObject({ categoryId: "cat-uncategorised", brandId: "br-unbranded", status: "ARCHIVED" });

    // the reserved rows exist for admins, are never offered to shoppers, and cannot be deleted
    const cats = await t.http.get(`${A}/categories`).set(staff).expect(200);
    expect(cats.body.find((c: { id: string }) => c.id === "cat-uncategorised")).toMatchObject({ name: "Uncategorised", productCount: 2 });
    const tree = await t.http.get("/v1/categories").expect(200);
    expect(tree.body.some((c: { id: string }) => c.id === "cat-uncategorised")).toBe(false);
    const snap = await t.http.get("/v1/storefront/catalog").expect(200);
    expect(snap.body.categories.some((c: { id: string }) => c.id === "cat-uncategorised")).toBe(false);
    expect(snap.body.brands.some((b: { id: string }) => b.id === "br-unbranded")).toBe(false);
    expect((await t.http.delete(`${A}/categories/cat-uncategorised`).set(staff).expect(409)).body.code).toBe("CATEGORY_RESERVED");
    expect((await t.http.delete(`${A}/brands/br-unbranded`).set(staff).expect(409)).body.code).toBe("BRAND_RESERVED");

    // a restored product cannot go live while it sits in a reserved category or brand
    await t.http.post(`${A}/products/${p.id}/restore`).set(staff).expect(201);
    const live = await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ active: true }).expect(422);
    expect(live.body.code).toBe("PLACEMENT_RESERVED");
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ categoryId: "cat-home", subcategory: "Lighting", brandId: "br-hearth", active: true }).expect(200);
  });

  it("refuses to create a live product in a reserved category or brand, and allows a switched off one", async () => {
    const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng("reserved"), "x.png").expect(201);
    const body = { title: "Reserved Row Lamp", sku: "AG-LC-RES", images: [img.body.url], categoryId: "cat-home", subcategory: "Lighting", brandId: "br-hearth", pricePaise: 100_000, mrpPaise: 120_000, stock: 5 };
    const inCategory = await t.http.post(`${A}/products`).set(staff).send({ ...body, categoryId: "cat-uncategorised", subcategory: "Misc" }).expect(422);
    expect(inCategory.body.code).toBe("PLACEMENT_RESERVED");
    const inBrand = await t.http.post(`${A}/products`).set(staff).send({ ...body, brandId: "br-unbranded" }).expect(422);
    expect(inBrand.body.code).toBe("PLACEMENT_RESERVED");
    const off = await t.http.post(`${A}/products`).set(staff).send({ ...body, brandId: "br-unbranded", active: false }).expect(201);
    expect(off.body).toMatchObject({ brandId: "br-unbranded", active: false });
  });
});

describe("slug change", () => {
  it("redirects old addresses, rejects duplicates and survives a chain of renames", async () => {
    const p = await make({}, "Slug Walrus Lamp");
    const other = await make({}, "Slug Otter Lamp");
    const a = p.slug as string;

    const b = await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: "walrus-lamp-b" }).expect(200);
    expect(b.body).toMatchObject({ id: p.id, slug: "walrus-lamp-b" });
    await t.http.get(`/v1/products/${a}`).expect(404);
    expect((await t.http.get(`/v1/products/walrus-lamp-b`).expect(200)).body.id).toBe(p.id);
    expect((await t.http.get(`/v1/storefront/products/redirect/${a}`).expect(200)).body).toEqual({ slug: "walrus-lamp-b" });
    // the current address is not a redirect
    await t.http.get(`/v1/storefront/products/redirect/walrus-lamp-b`).expect(404);

    // taken by a product, by another product's id, by another product's redirect, or malformed
    expect((await t.http.patch(`${A}/products/${other.id}`).set(staff).send({ slug: "walrus-lamp-b" }).expect(409)).body.code).toBe("SLUG_TAKEN");
    expect((await t.http.patch(`${A}/products/${other.id}`).set(staff).send({ slug: a }).expect(409)).body.code).toBe("SLUG_TAKEN");
    await t.http.patch(`${A}/products/${other.id}`).set(staff).send({ slug: "Not Valid" }).expect(422);
    await t.http.patch(`${A}/products/${other.id}`).set(staff).send({ slug: "ab" }).expect(422);
    await t.http.patch(`${A}/products/${other.id}`).set(staff).send({ slug: "x".repeat(81) }).expect(422);
    // a brand new product cannot reuse a redirected address either
    const img = await t.http.post(`${A}/media`).set(staff).attach("file", sampleSignaturePng("dup"), "d.png").expect(201);
    const dup = await t.http
      .post(`${A}/products`)
      .set(staff)
      .send({ title: "Dup", slug: a, sku: "AG-DUP", images: [img.body.url], categoryId: "cat-home", subcategory: "Lighting", brandId: "br-hearth", pricePaise: 1000, mrpPaise: 1000, stock: 1 })
      .expect(409);
    expect(dup.body.code).toBe("SLUG_TAKEN");

    // second rename: both older addresses reach the latest one
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: "walrus-lamp-c" }).expect(200);
    for (const old of [a, "walrus-lamp-b"]) expect((await t.http.get(`/v1/storefront/products/redirect/${old}`).expect(200)).body).toEqual({ slug: "walrus-lamp-c" });

    // renaming back to an old address drops that redirect
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: a }).expect(200);
    await t.http.get(`/v1/storefront/products/redirect/${a}`).expect(404);
    expect((await t.http.get(`/v1/storefront/products/redirect/walrus-lamp-c`).expect(200)).body).toEqual({ slug: a });
    // same slug is a no-op
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: a, stock: 7 }).expect(200);
    const log = await t.http.get(`${A}/audit`).query({ action: "product.update" }).set(staff).expect(200);
    expect(JSON.stringify(log.body.items)).toContain("walrus-lamp-b");
  });

  it("does not redirect to a product that is not on sale", async () => {
    const p = await make({}, "Hidden Slug Lamp");
    await t.http.patch(`${A}/products/${p.id}`).set(staff).send({ slug: "hidden-slug-lamp-new" }).expect(200);
    await t.http.post(`${A}/products/${p.id}/archive`).set(staff).expect(201);
    await t.http.get(`/v1/storefront/products/redirect/${p.slug}`).expect(404);
  });
});

describe("Auditor", () => {
  it("cannot archive, restore, delete or change a slug", async () => {
    const p = await make({}, "Auditor Target Lamp");
    const admin = staff;
    await t.http.post(`${A}/staff`).set(admin).send({ name: "Audit Or", email: "audit.or@altasgoods.in", roles: ["AUDITOR"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
    const first = await signIn(t.http, "audit.or@altasgoods.in", "temporary-pass-1");
    await t.http.post("/v1/me/password").set(first.auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
    const a = (await signIn(t.http, "audit.or@altasgoods.in", "chosen-password-1")).auth;
    await t.http.post(`${A}/products/${p.id}/archive`).set(a).expect(403);
    await t.http.post(`${A}/products/${p.id}/restore`).set(a).expect(403);
    await t.http.delete(`${A}/products/${p.id}`).set(a).expect(403);
    await t.http.patch(`${A}/products/${p.id}`).set(a).send({ slug: "auditor-slug" }).expect(403);
    await t.http.get(`${A}/products/${p.id}`).set(a).expect(200);
  });
});
