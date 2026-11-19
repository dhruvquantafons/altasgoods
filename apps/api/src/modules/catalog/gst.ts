import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { Db, Tx } from "../../db/client.js";
import { categories, products } from "../../db/schema.js";

/** A GST rate in basis points: 1800 is 18%. The usual slabs are 0, 25, 300, 500, 1200, 1800 and 2800; any whole value up to 40% is allowed. */
export const gstRateBpSchema = z.number().int().min(0).max(4000).describe("GST rate in basis points, 1800 = 18%");
/** An HSN code: 4, 6 or 8 digits. */
export const hsnSchema = z.string().regex(/^(\d{4}|\d{6}|\d{8})$/, "An HSN code has 4, 6 or 8 digits");

/**
 * The GST inside a GST-inclusive amount: round(net * r / (10000 + r)), half up, in integer
 * arithmetic only. For 118000 paise at 1800 bp this is 18000. Whole amounts only.
 */
export function taxIncludedPaise(netPaise: number, rateBp: number) {
  if (rateBp <= 0 || netPaise <= 0) return 0;
  const d = 10_000 + rateBp;
  return Math.floor((2 * netPaise * rateBp + d) / (2 * d));
}

/** The GST inside an order's prices: every line that is not cancelled (returned lines still count until refunded in full). */
export const gstIncluded = (items: { status: string; taxPaise: number }[]) => items.filter((i) => i.status !== "CANCELLED").reduce((a, i) => a + i.taxPaise, 0);

/** "18", "18%", "0.25" or "12.5" as basis points, exactly (no floating point); null when it is not a percentage with up to 2 decimals. */
export function percentToBp(text: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.replace(/%/g, "").trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export interface GstDefaults {
  defaultGstRateBp: number;
  defaultHsn: string | null;
}
export interface ResolvedGst {
  rateBp: number;
  hsn: string | null;
  /** where the rate came from, for the admin's hint */
  rateFrom: string;
  hsnFrom: string | null;
}
type Level = { name: string; gstRateBp: number | null; hsn: string | null };

/** The first rate and the first HSN found walking down the levels, then the store default. Rate and HSN resolve separately. */
export function resolveFrom(levels: Level[], defaults: GstDefaults): ResolvedGst {
  const rate = levels.find((l) => l.gstRateBp !== null);
  const hsn = levels.find((l) => l.hsn !== null);
  return {
    rateBp: rate ? rate.gstRateBp! : defaults.defaultGstRateBp,
    hsn: hsn ? hsn.hsn : defaults.defaultHsn,
    rateFrom: rate ? rate.name : "the store default",
    hsnFrom: hsn ? hsn.name : defaults.defaultHsn ? "the store default" : null,
  };
}

/** A resolved rate as the admin API shows it. */
export const inheritedView = (r: ResolvedGst) => ({ gstRateBp: r.rateBp, rateFrom: r.rateFrom, hsn: r.hsn, hsnFrom: r.hsnFrom });

type Where = { categoryId: string; subcategory: string };

/**
 * The levels for a product, most specific first: its own override, its subcategory (a child
 * category), then the category. A subcategory with no rate falls through to its parent.
 */
function levelsFor(
  p: { gstRateBp: number | null; hsn: string | null } | null,
  where: Where,
  cats: { id: string; parentId: string | null; name: string; gstRateBp: number | null; hsn: string | null }[],
): Level[] {
  const parent = cats.find((c) => c.id === where.categoryId);
  const child = cats.find((c) => c.parentId === where.categoryId && c.name === where.subcategory);
  return [
    ...(p ? [{ name: "this product", gstRateBp: p.gstRateBp, hsn: p.hsn }] : []),
    ...(child ? [{ name: `${child.name}`, gstRateBp: child.gstRateBp, hsn: child.hsn }] : []),
    ...(parent ? [{ name: parent.name, gstRateBp: parent.gstRateBp, hsn: parent.hsn }] : []),
  ];
}

/** What each product is taxed at, resolved product, then subcategory, then category, then the store default. Used to place an order. */
export async function resolveProductGst(db: Db | Tx, productIds: string[], defaults: GstDefaults) {
  const out = new Map<string, ResolvedGst>();
  if (!productIds.length) return out;
  const [rows, cats] = await Promise.all([
    db.select({ id: products.id, categoryId: products.categoryId, subcategory: products.subcategory, gstRateBp: products.gstRateBp, hsn: products.hsn }).from(products).where(inArray(products.id, productIds)),
    db.select().from(categories),
  ]);
  for (const r of rows) out.set(r.id, resolveFrom(levelsFor(r, r, cats), defaults));
  return out;
}

/** What a product (or a category's subcategory) would be taxed at with no override of its own: the hint the admin sees. */
export async function inheritedGst(db: Db | Tx, where: Where, defaults: GstDefaults) {
  const cats = await db.select().from(categories).where(or(eq(categories.id, where.categoryId), eq(categories.parentId, where.categoryId)));
  return resolveFrom(levelsFor(null, where, cats), defaults);
}
