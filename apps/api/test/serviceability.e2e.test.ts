import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LOGISTICS_PROVIDER, REDIS } from "../src/common/tokens.js";
import { DEFAULT_SETTINGS } from "../src/modules/admin/admin.schemas.js";
import { SimulatedLogisticsProvider } from "../src/modules/commerce/shipping/simulated.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

/** The simulated courier with a Shiprocket-style serviceability check we can steer. */
class CheckingCourier extends SimulatedLogisticsProvider {
  pickupPincode = "560001";
  answer: (pin: string) => Promise<{ serviceable: boolean; codAvailable: boolean; etaDays: number | null } | null> = async () => null;
  calls: { pin: string; weightGrams: number }[] = [];
  serviceability(pin: string, weightGrams: number) {
    this.calls.push({ pin, weightGrams });
    return this.answer(pin);
  }
}

const courier = new CheckingCourier();
let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;

const A = "/v1/admin";
const saveAreas = (areas: object) => t.http.put(`${A}/settings`).set(staff).send({ ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery, areas } });
const check = (pin: string) => t.http.get(`/v1/storefront/pincodes/${pin}`);
const addressIn = async (pincode: string) => {
  const r = await t.http.post("/v1/me/addresses").set(shopper).send({ name: "Test Shopper", phone: "9845012345", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode }).expect(201);
  return r.body.id as string;
};
const offerOf = async (slug: string) => (await t.http.get(`/v1/products/${slug}`).expect(200)).body.offerId as string;
const place = (addressId: string, body: object) => t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, ...body });

beforeAll(async () => {
  t = await createTestApp([{ provide: LOGISTICS_PROVIDER, useValue: courier }]);
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
});
afterAll(() => t.close());
const redis = () => t.app.get<Redis>(REDIS);
const keyPrefix = () => redis().options.keyPrefix ?? "";
const cacheKeys = async () => (await redis().keys(`${keyPrefix()}serviceability:*`)).map((k) => k.slice(keyPrefix().length));
beforeEach(async () => {
  for (const k of await cacheKeys()) await redis().del(k);
  courier.answer = async () => null;
  courier.calls = [];
  await saveAreas({ blocked: [], noCod: [], extraDays: [] }).expect(200);
  t.clock.reset();
});

describe("pincode rules", () => {
  it("delivers everywhere until an admin says otherwise", async () => {
    const r = await check("560087").expect(200);
    expect(r.body).toEqual({ pincode: "560087", serviceable: true, codAvailable: true, extraDays: 0, etaDays: null, source: "rules" });
  });

  it("rejects a malformed pincode", async () => {
    await check("060087").expect(422);
    await check("56008").expect(422);
    await check("abcdef").expect(422);
  });

  it("blocks by prefix or full pincode, and turns cash on delivery off by prefix", async () => {
    await saveAreas({ blocked: ["6825", "110001"], noCod: ["79"], extraDays: [] }).expect(200);
    expect((await check("682501").expect(200)).body).toMatchObject({ serviceable: false, codAvailable: false });
    expect((await check("110001").expect(200)).body.serviceable).toBe(false);
    expect((await check("110002").expect(200)).body.serviceable).toBe(true);
    expect((await check("791001").expect(200)).body).toMatchObject({ serviceable: true, codAvailable: false });
  });

  it("adds the days of the longest matching prefix", async () => {
    await saveAreas({ blocked: [], noCod: [], extraDays: [{ prefix: "79", days: 4 }, { prefix: "7910", days: 2 }, { prefix: "791001", days: 6 }] }).expect(200);
    expect((await check("792000").expect(200)).body.extraDays).toBe(4);
    expect((await check("791099").expect(200)).body.extraDays).toBe(2);
    expect((await check("791001").expect(200)).body.extraDays).toBe(6);
    expect((await check("560001").expect(200)).body.extraDays).toBe(0);
  });

  it("validates the rule lists when saved, and keeps them out of the public settings", async () => {
    await saveAreas({ blocked: ["5"], noCod: [], extraDays: [] }).expect(422);
    await saveAreas({ blocked: ["12ab34"], noCod: [], extraDays: [] }).expect(422);
    await saveAreas({ blocked: [], noCod: [], extraDays: [{ prefix: "79", days: 16 }] }).expect(422);
    await saveAreas({ blocked: ["6825"], noCod: [], extraDays: [] }).expect(200);
    const pub = await t.http.get("/v1/storefront/settings").expect(200);
    expect(pub.body.delivery).toEqual({ feePaise: DEFAULT_SETTINGS.delivery.feePaise, freeFromPaise: DEFAULT_SETTINGS.delivery.freeFromPaise });
  });
});

