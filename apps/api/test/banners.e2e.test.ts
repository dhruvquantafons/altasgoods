import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
const A = "/v1/admin/banners";
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
});
afterAll(() => t.close());

describe("storefront CMS", () => {
  it("starts with the banners the storefront shipped with", async () => {
    const r = await t.http.get("/v1/storefront/banners").expect(200);
    expect(r.body.hero.length).toBe(4);
    expect(r.body.promo.length).toBe(2);
    expect(r.body.hero[0]).toMatchObject({ title: "The festive sale, done calmly", href: "/deals", image: "/images/banners/hero-festive.jpg" });
  });

  it("adds, schedules, hides and reorders banners, and the homepage follows", async () => {
    const added = await t.http
      .post(A)
      .set(staff)
      .send({ placement: "HERO", eyebrow: "Diwali", title: "Lights, gifts and savings", body: "Up to 40% off", ctaLabel: "Shop Diwali", href: "/deals", image: "/images/banners/hero-home.jpg", theme: "light" })
      .expect(201);
    expect(added.body).toMatchObject({ sortOrder: 4, showing: true });
    let home = (await t.http.get("/v1/storefront/banners").expect(200)).body;
    expect(home.hero.at(-1).title).toBe("Lights, gifts and savings");

    // scheduled for later: not shown until it starts
    await t.http.patch(`${A}/${added.body.id}`).set(staff).send({ startsAt: iso(2 * HOUR), endsAt: iso(5 * HOUR) }).expect(200);
    home = (await t.http.get("/v1/storefront/banners").expect(200)).body;
    expect(home.hero.map((b: { id: string }) => b.id)).not.toContain(added.body.id);
    t.clock.advance(3 * HOUR);
    home = (await t.http.get("/v1/storefront/banners").expect(200)).body;
    expect(home.hero.map((b: { id: string }) => b.id)).toContain(added.body.id);
    t.clock.reset();

    // first in line
    const all = (await t.http.get(A).set(staff).expect(200)).body.filter((b: { placement: string }) => b.placement === "HERO").map((b: { id: string }) => b.id);
    await t.http.post(`${A}/reorder`).set(staff).send({ placement: "HERO", ids: [added.body.id, ...all.filter((id: string) => id !== added.body.id)] }).expect(200);
    await t.http.patch(`${A}/${added.body.id}`).set(staff).send({ startsAt: null, endsAt: null }).expect(200);
    home = (await t.http.get("/v1/storefront/banners").expect(200)).body;
    expect(home.hero[0].id).toBe(added.body.id);
    await t.http.post(`${A}/reorder`).set(staff).send({ placement: "HERO", ids: [added.body.id] }).expect(422);

    // hidden, then removed
    await t.http.patch(`${A}/${added.body.id}`).set(staff).send({ active: false }).expect(200);
    home = (await t.http.get("/v1/storefront/banners").expect(200)).body;
    expect(home.hero.map((b: { id: string }) => b.id)).not.toContain(added.body.id);
    await t.http.delete(`${A}/${added.body.id}`).set(staff).expect(204);

    const log = (await t.http.get("/v1/admin/audit").query({ action: "banner" }).set(staff).expect(200)).body;
    expect(log.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["banner.create", "banner.update", "banner.reorder", "banner.delete"]));
  });

  it("checks images and links, and is for staff only", async () => {
    await t.http.post(A).set(staff).send({ placement: "PROMO", title: "Bad image", href: "/c/home", image: "https://evil.example/x.jpg" }).expect(422);
    await t.http.post(A).set(staff).send({ placement: "PROMO", title: "Bad link", href: "javascript:alert(1)", image: "/images/banners/promo-beauty.jpg" }).expect(422);
    const shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
    await t.http.get(A).set(shopper).expect(403);
  });
});
