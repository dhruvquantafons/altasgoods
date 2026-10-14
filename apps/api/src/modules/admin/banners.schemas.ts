import { z } from "zod";
import { storefrontImage } from "../commerce/promotions.schemas.js";

/** Where a banner links: a storefront path, or a full https address. */
const link = z.string().trim().min(1).max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a storefront path such as /deals, or a full https:// address");

const bannerBase = z.object({
  placement: z.enum(["HERO", "PROMO"]),
  eyebrow: z.string().trim().max(60),
  title: z.string().trim().min(2).max(90),
  body: z.string().trim().max(200),
  ctaLabel: z.string().trim().max(30).describe("The button on a hero slide"),
  href: link,
  image: storefrontImage,
  alt: z.string().trim().max(160).describe("Describes the image for screen readers"),
  align: z.enum(["left", "right"]),
  theme: z.enum(["dark", "light"]).describe("Light text on a dark image, or dark text on a light one"),
  position: z.string().trim().max(40).regex(/^[a-z0-9%. -]*$/i, "For example center, left center or 70% center"),
  active: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
});

const window = (v: { startsAt?: string | null; endsAt?: string | null }) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);
const windowMessage = { message: "The end has to be after the start", path: ["endsAt"] };

export const bannerInput = bannerBase
  .extend({
    eyebrow: bannerBase.shape.eyebrow.default(""),
    body: bannerBase.shape.body.default(""),
    ctaLabel: bannerBase.shape.ctaLabel.default(""),
    alt: bannerBase.shape.alt.default(""),
    align: bannerBase.shape.align.default("left"),
    theme: bannerBase.shape.theme.default("dark"),
    position: bannerBase.shape.position.default("center"),
    active: bannerBase.shape.active.default(true),
    startsAt: bannerBase.shape.startsAt.default(null),
    endsAt: bannerBase.shape.endsAt.default(null),
  })
  .refine(window, windowMessage);
export const bannerPatch = bannerBase.omit({ placement: true }).partial().refine(window, windowMessage);

export const bannerSchema = bannerBase.extend({
  id: z.uuid(),
  sortOrder: z.number().int(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  showing: z.boolean().describe("Active and inside its schedule right now"),
  updatedAt: z.iso.datetime(),
});

export const reorderBody = z.object({ placement: z.enum(["HERO", "PROMO"]), ids: z.array(z.uuid()).min(1).max(50) });

const publicBanner = bannerSchema.pick({ id: true, eyebrow: true, title: true, body: true, ctaLabel: true, href: true, image: true, alt: true, align: true, theme: true, position: true });
export const storefrontBanners = z.object({ hero: z.array(publicBanner), promo: z.array(publicBanner) });
