import { z } from "zod";

/** An uploaded image (/media/...) or one shipped with the storefront (/images/...). */
export const storefrontImage = z.string().regex(/^\/(media\/[0-9a-f-]{36}|images\/[\w/.-]+\.(jpg|jpeg|png|webp))$/, "Upload the image first");

const endsAfterStart = (v: { startsAt?: string; endsAt?: string }) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);
const windowMessage = { message: "The end has to be after the start", path: ["endsAt"] };

/* --------------------------------- Sales --------------------------------- */

/** Sale fields without defaults: shared by creating and editing (a patch must not reset what it leaves out). */
const saleBase = z.object({
  name: z.string().trim().min(3).max(80).describe("For example Diwali Dhamaka"),
  headline: z.string().trim().max(140).describe("One line for the storefront banner"),
  description: z.string().trim().max(1000),
  discountPercent: z.number().int().min(1).max(90),
  scope: z.enum(["ALL", "CATEGORIES", "PRODUCTS"]),
  categoryIds: z.array(z.string().min(1)).max(50),
  productIds: z.array(z.string().min(1)).max(500),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  status: z.enum(["ACTIVE", "PAUSED"]),
  bannerImage: storefrontImage.nullable(),
});

const coversSomething = (v: { scope?: string; categoryIds?: string[]; productIds?: string[] }) =>
  v.scope === undefined || v.scope === "ALL" || (v.scope === "CATEGORIES" && (v.categoryIds?.length ?? 0) > 0) || (v.scope === "PRODUCTS" && (v.productIds?.length ?? 0) > 0);
const coversMessage = { message: "Pick at least one category or product for this sale", path: ["scope"] };

export const saleInput = saleBase
  .extend({
    headline: saleBase.shape.headline.default(""),
    description: saleBase.shape.description.default(""),
    categoryIds: saleBase.shape.categoryIds.default([]),
    productIds: saleBase.shape.productIds.default([]),
    status: saleBase.shape.status.default("ACTIVE"),
    bannerImage: saleBase.shape.bannerImage.default(null),
  })
  .refine(endsAfterStart, windowMessage)
  .refine(coversSomething, coversMessage);
export const salePatch = saleBase.partial().refine(endsAfterStart, windowMessage).refine(coversSomething, coversMessage);

export const saleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  headline: z.string(),
  description: z.string(),
  discountPercent: z.number().int(),
  scope: z.enum(["ALL", "CATEGORIES", "PRODUCTS"]),
  categoryIds: z.array(z.string()),
  productIds: z.array(z.string()),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: z.enum(["ACTIVE", "PAUSED"]),
  bannerImage: z.string().nullable(),
  state: z.enum(["LIVE", "SCHEDULED", "ENDED", "PAUSED"]).describe("Worked out from the status and the dates"),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/* -------------------------------- Coupons -------------------------------- */

/** Coupon fields without defaults; the code cannot change once created. */
const couponBase = z.object({
  description: z.string().trim().min(3).max(140),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().positive().describe("A percentage for PERCENT, paise for FLAT"),
  maxDiscountPaise: z.number().int().positive().nullable(),
  minOrderPaise: z.number().int().min(0),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  status: z.enum(["ACTIVE", "PAUSED"]),
  usageLimit: z.number().int().positive().nullable(),
  showOnStorefront: z.boolean(),
});

const percentInRange = (v: { type?: string; value?: number }) => v.type !== "PERCENT" || v.value === undefined || v.value <= 90;
const percentMessage = { message: "A percentage coupon can be at most 90% off", path: ["value"] };

export const couponInput = couponBase
  .extend({
    code: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only")
      .transform((v) => v.toUpperCase()),
    maxDiscountPaise: couponBase.shape.maxDiscountPaise.default(null),
    minOrderPaise: couponBase.shape.minOrderPaise.default(0),
    status: couponBase.shape.status.default("ACTIVE"),
    usageLimit: couponBase.shape.usageLimit.default(null),
    showOnStorefront: couponBase.shape.showOnStorefront.default(true),
  })
  .refine(endsAfterStart, windowMessage)
  .refine(percentInRange, percentMessage);
export const couponPatch = couponBase.partial().refine(endsAfterStart, windowMessage).refine(percentInRange, percentMessage);

export const couponSchema = z.object({
  code: z.string(),
  description: z.string(),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int(),
  maxDiscountPaise: z.number().int().nullable(),
  minOrderPaise: z.number().int(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: z.enum(["ACTIVE", "PAUSED"]),
  usageLimit: z.number().int().nullable(),
  usageCount: z.number().int(),
  showOnStorefront: z.boolean(),
  state: z.enum(["LIVE", "SCHEDULED", "ENDED", "PAUSED", "USED_UP"]),
});

/* ------------------------------- Storefront ------------------------------- */

export const liveSaleSchema = saleSchema.pick({ id: true, name: true, slug: true, headline: true, description: true, discountPercent: true, scope: true, categoryIds: true, productIds: true, startsAt: true, endsAt: true, bannerImage: true });
export const storefrontCouponSchema = couponSchema.pick({ code: true, description: true, type: true, value: true, maxDiscountPaise: true, minOrderPaise: true, endsAt: true });
