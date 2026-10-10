import "server-only";
import { cache } from "react";
import { STORE_ID } from "./api/format";
import type { paths } from "./api/schema";
import { apiUrl } from "./api/session";
import type { Brand, Category, Product } from "./types";

/**
 * The store's live catalog, as the storefront renders it. One API call
 * returns every product on sale with categories and brands; it is cached and
 * refreshed when AltasGoods Control saves a change (updateTag(CATALOG_TAG))
 * or after a minute, which picks up stock that orders use up.
 */

type Snapshot = paths["/v1/storefront/catalog"]["get"]["responses"][200]["content"]["application/json"];
type ApiProduct = Snapshot["products"][number];

export const CATALOG_TAG = "catalog";

export interface StoreCatalog {
  /** false when the API could not be reached; pages show an unavailable state instead of stale data */
  available: boolean;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  product(idOrSlug: string): Product | undefined;
  category(idOrSlug: string): Category | undefined;
  brand(idOrSlug: string): Brand | undefined;
  inCategory(slug: string): Product[];
}

const TAGS = new Set(["bestseller", "new", "deal", "limited"]);

function toProduct(p: ApiProduct, brand: Brand | undefined, category: Category | undefined): Product {
  const price = p.offer.pricePaise / 100;
  const mrp = p.offer.mrpPaise / 100;
  const images = p.images.length ? p.images : ["/images/products/placeholder.jpg"];
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    title: p.title,
    brandId: p.brandId,
    brandName: brand?.name ?? "",
    brandSlug: brand?.slug ?? "",
    categoryId: p.categoryId,
    categoryName: category?.name ?? "",
    categorySlug: category?.slug ?? "",
    subcategory: p.subcategory,
    image: images[0]!,
    gallery: images,
    price,
    mrp,
    rating: p.rating,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    highlights: p.highlights,
    description: p.description,
    specs: p.specs,
    variants: p.variants,
    offers: [
      {
        sellerId: STORE_ID,
        price,
        mrp,
        stock: p.offer.stock,
        fulfilledBy: "blubuy",
        deliveryDays: p.offer.deliveryDays,
        codAvailable: p.offer.codAvailable,
        returnWindowDays: p.offer.returnWindowDays,
      },
    ],
    featuredSellerId: STORE_ID,
    assured: p.assured,
    tags: p.tags.filter((t): t is Product["tags"][number] => TAGS.has(t)),
    stock: p.offer.stock,
    soldLast30d: p.soldLast30d,
    listingStatus: p.offer.stock > 0 ? "live" : "out_of_stock",
    createdAt: p.createdAt,
  };
}

function build(snapshot: Snapshot, available: boolean): StoreCatalog {
  const brands: Brand[] = snapshot.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, verified: true }));
  const categories: Category[] = snapshot.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon ?? "Package",
    image: c.image ?? undefined,
    commission: 0,
    children: c.children.map((x) => ({ id: x.id, slug: x.slug, name: x.name, parentId: c.id, icon: c.icon ?? "Package", commission: 0 })),
  }));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const products = snapshot.products.map((p) => toProduct(p, brandById.get(p.brandId), categoryById.get(p.categoryId)));
  // a category added in AltasGoods Control may have no image yet: use one of its products' photos
  for (const c of categories) c.image ??= products.find((p) => p.categoryId === c.id)?.image;
  return {
    available,
    products,
    categories,
    brands,
    product: (key) => products.find((p) => p.id === key || p.slug === key),
    category: (key) => categories.find((c) => c.id === key || c.slug === key),
    brand: (key) => brands.find((b) => b.id === key || b.slug === key),
    inCategory: (slug) => products.filter((p) => p.categorySlug === slug),
  };
}

/** The live catalog for this request (deduplicated per render, cached across requests by tag). */
export const getStoreCatalog = cache(async (): Promise<StoreCatalog> => {
  try {
    const r = await fetch(`${apiUrl()}/v1/storefront/catalog`, { next: { tags: [CATALOG_TAG], revalidate: 60 } });
    if (!r.ok) throw new Error(`catalog ${r.status}`);
    return build((await r.json()) as Snapshot, true);
  } catch {
    return build({ products: [], categories: [], brands: [] }, false);
  }
});
