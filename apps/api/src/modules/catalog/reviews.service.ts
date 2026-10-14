import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { conflict, forbidden, notFound } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { orderItems, orders, products, reviews, users } from "../../db/schema.js";
import { SettingsService } from "../admin/settings.service.js";
import type { adminReviewsQuery, moderateBody, productReviewsQuery, reviewInput, reviewPatch } from "./reviews.schemas.js";

type Review = typeof reviews.$inferSelect;
type Status = Review["status"];

/** "Ananya S." from "Ananya Sharma". */
const authorName = (name: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AltasGoods customer";
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts.at(-1)![0]}.`;
};

/**
 * Keeps a product's rating, rating_count and review_count in step as a review
 * goes in or out of the published set, or changes its stars while published.
 * One SQL update each, so concurrent changes cannot lose a count. Ratings the
 * catalog started with stay in the totals.
 */
async function adjust(tx: Db | Tx, productId: string, before: { published: boolean; rating: number }, after: { published: boolean; rating: number }) {
  if (before.published && after.published) {
    if (before.rating === after.rating) return;
    await tx
      .update(products)
      .set({ rating: sql`case when ${products.ratingCount} > 0 then ${products.rating} + (${after.rating - before.rating})::real / ${products.ratingCount} else ${products.rating} end` })
      .where(eq(products.id, productId));
  } else if (!before.published && after.published) {
    await tx
      .update(products)
      .set({
        rating: sql`(${products.rating} * ${products.ratingCount} + ${after.rating}) / (${products.ratingCount} + 1)`,
        ratingCount: sql`${products.ratingCount} + 1`,
        reviewCount: sql`${products.reviewCount} + 1`,
      })
      .where(eq(products.id, productId));
  } else if (before.published && !after.published) {
    await tx
      .update(products)
      .set({
        rating: sql`case when ${products.ratingCount} <= 1 then 0 else (${products.rating} * ${products.ratingCount} - ${before.rating}) / (${products.ratingCount} - 1) end`,
        ratingCount: sql`greatest(${products.ratingCount} - 1, 0)`,
        reviewCount: sql`greatest(${products.reviewCount} - 1, 0)`,
      })
      .where(eq(products.id, productId));
  }
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  /** The customer's latest delivered order line for a product, or null when they have not received one. */
  private async deliveredLine(userId: string, productId: string) {
    const [line] = await this.db
      .select({ id: orderItems.id, deliveredAt: orderItems.deliveredAt })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId), isNotNull(orderItems.deliveredAt)))
      .orderBy(desc(orderItems.deliveredAt))
      .limit(1);
    return line ?? null;
  }

  private async product(idOrSlug: string) {
    const [p] = await this.db.select({ id: products.id }).from(products).where(or(eq(products.id, idOrSlug), eq(products.slug, idOrSlug)));
    if (!p) throw notFound("Product");
    return p;
  }

  /* ------------------------------ Storefront ------------------------------ */

  async forProduct(idOrSlug: string, q: z.infer<typeof productReviewsQuery>, viewerId?: string) {
    const { id } = await this.product(idOrSlug);
    const published = and(eq(reviews.productId, id), eq(reviews.status, "PUBLISHED"));
    const where = q.stars ? and(published, eq(reviews.rating, q.stars)) : published;
    const order = q.sort === "high" ? [desc(reviews.rating), desc(reviews.createdAt)] : q.sort === "low" ? [asc(reviews.rating), desc(reviews.createdAt)] : [desc(reviews.createdAt)];
    const [rows, [total], breakdown, canReview] = await Promise.all([
      this.db
        .select({ r: reviews, name: users.name })
        .from(reviews)
        .innerJoin(users, eq(users.id, reviews.userId))
        .where(where)
        .orderBy(...order)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(reviews).where(where),
      this.db.select({ stars: reviews.rating, n: count() }).from(reviews).where(published).groupBy(reviews.rating),
      viewerId ? this.canReview(viewerId, id) : Promise.resolve(false),
    ]);
    const byStar = new Map(breakdown.map((b) => [b.stars, b.n]));
    return {
      items: rows.map(({ r, name }) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: authorName(name), verified: true as const, reply: r.reply, createdAt: r.createdAt.toISOString() })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: byStar.get(stars) ?? 0 })),
      canReview,
    };
  }

  private async canReview(userId: string, productId: string) {
    const [mine] = await this.db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)));
    return !mine && !!(await this.deliveredLine(userId, productId));
  }

  /* ------------------------------- Customer ------------------------------- */

  /** Delivered products the customer has not reviewed yet, most recent first. */
  async reviewable(userId: string) {
    const rows = await this.db
      .select({ id: products.id, slug: products.slug, title: products.title, images: products.images, deliveredAt: sql<Date>`max(${orderItems.deliveredAt})` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(and(eq(orders.userId, userId), isNotNull(orderItems.deliveredAt), sql`not exists (select 1 from reviews r where r.user_id = ${userId} and r.product_id = ${products.id})`))
      .groupBy(products.id, products.slug, products.title, products.images)
      .orderBy(desc(sql`max(${orderItems.deliveredAt})`))
      .limit(50);
    return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, image: r.images[0] ?? "", deliveredAt: new Date(r.deliveredAt).toISOString() }));
  }

  private async withProduct(rows: Review[]) {
    const ids = [...new Set(rows.map((r) => r.productId))];
    const ps = ids.length ? await this.db.select({ id: products.id, slug: products.slug, title: products.title, images: products.images }).from(products).where(inArray(products.id, ids)) : [];
    const byId = new Map(ps.map((p) => [p.id, { id: p.id, slug: p.slug, title: p.title, image: p.images[0] ?? "" }]));
    return rows.map((r) => ({
      id: r.id,
      product: byId.get(r.productId) ?? { id: r.productId, slug: r.productId, title: "Product", image: "" },
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      reply: r.reply,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async mine(userId: string) {
    return this.withProduct(await this.db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt)));
  }

  async create(userId: string, input: z.infer<typeof reviewInput>) {
    const { id: productId } = await this.product(input.productId);
    const line = await this.deliveredLine(userId, productId);
    if (!line) throw forbidden("You can review a product once it has been delivered to you.");
    const { reviews: rules } = await this.settings.get();
    const status: Status = rules.autoPublish ? "PUBLISHED" : "PENDING";
    try {
      const review = await this.db.transaction(async (tx) => {
        const [r] = await tx.insert(reviews).values({ productId, userId, orderItemId: line.id, rating: input.rating, title: input.title, body: input.body, status }).returning();
        await adjust(tx, productId, { published: false, rating: 0 }, { published: status === "PUBLISHED", rating: input.rating });
        return r!;
      });
      return (await this.withProduct([review]))[0]!;
    } catch (e) {
      if ((e as { code?: string; cause?: { code?: string } }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") throw conflict("ALREADY_REVIEWED", "You have already reviewed this product. Edit your review instead.");
      throw e;
    }
  }

  private async own(userId: string, id: string) {
    const [r] = await this.db.select().from(reviews).where(eq(reviews.id, id));
    if (!r || r.userId !== userId) throw notFound("Review");
    return r;
  }

  /** An edit is published straight away when reviews auto-publish; otherwise, and always after a review was hidden, it waits for approval. */
  async update(userId: string, id: string, patch: z.infer<typeof reviewPatch>) {
    const before = await this.own(userId, id);
    const { reviews: rules } = await this.settings.get();
    const status: Status = before.status === "HIDDEN" || !rules.autoPublish ? "PENDING" : "PUBLISHED";
    const rating = patch.rating ?? before.rating;
    const r = await this.db.transaction(async (tx) => {
      const [row] = await tx.update(reviews).set({ ...patch, status }).where(eq(reviews.id, id)).returning();
      await adjust(tx, before.productId, { published: before.status === "PUBLISHED", rating: before.rating }, { published: status === "PUBLISHED", rating });
      return row!;
    });
    return (await this.withProduct([r]))[0]!;
  }

  async remove(userId: string, id: string) {
    const before = await this.own(userId, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(reviews).where(eq(reviews.id, id));
      await adjust(tx, before.productId, { published: before.status === "PUBLISHED", rating: before.rating }, { published: false, rating: 0 });
    });
  }

  /* -------------------------------- Admin -------------------------------- */

  async adminList(q: z.infer<typeof adminReviewsQuery>) {
    const filters: SQL[] = [];
    if (q.status) filters.push(eq(reviews.status, q.status));
    if (q.rating) filters.push(eq(reviews.rating, q.rating));
    if (q.q) filters.push(or(ilike(products.title, `%${q.q}%`), ilike(reviews.title, `%${q.q}%`), ilike(users.email, `%${q.q}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const base = this.db
      .select({ r: reviews, name: users.name, email: users.email, orderId: orderItems.orderId })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .innerJoin(products, eq(products.id, reviews.productId))
      .leftJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
      .where(where);
    const [rows, [total], counts] = await Promise.all([
      base.orderBy(desc(reviews.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(reviews).innerJoin(users, eq(users.id, reviews.userId)).innerJoin(products, eq(products.id, reviews.productId)).where(where),
      this.db.select({ status: reviews.status, n: count() }).from(reviews).groupBy(reviews.status),
    ]);
    const shaped = await this.withProduct(rows.map((x) => x.r));
    const by = new Map(counts.map((c) => [c.status, c.n]));
    return {
      items: shaped.map((s, i) => ({ ...s, customer: { id: rows[i]!.r.userId, name: rows[i]!.name, email: rows[i]!.email }, orderId: rows[i]!.orderId, adminNote: rows[i]!.r.adminNote })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      counts: { PENDING: by.get("PENDING") ?? 0, PUBLISHED: by.get("PUBLISHED") ?? 0, HIDDEN: by.get("HIDDEN") ?? 0 },
    };
  }

  async moderate(id: string, body: z.infer<typeof moderateBody>) {
    const [before] = await this.db.select().from(reviews).where(eq(reviews.id, id));
    if (!before) throw notFound("Review");
    const status = body.status ?? before.status;
    const reply = body.reply === undefined ? before.reply : body.reply || null;
    const r = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(reviews)
        .set({ status, reply, repliedAt: reply !== before.reply ? (reply ? new Date() : null) : before.repliedAt, ...(body.adminNote !== undefined ? { adminNote: body.adminNote || null } : {}) })
        .where(eq(reviews.id, id))
        .returning();
      await adjust(tx, before.productId, { published: before.status === "PUBLISHED", rating: before.rating }, { published: status === "PUBLISHED", rating: before.rating });
      return row!;
    });
    const [shaped] = await this.withProduct([r]);
    const [u] = await this.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, r.userId));
    return { before, review: { ...shaped!, customer: { id: r.userId, name: u?.name ?? null, email: u?.email ?? "" }, orderId: null, adminNote: r.adminNote } };
  }
}
