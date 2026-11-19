import { count, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../../db/client.js";
import { aboutContent, brandSpotlights, contentPages, helpFaqs, helpTopics, jobRoles, pressReleases, products } from "../../db/schema.js";
import { DEFAULT_ABOUT, DEFAULT_FAQS, DEFAULT_HELP_TOPICS, DEFAULT_PAGES, DEFAULT_PRESS, DEFAULT_ROLES, DEFAULT_SPOTLIGHTS } from "./defaults.js";

const isEmpty = async (db: Db, table: PgTable) => {
  const [r] = await db.select({ n: count() }).from(table);
  return Number(r?.n ?? 0) === 0;
};

/**
 * Inserts the starting content of each kind whose table is empty, so edits made in AltasGoods Control are
 * never overwritten. Each table is judged on its own. Used at API startup and by db:seed. Returns the kinds it filled.
 */
export async function insertDefaultContent(db: Db) {
  const filled: string[] = [];

  if (await isEmpty(db, contentPages)) {
    await db
      .insert(contentPages)
      .values(DEFAULT_PAGES.map((p, i) => ({ slug: p.slug, kind: p.kind, title: p.title, nav: p.nav, summary: p.summary, sections: p.sections, related: p.related, sortOrder: i, updatedAt: new Date(`${p.updated}T00:00:00+05:30`) })))
      .onConflictDoNothing();
    filled.push("pages");
  }
  if (await isEmpty(db, helpTopics)) {
    await db.insert(helpTopics).values(DEFAULT_HELP_TOPICS.map((t, i) => ({ ...t, id: `topic-${i + 1}`, sortOrder: i }))).onConflictDoNothing();
    filled.push("help topics");
  }
  if (await isEmpty(db, helpFaqs)) {
    await db.insert(helpFaqs).values(DEFAULT_FAQS.map((f, i) => ({ ...f, sortOrder: i }))).onConflictDoNothing();
    filled.push("faqs");
  }
  if (await isEmpty(db, jobRoles)) {
    await db.insert(jobRoles).values(DEFAULT_ROLES.map((r, i) => ({ ...r, sortOrder: i }))).onConflictDoNothing();
    filled.push("roles");
  }
  if (await isEmpty(db, pressReleases)) {
    await db.insert(pressReleases).values(DEFAULT_PRESS.map((p, i) => ({ ...p, sortOrder: i }))).onConflictDoNothing();
    filled.push("press");
  }
  if (await isEmpty(db, aboutContent)) {
    await db.insert(aboutContent).values({ id: "about", doc: DEFAULT_ABOUT }).onConflictDoNothing();
    filled.push("about");
  }
  if (await isEmpty(db, brandSpotlights)) {
    const found = await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, DEFAULT_SPOTLIGHTS.map((s) => s.productSlug)));
    const byslug = new Map(found.map((p) => [p.slug, p.id]));
    // a spotlight needs its product: ones missing from the catalogue are skipped
    const rows = DEFAULT_SPOTLIGHTS.flatMap((s, i) => (byslug.has(s.productSlug) ? [{ brand: s.brand, tagline: s.tagline, productId: byslug.get(s.productSlug)!, tone: s.tone, image: s.image, sortOrder: i }] : []));
    if (rows.length) await db.insert(brandSpotlights).values(rows);
    if (rows.length) filled.push("spotlights");
  }
  return filled;
}
