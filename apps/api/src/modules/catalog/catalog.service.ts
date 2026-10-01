import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { categories, offers, products, sellers } from "../../db/schema.js";
import { notFound } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { ProductQuery, ProductSummary } from "./catalog.schemas.js";

export const discountPercent = (price: number, mrp: number) => (mrp > price ? Math.floor(((mrp - price) / mrp) * 100) : 0);

/**
 * Featured offer (buy box), spec 10.2 simplified: an active, in stock offer
 * wins over out of stock, then the lowest price, then the better rated seller.
 */
const BEST_OFFER = sql`
  select distinct on (o.product_id)
    o.product_id, o.id as offer_id, o.seller_id, o.price_paise, o.mrp_paise, o.stock, o.delivery_days
  from offers o
  join sellers s on s.id = o.seller_id
  where o.status = 'ACTIVE' and s.status = 'ACTIVE'
  order by o.product_id, (o.stock > 0) desc, o.price_paise asc, s.rating desc`;

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
        commissionPercent: c.commissionBps / 100,
        productCount: countBy.get(c.id) ?? 0,
        children: rows.filter((x) => x.parentId === c.id).map((x) => ({ id: x.id, slug: x.slug, name: x.name })),
      }));
  }

  async listProducts(q: ProductQuery) {
    const where: SQL[] = [sql`p.listing_status = 'LIVE'`];
    const search = q.q?.trim();
    if (search) where.push(sql`(p.search_vector @@ websearch_to_tsquery('simple', ${search}) or p.search_text ilike ${"%" + search + "%"} or word_similarity(${search}, p.search_text) > 0.45)`);
    if (q.category) where.push(sql`c.slug = ${q.category}`);
    if (q.subcategory) where.push(sql`p.subcategory = ${q.subcategory}`);
    if (q.ids.length) where.push(sql`(p.id = any(string_to_array(${q.ids.join(",")}, ',')) or p.slug = any(string_to_array(${q.ids.join(",")}, ',')))`);
    if (q.seller) where.push(sql`exists (select 1 from offers so join sellers ss on ss.id = so.seller_id where so.product_id = p.id and ss.slug = ${q.seller} and so.status = 'ACTIVE')`);
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
      join (${BEST_OFFER}) bo on bo.product_id = p.id`;
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
               bo.offer_id, bo.seller_id, bo.price_paise, bo.mrp_paise, bo.stock, bo.delivery_days,
               (select count(*)::int from offers x where x.product_id = p.id and x.status = 'ACTIVE') as seller_count
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

  async productDetail(idOrSlug: string) {
    const list = await this.listProducts({ ids: [idOrSlug], sort: "relevance", page: 1, pageSize: 1, brand: [], assured: false, inStock: false });
    const summary = list.items[0];
    if (!summary) throw notFound("Product");
    const [p] = await this.db.select().from(products).where(eq(products.id, summary.id));
    const offerRows = await this.db
      .select({ offer: offers, seller: sellers })
      .from(offers)
      .innerJoin(sellers, eq(sellers.id, offers.sellerId))
      .where(and(eq(offers.productId, summary.id), eq(offers.status, "ACTIVE"), eq(sellers.status, "ACTIVE")))
      .orderBy(asc(offers.pricePaise));
    return {
      ...summary,
      images: p!.images,
      description: p!.description,
      highlights: p!.highlights,
      specs: p!.specs,
      variants: p!.variants,
      reviewCount: p!.reviewCount,
      soldLast30d: p!.soldLast30d,
      offers: offerRows.map(({ offer, seller }) => ({
        id: offer.id,
        seller: { id: seller.id, slug: seller.slug, displayName: seller.displayName, city: seller.city, rating: seller.rating, ratingCount: seller.ratingCount, tier: seller.tier },
        pricePaise: offer.pricePaise,
        mrpPaise: offer.mrpPaise,
        discountPercent: discountPercent(offer.pricePaise, offer.mrpPaise),
        inStock: offer.stock > 0,
        lowStock: offer.stock > 0 && offer.stock <= 10 ? offer.stock : null,
        fulfilledBy: offer.fulfilledBy,
        deliveryDays: offer.deliveryDays,
        codAvailable: offer.codAvailable,
        returnWindowDays: offer.returnWindowDays,
        isFeatured: offer.id === summary.featuredOfferId,
      })),
    };
  }

  async sellerProfile(slug: string) {
    const [s] = await this.db.select().from(sellers).where(and(eq(sellers.slug, slug), eq(sellers.status, "ACTIVE")));
    if (!s) throw notFound("Seller");
    const live = await this.db.execute<{ n: number }>(sql`select count(distinct product_id)::int as n from offers where seller_id = ${s.id} and status = 'ACTIVE'`);
    return {
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      city: s.city,
      state: s.state,
      rating: s.rating,
      ratingCount: s.ratingCount,
      tier: s.tier,
      joinedAt: s.joinedAt.toISOString(),
      liveProducts: Number(live.rows[0]?.n ?? 0),
    };
  }
}

function toSummary(r: Record<string, unknown>): ProductSummary {
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
    sellerCount: Number(r.seller_count),
    featuredOfferId: (r.offer_id as string) ?? null,
    featuredSellerId: (r.seller_id as string) ?? null,
  };
}
