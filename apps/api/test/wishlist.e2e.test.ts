import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, signUp, type TestContext } from "./helpers.js";

let t: TestContext;
const W = "/v1/me/wishlist";

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe("wishlist", () => {
  it("is saved to the account, newest first, and only holds real products", async () => {
    const { auth } = await signUp(t.http, `wish.${Date.now()}@example.com`);
    const [a, b] = await Promise.all(
      ["headphones-studio", "tea-assam"].map(async (slug) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body.id as string),
    );

    expect((await t.http.get(W).set(auth).expect(200)).body).toEqual({ productIds: [] });
    const put = await t.http
      .put(W)
      .set(auth)
      .send({ productIds: [b, a, b, "no-such-product"] })
      .expect(200);
    expect(put.body).toEqual({ productIds: [b, a] });
    expect((await t.http.get(W).set(auth).expect(200)).body).toEqual({ productIds: [b, a] });

    await t.http.put(W).set(auth).send({ productIds: [] }).expect(200);
    expect((await t.http.get(W).set(auth).expect(200)).body).toEqual({ productIds: [] });
  });

  it("is private to each account", async () => {
    await t.http.get(W).expect(401);
    const one = await signUp(t.http, `wish.one.${Date.now()}@example.com`);
    const two = await signUp(t.http, `wish.two.${Date.now()}@example.com`);
    const id = (await t.http.get("/v1/products/tea-assam").expect(200)).body.id as string;
    await t.http
      .put(W)
      .set(one.auth)
      .send({ productIds: [id] })
      .expect(200);
    expect((await t.http.get(W).set(two.auth).expect(200)).body).toEqual({ productIds: [] });
  });
});
