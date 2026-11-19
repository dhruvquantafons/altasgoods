import { z } from "zod";
import { storefrontImage } from "../commerce/promotions.schemas.js";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens, such as returns-and-refunds");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30");
const oneLine = (max: number) => z.string().trim().min(1).max(max);
const text = (max: number) => z.string().trim().max(max);
/** A storefront path, or a full https address. */
const href = z.string().trim().min(1).max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a storefront path such as /deals, or a full https:// address");

export const MAX_SECTIONS = 30;
export const MAX_BODY = 20_000;

/* --------------------------------- Pages --------------------------------- */

export const sectionInput = z.object({
  id: slug.optional().describe("Anchor of the section; made from the heading when left out"),
  heading: oneLine(120),
  body: z.string().max(MAX_BODY, `Keep each section under ${MAX_BODY} characters`).describe("Markdown. Raw HTML is not shown."),
});
const sections = z.array(sectionInput).max(MAX_SECTIONS, `At most ${MAX_SECTIONS} sections`);

export const pageInput = z.object({
  slug,
  kind: z.enum(["policy", "page"]).default("policy"),
  title: oneLine(140),
  nav: oneLine(60),
  summary: text(400).default(""),
  sections: sections.default([]),
  related: z.array(slug).max(10).default([]),
  published: z.boolean().default(true),
});
export const pagePatch = pageInput.omit({ slug: true, kind: true }).partial();

export const pageSchema = z.object({
  slug: z.string(),
  kind: z.enum(["policy", "page"]),
  title: z.string(),
  nav: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ id: z.string(), heading: z.string(), body: z.string() })),
  related: z.array(z.string()),
  published: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.string().nullable().describe("Name of whoever saved it last"),
});

export const slugOrder = z.object({ slugs: z.array(slug).min(1).max(100) });
export const idOrder = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200) });
export const uuidOrder = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

/* ---------------------------------- Help ---------------------------------- */

export const faqInput = z.object({ group: oneLine(60), q: oneLine(200), a: oneLine(5000).describe("Markdown") });
export const faqPatch = faqInput.partial();
export const faqSchema = faqInput.extend({ id: z.string(), sortOrder: z.number().int() });

export const topicInput = z.object({
  title: oneLine(80),
  body: text(200).default(""),
  icon: z.string().trim().regex(/^[A-Z][A-Za-z0-9]{1,30}$/, "A lucide icon name such as Package"),
  href,
});
export const topicPatch = topicInput.partial();
export const topicSchema = topicInput.extend({ id: z.string(), sortOrder: z.number().int() });

/* --------------------------------- Careers -------------------------------- */

const lines = z.array(oneLine(300)).max(20);
export const roleInput = z.object({
  slug,
  title: oneLine(140),
  team: oneLine(40),
  location: oneLine(80),
  type: z.enum(["Full time", "Contract"]).default("Full time"),
  experience: text(40).default(""),
  posted: day,
  summary: text(500).default(""),
  responsibilities: lines.default([]),
  requirements: lines.default([]),
  niceToHave: lines.default([]),
  published: z.boolean().default(true),
});
export const rolePatch = roleInput.omit({ slug: true }).partial();
export const roleSchema = roleInput.extend({ sortOrder: z.number().int() });

/* ---------------------------------- Press --------------------------------- */

export const pressInput = z.object({ slug, date: day, title: oneLine(200), summary: text(500).default(""), category: oneLine(30) });
export const pressPatch = pressInput.omit({ slug: true }).partial();
export const pressSchema = pressInput.extend({ sortOrder: z.number().int() });

/* ---------------------------------- About --------------------------------- */

export const aboutDoc = z.object({
  numbers: z.array(z.object({ value: oneLine(30), label: oneLine(80) })).max(8),
  principles: z.array(z.object({ title: oneLine(80), body: oneLine(400) })).max(8),
  milestones: z.array(z.object({ date: oneLine(30), title: oneLine(100), body: oneLine(400) })).max(12),
  offices: z.array(z.object({ city: oneLine(60), note: text(100).default(""), address: oneLine(300) })).max(12),
});
export const aboutSchema = aboutDoc.extend({ updatedAt: z.iso.datetime().nullable() });

/* -------------------------------- Spotlights ------------------------------- */

export const spotlightInput = z.object({
  brand: oneLine(60),
  tagline: text(120).default(""),
  productId: z.string().min(1).max(80).nullable().describe("A product of this brand; the spotlight links to its brand store"),
  tone: z.string().regex(/^#[0-9a-fA-F]{6}$/, "A colour such as #eef1f6").default("#f1efea"),
  image: storefrontImage,
  active: z.boolean().default(true),
});
export const spotlightPatch = spotlightInput.partial();
export const spotlightSchema = spotlightInput.extend({
  id: z.uuid(),
  sortOrder: z.number().int(),
  productTitle: z.string().nullable(),
  productStatus: z.enum(["LIVE", "INACTIVE", "ARCHIVED"]).nullable(),
  showing: z.boolean().describe("Active, and its product is on sale"),
});

/* ------------------------------- Storefront ------------------------------- */

export const storefrontPageCard = z.object({ slug: z.string(), title: z.string(), nav: z.string(), summary: z.string(), updatedAt: z.iso.datetime() });
export const storefrontPage = storefrontPageCard.extend({
  sections: z.array(z.object({ id: z.string(), heading: z.string(), body: z.string() })),
  related: z.array(storefrontPageCard),
});
export const storefrontHelp = z.object({
  topics: z.array(topicSchema.omit({ sortOrder: true })),
  faqs: z.array(faqSchema.omit({ sortOrder: true })),
});
export const storefrontRole = roleSchema.omit({ published: true, sortOrder: true });
export const storefrontPress = pressSchema.omit({ sortOrder: true });
export const storefrontSpotlight = z.object({ id: z.uuid(), brand: z.string(), tagline: z.string(), tone: z.string(), image: z.string(), brandSlug: z.string(), productSlug: z.string() });
