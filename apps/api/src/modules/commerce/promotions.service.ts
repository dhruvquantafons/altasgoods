import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { conflict, notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { categories, coupons, products, sales } from "../../db/schema.js";
import { slugify } from "../catalog/admin-catalog.service.js";
import type { couponInput, couponPatch, saleInput, salePatch } from "./promotions.schemas.js";

type Sale = typeof sales.$inferSelect;
type Coupon = typeof coupons.$inferSelect;

/** Sales and coupons: created and edited in AltasGoods Control, honoured by the catalog, cart and checkout. */
@Injectable()
export class PromotionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /* ------------------------------- Sales ------------------------------- */

  private saleState(s: Sale, now = this.clock.now()) {
    if (s.status === "PAUSED") return "PAUSED" as const;
    if (now < s.startsAt) return "SCHEDULED" as const;
    if (now >= s.endsAt) return "ENDED" as const;
    return "LIVE" as const;
  }

  private toSale(s: Sale) {
    return { ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(), state: this.saleState(s) };
  }

  /** Every sale: live and scheduled first, then ended ones, newest first. */
  async sales() {
    const rows = await this.db.select().from(sales).orderBy(desc(sales.startsAt));
    const order = { LIVE: 0, SCHEDULED: 1, PAUSED: 2, ENDED: 3 } as const;
    return rows.map((s) => this.toSale(s)).sort((a, b) => order[a.state] - order[b.state]);
  }

  async sale(id: string) {
    const [s] = await this.db.select().from(sales).where(eq(sales.id, id));
    if (!s) throw notFound("Sale");
    return this.toSale(s);
  }

  /** Live sales for the storefront banner and the deals page. */
  async liveSales() {
    const now = this.clock.now();
    const rows = await this.db
      .select()
      .from(sales)
      .where(and(eq(sales.status, "ACTIVE"), lte(sales.startsAt, now), gt(sales.endsAt, now)))
      .orderBy(desc(sales.discountPercent), asc(sales.endsAt));
    return rows.map((s) => this.toSale(s));
  }

  /** Categories must be top-level ones and products must exist; unknown ids are refused, not ignored. */
  private async checkScope(categoryIds: string[] | undefined, productIds: string[] | undefined) {
    if (categoryIds?.length) {
      const found = await this.db.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, categoryIds), isNull(categories.parentId)));
      const missing = categoryIds.filter((id) => !found.some((f) => f.id === id));
      if (missing.length) throw unprocessable("UNKNOWN_CATEGORY", `These categories do not exist: ${missing.join(", ")}`);
    }
    if (productIds?.length) {
      const found = await this.db.select({ id: products.id }).from(products).where(inArray(products.id, productIds));
      const missing = productIds.filter((id) => !found.some((f) => f.id === id));
      if (missing.length) throw unprocessable("UNKNOWN_PRODUCT", `These products do not exist: ${missing.join(", ")}`);
    }
  }

  private async uniqueSlug(name: string, exceptId?: string) {
    const base = slugify(name) || "sale";
    const taken = await this.db.select({ slug: sales.slug, id: sales.id }).from(sales).where(or(eq(sales.slug, base), like(sales.slug, `${base}-%`)));
    const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.slug));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  async createSale(input: z.infer<typeof saleInput>) {
    await this.checkScope(input.scope === "CATEGORIES" ? input.categoryIds : undefined, input.scope === "PRODUCTS" ? input.productIds : undefined);
    const [s] = await this.db
      .insert(sales)
      .values({
        ...input,
        // only the list that matches the scope is kept
        categoryIds: input.scope === "CATEGORIES" ? input.categoryIds : [],
        productIds: input.scope === "PRODUCTS" ? input.productIds : [],
        slug: await this.uniqueSlug(input.name),
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      })
      .returning();
    return this.toSale(s!);
  }

  async updateSale(id: string, patch: z.infer<typeof salePatch>) {
    const [before] = await this.db.select().from(sales).where(eq(sales.id, id));
    if (!before) throw notFound("Sale");
    const scope = patch.scope ?? before.scope;
    const categoryIds = scope === "CATEGORIES" ? (patch.categoryIds ?? before.categoryIds) : [];
    const productIds = scope === "PRODUCTS" ? (patch.productIds ?? before.productIds) : [];
    if ((scope === "CATEGORIES" && !categoryIds.length) || (scope === "PRODUCTS" && !productIds.length)) throw unprocessable("EMPTY_SCOPE", "Pick at least one category or product for this sale");
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : before.startsAt;
    const endsAt = patch.endsAt ? new Date(patch.endsAt) : before.endsAt;
    if (endsAt <= startsAt) throw unprocessable("BAD_WINDOW", "The end has to be after the start");
    await this.checkScope(scope === "CATEGORIES" ? categoryIds : undefined, scope === "PRODUCTS" ? productIds : undefined);
    const [s] = await this.db
      .update(sales)
      .set({ ...patch, scope, categoryIds, productIds, startsAt, endsAt, ...(patch.name && patch.name !== before.name ? { slug: await this.uniqueSlug(patch.name, id) } : {}) })
      .where(eq(sales.id, id))
      .returning();
    return { before: this.toSale(before), after: this.toSale(s!) };
  }

  /** Orders already placed keep the price they were charged. */
  async deleteSale(id: string) {
    const [s] = await this.db.delete(sales).where(eq(sales.id, id)).returning();
    if (!s) throw notFound("Sale");
    return this.toSale(s);
  }

  /* ------------------------------ Coupons ------------------------------ */

  private couponState(c: Coupon, now = this.clock.now()) {
    if (c.status === "PAUSED") return "PAUSED" as const;
    if (now < c.startsAt) return "SCHEDULED" as const;
    if (now > c.endsAt) return "ENDED" as const;
    if (c.usageLimit !== null && c.usageCount >= c.usageLimit) return "USED_UP" as const;
    return "LIVE" as const;
  }

  private toCoupon(c: Coupon) {
    const { createdAt: _c, ...rest } = c;
    return { ...rest, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), state: this.couponState(c) };
  }

  async coupons() {
    const rows = await this.db.select().from(coupons).orderBy(desc(coupons.createdAt), asc(coupons.code));
    return rows.map((c) => this.toCoupon(c));
  }

  /** Coupons customers can use right now and that the store chose to list. */
  async storefrontCoupons() {
    const now = this.clock.now();
    const rows = await this.db
      .select()
      .from(coupons)
      .where(and(eq(coupons.status, "ACTIVE"), eq(coupons.showOnStorefront, true), lte(coupons.startsAt, now), gt(coupons.endsAt, now), sql`(${coupons.usageLimit} is null or ${coupons.usageCount} < ${coupons.usageLimit})`))
      .orderBy(asc(coupons.minOrderPaise));
    return rows.map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, maxDiscountPaise: c.maxDiscountPaise, minOrderPaise: c.minOrderPaise, endsAt: c.endsAt.toISOString() }));
  }

  async createCoupon(input: z.infer<typeof couponInput>) {
    const [exists] = await this.db.select({ code: coupons.code }).from(coupons).where(eq(coupons.code, input.code));
    if (exists) throw conflict("COUPON_EXISTS", `There is already a coupon called ${input.code}`);
    const [c] = await this.db
      .insert(coupons)
      .values({ ...input, fundedBy: "STORE", startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) })
      .returning();
    return this.toCoupon(c!);
  }

  async updateCoupon(code: string, patch: z.infer<typeof couponPatch>) {
    const [before] = await this.db.select().from(coupons).where(eq(coupons.code, code));
    if (!before) throw notFound("Coupon");
    const type = patch.type ?? before.type;
    const value = patch.value ?? before.value;
    if (type === "PERCENT" && value > 90) throw unprocessable("BAD_VALUE", "A percentage coupon can be at most 90% off");
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : before.startsAt;
    const endsAt = patch.endsAt ? new Date(patch.endsAt) : before.endsAt;
    if (endsAt <= startsAt) throw unprocessable("BAD_WINDOW", "The end has to be after the start");
    const [c] = await this.db.update(coupons).set({ ...patch, startsAt, endsAt }).where(eq(coupons.code, code)).returning();
    return { before: this.toCoupon(before), after: this.toCoupon(c!) };
  }

  /** A coupon that has been used stays for the record: pause it instead. */
  async deleteCoupon(code: string) {
    const [c] = await this.db.select().from(coupons).where(eq(coupons.code, code));
    if (!c) throw notFound("Coupon");
    if (c.usageCount > 0) throw conflict("COUPON_USED", `${code} has been used ${c.usageCount} time${c.usageCount === 1 ? "" : "s"}, so it stays for the record. Pause it instead.`);
    await this.db.delete(coupons).where(eq(coupons.code, code));
    return this.toCoupon(c);
  }
}
