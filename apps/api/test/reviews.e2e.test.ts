import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { orderItems } from "../src/db/schema.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);

beforeAll(async () => {
  t = await createTestApp();
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

async function deliver(slug: string) {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  const placed = await t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, paymentMethod: "UPI", lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] }).expect(201);
  await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, placed.body.order.id));
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids: [item!.id], to }).expect(200);
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) await t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId: item!.id, to }).expect(200);
  return p.body as { id: string; rating: number; ratingCount: number };
}

const product = async (slug: string) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body as { rating: number; ratingCount: number };

describe("reviews", () => {
  it("only a customer who received the product can review it, once", async () => {
    const other = (await signUp(t.http, "never.bought@example.com")).auth;
    const p = await t.http.get("/v1/products/serum-glow").expect(200);
    await t.http.post("/v1/me/reviews").set(other).send({ productId: p.body.id, rating: 5, title: "Lovely" }).expect(403);
    await t.http.post("/v1/me/reviews").set(shopper).send({ productId: p.body.id, rating: 5, title: "Lovely" }).expect(403);

    await deliver("serum-glow");
    expect((await t.http.get("/v1/me/reviewable").set(shopper).expect(200)).body.map((r: { slug: string }) => r.slug)).toContain("serum-glow");
    const view = await t.http.get("/v1/products/serum-glow/reviews").set(shopper).expect(200);
    expect(view.body.canReview).toBe(true);

    await t.http.post("/v1/me/reviews").set(shopper).send({ productId: "serum-glow", rating: 4, title: "Absorbs fast", body: "No greasy feel." }).expect(201);
    const again = await t.http.post("/v1/me/reviews").set(shopper).send({ productId: "serum-glow", rating: 5, title: "Again" }).expect(409);
    expect(again.body.code).toBe("ALREADY_REVIEWED");
    expect((await t.http.get("/v1/products/serum-glow/reviews").set(shopper).expect(200)).body.canReview).toBe(false);
  });

  it("publishes straight away by default and keeps the product's rating in step", async () => {
    const before = await deliver("tea-assam");
    const r = await t.http.post("/v1/me/reviews").set(shopper).send({ productId: before.id, rating: 1, title: "Stale leaves", body: "Not fresh." }).expect(201);
    expect(r.body.status).toBe("PUBLISHED");

    const after = await product("tea-assam");
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect(after.rating).toBeCloseTo((before.rating * before.ratingCount + 1) / (before.ratingCount + 1), 4);
    const list = (await t.http.get("/v1/products/tea-assam/reviews").expect(200)).body;
    expect(list.items[0]).toMatchObject({ title: "Stale leaves", author: "Ananya S.", verified: true });
    expect(list.breakdown.find((b: { stars: number }) => b.stars === 1).count).toBe(1);

    // edited to 5 stars: the average moves, the count does not
    await t.http.patch(`/v1/me/reviews/${r.body.id}`).set(shopper).send({ rating: 5, title: "Better batch" }).expect(200);
    const edited = await product("tea-assam");
    expect(edited.ratingCount).toBe(after.ratingCount);
    expect(edited.rating).toBeCloseTo((before.rating * before.ratingCount + 5) / (before.ratingCount + 1), 4);

    // hidden by the store, it comes out of the totals; published again, it goes back in
    await t.http.patch(`/v1/admin/reviews/${r.body.id}`).set(staff).send({ status: "HIDDEN", adminNote: "Mentions a competitor" }).expect(200);
    const hidden = await product("tea-assam");
    expect(hidden.ratingCount).toBe(before.ratingCount);
    expect(hidden.rating).toBeCloseTo(before.rating, 4);
    expect((await t.http.get("/v1/products/tea-assam/reviews").expect(200)).body.items).toHaveLength(0);
    await t.http.patch(`/v1/admin/reviews/${r.body.id}`).set(staff).send({ status: "PUBLISHED", reply: "Thank you for trying us again!" }).expect(200);
    const back = (await t.http.get("/v1/products/tea-assam/reviews").expect(200)).body;
    expect(back.items[0].reply).toBe("Thank you for trying us again!");

    // deleted by the customer
    await t.http.delete(`/v1/me/reviews/${r.body.id}`).set(shopper).expect(204);
    expect((await product("tea-assam")).ratingCount).toBe(before.ratingCount);
  });

  it("waits for approval when Settings say so", async () => {
    await t.http.put("/v1/admin/settings").set(staff).send({ ...DEFAULT_SETTINGS, reviews: { autoPublish: false } }).expect(200);
    try {
      const before = await deliver("chair-lounge");
      const r = await t.http.post("/v1/me/reviews").set(shopper).send({ productId: before.id, rating: 5, title: "So comfortable" }).expect(201);
      expect(r.body.status).toBe("PENDING");
      expect((await product("chair-lounge")).ratingCount).toBe(before.ratingCount);
      expect((await t.http.get("/v1/products/chair-lounge/reviews").expect(200)).body.items).toHaveLength(0);

      const queue = (await t.http.get("/v1/admin/reviews").query({ status: "PENDING" }).set(staff).expect(200)).body;
      expect(queue.items.map((x: { id: string }) => x.id)).toContain(r.body.id);
      expect(queue.items.find((x: { id: string }) => x.id === r.body.id).customer.email).toBe(DEMO_CUSTOMER);
      await t.http.patch(`/v1/admin/reviews/${r.body.id}`).set(staff).send({ status: "PUBLISHED" }).expect(200);
      expect((await product("chair-lounge")).ratingCount).toBe(before.ratingCount + 1);

      const log = (await t.http.get("/v1/admin/audit").query({ action: "review" }).set(staff).expect(200)).body;
      expect(log.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["review.publish", "review.hide"]));
      await t.http.get("/v1/admin/reviews").set(shopper).expect(403);
    } finally {
      await t.http.put("/v1/admin/settings").set(staff).send(DEFAULT_SETTINGS).expect(200);
    }
  });
});
