import { z } from "zod";
import { pageQuery, paginated } from "../../common/http.js";
import { gstRateBpSchema, hsnSchema } from "./gst.js";

/** Lowercase words joined by hyphens, as used in storefront URLs. */
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(80);
const text = (max: number) => z.string().trim().max(max);

/** Product images are uploaded through POST /v1/admin/media, or are one of the bundled sample photos. */
export const imagePath = z.string().regex(/^\/(media\/[0-9a-f-]{36}|images\/products\/[\w.-]+\.(jpg|jpeg|png|webp))$/, "Upload the image first");

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

/** Product fields without defaults: the shape both creating and editing share. */
const productBase = z.object({
  title: text(200).min(3),
  slug: slug.optional().describe("Defaults to one made from the title"),
  sku: text(64).min(1),
  description: text(5000),
  highlights: z.array(text(200).min(1)).max(10),
  specs,
  variants,
  images: z.array(imagePath).min(1, "Add at least one image").max(8),
  categoryId: z.string().min(1),
  subcategory: text(60).min(1),
  brandId: z.string().min(1),
  gstRateBp: gstRateBpSchema.nullable().describe("Overrides the category's GST rate; null inherits it"),
  hsn: hsnSchema.nullable().describe("Overrides the category's HSN code; null inherits it"),
  tags: z.array(z.enum(PRODUCT_TAGS)).max(4),
  pricePaise: z.number().int().positive(),
  mrpPaise: z.number().int().positive(),
  stock: z.number().int().min(0).max(1_000_000),
  deliveryDays: z.number().int().min(1).max(30),
  codAvailable: z.boolean(),
  returnWindowDays: z.number().int().min(0).max(90),
  active: z.boolean(),
});

/** Creating a product: the optional details fall back to sensible defaults. */
const productFields = productBase.extend({
  description: productBase.shape.description.default(""),
  highlights: productBase.shape.highlights.default([]),
  specs: specs.default([]),
  variants: variants.default([]),
  tags: productBase.shape.tags.default([]),
  gstRateBp: productBase.shape.gstRateBp.default(null),
  hsn: productBase.shape.hsn.default(null),
  deliveryDays: productBase.shape.deliveryDays.default(3),
  codAvailable: productBase.shape.codAvailable.default(true),
  returnWindowDays: productBase.shape.returnWindowDays.default(7),
  active: productBase.shape.active.default(true),
});

const priceWithinMrp = (v: { pricePaise?: number; mrpPaise?: number }) => v.pricePaise === undefined || v.mrpPaise === undefined || v.pricePaise <= v.mrpPaise;
const priceMessage = { message: "The selling price cannot be more than the MRP", path: ["pricePaise"] };

export const productInput = productFields.refine(priceWithinMrp, priceMessage);
/**
 * Every field optional, built from the fields without defaults: a patch that
 * only changes the stock must leave the description, specs, variants and the
 * rest as they are. The id never changes; the slug can, and the old one then redirects.
 */
export const productPatch = productBase
  .extend({ slug: slug.min(3, "Use at least 3 characters").describe("Changing it keeps the old address working as a redirect") })
  .partial()
  .refine(priceWithinMrp, priceMessage);
export type ProductInput = z.infer<typeof productInput>;
export type ProductPatch = z.infer<typeof productPatch>;

export const adminProductQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional().describe("Category id"),
  status: z.enum(["active", "inactive", "archived", "all"]).default("all").describe("all leaves out archived products; inactive is switched off, not archived"),
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
  status: z.enum(["LIVE", "INACTIVE", "ARCHIVED"]),
  updatedAt: z.iso.datetime(),
});
export const adminProductList = paginated(adminProductRow);

/** What a product or category is taxed at when it sets nothing itself, and where that comes from. */
export const inheritedGstSchema = z.object({
  gstRateBp: z.number().int(),
  rateFrom: z.string().describe("The category it comes from, or the store default"),
  hsn: z.string().nullable(),
  hsnFrom: z.string().nullable(),
});

export const adminProduct = productFields.required().extend({
  inheritedGst: inheritedGstSchema,
  id: z.string(),
  status: z.enum(["LIVE", "INACTIVE", "ARCHIVED"]),
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
  gstRateBp: gstRateBpSchema.nullable().optional().describe("GST rate for the category's products; null inherits the store default"),
  hsn: hsnSchema.nullable().optional(),
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
  gstRateBp: z.number().int().nullable(),
  hsn: z.string().nullable(),
  inheritedGst: inheritedGstSchema.describe("What its products are taxed at when it sets nothing: the store default"),
  subcategories: z.array(z.object({ id: z.string(), name: z.string(), productCount: z.number().int() })),
  productCount: z.number().int(),
});

export const brandInput = z.object({ name: text(60).min(1), slug: slug.optional() });
export const brandPatch = brandInput.partial();
export const adminBrand = z.object({ id: z.string(), slug: z.string(), name: z.string(), productCount: z.number().int() });

export const mediaSchema = z.object({ id: z.uuid(), url: z.string(), mimeType: z.string(), sizeBytes: z.number().int() });

export const importQuery = z.object({
  dryRun: z.enum(["true", "false"]).default("false").transform((v) => v === "true").describe("Check the file and report what would change, without saving"),
});

export const importResult = z.object({
  dryRun: z.boolean(),
  /** each header in the file and what it was read as: a product field, images, a spec, a variant or ignored */
  columns: z.array(z.object({ name: z.string(), use: z.string() })),
  summary: z.object({
    rows: z.number().int(),
    created: z.number().int(),
    updated: z.number().int(),
    skipped: z.number().int(),
    newCategories: z.array(z.string()),
    newSubcategories: z.array(z.string()),
    newBrands: z.array(z.string()),
    imagesDownloaded: z.number().int(),
    imagesFailed: z.number().int(),
  }),
  rows: z.array(
    z.object({
      /** line in the file, counting the header as line 1 */
      line: z.number().int(),
      sku: z.string(),
      title: z.string(),
      action: z.enum(["create", "update", "skip"]),
      productId: z.string().nullable(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    }),
  ),
});

export const slugRedirect = z.object({ slug: z.string() });
