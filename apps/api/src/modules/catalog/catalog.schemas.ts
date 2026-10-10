import { z } from "zod";
import { pageQuery, paginated } from "../../common/http.js";

export const SORTS = ["relevance", "popular", "price_asc", "price_desc", "newest", "discount", "rating"] as const;

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));
const boolish = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

export const productQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional().describe("Category slug"),
  subcategory: z.string().optional().describe("Subcategory name, e.g. Headphones"),
  brand: csv.describe("Comma separated brand slugs"),
  ids: csv.describe("Comma separated product ids or slugs"),
  minPrice: z.coerce.number().int().min(0).optional().describe("Paise"),
  maxPrice: z.coerce.number().int().min(0).optional().describe("Paise"),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minDiscount: z.coerce.number().int().min(0).max(90).optional().describe("Percent"),
  assured: boolish,
  inStock: boolish,
  tag: z.enum(["bestseller", "new", "deal", "limited"]).optional(),
  sort: z.enum(SORTS).default("relevance"),
  ...pageQuery,
});
export type ProductQuery = z.infer<typeof productQuery>;

const brandRef = z.object({ id: z.string(), slug: z.string(), name: z.string() });
const categoryRef = z.object({ id: z.string(), slug: z.string(), name: z.string() });

export const productSummary = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  brand: brandRef,
  category: categoryRef,
  subcategory: z.string(),
  image: z.string(),
  pricePaise: z.number().int(),
  mrpPaise: z.number().int(),
  discountPercent: z.number().int(),
  rating: z.number(),
  ratingCount: z.number().int(),
  assured: z.boolean(),
  tags: z.array(z.string()),
  inStock: z.boolean(),
  deliveryDays: z.number().int(),
  /** the store's offer: what carts and orders reference */
  offerId: z.uuid(),
});
export type ProductSummary = z.infer<typeof productSummary>;

export const productList = paginated(productSummary).extend({
  facets: z.object({
    brands: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
    categories: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
    price: z.object({ minPaise: z.number().int(), maxPaise: z.number().int() }),
  }),
});

export const productDetail = productSummary.extend({
  images: z.array(z.string()),
  description: z.string(),
  highlights: z.array(z.string()),
  specs: z.array(z.object({ group: z.string(), items: z.array(z.object({ label: z.string(), value: z.string() })) })),
  variants: z.array(z.object({ name: z.string(), values: z.array(z.object({ label: z.string(), swatch: z.string().optional(), available: z.boolean() })) })),
  reviewCount: z.number().int(),
  soldLast30d: z.number().int(),
  lowStock: z.number().int().nullable().describe("Units left when 10 or fewer, otherwise null"),
  codAvailable: z.boolean(),
  returnWindowDays: z.number().int(),
});

export const categoryNode = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  image: z.string().nullable(),
  productCount: z.number().int(),
  children: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
});

/* ------------------------- Storefront snapshot ------------------------- */

const specsSchema = z.array(z.object({ group: z.string(), items: z.array(z.object({ label: z.string(), value: z.string() })) }));
const variantsSchema = z.array(z.object({ name: z.string(), values: z.array(z.object({ label: z.string(), swatch: z.string().optional(), available: z.boolean() })) }));

export const storefrontProduct = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string(),
  title: z.string(),
  brandId: z.string(),
  categoryId: z.string(),
  subcategory: z.string(),
  images: z.array(z.string()),
  description: z.string(),
  highlights: z.array(z.string()),
  specs: specsSchema,
  variants: variantsSchema,
  rating: z.number(),
  ratingCount: z.number().int(),
  reviewCount: z.number().int(),
  assured: z.boolean(),
  tags: z.array(z.string()),
  soldLast30d: z.number().int(),
  createdAt: z.iso.datetime(),
  offer: z.object({
    id: z.uuid(),
    pricePaise: z.number().int(),
    mrpPaise: z.number().int(),
    stock: z.number().int().describe("Units available to order, capped at 10"),
    deliveryDays: z.number().int(),
    codAvailable: z.boolean(),
    returnWindowDays: z.number().int(),
  }),
});

export const storefrontCatalog = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      icon: z.string().nullable(),
      image: z.string().nullable(),
      children: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
    }),
  ),
  brands: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
  products: z.array(storefrontProduct),
});