describe("checkout enforcement", () => {
  it("refuses to place an order to a blocked pincode, and says so in the quote", async () => {
    await saveAreas({ blocked: ["6825"], noCod: [], extraDays: [] }).expect(200);
    const offerId = await offerOf("tea-assam");
    const addressId = await addressIn("682501");
    const lines = [{ offerId, qty: 1, variant: "" }];

    const quote = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200);
    expect(quote.body.canPlaceOrder).toBe(false);
    expect(quote.body.issues[0]).toMatchObject({ code: "PINCODE_UNSERVICEABLE", message: "We don't deliver to 682501 yet" });

    const placed = await place(addressId, { paymentMethod: "UPI", lines }).expect(422);
    expect(placed.body.code).toBe("PINCODE_UNSERVICEABLE");
  });

  it("refuses cash on delivery where the admin switched it off, but takes UPI", async () => {
    await saveAreas({ blocked: [], noCod: ["79"], extraDays: [] }).expect(200);
    const offerId = await offerOf("tea-assam");
    const addressId = await addressIn("791001");
    const lines = [{ offerId, qty: 1, variant: "" }];

    const quote = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200);
    expect(quote.body.cod).toMatchObject({ available: false });
    expect(quote.body.cod.reason).toContain("791001");
    const cod = await place(addressId, { paymentMethod: "COD", lines }).expect(409);
    expect(cod.body.code).toBe("COD_UNAVAILABLE");
    await place(addressId, { paymentMethod: "UPI", lines }).expect(201);
  });

  it("pushes the promised date out by the area's extra days", async () => {
    const offerId = await offerOf("tea-assam");
    const addressId = await addressIn("791001");
    const lines = [{ offerId, qty: 1, variant: "" }];
    const plain = (await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200)).body.promisedBy;
    await saveAreas({ blocked: [], noCod: [], extraDays: [{ prefix: "79", days: 3 }] }).expect(200);
    const slow = (await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines }).expect(200)).body.promisedBy;
    expect((new Date(slow).getTime() - new Date(plain).getTime()) / 86_400_000).toBe(3);
  });
});

describe("Shiprocket check", () => {
  it("ands the courier's answer with the rules, and takes the longer ETA", async () => {
    courier.answer = async (pin) => (pin === "400001" ? { serviceable: true, codAvailable: false, etaDays: 9 } : { serviceable: false, codAvailable: false, etaDays: null });
    const ok = await check("400001").expect(200);
    expect(ok.body).toEqual({ pincode: "400001", serviceable: true, codAvailable: false, extraDays: 0, etaDays: 9, source: "rules+shiprocket" });
    expect((await check("400002").expect(200)).body).toMatchObject({ serviceable: false, codAvailable: false });
  });

  it("asks the courier once per pincode and weight, then answers from cache", async () => {
    courier.answer = async () => ({ serviceable: true, codAvailable: true, etaDays: 3 });
    await check("411001").expect(200);
    await check("411001").expect(200);
    expect(courier.calls).toHaveLength(1);
  });

  it("falls back to the rules when the courier errors", async () => {
    courier.answer = async () => {
      throw new Error("Shiprocket is down");
    };
    await saveAreas({ blocked: ["6825"], noCod: [], extraDays: [] }).expect(200);
    const r = await check("500001").expect(200);
    expect(r.body).toMatchObject({ serviceable: true, codAvailable: true, etaDays: null, source: "rules" });
    expect((await check("682502").expect(200)).body.serviceable).toBe(false);
  });

  it("delays the promised date when the courier's ETA is longer", async () => {
    courier.answer = async () => ({ serviceable: true, codAvailable: true, etaDays: 12 });
    const offerId = await offerOf("tea-assam");
    const addressId = await addressIn("600001");
    const q = await t.http.post("/v1/checkout/quote").set(shopper).send({ addressId, lines: [{ offerId, qty: 1, variant: "" }] }).expect(200);
    const days = (new Date(q.body.promisedBy).getTime() - t.clock.now().getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(11);
    expect(days).toBeLessThan(13);
  });

  it("keys the cache by pickup pincode, and caches a well-formed unserviceable answer", async () => {
    courier.answer = async () => ({ serviceable: false, codAvailable: false, etaDays: null });
    expect((await check("700001").expect(200)).body.serviceable).toBe(false);
    expect((await check("700001").expect(200)).body.serviceable).toBe(false);
    expect(courier.calls).toHaveLength(1);
    expect(await cacheKeys()).toContain("serviceability:560001:700001:1");
    courier.pickupPincode = "400001";
    await check("700001").expect(200);
    expect(courier.calls).toHaveLength(2);
    courier.pickupPincode = "560001";
  });

  it("does not cache a failure, but skips the courier for a minute after one", async () => {
    courier.answer = async () => {
      throw new Error("timed out");
    };
    expect((await check("800001").expect(200)).body).toMatchObject({ serviceable: true, source: "rules" });
    expect((await cacheKeys()).filter((k) => !k.includes(":down:"))).toEqual([]);
    // a different pincode in the window does not wait on the courier again
    expect((await check("800002").expect(200)).body.source).toBe("rules");
    expect(courier.calls).toHaveLength(1);
    // once the pause lapses the courier is asked again, and an answer is cached
    await redis().del("serviceability:down:560001");
    courier.answer = async () => ({ serviceable: true, codAvailable: true, etaDays: 4 });
    expect((await check("800003").expect(200)).body).toMatchObject({ etaDays: 4, source: "rules+shiprocket" });
    expect(courier.calls).toHaveLength(2);
  });
});
