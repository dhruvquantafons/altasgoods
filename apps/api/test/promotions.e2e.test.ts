import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { careAgentEmail } from "../src/db/demo.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let shopper: Record<string, string>;
let addressId: string;
const A = "/v1/admin";
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(() => t.close());

const product = async (slug: string) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body;

describe("sales", () => {
  it("lowers the price everywhere a customer sees it, and that is what they pay", async () => {
    const before = await product("tea-assam");
    const sale = await t.http
      .post(`${A}/sales`)
      .set(staff)
      .send({ name: "Holi Hai", headline: "Colours and savings", discountPercent: 25, scope: "PRODUCTS", productIds: [before.id], startsAt: iso(-HOUR), endsAt: iso(48 * HOUR) })
      .expect(201);
    expect(sale.body).toMatchObject({ slug: "holi-hai", state: "LIVE" });

    const expected = Math.max(100, Math.floor((before.pricePaise * 75) / 10_000) * 100);
    const after = await product("tea-assam");
    expect(after.pricePaise).toBe(expected);
    expect(after.sale).toMatchObject({ name: "Holi Hai", percent: 25 });

    // listing, the storefront snapshot and the cart agree
    const list = await t.http.get("/v1/products").query({ ids: before.id }).expect(200);
    expect(list.body.items[0].pricePaise).toBe(expected);
    const snapshot = await t.http.get("/v1/storefront/catalog").expect(200);
    const inSnapshot = snapshot.body.products.find((p: { id: string }) => p.id === before.id);
    expect(inSnapshot.offer).toMatchObject({ pricePaise: expected, regularPricePaise: before.pricePaise, sale: { name: "Holi Hai" } });
    await t.http.put("/v1/cart").set(shopper).send({ lines: [{ offerId: before.offerId, qty: 2, variant: "" }] }).expect(200);
    const cart = await t.http.get("/v1/cart").set(shopper).expect(200);
    expect(cart.body.lines[0].pricePaise).toBe(expected);

    // and the order is charged the sale price
    const placed = await t.http
      .post("/v1/orders")
      .set(shopper)
      .set("Idempotency-Key", randomUUID())
      .send({ addressId, paymentMethod: "UPI", lines: [{ offerId: before.offerId, qty: 2, variant: "" }] })
      .expect(201);
    expect(placed.body.order.subtotalPaise).toBe(expected * 2);

    // paused, the regular price is back
    await t.http.patch(`${A}/sales/${sale.body.id}`).set(staff).send({ status: "PAUSED" }).expect(200);
    expect((await product("tea-assam")).pricePaise).toBe(before.pricePaise);
    await t.http.delete(`${A}/sales/${sale.body.id}`).set(staff).expect(204);
  });

  it("starts and ends on its own, and the biggest overlapping discount wins", async () => {
    const p = await product("headphones-studio");
    const later = await t.http
      .post(`${A}/sales`)
      .set(staff)
      .send({ name: "Diwali Dhamaka", discountPercent: 40, scope: "CATEGORIES", categoryIds: [p.category.id], startsAt: iso(2 * HOUR), endsAt: iso(10 * HOUR) })
      .expect(201);
    expect(later.body.state).toBe("SCHEDULED");
    const everything = await t.http.post(`${A}/sales`).set(staff).send({ name: "Store wide", discountPercent: 10, scope: "ALL", startsAt: iso(-HOUR), endsAt: iso(24 * HOUR) }).expect(201);

    expect((await product("headphones-studio")).sale.name).toBe("Store wide");
    t.clock.advance(3 * HOUR);
    const during = await product("headphones-studio");
    expect(during.sale).toMatchObject({ name: "Diwali Dhamaka", percent: 40 });
    t.clock.advance(8 * HOUR);
    expect((await product("headphones-studio")).sale.name).toBe("Store wide");
    t.clock.reset();

    const live = await t.http.get("/v1/storefront/sales/live").expect(200);
    expect(live.body.map((s: { name: string }) => s.name)).toEqual(["Store wide"]);
    await t.http.delete(`${A}/sales/${later.body.id}`).set(staff).expect(204);
    await t.http.delete(`${A}/sales/${everything.body.id}`).set(staff).expect(204);
  });

  it("checks what a sale covers and its dates, and is for admins only", async () => {
    await t.http.post(`${A}/sales`).set(staff).send({ name: "Empty", discountPercent: 10, scope: "PRODUCTS", startsAt: iso(0), endsAt: iso(HOUR) }).expect(422);
    await t.http.post(`${A}/sales`).set(staff).send({ name: "Backwards", discountPercent: 10, scope: "ALL", startsAt: iso(HOUR), endsAt: iso(0) }).expect(422);
    await t.http.post(`${A}/sales`).set(staff).send({ name: "Ghost", discountPercent: 10, scope: "PRODUCTS", productIds: ["p-nope"], startsAt: iso(0), endsAt: iso(HOUR) }).expect(422);
    await t.http.post(`${A}/sales`).set(staff).send({ name: "Too much", discountPercent: 95, scope: "ALL", startsAt: iso(0), endsAt: iso(HOUR) }).expect(422);
    const agent = (await signIn(t.http, careAgentEmail(0))).auth;
    await t.http.get(`${A}/sales`).set(agent).expect(403);
    await t.http.get(`${A}/sales`).set(shopper).expect(403);
    const log = await t.http.get(`${A}/audit`).query({ action: "sale" }).set(staff).expect(200);
    expect(log.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["sale.create", "sale.pause", "sale.delete"]));
  });
});

