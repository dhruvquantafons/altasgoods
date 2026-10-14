import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { brands, categories, offers, products, sales } from "../../db/schema.js";
import { notFound } from "../../common/errors.js";
import { HOUSE_SELLER_ID } from "../../common/house.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import { bestSale, salePrice, type LiveSale } from "../commerce/pricing.js";
import type { ProductQuery, ProductSummary } from "./catalog.schemas.js";

export const discountPercent = (price: number, mrp: number) => (mrp > price ? Math.floor(((mrp - price) / mrp) * 100) : 0);

/**
 * The store's offer for each product at a moment; a paused offer takes the
 * product off sale. price_paise is the selling price with the biggest live sale
 * applied, rounded down to the rupee exactly as salePrice() in pricing.ts does.
 */
const houseOffer = (at: Date) => sql`
  select o.product_id, o.id as offer_id, o.mrp_paise, o.stock, o.delivery_days, o.cod_available, o.return_window_days,
         o.price_paise as regular_price_paise,
         case when s.discount_percent is null then o.price_paise
              else greatest(100, (o.price_paise * (100 - s.discount_percent) / 10000) * 100) end as price_paise,
         s.id as sale_id, s.name as sale_name, s.slug as sale_slug, s.discount_percent as sale_percent, s.ends_at as sale_ends_at
  from offers o
  join products op on op.id = o.product_id
  left join lateral (
    select sa.id, sa.name, sa.slug, sa.discount_percent, sa.ends_at from sales sa
    where sa.status = 'ACTIVE' and sa.starts_at <= ${at} and sa.ends_at > ${at}
      and (sa.scope = 'ALL'
        or (sa.scope = 'CATEGORIES' and op.category_id = any(sa.category_ids))
        or (sa.scope = 'PRODUCTS' and o.product_id = any(sa.product_ids)))
    order by sa.discount_percent desc, sa.ends_at asc
    limit 1
  ) s on true
  where o.seller_id = ${HOUSE_SELLER_ID} and o.status = 'ACTIVE'`;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async categoryTree() {
    const rows = await this.db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    const counts = await this.db.execute<{ category_id: string; n: number }>(
      sql`select category_id, count(*)::int as n from products where listing_status = 'LIVE' group by category_id`,
    );
    const countBy = new Map(counts.rows.map((r) => [r.category_id, Number(r.n)]));
    return rows
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        image: c.image,
        productCount: countBy.get(c.id) ?? 0,
        children: rows.filter((x) => x.parentId === c.id).map((x) => ({ id: x.id, slug: x.slug, name: x.name })),
      }));
  }

  async listProducts(q: ProductQuery) {
    const list = await this.search(q);
    return { ...list, items: list.items.map(({ stock: _s, codAvailable: _c, returnWindowDays: _r, ...item }) => item) };
  }

  /** The product query behind listProducts and productDetail; items also carry the offer terms. */
  private async search(q: ProductQuery) {
    const where: SQL[] = [sql`p.listing_status = 'LIVE'`];
    const search = q.q?.trim();
    if (search) where.push(sql`(p.search_vector @@ websearch_to_tsquery('simple', ${search}) or p.search_text ilike ${"%" + search + "%"} or word_similarity(${search}, p.search_text) > 0.45)`);
    if (q.category) where.push(sql`c.slug = ${q.category}`);
    if (q.subcategory) where.push(sql`p.subcategory = ${q.subcategory}`);
    if (q.ids.length) where.push(sql`(p.id = any(string_to_array(${q.ids.join(",")}, ',')) or p.slug = any(string_to_array(${q.ids.join(",")}, ',')))`);
    if (q.minRating) where.push(sql`p.rating >= ${q.minRating}`);
    if (q.assured) where.push(sql`p.assured`);
    if (q.tag) where.push(sql`${q.tag} = any(p.tags)`);
    // filters that facets should not narrow by themselves
    const priceAndBrand: SQL[] = [];
    if (q.brand.length) priceAndBrand.push(sql`b.slug = any(string_to_array(${q.brand.join(",")}, ','))`);
    if (q.minPrice !== undefined) priceAndBrand.push(sql`bo.price_paise >= ${q.minPrice}`);
    if (q.maxPrice !== undefined) priceAndBrand.push(sql`bo.price_paise <= ${q.maxPrice}`);
    if (q.minDiscount) priceAndBrand.push(sql`bo.mrp_paise > 0 and (bo.mrp_paise - bo.price_paise) * 100 >= ${q.minDiscount} * bo.mrp_paise`);
    if (q.inStock) priceAndBrand.push(sql`bo.stock > 0`);

    const base = sql`
      from products p
      join brands b on b.id = p.brand_id
      join categories c on c.id = p.category_id
      join (${houseOffer(this.clock.now())}) bo on bo.product_id = p.id`;
    const whereAll = sql.join([...where, ...priceAndBrand], sql` and `);

    const orderBy = {
      relevance: search
        ? sql`(case when p.subcategory ilike ${search + "%"} or c.name ilike ${search + "%"} then 1 else 0 end) + ts_rank(p.search_vector, websearch_to_tsquery('simple', ${search})) + word_similarity(${search}, p.search_text) desc, p.sold_last_30d desc`
        : sql`p.sold_last_30d desc`,
      popular: sql`p.sold_last_30d desc`,
      price_asc: sql`bo.price_paise asc`,
      price_desc: sql`bo.price_paise desc`,
      newest: sql`p.created_at desc`,
      discount: sql`(bo.mrp_paise - bo.price_paise)::float / nullif(bo.mrp_paise, 0) desc`,
      rating: sql`p.rating desc, p.rating_count desc`,
    }[q.sort];

    const offset = (q.page - 1) * q.pageSize;
    const [rows, total, brandFacet, categoryFacet, priceFacet] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select p.id, p.slug, p.title, p.subcategory, p.images, p.rating, p.rating_count, p.assured, p.tags,
               b.id as brand_id, b.slug as brand_slug, b.name as brand_name,
               c.id as category_id, c.slug as category_slug, c.name as category_name,
               bo.offer_id, bo.price_paise, bo.mrp_paise, bo.stock, bo.delivery_days, bo.cod_available, bo.return_window_days,
               bo.sale_id, bo.sale_name, bo.sale_slug, bo.sale_percent, bo.sale_ends_at
        ${base} where ${whereAll}
        order by ${orderBy}, p.id
        limit ${q.pageSize} offset ${offset}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n ${base} where ${whereAll}`),
      // facets ignore the brand and price filters so users can widen them again
      this.db.execute<{ slug: string; name: string; n: number }>(sql`
        select b.slug, b.name, count(*)::int as n ${base} where ${sql.join(where, sql` and `)}
        group by b.slug, b.name order by n desc, b.name limit 20`),
      this.db.execute<{ slug: string; name: string; n: number }>(sql`
        select c.slug, c.name, count(*)::int as n ${base} where ${sql.join(where, sql` and `)}
        group by c.slug, c.name order by n desc`),
      this.db.execute<{ lo: number | null; hi: number | null }>(sql`
        select min(bo.price_paise)::bigint as lo, max(bo.price_paise)::bigint as hi ${base} where ${sql.join(where, sql` and `)}`),
    ]);

    return {
      items: rows.rows.map(toSummary),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total.rows[0]?.n ?? 0),
      facets: {
        brands: brandFacet.rows.map((r) => ({ slug: r.slug, name: r.name, count: Number(r.n) })),
        categories: categoryFacet.rows.map((r) => ({ slug: r.slug, name: r.name, count: Number(r.n) })),
        price: { minPaise: Number(priceFacet.rows[0]?.lo ?? 0), maxPaise: Number(priceFacet.rows[0]?.hi ?? 0) },
      },
    };
  }

  /**
   * Everything the storefront renders, in one response: every product on sale
   * with its full details and the store's offer, plus categories and brands.
   * The web app caches it and refreshes it when the catalog changes.
   */
  async storefront() {
    const now = this.clock.now();
    const [rows, cats, brandRows, live] = await Promise.all([
      this.db
        .select({ product: products, offer: offers })
        .from(products)
        .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID), eq(offers.status, "ACTIVE")))
        .where(eq(products.listingStatus, "LIVE"))
        .orderBy(asc(products.createdAt), asc(products.id)),
      this.db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      this.db.select().from(brands).orderBy(asc(brands.name)),
      this.db
        .select({ id: sales.id, name: sales.name, slug: sales.slug, discountPercent: sales.discountPercent, scope: sales.scope, categoryIds: sales.categoryIds, productIds: sales.productIds, endsAt: sales.endsAt })
        .from(sales)
        .where(and(eq(sales.status, "ACTIVE"), lte(sales.startsAt, now), gt(sales.endsAt, now))),
    ]);
    const saleFor = (p: { id: string; categoryId: string }) => bestSale(live as LiveSale[], p);
    return {
      categories: cats
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, image: c.image, children: cats.filter((x) => x.parentId === c.id).map((x) => ({ id: x.id, slug: x.slug, name: x.name })) })),
      brands: brandRows.map((b) => ({ id: b.id, slug: b.slug, name: b.name })),
      products: rows.map(({ product: p, offer: o }) => {
        const sale = saleFor(p);
        return {
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        title: p.title,
        brandId: p.brandId,
        categoryId: p.categoryId,
        subcategory: p.subcategory,
        images: p.images,
        description: p.description,
        highlights: p.highlights,
        specs: p.specs,
        variants: p.variants.map((v) => ({ ...v, values: v.values.map((x) => ({ ...x, available: x.available ?? true })) })),
        rating: p.rating,
        ratingCount: p.ratingCount,
        reviewCount: p.reviewCount,
        assured: p.assured,
        tags: p.tags,
        soldLast30d: p.soldLast30d,
        createdAt: p.createdAt.toISOString(),
        offer: {
          id: o.id,
          pricePaise: sale ? salePrice(o.pricePaise, sale.discountPercent) : o.pricePaise,
          mrpPaise: o.mrpPaise,
          regularPricePaise: o.pricePaise,
          sale: sale ? { id: sale.id, name: sale.name, slug: sale.slug, percent: sale.discountPercent, endsAt: sale.endsAt.toISOString() } : null,
          // exact stock stays private; a cart line is capped at 10 anyway
          stock: Math.min(o.stock, 10),
          deliveryDays: o.deliveryDays,
          codAvailable: o.codAvailable,
          returnWindowDays: o.returnWindowDays,
        },
      };
      }),
    };
  }

  async productDetail(idOrSlug: string) {
    const list = await this.search({ ids: [idOrSlug], sort: "relevance", page: 1, pageSize: 1, brand: [], assured: false, inStock: false });
    const summary = list.items[0];
    if (!summary) throw notFound("Product");
    const [p] = await this.db.select().from(products).where(eq(products.id, summary.id));
    return {
      ...summary,
      images: p!.images,
      description: p!.description,
      highlights: p!.highlights,
      specs: p!.specs,
      variants: p!.variants,
      reviewCount: p!.reviewCount,
      soldLast30d: p!.soldLast30d,
      lowStock: summary.stock > 0 && summary.stock <= 10 ? summary.stock : null,
      codAvailable: summary.codAvailable,
      returnWindowDays: summary.returnWindowDays,
    };
  }
}

/** A list row, plus the offer terms productDetail needs (extra keys are dropped from list responses by the schema). */
function toSummary(r: Record<string, unknown>): ProductSummary & { stock: number; codAvailable: boolean; returnWindowDays: number } {
  const price = Number(r.price_paise);
  const mrp = Number(r.mrp_paise);
  const images = r.images as string[];
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    brand: { id: String(r.brand_id), slug: String(r.brand_slug), name: String(r.brand_name) },
    category: { id: String(r.category_id), slug: String(r.category_slug), name: String(r.category_name) },
    subcategory: String(r.subcategory),
    image: images[0] ?? "",
    pricePaise: price,
    mrpPaise: mrp,
    discountPercent: discountPercent(price, mrp),
    rating: Number(r.rating),
    ratingCount: Number(r.rating_count),
    assured: Boolean(r.assured),
    tags: (r.tags as string[]) ?? [],
    inStock: Number(r.stock) > 0,
    deliveryDays: Number(r.delivery_days),
    offerId: String(r.offer_id),
    sale: r.sale_id
      ? { id: String(r.sale_id), name: String(r.sale_name), slug: String(r.sale_slug), percent: Number(r.sale_percent), endsAt: new Date(r.sale_ends_at as string).toISOString() }
      : null,
    stock: Number(r.stock),
    codAvailable: Boolean(r.cod_available),
    returnWindowDays: Number(r.return_window_days),
  };
}
