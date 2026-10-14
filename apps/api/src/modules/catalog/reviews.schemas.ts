import { z } from "zod";

export const reviewInput = z.object({
  productId: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3, "Give your review a short title").max(100),
  body: z.string().trim().max(3000).default(""),
});
export const reviewPatch = reviewInput.omit({ productId: true }).partial();

export const publicReview = z.object({
  id: z.uuid(),
  rating: z.number().int(),
  title: z.string(),
  body: z.string(),
  author: z.string().describe("First name and last initial"),
  verified: z.literal(true).describe("Every review comes from a delivered order"),
  reply: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const productReviewsQuery = z.object({
  sort: z.enum(["recent", "high", "low"]).default("recent"),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const productReviews = z.object({
  items: z.array(publicReview),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  breakdown: z.array(z.object({ stars: z.number().int(), count: z.number().int() })).describe("Published written reviews by star, 5 to 1"),
  canReview: z.boolean().describe("The signed-in customer has a delivered order for this product and has not reviewed it"),
});

const productRef = z.object({ id: z.string(), slug: z.string(), title: z.string(), image: z.string() });

export const myReview = z.object({
  id: z.uuid(),
  product: productRef,
  rating: z.number().int(),
  title: z.string(),
  body: z.string(),
  status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]),
  reply: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const reviewable = z.array(productRef.extend({ deliveredAt: z.iso.datetime() }));

export const adminReviewsQuery = z.object({
  status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  q: z.string().trim().max(80).optional().describe("Product, title or customer email"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminReview = myReview.extend({
  customer: z.object({ id: z.uuid(), name: z.string().nullable(), email: z.string() }),
  orderId: z.string().nullable(),
  adminNote: z.string().nullable(),
});

export const adminReviewList = z.object({
  items: z.array(adminReview),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  counts: z.object({ PENDING: z.number().int(), PUBLISHED: z.number().int(), HIDDEN: z.number().int() }),
});

export const moderateBody = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  reply: z.string().trim().max(1000).nullable().optional().describe("The store's public reply; null removes it"),
  adminNote: z.string().trim().max(500).nullable().optional(),
});
