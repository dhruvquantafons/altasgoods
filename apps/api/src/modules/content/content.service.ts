import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { conflict, notFound, unprocessable } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { aboutContent, brandSpotlights, brands, contentPages, helpFaqs, helpTopics, jobRoles, pressReleases, products, users, type ContentSection } from "../../db/schema.js";
import { insertDefaultContent } from "./ensure-defaults.js";
import type * as c from "./content.schemas.js";

type Page = typeof contentPages.$inferSelect;
const iso = (d: Date) => d.toISOString();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Gives every section an anchor: its own when valid, else made from its heading, kept unique. */
function withIds(sections: z.infer<typeof c.sectionInput>[]): ContentSection[] {
  const taken = new Set<string>();
  for (const s of sections) {
    if (!s.id) continue;
    if (taken.has(s.id)) throw unprocessable("DUPLICATE_SECTION", `Two sections use the anchor "${s.id}"`);
    taken.add(s.id);
  }
  return sections.map((s) => {
    if (s.id) return { id: s.id, heading: s.heading, body: s.body };
    const base = slugify(s.heading) || "section";
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return { id, heading: s.heading, body: s.body };
  });
}

/** Policies, help, careers, press, about and brand spotlights: the storefront pages that used to be fixed text. */
@Injectable()
export class ContentService implements OnApplicationBootstrap {
  private readonly log = new Logger("Content");
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Puts the starting content in place the first time the API runs. A failure is logged and does not stop the API. */
  async onApplicationBootstrap() {
    try {
      const filled = await this.ensureDefaults();
      if (filled.length) this.log.log(`Added the starting ${filled.join(", ")}`);
    } catch (e) {
      this.log.error(`Could not add the starting content: ${(e as Error).message}`);
    }
  }

  ensureDefaults() {
    return insertDefaultContent(this.db);
  }

  /** Next sort position in a table. */
  private async nextOrder(table: PgTable, col: PgColumn) {
    const [r] = await this.db.select({ max: sql<number>`coalesce(max(${col}), -1)` }).from(table);
    return Number(r?.max ?? -1) + 1;
  }