describe("coupons", () => {
  it("are created in the admin and work at checkout, and only listed ones show on the storefront", async () => {
    const p = await product("chair-lounge");
    await t.http
      .post(`${A}/coupons`)
      .set(staff)
      .send({ code: "diwali500", description: "₹500 off orders over ₹5,000", type: "FLAT", value: 50_000, minOrderPaise: 500_000, startsAt: iso(-HOUR), endsAt: iso(48 * HOUR) })
      .expect(201);
    await t.http.post(`${A}/coupons`).set(staff).send({ code: "SECRET10", description: "Staff only", type: "PERCENT", value: 10, startsAt: iso(-HOUR), endsAt: iso(48 * HOUR), showOnStorefront: false }).expect(201);
    await t.http.post(`${A}/coupons`).set(staff).send({ code: "DIWALI500", description: "Again", type: "FLAT", value: 100, startsAt: iso(-HOUR), endsAt: iso(HOUR) }).expect(409);

    const quote = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, couponCode: "DIWALI500", lines: [{ offerId: p.offerId, qty: 1, variant: "" }] }).expect(200);
    expect(quote.body.coupon).toMatchObject({ code: "DIWALI500", applied: p.pricePaise >= 500_000 });
    const listed = await t.http.get("/v1/storefront/coupons").expect(200);
    expect(listed.body.map((c: { code: string }) => c.code)).toContain("DIWALI500");
    expect(listed.body.map((c: { code: string }) => c.code)).not.toContain("SECRET10");

    await t.http.patch(`${A}/coupons/DIWALI500`).set(staff).send({ status: "PAUSED" }).expect(200);
    const paused = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, couponCode: "DIWALI500", lines: [{ offerId: p.offerId, qty: 1, variant: "" }] }).expect(200);
    expect(paused.body.coupon.applied).toBe(false);
    expect((await t.http.get(`${A}/coupons`).set(staff).expect(200)).body.find((c: { code: string }) => c.code === "DIWALI500").state).toBe("PAUSED");
    await t.http.delete(`${A}/coupons/SECRET10`).set(staff).expect(204);
  });

  it("keeps a used coupon for the record", async () => {
    const coupons = (await t.http.get(`${A}/coupons`).set(staff).expect(200)).body as { code: string; usageCount: number }[];
    const used = coupons.find((c) => c.usageCount > 0);
    if (used) {
      const r = await t.http.delete(`${A}/coupons/${used.code}`).set(staff).expect(409);
      expect(r.body.code).toBe("COUPON_USED");
    }
    await t.http.patch(`${A}/coupons/DIWALI500`).set(staff).send({ type: "PERCENT", value: 95 }).expect(422);
  });
});
