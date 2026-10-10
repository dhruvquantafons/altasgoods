import { z } from "zod";
import { pageQuery, paginated } from "../../common/http.js";

/** Lowercase words joined by hyphens, as used in storefront URLs. */
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(80);
const text = (max: number) => z.string().trim().max(max);

/** Product images are uploaded through POST /v1/admin/media, or are one of the bundled sample photos. */
const imagePath = z.string().regex(/^\/(media\/[0-9a-f-]{36}|images\/products\/[\w.-]+\.(jpg|jpeg|png|webp))$/, "Upload the image first");

const specs = z
  .array(z.object({ group: text(60).min(1), items: z.array(z.object({ label: text(60).min(1), value: text(200).min(1) })).min(1).max(30) }))
  .max(12);
const variants = z
  .array(
    z.object({
      name: text(40).min(1),
      values: z.array(z.object({ label: text(40).min(1), swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), available: z.boolean().default(true) })).min(1).max(20),
    }),
  )
  .max(3);

export const PRODUCT_TAGS = ["bestseller", "new", "deal", "limited"] as const;

const productFields = z.object({
  title: text(200).min(3),
  slug: slug.optional().describe("Defaults to one made from the title"),
  sku: text(64).min(1),
  description: text(5000).default(""),
  highlights: z.array(text(200).min(1)).max(10).default([]),
  specs: specs.default([]),
  variants: variants.default([]),
  images: z.array(imagePath).min(1, "Add at least one image").max(8),
  categoryId: z.string().min(1),
  subcategory: text(60).min(1),
  brandId: z.string().min(1),
  tags: z.array(z.enum(PRODUCT_TAGS)).max(4).default([]),
  pricePaise: z.number().int().positive(),
  mrpPaise: z.number().int().positive(),
  stock: z.number().int().min(0).max(1_000_000),
  deliveryDays: z.number().int().min(1).max(30).default(3),
  codAvailable: z.boolean().default(true),
  returnWindowDays: z.number().int().min(0).max(90).default(7),
  active: z.boolean().default(true),
});

const priceWithinMrp = (v: { pricePaise?: number; mrpPaise?: number }) => v.pricePaise === undefined || v.mrpPaise === undefined || v.pricePaise <= v.mrpPaise;
const priceMessage = { message: "The selling price cannot be more than the MRP", path: ["pricePaise"] };

export const productInput = productFields.refine(priceWithinMrp, priceMessage);
/** Every field optional; the slug and id never change after creation. */
export const productPatch = productFields.omit({ slug: true }).partial().refine(priceWithinMrp, priceMessage);
export type ProductInput = z.infer<typeof productInput>;
export type ProductPatch = z.infer<typeof productPatch>;

export const adminProductQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional().describe("Category id"),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  stock: z.enum(["out", "low", "all"]).default("all").describe("low is 10 or fewer"),
  ...pageQuery,
});

const ref = z.object({ id: z.string(), name: z.string() });

export const adminProductRow = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string(),
  title: z.string(),
  image: z.string(),
  brand: ref,
  category: ref,
  subcategory: z.string(),
  pricePaise: z.number().int(),
  mrpPaise: z.number().int(),
  stock: z.number().int(),
  active: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export const adminProductList = paginated(adminProductRow);

export const adminProduct = productFields.required().extend({
  id: z.string(),
  slug: z.string(),
  rating: z.number(),
  ratingCount: z.number().int(),
  soldLast30d: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const categoryInput = z.object({
  name: text(60).min(2),
  slug: slug.optional().describe("Defaults to one made from the name"),
  icon: text(40).nullable().optional().describe("Lucide icon name for menus"),
  image: imagePath.nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  /** subcategory names; products pick one of these */
  subcategories: z.array(text(60).min(1)).max(40).optional(),
});
export const categoryPatch = categoryInput.partial();

export const adminCategory = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  image: z.string().nullable(),
  sortOrder: z.number().int(),
  subcategories: z.array(z.object({ id: z.string(), name: z.string(), productCount: z.number().int() })),
  productCount: z.number().int(),
});

export const brandInput = z.object({ name: text(60).min(1), slug: slug.optional() });
export const brandPatch = brandInput.partial();
export const adminBrand = z.object({ id: z.string(), slug: z.string(), name: z.string(), productCount: z.number().int() });

export const mediaSchema = z.object({ id: z.uuid(), url: z.string(), mimeType: z.string(), sizeBytes: z.number().int() });
