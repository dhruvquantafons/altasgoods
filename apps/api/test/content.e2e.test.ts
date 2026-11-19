import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { DB } from "../src/common/tokens.js";
import type { Db } from "../src/db/client.js";
import { ContentService } from "../src/modules/content/content.service.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
let auditor: Record<string, string>;
const A = "/v1/admin/content";
const S = "/v1/storefront/content";
const POLICY = { slug: "gift-wrap", title: "Gift wrap policy", nav: "Gift wrap", summary: "How gift wrapping works.", sections: [{ heading: "What it costs", body: "It is **free**." }], related: ["returns"] };

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  await t.http.post("/v1/admin/staff").set(staff).send({ name: "Audit Or", email: "audit.content@altasgoods.in", roles: ["AUDITOR"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
  await t.http.post("/v1/me/password").set((await signIn(t.http, "audit.content@altasgoods.in", "temporary-pass-1")).auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
  auditor = (await signIn(t.http, "audit.content@altasgoods.in", "chosen-password-1")).auth;
});
afterAll(() => t.close());

/** Audit entries whose action starts with the given text. */
const audit = async (prefix: string) => {
  const body = (await t.http.get("/v1/admin/audit").query({ action: "content", pageSize: 100 }).set(staff).expect(200)).body;
  return (body.items as { action: string; entityType: string; entityId: string | null; summary: string }[]).filter((e) => e.action.startsWith(prefix));
};

describe("starting content", () => {
  it("has the policies, help, careers, press, about and spotlights, and no Credits policy", async () => {
    const policies = (await t.http.get(`${S}/policies`).expect(200)).body as { slug: string }[];
    expect(policies.map((p) => p.slug)).toEqual(["returns", "shipping", "cancellation", "payments", "guarantee", "terms", "privacy", "account-security", "grievance"]);
    await t.http.get(`${S}/policies/credits`).expect(404);
    const guarantee = (await t.http.get(`${S}/policies/guarantee`).expect(200)).body;
    expect(guarantee.related.map((r: { slug: string }) => r.slug)).not.toContain("credits");
    const help = (await t.http.get(`${S}/help`).expect(200)).body;
    expect(help.topics.length).toBeGreaterThan(5);
    expect(help.topics.map((x: { href: string }) => x.href)).not.toContain("/policies/credits");
    expect(help.faqs.map((f: { id: string }) => f.id)).not.toContain("credits");
    expect((await t.http.get(`${S}/careers`).expect(200)).body.length).toBeGreaterThan(5);
    expect((await t.http.get(`${S}/press`).expect(200)).body.length).toBe(4);
    const about = (await t.http.get(`${S}/about`).expect(200)).body;
    expect(about.numbers.length).toBe(4);
    expect(about.offices.length).toBe(4);
    const spots = (await t.http.get(`${S}/brand-spotlights`).expect(200)).body;
    expect(spots.map((s: { brand: string }) => s.brand)).toEqual(["Kestrel", "Auralis", "Kiln & Co", "Linen & Loom"]);
    expect(spots[0]).toMatchObject({ tone: "#eef1f6", brandSlug: "kestrel", productSlug: "laptop-air" });
  });

  it("keeps the policy tables as Markdown", async () => {
    const returns = (await t.http.get(`${S}/policies/returns`).expect(200)).body;
    expect(returns.sections[0].body).toContain("| Category | Window | Resolution |");
    expect(returns.sections[1].body).toContain("1. **Start from your order.**");
    expect(returns.sections[3].body).toContain("> **Note:**");
  });

  it("inserts once and never overwrites edits", async () => {
    await t.http.patch(`${A}/pages/returns`).set(staff).send({ title: "Our returns promise" }).expect(200);
    await t.http.delete(`${A}/faqs/cancellation`).set(staff).expect(204);
    const svc = t.app.get(ContentService);
    expect(await svc.ensureDefaults()).toEqual([]);
    expect((await t.http.get(`${S}/policies/returns`).expect(200)).body.title).toBe("Our returns promise");
    expect((await t.http.get(`${S}/help`).expect(200)).body.faqs.map((f: { id: string }) => f.id)).not.toContain("cancellation");

    // an emptied table is filled again; the others are left alone
    await (t.app.get(DB) as Db).execute(sql`truncate table press_releases`);
    expect(await svc.ensureDefaults()).toEqual(["press"]);
    expect((await t.http.get(`${S}/press`).expect(200)).body.length).toBe(4);
    expect((await t.http.get(`${S}/policies/returns`).expect(200)).body.title).toBe("Our returns promise");
  });
});

describe("pages and policies", () => {
  it("creates, edits, unpublishes, reorders and deletes a page, each audited", async () => {
    const made = await t.http.post(`${A}/pages`).set(staff).send(POLICY).expect(201);
    expect(made.body).toMatchObject({ slug: "gift-wrap", kind: "policy", published: true, updatedBy: expect.any(String) });
    expect(made.body.sections[0].id).toBe("what-it-costs");
    expect((await t.http.get(`${S}/policies`).expect(200)).body.at(-1).slug).toBe("gift-wrap");
    const live = (await t.http.get(`${S}/policies/gift-wrap`).expect(200)).body;
    expect(live.related.map((r: { slug: string }) => r.slug)).toEqual(["returns"]);

    await t.http.patch(`${A}/pages/gift-wrap`).set(staff).send({ sections: [{ heading: "What it costs", body: "It is free." }, { heading: "What it costs", body: "Twice." }] }).expect(200);
    const again = (await t.http.get(`${S}/policies/gift-wrap`).expect(200)).body;
    expect(again.sections.map((s: { id: string }) => s.id)).toEqual(["what-it-costs", "what-it-costs-2"]);

    // unpublished: gone from the storefront (and from other pages' related lists), still in admin
    await t.http.patch(`${A}/pages/gift-wrap`).set(staff).send({ published: false }).expect(200);
    await t.http.get(`${S}/policies/gift-wrap`).expect(404);
    expect((await t.http.get(`${S}/policies`).expect(200)).body.map((p: { slug: string }) => p.slug)).not.toContain("gift-wrap");
    expect((await t.http.get(`${A}/pages`).set(staff).expect(200)).body.map((p: { slug: string }) => p.slug)).toContain("gift-wrap");
    await t.http.patch(`${A}/pages/shipping`).set(staff).send({ related: ["gift-wrap", "returns"] }).expect(200);
    expect((await t.http.get(`${S}/policies/shipping`).expect(200)).body.related.map((r: { slug: string }) => r.slug)).toEqual(["returns"]);

    const order = (await t.http.get(`${A}/pages`).set(staff).expect(200)).body.map((p: { slug: string }) => p.slug) as string[];
    const flipped = [order.at(-1)!, ...order.slice(0, -1)];
    const re = await t.http.post(`${A}/pages/reorder`).set(staff).send({ slugs: flipped }).expect(200);
    expect(re.body.map((p: { slug: string }) => p.slug)).toEqual(flipped);
    await t.http.post(`${A}/pages/reorder`).set(staff).send({ slugs: ["returns"] }).expect(422);

    // deleting a page takes it out of the related lists
    await t.http.delete(`${A}/pages/gift-wrap`).set(staff).expect(204);
    await t.http.delete(`${A}/pages/gift-wrap`).set(staff).expect(404);
    expect((await t.http.get(`${A}/pages`).set(staff).expect(200)).body.find((p: { slug: string }) => p.slug === "shipping").related).toEqual(["returns"]);

    const log = await audit("content.page");
    expect(log.map((e) => e.action).sort()).toEqual(expect.arrayContaining(["content.page.create", "content.page.delete", "content.page.reorder", "content.page.update"]));
    expect(log.find((e) => e.action === "content.page.create")).toMatchObject({ entityType: "content_page", entityId: "gift-wrap" });
  });

  it("validates slugs, related pages, section count and size", async () => {
    await t.http.post(`${A}/pages`).set(staff).send({ ...POLICY, slug: "Bad Slug" }).expect(422);
    await t.http.post(`${A}/pages`).set(staff).send({ ...POLICY, slug: "returns" }).expect(409);
    const orphan = await t.http.post(`${A}/pages`).set(staff).send({ ...POLICY, related: ["nope"] }).expect(422);
    expect(orphan.body.code).toBe("BAD_RELATED");
    await t.http.post(`${A}/pages`).set(staff).send({ ...POLICY, related: ["gift-wrap"] }).expect(422);
    await t.http.patch(`${A}/pages/returns`).set(staff).send({ sections: [{ heading: "Big", body: "x".repeat(20_001) }] }).expect(422);
    const many = Array.from({ length: 31 }, (_, i) => ({ heading: `Part ${i}`, body: "x" }));
    await t.http.patch(`${A}/pages/returns`).set(staff).send({ sections: many }).expect(422);
    await t.http.patch(`${A}/pages/returns`).set(staff).send({ sections: many.slice(0, 30) }).expect(200);
    await t.http.patch(`${A}/pages/returns`).set(staff).send({ sections: [{ id: "a", heading: "A", body: "" }, { id: "a", heading: "B", body: "" }] }).expect(422);
    await t.http.patch(`${A}/pages/nope`).set(staff).send({ title: "x" }).expect(404);
  });
});

describe("help, careers and press", () => {
  it("adds, edits, reorders and removes FAQs and topics", async () => {
    const f = await t.http.post(`${A}/faqs`).set(staff).send({ group: "Payments", q: "Do you take cheques?", a: "No. See [payments](/policies/payments)." }).expect(201);
    await t.http.patch(`${A}/faqs/${f.body.id}`).set(staff).send({ a: "Not at all." }).expect(200);
    const ids = (await t.http.get(`${A}/faqs`).set(staff).expect(200)).body.map((x: { id: string }) => x.id) as string[];
    expect(ids.at(-1)).toBe(f.body.id);
    await t.http.post(`${A}/faqs/reorder`).set(staff).send({ ids: [ids.at(-1)!, ...ids.slice(0, -1)] }).expect(200);
    expect((await t.http.get(`${S}/help`).expect(200)).body.faqs[0]).toMatchObject({ id: f.body.id, a: "Not at all." });
    await t.http.delete(`${A}/faqs/${f.body.id}`).set(staff).expect(204);
    await t.http.delete(`${A}/faqs/${f.body.id}`).set(staff).expect(404);

    const tp = await t.http.post(`${A}/help-topics`).set(staff).send({ title: "Gifting", body: "Wrap and note", icon: "Gift", href: "/policies/shipping" }).expect(201);
    await t.http.patch(`${A}/help-topics/${tp.body.id}`).set(staff).send({ title: "Gifts" }).expect(200);
    await t.http.post(`${A}/help-topics`).set(staff).send({ title: "Bad", icon: "gift", href: "/x" }).expect(422);
    await t.http.delete(`${A}/help-topics/${tp.body.id}`).set(staff).expect(204);

    for (const a of ["content.faq.create", "content.faq.update", "content.faq.reorder", "content.faq.delete", "content.help_topic.create", "content.help_topic.update", "content.help_topic.delete"]) {
      expect((await audit(a)).length, a).toBeGreaterThan(0);
    }
    expect((await audit("content.faq.create"))[0]).toMatchObject({ entityType: "faq", entityId: f.body.id });
  });

  it("publishes and hides job roles", async () => {
    const role = { slug: "warehouse-lead", title: "Warehouse Lead", team: "Operations", location: "Pune", posted: "2026-11-01", summary: "Run the floor.", responsibilities: ["Plan shifts"], requirements: ["5 years"] };
    const made = await t.http.post(`${A}/roles`).set(staff).send(role).expect(201);
    expect(made.body).toMatchObject({ type: "Full time", niceToHave: [], published: true });
    expect((await t.http.get(`${S}/careers/warehouse-lead`).expect(200)).body.title).toBe("Warehouse Lead");
    await t.http.patch(`${A}/roles/warehouse-lead`).set(staff).send({ published: false }).expect(200);
    await t.http.get(`${S}/careers/warehouse-lead`).expect(404);
    expect((await t.http.get(`${S}/careers`).expect(200)).body.map((r: { slug: string }) => r.slug)).not.toContain("warehouse-lead");
    expect((await t.http.get(`${A}/roles`).set(staff).expect(200)).body.map((r: { slug: string }) => r.slug)).toContain("warehouse-lead");
    await t.http.post(`${A}/roles`).set(staff).send({ ...role, posted: "yesterday" }).expect(422);
    await t.http.delete(`${A}/roles/warehouse-lead`).set(staff).expect(204);
    expect((await audit("content.role")).map((e) => e.action)).toEqual(expect.arrayContaining(["content.role.create", "content.role.update", "content.role.delete"]));
  });

  it("adds a press release at the top, edits and removes it", async () => {
    const r = await t.http.post(`${A}/press`).set(staff).send({ slug: "new-hub", date: "2026-11-10", title: "A new hub", summary: "Opens in Pune.", category: "Logistics" }).expect(201);
    expect((await t.http.get(`${S}/press`).expect(200)).body[0].slug).toBe("new-hub");
    await t.http.patch(`${A}/press/new-hub`).set(staff).send({ title: "A newer hub" }).expect(200);
    await t.http.post(`${A}/press`).set(staff).send({ slug: "new-hub", date: "2026-11-10", title: "Again", category: "Logistics" }).expect(409);
    await t.http.delete(`${A}/press/new-hub`).set(staff).expect(204);
    expect(r.body.sortOrder).toBe(0);
    expect((await audit("content.press")).length).toBe(3);
  });
});

describe("about", () => {
  it("saves the whole page and audits it", async () => {
    const cur = (await t.http.get(`${A}/about`).set(staff).expect(200)).body;
    const next = { numbers: [{ value: "5", label: "cities" }], principles: cur.principles, milestones: cur.milestones, offices: cur.offices };
    const saved = await t.http.put(`${A}/about`).set(staff).send(next).expect(200);
    expect(saved.body.numbers).toEqual([{ value: "5", label: "cities" }]);
    expect((await t.http.get(`${S}/about`).expect(200)).body.numbers).toEqual([{ value: "5", label: "cities" }]);
    await t.http.put(`${A}/about`).set(staff).send({ ...next, numbers: [{ value: "", label: "x" }] }).expect(422);
    expect((await audit("content.about"))[0]).toMatchObject({ entityType: "about", entityId: "about" });
  });
});

describe("brand spotlights", () => {
  it("hides a spotlight whose product is archived or switched off, and shows it again", async () => {
    const list = (await t.http.get(`${A}/spotlights`).set(staff).expect(200)).body;
    const kestrel = list.find((s: { brand: string }) => s.brand === "Kestrel");
    expect(kestrel).toMatchObject({ productStatus: "LIVE", showing: true });
    await t.http.post(`/v1/admin/products/${kestrel.productId}/archive`).set(staff).expect(201);
    expect((await t.http.get(`${S}/brand-spotlights`).expect(200)).body.map((s: { brand: string }) => s.brand)).not.toContain("Kestrel");
    expect((await t.http.get(`${A}/spotlights`).set(staff).expect(200)).body.find((s: { brand: string }) => s.brand === "Kestrel")).toMatchObject({ productStatus: "ARCHIVED", showing: false });
    await t.http.post(`/v1/admin/products/${kestrel.productId}/restore`).set(staff).expect(201);
    // restored as inactive: still hidden until switched on
    expect((await t.http.get(`${S}/brand-spotlights`).expect(200)).body.map((s: { brand: string }) => s.brand)).not.toContain("Kestrel");
  });

  it("adds, edits, deactivates, reorders and removes one, and rejects a missing product", async () => {
    const list = (await t.http.get(`${A}/spotlights`).set(staff).expect(200)).body;
    const auralis = list.find((s: { brand: string }) => s.brand === "Auralis");
    const made = await t.http.post(`${A}/spotlights`).set(staff).send({ brand: "Auralis Pro", tagline: "More sound", productId: auralis.productId, image: "/images/products/headphones-studio.jpg", tone: "#eeeeee" }).expect(201);
    expect(made.body).toMatchObject({ showing: true, active: true });
    expect((await t.http.get(`${S}/brand-spotlights`).expect(200)).body.at(-1)).toMatchObject({ brand: "Auralis Pro", tone: "#eeeeee" });
    await t.http.post(`${A}/spotlights`).set(staff).send({ brand: "X", productId: "no-such-product", image: "/images/products/x.jpg" }).expect(422);
    await t.http.post(`${A}/spotlights`).set(staff).send({ brand: "X", productId: null, image: "https://evil.example/x.jpg" }).expect(422);
    await t.http.patch(`${A}/spotlights/${made.body.id}`).set(staff).send({ active: false }).expect(200);
    expect((await t.http.get(`${S}/brand-spotlights`).expect(200)).body.map((s: { brand: string }) => s.brand)).not.toContain("Auralis Pro");
    const ids = (await t.http.get(`${A}/spotlights`).set(staff).expect(200)).body.map((s: { id: string }) => s.id) as string[];
    await t.http.post(`${A}/spotlights/reorder`).set(staff).send({ ids: [ids.at(-1)!, ...ids.slice(0, -1)] }).expect(200);
    await t.http.delete(`${A}/spotlights/${made.body.id}`).set(staff).expect(204);
    expect((await audit("content.spotlight")).map((e) => e.action)).toEqual(expect.arrayContaining(["content.spotlight.create", "content.spotlight.update", "content.spotlight.reorder", "content.spotlight.delete"]));
  });

  it("keeps the spotlight, hidden, when its product is deleted", async () => {
    const db = t.app.get(DB) as Db;
    const id = ((await db.execute(sql`insert into brand_spotlights (brand, tagline, product_id, tone, image) values ('Ghost', '', null, '#ffffff', '/images/products/x.jpg') returning id`)).rows as { id: string }[])[0]!.id;
    const row = (await t.http.get(`${A}/spotlights`).set(staff).expect(200)).body.find((s: { id: string }) => s.id === id);
    expect(row).toMatchObject({ productId: null, showing: false });
    expect((await t.http.get(`${S}/brand-spotlights`).expect(200)).body.map((s: { brand: string }) => s.brand)).not.toContain("Ghost");
  });
});

describe("access", () => {
  it("lets an Auditor read every content list but change nothing", async () => {
    for (const path of ["pages", "faqs", "help-topics", "roles", "press", "about", "spotlights"]) await t.http.get(`${A}/${path}`).set(auditor).expect(200);
    await t.http.post(`${A}/pages`).set(auditor).send(POLICY).expect(403);
    await t.http.patch(`${A}/pages/returns`).set(auditor).send({ title: "x" }).expect(403);
    await t.http.delete(`${A}/pages/returns`).set(auditor).expect(403);
    await t.http.post(`${A}/pages/reorder`).set(auditor).send({ slugs: ["returns"] }).expect(403);
    await t.http.post(`${A}/faqs`).set(auditor).send({ group: "g", q: "q", a: "a" }).expect(403);
    await t.http.put(`${A}/about`).set(auditor).send({ numbers: [], principles: [], milestones: [], offices: [] }).expect(403);
    await t.http.post(`${A}/spotlights`).set(auditor).send({ brand: "x", productId: null, image: "/images/products/x.jpg" }).expect(403);
    await t.http.post(`${A}/roles`).set(auditor).send({ slug: "abc", title: "t", team: "t", location: "l", posted: "2026-01-01" }).expect(403);
  });

  it("keeps customers and the signed-out out of the admin endpoints, and the storefront open", async () => {
    await t.http.get(`${A}/pages`).expect(401);
    const customer = (await signIn(t.http, DEMO_CUSTOMER)).auth;
    await t.http.get(`${A}/pages`).set(customer).expect(403);
    await t.http.get(`${S}/policies`).expect(200);
  });
});