  /** Puts a table's rows in the given order; every row must be listed once. */
  private async reorderRows(table: PgTable, key: PgColumn, ids: string[], what: string) {
    const current = (await this.db.select({ id: key }).from(table)) as { id: string }[];
    if (current.length !== ids.length || new Set(ids).size !== ids.length || current.some((r) => !ids.includes(r.id))) throw unprocessable("BAD_ORDER", `List every ${what} exactly once`);
    await this.db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) await tx.update(table).set({ sortOrder: i } as never).where(eq(key, id));
    });
  }

  /* --------------------------------- Pages --------------------------------- */

  private async pageView(p: Page) {
    let by: string | null = null;
    if (p.updatedBy) {
      const [u] = await this.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, p.updatedBy));
      by = u?.name ?? u?.email ?? null;
    }
    const { updatedBy: _by, updatedAt, ...rest } = p;
    return { ...rest, updatedAt: iso(updatedAt), updatedBy: by };
  }

  async listPages() {
    const rows = await this.db.select().from(contentPages).orderBy(asc(contentPages.sortOrder), asc(contentPages.slug));
    return Promise.all(rows.map((p) => this.pageView(p)));
  }

  /** Related pages must exist, and a page cannot relate to itself. */
  private async checkRelated(related: string[], self: string) {
    if (related.includes(self)) throw unprocessable("BAD_RELATED", "A page cannot be related to itself");
    if (!related.length) return;
    const found = await this.db.select({ slug: contentPages.slug }).from(contentPages).where(inArray(contentPages.slug, related));
    const missing = related.filter((r) => !found.some((f) => f.slug === r));
    if (missing.length) throw unprocessable("BAD_RELATED", `No page named ${missing.join(", ")} to relate to`);
  }

  async createPage(input: z.infer<typeof c.pageInput>, staffId: string) {
    const [taken] = await this.db.select({ slug: contentPages.slug }).from(contentPages).where(eq(contentPages.slug, input.slug));
    if (taken) throw conflict("SLUG_TAKEN", "A page with this address already exists");
    await this.checkRelated(input.related, input.slug);
    const [p] = await this.db
      .insert(contentPages)
      .values({ ...input, sections: withIds(input.sections), sortOrder: await this.nextOrder(contentPages, contentPages.sortOrder), updatedBy: staffId })
      .returning();
    return this.pageView(p!);
  }

  async updatePage(slug: string, patch: z.infer<typeof c.pagePatch>, staffId: string) {
    const [before] = await this.db.select().from(contentPages).where(eq(contentPages.slug, slug));
    if (!before) throw notFound("Page");
    if (patch.related) await this.checkRelated(patch.related, slug);
    const { sections, ...rest } = patch;
    const [p] = await this.db
      .update(contentPages)
      .set({ ...rest, ...(sections ? { sections: withIds(sections) } : {}), updatedBy: staffId })
      .where(eq(contentPages.slug, slug))
      .returning();
    return { before: await this.pageView(before), after: await this.pageView(p!) };
  }

  async removePage(slug: string) {
    return this.db.transaction(async (tx) => {
      const [p] = await tx.delete(contentPages).where(eq(contentPages.slug, slug)).returning();
      if (!p) throw notFound("Page");
      // nothing keeps pointing at a page that is gone
      await tx.update(contentPages).set({ related: sql`array_remove(${contentPages.related}, ${slug})` }).where(sql`${slug} = any(${contentPages.related})`);
      return p;
    });
  }

  async reorderPages(slugs: string[]) {
    await this.reorderRows(contentPages, contentPages.slug, slugs, "page");
    return this.listPages();
  }

  /* ---------------------------------- Help --------------------------------- */

  listFaqs() {
    return this.db.select().from(helpFaqs).orderBy(asc(helpFaqs.sortOrder), asc(helpFaqs.id));
  }
  async createFaq(input: z.infer<typeof c.faqInput>) {
    const [f] = await this.db.insert(helpFaqs).values({ ...input, id: randomUUID(), sortOrder: await this.nextOrder(helpFaqs, helpFaqs.sortOrder) }).returning();
    return f!;
  }
  async updateFaq(id: string, patch: z.infer<typeof c.faqPatch>) {
    const [before] = await this.db.select().from(helpFaqs).where(eq(helpFaqs.id, id));
    if (!before) throw notFound("Question");
    const [f] = await this.db.update(helpFaqs).set(patch).where(eq(helpFaqs.id, id)).returning();
    return { before, after: f! };
  }
  async removeFaq(id: string) {
    const [f] = await this.db.delete(helpFaqs).where(eq(helpFaqs.id, id)).returning();
    if (!f) throw notFound("Question");
    return f;
  }
  async reorderFaqs(ids: string[]) {
    await this.reorderRows(helpFaqs, helpFaqs.id, ids, "question");
    return this.listFaqs();
  }

  listTopics() {
    return this.db.select().from(helpTopics).orderBy(asc(helpTopics.sortOrder), asc(helpTopics.id));
  }
  async createTopic(input: z.infer<typeof c.topicInput>) {
    const [t] = await this.db.insert(helpTopics).values({ ...input, id: randomUUID(), sortOrder: await this.nextOrder(helpTopics, helpTopics.sortOrder) }).returning();
    return t!;
  }
  async updateTopic(id: string, patch: z.infer<typeof c.topicPatch>) {
    const [before] = await this.db.select().from(helpTopics).where(eq(helpTopics.id, id));
    if (!before) throw notFound("Help topic");
    const [t] = await this.db.update(helpTopics).set(patch).where(eq(helpTopics.id, id)).returning();
    return { before, after: t! };
  }
  async removeTopic(id: string) {
    const [t] = await this.db.delete(helpTopics).where(eq(helpTopics.id, id)).returning();
    if (!t) throw notFound("Help topic");
    return t;
  }
  async reorderTopics(ids: string[]) {
    await this.reorderRows(helpTopics, helpTopics.id, ids, "topic");
    return this.listTopics();
  }

  /* --------------------------------- Careers -------------------------------- */

  listRoles() {
    return this.db.select().from(jobRoles).orderBy(asc(jobRoles.sortOrder), asc(jobRoles.slug));
  }
  async createRole(input: z.infer<typeof c.roleInput>) {
    const [taken] = await this.db.select({ slug: jobRoles.slug }).from(jobRoles).where(eq(jobRoles.slug, input.slug));
    if (taken) throw conflict("SLUG_TAKEN", "A role with this address already exists");
    const [r] = await this.db.insert(jobRoles).values({ ...input, sortOrder: await this.nextOrder(jobRoles, jobRoles.sortOrder) }).returning();
    return r!;
  }
  async updateRole(slug: string, patch: z.infer<typeof c.rolePatch>) {
    const [before] = await this.db.select().from(jobRoles).where(eq(jobRoles.slug, slug));
    if (!before) throw notFound("Role");
    const [r] = await this.db.update(jobRoles).set(patch).where(eq(jobRoles.slug, slug)).returning();
    return { before, after: r! };
  }
  async removeRole(slug: string) {
    const [r] = await this.db.delete(jobRoles).where(eq(jobRoles.slug, slug)).returning();
    if (!r) throw notFound("Role");
    return r;
  }
  async reorderRoles(slugs: string[]) {
    await this.reorderRows(jobRoles, jobRoles.slug, slugs, "role");
    return this.listRoles();
  }

  /* ---------------------------------- Press --------------------------------- */

  listPress() {
    return this.db.select().from(pressReleases).orderBy(asc(pressReleases.sortOrder), asc(pressReleases.slug));
  }
  async createPress(input: z.infer<typeof c.pressInput>) {
    const [taken] = await this.db.select({ slug: pressReleases.slug }).from(pressReleases).where(eq(pressReleases.slug, input.slug));
    if (taken) throw conflict("SLUG_TAKEN", "A release with this address already exists");
    // the newest release leads the press page, so a new one goes first
    await this.db.update(pressReleases).set({ sortOrder: sql`${pressReleases.sortOrder} + 1` });
    const [r] = await this.db.insert(pressReleases).values({ ...input, sortOrder: 0 }).returning();
    return r!;
  }
  async updatePress(slug: string, patch: z.infer<typeof c.pressPatch>) {
    const [before] = await this.db.select().from(pressReleases).where(eq(pressReleases.slug, slug));
    if (!before) throw notFound("Press release");
    const [r] = await this.db.update(pressReleases).set(patch).where(eq(pressReleases.slug, slug)).returning();
    return { before, after: r! };
  }
  async removePress(slug: string) {
    const [r] = await this.db.delete(pressReleases).where(eq(pressReleases.slug, slug)).returning();
    if (!r) throw notFound("Press release");
    return r;
  }
  async reorderPress(slugs: string[]) {
    await this.reorderRows(pressReleases, pressReleases.slug, slugs, "release");
    return this.listPress();
  }

  /* ---------------------------------- About --------------------------------- */

  async getAbout() {
    const [a] = await this.db.select().from(aboutContent).where(eq(aboutContent.id, "about"));
    if (!a) return { numbers: [], principles: [], milestones: [], offices: [], updatedAt: null };
    return { ...a.doc, updatedAt: iso(a.updatedAt) };
  }
  async saveAbout(doc: z.infer<typeof c.aboutDoc>, staffId: string) {
    const before = await this.getAbout();
    await this.db
      .insert(aboutContent)
      .values({ id: "about", doc, updatedBy: staffId })
      .onConflictDoUpdate({ target: aboutContent.id, set: { doc, updatedAt: new Date(), updatedBy: staffId } });
    return { before, after: await this.getAbout() };
  }

  /* -------------------------------- Spotlights ------------------------------- */

  private spotlightRows() {
    return this.db
      .select({ s: brandSpotlights, productTitle: products.title, productStatus: products.listingStatus, productSlug: products.slug, brandSlug: brands.slug })
      .from(brandSpotlights)
      .leftJoin(products, eq(products.id, brandSpotlights.productId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .orderBy(asc(brandSpotlights.sortOrder), asc(brandSpotlights.brand));
  }

  async listSpotlights() {
    const rows = await this.spotlightRows();
    return rows.map(({ s, productTitle, productStatus }) => ({ ...s, productTitle, productStatus, showing: s.active && productStatus === "LIVE" }));
  }

  private async spotlight(id: string) {
    return (await this.listSpotlights()).find((s) => s.id === id);
  }

  private async checkProduct(productId: string | null | undefined) {
    if (!productId) return;
    const [p] = await this.db.select({ id: products.id }).from(products).where(eq(products.id, productId));
    if (!p) throw unprocessable("BAD_PRODUCT", "That product does not exist");
  }

  async createSpotlight(input: z.infer<typeof c.spotlightInput>) {
    await this.checkProduct(input.productId);
    const [s] = await this.db.insert(brandSpotlights).values({ ...input, sortOrder: await this.nextOrder(brandSpotlights, brandSpotlights.sortOrder) }).returning();
    return (await this.spotlight(s!.id))!;
  }
  async updateSpotlight(id: string, patch: z.infer<typeof c.spotlightPatch>) {
    const before = await this.spotlight(id);
    if (!before) throw notFound("Spotlight");
    await this.checkProduct(patch.productId);
    await this.db.update(brandSpotlights).set(patch).where(eq(brandSpotlights.id, id));
    return { before, after: (await this.spotlight(id))! };
  }
  async removeSpotlight(id: string) {
    const before = await this.spotlight(id);
    if (!before) throw notFound("Spotlight");
    await this.db.delete(brandSpotlights).where(eq(brandSpotlights.id, id));
    return before;
  }
  async reorderSpotlights(ids: string[]) {
    await this.reorderRows(brandSpotlights, brandSpotlights.id, ids, "spotlight");
    return this.listSpotlights();
  }

  /* -------------------------------- Storefront ------------------------------- */

  private card = (p: Page) => ({ slug: p.slug, title: p.title, nav: p.nav, summary: p.summary, updatedAt: iso(p.updatedAt) });

  /** Published policies, in order. */
  async storefrontPolicies() {
    const rows = await this.db
      .select()
      .from(contentPages)
      .where(and(eq(contentPages.kind, "policy"), eq(contentPages.published, true)))
      .orderBy(asc(contentPages.sortOrder), asc(contentPages.slug));
    return rows.map(this.card);
  }

  async storefrontPolicy(slug: string) {
    const [p] = await this.db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.kind, "policy"), eq(contentPages.published, true)));
    if (!p) throw notFound("Policy");
    // related pages that were unpublished or deleted are left out
    const related = p.related.length ? await this.db.select().from(contentPages).where(and(inArray(contentPages.slug, p.related), eq(contentPages.published, true))) : [];
    return { ...this.card(p), sections: p.sections, related: p.related.flatMap((r) => related.filter((x) => x.slug === r).map(this.card)) };
  }

  async storefrontHelp() {
    const [topics, faqs] = await Promise.all([this.listTopics(), this.listFaqs()]);
    return { topics: topics.map(({ sortOrder: _o, ...t }) => t), faqs: faqs.map(({ sortOrder: _o, ...f }) => f) };
  }

  async storefrontRoles() {
    const rows = await this.db.select().from(jobRoles).where(eq(jobRoles.published, true)).orderBy(asc(jobRoles.sortOrder), asc(jobRoles.slug));
    return rows.map(({ published: _p, sortOrder: _o, ...r }) => r);
  }
  async storefrontRole(slug: string) {
    const [r] = await this.db.select().from(jobRoles).where(and(eq(jobRoles.slug, slug), eq(jobRoles.published, true)));
    if (!r) throw notFound("Role");
    const { published: _p, sortOrder: _o, ...rest } = r;
    return rest;
  }

  async storefrontPress() {
    return (await this.listPress()).map(({ sortOrder: _o, ...p }) => p);
  }

  /** Active spotlights whose product is on sale, with the brand to link to. */
  async storefrontSpotlights() {
    const rows = await this.spotlightRows();
    return rows.flatMap(({ s, productStatus, productSlug, brandSlug }) =>
      s.active && productStatus === "LIVE" && productSlug && brandSlug ? [{ id: s.id, brand: s.brand, tagline: s.tagline, tone: s.tone, image: s.image, brandSlug, productSlug }] : [],
    );
  }
}
