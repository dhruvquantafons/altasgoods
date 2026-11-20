import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// the secret must be in the environment before the app (and its cached env) loads
const SECRET = vi.hoisted(() => {
  const value = "cron-secret-for-the-tests-0123456789";
  process.env.CRON_SECRET = value;
  return value;
});

import { cronAuthorized } from "../src/modules/commerce/cron.controller.js";
import { createTestApp, DEMO_CUSTOMER, signIn, type TestContext } from "./helpers.js";

describe("cronAuthorized", () => {
  it("accepts only the exact bearer secret", () => {
    expect(cronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(cronAuthorized(SECRET, SECRET)).toBe(false);
    expect(cronAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(cronAuthorized(undefined, SECRET)).toBe(false);
    expect(cronAuthorized(`Bearer ${SECRET}`, undefined)).toBe(false);
  });
});

describe("GET /v1/cron/tick", () => {
  let t: TestContext;
  let shopper: Record<string, string>;
  let addressId: string;

  beforeAll(async () => {
    t = await createTestApp();
    shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
    const addresses = await t.http.get("/v1/me/addresses").set(shopper).expect(200);
    addressId = addresses.body.find((a: { isDefault: boolean }) => a.isDefault).id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.clock.reset());

  it("refuses calls without the secret", async () => {
    await t.http.get("/v1/cron/tick").expect(401);
    await t.http.get("/v1/cron/tick").set("Authorization", "Bearer wrong-secret-wrong-secret").expect(401);
    // a signed-in shopper is still not Vercel Cron
    await t.http.get("/v1/cron/tick").set(shopper).expect(401);
  });

  it("does one round of the background work: expires an order left unpaid", async () => {
    const product = await t.http.get("/v1/products/tea-assam").expect(200);
    const placed = await t.http
      .post("/v1/orders")
      .set(shopper)
      .set("Idempotency-Key", randomUUID())
      .send({ addressId, paymentMethod: "UPI", lines: [{ offerId: product.body.offerId, qty: 1, variant: "" }] })
      .expect(201);

    t.clock.advance(31 * 60_000);
    const tick = await t.http.get("/v1/cron/tick").set("Authorization", `Bearer ${SECRET}`).expect(200);
    expect(tick.body).toMatchObject({ ordersExpired: expect.any(Number), paymentsConfirmed: expect.any(Number), refundsSettled: expect.any(Number), trackingMoved: 0, jobsPruned: expect.any(Number) });
    expect(tick.body.ordersExpired).toBeGreaterThanOrEqual(1);

    const detail = await t.http.get(`/v1/me/orders/${placed.body.order.id}`).set(shopper).expect(200);
    expect(detail.body.status).toBe("ABANDONED");
  });
});
