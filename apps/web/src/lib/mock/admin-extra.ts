/**
 * Extra mock data for BluBuy Control (the admin console). Everything here is
 * deterministic and anchored to NOW so server and client renders agree.
 * Derived from the shared mock files; it never mutates them.
 */
import type { Order, Seller } from "../types";
import type { NdrReason, OrderStatus, PaymentMethod, RefundStatus, SettlementStatus, ShipmentStatus } from "../status";
import { between, istHour, istMinuteOfDay, NOW, pick, seeded } from "../utils";
import { platformDaily, SALE_EVENT } from "./analytics";
import { brands, categories, products } from "./catalog";
import { allSettlements } from "./finance";
import { hubs, shipments } from "./logistics";
import { orders, refunds, returns } from "./orders";
import { customers, sellers, staff } from "./people";
import { reviews } from "./engagement";

/* ------------------------------- Helpers ------------------------------ */

const MIN = 60_000;
const ago = (mins: number) => new Date(NOW.getTime() - mins * MIN).toISOString();
const ahead = (mins: number) => new Date(NOW.getTime() + mins * MIN).toISOString();
const H = 60;
const D = 1440;

export function hashOf(s: string) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BSIN_CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** BSIN: "B0" + 8 alphanumerics, stable per key. */
export function bsinFor(key: string) {
  const r = seeded(hashOf(key));
  return `B0${Array.from({ length: 8 }, () => BSIN_CHARS[Math.floor(r() * BSIN_CHARS.length)]).join("")}`;
}

const productByKey = (k: string) => products.find((p) => p.slug === k)!;
const sellerById = (id: string) => sellers.find((s) => s.id === id);

/** Masks a phone for default display: "+91 98XXXXXX21" (PII reveal is audited). */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${digits.slice(0, 2)}XXXXXX${digits.slice(-2)}`;
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 3))}${user.slice(-1)}@${domain}`;
}

/* ------------------------------ Overview ------------------------------ */

const hourShape = [0.9, 0.55, 0.35, 0.25, 0.22, 0.3, 0.6, 1.2, 2, 2.8, 3.4, 3.9, 4.3, 4.1, 3.8, 3.7, 3.9, 4.4, 5, 5.8, 6.6, 7.4, 6.2, 3.6];
export function hourLabel(h: number) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${h < 12 ? "am" : "pm"}`;
}

/** Orders by hour for yesterday (a complete day), shaped by the evening sale peak. */
export const hourlyOrdersYesterday = (() => {
  const y = platformDaily.at(-2)!;
  const total = hourShape.reduce((a, s) => a + s, 0);
  return hourShape.map((s, h) => ({ hour: h, label: hourLabel(h), orders: Math.round((y.orders * s) / total) }));
})();

/** Orders per minute right now (today so far divided by elapsed minutes). */
export const ordersPerMinute = Math.round(platformDaily.at(-1)!.orders / istMinuteOfDay(NOW));

export const CATALOG_QUEUE_TOTAL = 212;

/* ---------------------------- Category meta --------------------------- */

export type AttributeType = "text" | "number" | "enum" | "multi_enum" | "boolean" | "unit_value";
export interface AttributeDef {
  code: string;
  label: string;
  type: AttributeType;
  mandatory: boolean;
  variant?: boolean;
  filterable?: boolean;
}

/** Legal Metrology declarations: mandatory for every physical product. */
export const LEGAL_ATTRIBUTES: AttributeDef[] = [
  { code: "mrp", label: "M.R.P. (inclusive of all taxes)", type: "number", mandatory: true },
  { code: "net_quantity", label: "Net quantity", type: "unit_value", mandatory: true },
  { code: "manufacturer_name_address", label: "Manufacturer name and address", type: "text", mandatory: true },
  { code: "country_of_origin", label: "Country of origin", type: "enum", mandatory: true, filterable: true },
  { code: "consumer_care_details", label: "Consumer care details", type: "text", mandatory: true },
  { code: "generic_name", label: "Generic name", type: "text", mandatory: true },
];

export interface CategoryMeta {
  categoryId: string;
  returnWindow: string;
  returnDays: number;
  resolution: string;
  gated: boolean;
  gateRequirement?: string;
  hsn: string;
  gstRate: number;
  gstLabel: string;
  commissionRange: string;
  variationTheme: string;
  liveListings: number;
  pendingApprovals: number;
  attributes: AttributeDef[];
}

const a = (code: string, label: string, type: AttributeType, mandatory = false, extra: Partial<AttributeDef> = {}): AttributeDef => ({ code, label, type, mandatory, ...extra });

export const categoryMeta: CategoryMeta[] = [
  {
    categoryId: "cat-mobiles", returnWindow: "7 days", returnDays: 7, resolution: "Replacement only", gated: true,
    gateRequirement: "Brand authorisation letter for listed brands; IMEI capture at dispatch", hsn: "8517", gstRate: 18, gstLabel: "18%",
    commissionRange: "3% to 5%", variationTheme: "Storage and colour", liveListings: 18420, pendingApprovals: 6,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("model_name", "Model name", "text", true), a("colour", "Colour", "enum", true, { variant: true, filterable: true }), a("storage", "Internal storage", "unit_value", true, { variant: true, filterable: true }), a("ram", "RAM", "unit_value", true, { filterable: true }), a("display_size", "Display size", "unit_value", true), a("battery", "Battery capacity", "unit_value", true), a("network", "Network type", "enum", true, { filterable: true }), a("imei_required", "IMEI captured at dispatch", "boolean", true)],
  },
  {
    categoryId: "cat-electronics", returnWindow: "7 days", returnDays: 7, resolution: "Replacement only", gated: false, hsn: "8471, 8518", gstRate: 18, gstLabel: "18%",
    commissionRange: "4% to 12%", variationTheme: "Colour", liveListings: 46210, pendingApprovals: 9,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("model_name", "Model name", "text", true), a("colour", "Colour", "enum", false, { variant: true, filterable: true }), a("connectivity", "Connectivity", "multi_enum", true, { filterable: true }), a("warranty", "Warranty", "unit_value", true), a("battery_life", "Battery life", "unit_value"), a("bis_registration", "BIS registration number", "text", true)],
  },
  {
    categoryId: "cat-fashion", returnWindow: "10 days", returnDays: 10, resolution: "Refund, replacement or exchange", gated: false, hsn: "6109, 6403", gstRate: 5, gstLabel: "5% up to ₹2,500, 18% above",
    commissionRange: "0% to 13%", variationTheme: "Size and colour", liveListings: 128640, pendingApprovals: 14,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("size", "Size", "enum", true, { variant: true, filterable: true }), a("colour", "Colour", "enum", true, { variant: true, filterable: true }), a("fabric", "Fabric", "enum", true, { filterable: true }), a("fit", "Fit", "enum", false, { filterable: true }), a("pattern", "Pattern", "enum"), a("occasion", "Occasion", "multi_enum", false, { filterable: true }), a("care", "Care instructions", "text")],
  },
  {
    categoryId: "cat-home", returnWindow: "7 days (furniture 10 days)", returnDays: 7, resolution: "Refund or replacement", gated: false, hsn: "9403, 7323", gstRate: 18, gstLabel: "18%",
    commissionRange: "8% to 13%", variationTheme: "Colour and material", liveListings: 61380, pendingApprovals: 8,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("material", "Primary material", "enum", true, { filterable: true }), a("colour", "Colour", "enum", false, { variant: true, filterable: true }), a("dimensions", "Dimensions (L x W x H)", "unit_value", true), a("weight", "Item weight", "unit_value", true), a("assembly", "Assembly required", "boolean", true), a("pieces", "Number of pieces", "number")],
  },
  {
    categoryId: "cat-appliances", returnWindow: "10 days", returnDays: 10, resolution: "Replacement after technician visit", gated: false, hsn: "8516, 8418", gstRate: 18, gstLabel: "18%",
    commissionRange: "4% to 10%", variationTheme: "Capacity", liveListings: 21970, pendingApprovals: 3,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("model_name", "Model name", "text", true), a("wattage", "Power consumption", "unit_value", true), a("capacity", "Capacity", "unit_value", true, { variant: true, filterable: true }), a("energy_rating", "BEE star rating", "enum", false, { filterable: true }), a("warranty", "Warranty", "unit_value", true), a("installation", "Installation included", "boolean")],
  },
  {
    categoryId: "cat-beauty", returnWindow: "7 days", returnDays: 7, resolution: "Refund if sealed, replacement if damaged", gated: true,
    gateRequirement: "Cosmetics manufacturing or import licence (CDSCO) for listed brands", hsn: "3304", gstRate: 18, gstLabel: "18%",
    commissionRange: "8% to 12%", variationTheme: "Shade and volume", liveListings: 33910, pendingApprovals: 5,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("skin_type", "Skin type", "multi_enum", true, { filterable: true }), a("volume", "Volume or weight", "unit_value", true, { variant: true }), a("shade", "Shade", "enum", false, { variant: true }), a("expiry", "Expiry date", "text", true), a("ingredients", "Key ingredients", "text", true)],
  },
  {
    categoryId: "cat-grocery", returnWindow: "2 days", returnDays: 2, resolution: "Refund for damaged, expired or wrong items", gated: true,
    gateRequirement: "Valid FSSAI licence; expiry at least 60% of shelf life at dispatch", hsn: "0901, 0802", gstRate: 5, gstLabel: "5%",
    commissionRange: "4% to 7%", variationTheme: "Weight", liveListings: 15240, pendingApprovals: 4,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("net_weight", "Net weight", "unit_value", true, { variant: true }), a("fssai_licence", "FSSAI licence number", "text", true), a("food_type", "Vegetarian or non-vegetarian mark", "enum", true, { filterable: true }), a("shelf_life", "Shelf life", "unit_value", true), a("allergens", "Allergen information", "text")],
  },
  {
    categoryId: "cat-books", returnWindow: "7 days", returnDays: 7, resolution: "Replacement only", gated: false, hsn: "4901", gstRate: 0, gstLabel: "Nil (exempt)",
    commissionRange: "6% to 10%", variationTheme: "Format", liveListings: 82110, pendingApprovals: 2,
    attributes: [a("author", "Author", "text", true, { filterable: true }), a("publisher", "Publisher", "enum", true, { filterable: true }), a("isbn", "ISBN-13", "text", true), a("language", "Language", "enum", true, { filterable: true }), a("binding", "Binding", "enum", true, { variant: true }), a("pages", "Number of pages", "number")],
  },
  {
    categoryId: "cat-sports", returnWindow: "7 days", returnDays: 7, resolution: "Replacement only", gated: false, hsn: "9506", gstRate: 5, gstLabel: "5%",
    commissionRange: "8% to 11%", variationTheme: "Size and weight", liveListings: 19880, pendingApprovals: 3,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("sport", "Sport", "enum", true, { filterable: true }), a("material", "Material", "enum", true), a("size", "Size", "enum", false, { variant: true }), a("weight", "Weight", "unit_value", false, { variant: true })],
  },
  {
    categoryId: "cat-toys", returnWindow: "7 days", returnDays: 7, resolution: "Replacement only", gated: true,
    gateRequirement: "BIS certificate under the Toys Quality Control Order", hsn: "9503", gstRate: 5, gstLabel: "5%",
    commissionRange: "8% to 11%", variationTheme: "Age group", liveListings: 12730, pendingApprovals: 4,
    attributes: [a("brand", "Brand", "enum", true, { filterable: true }), a("age_group", "Age group", "enum", true, { filterable: true }), a("material", "Material", "enum", true), a("bis_licence", "BIS licence number (CM/L)", "text", true), a("battery_operated", "Battery operated", "boolean")],
  },
];

export function getCategoryMeta(categoryId: string) {
  return categoryMeta.find((m) => m.categoryId === categoryId);
}

/* ------------------------- Catalog moderation ------------------------- */

export type ModerationType = "new_listing" | "edit" | "gated_brand" | "appeal";
export type CheckResult = "pass" | "warn" | "fail";
export type RiskLevel = "low" | "medium" | "high";

export interface QcCheck {
  key: string;
  label: string;
  result: CheckResult;
  detail: string;
}

export interface ModerationItem {
  id: string;
  bsin: string;
  productId: string;
  title: string;
  image: string;
  gallery: string[];
  brand: string;
  categoryId: string;
  subcategory: string;
  sellerId: string;
  sellerName: string;
  type: ModerationType;
  price: number;
  mrp: number;
  submittedAt: string;
  slaDueAt: string;
  risk: RiskLevel;
  autoScore: number;
  attributes: { label: string; value: string; missing?: boolean }[];
  checks: QcCheck[];
  flags: string[];
  duplicate?: { bsin: string; title: string; image: string; similarity: number; sellerName: string };
  changes?: { field: string; from: string; to: string }[];
}

const checkCopy: Record<string, { label: string; pass: string; warn: string; fail: string }> = {
  image: { label: "Image quality", pass: "Main image 2000 x 2000 px on a white background", warn: "Main image background is off-white (RGB 244, 242, 238)", fail: "Main image is 640 x 640 px; minimum is 1000 px on the long side" },
  watermark: { label: "Text and watermarks", pass: "No text, logos or watermarks detected on images", warn: "Small badge text on image 3", fail: "Watermark with a phone number detected on 2 images" },
  title: { label: "Title rules", pass: "Brand, model and key attribute present; 96 characters", warn: "Title is 214 characters; the limit is 200", fail: "Promotional text in title: \"best price, 100% original\"" },
  prohibited: { label: "Restricted terms", pass: "No restricted, prohibited or misleading claims", warn: "Unverified claim \"clinically proven\" needs evidence", fail: "Counterfeit signal: \"first copy\" in description" },
  mrp: { label: "M.R.P. sanity", pass: "M.R.P. within 1.2x of the 30 day median for this model", warn: "M.R.P. is 1.6x the 30 day median for this model", fail: "M.R.P. raised 38% within 7 days of a sale event" },
  legal: { label: "Legal Metrology declarations", pass: "All mandatory declarations present", warn: "Consumer care email only; phone number recommended", fail: "Missing manufacturer address and consumer care details" },
  duplicate: { label: "Duplicate BSIN detection", pass: "No close match in the catalog", warn: "86% similar to an existing BSIN; review before creating", fail: "97% match with an existing BSIN; offer should join it" },
  brand: { label: "Brand authorisation", pass: "Seller holds a valid authorisation for this brand", warn: "Authorisation letter expires in 21 days", fail: "No authorisation on file from the brand owner" },
};

type ModSeed = {
  key: string;
  seller: string;
  type: ModerationType;
  title: string;
  fails?: string[];
  warns?: string[];
  flags?: string[];
  dupOf?: string;
  ageMins: number;
  priceAdj?: number;
  changes?: { field: string; from: string; to: string }[];
};

const modSeeds: ModSeed[] = [
  { key: "headphones-studio", seller: "s-ganesh", type: "new_listing", title: "Auralis Studio ANC Headphones First Copy, Premium Quality", fails: ["prohibited", "duplicate"], flags: ["Counterfeit signal: \"first copy\"", "Price 61% below the brand's lowest live offer"], dupOf: "headphones-studio", ageMins: 52 * H, priceAdj: 0.39 },
  { key: "phone-nova", seller: "s-urbankart", type: "gated_brand", title: "Novatek Nova Lite 5G (Midnight Blue, 128 GB) 8 GB RAM", fails: ["brand"], ageMins: 47 * H },
  { key: "tee-classic", seller: "s-loomhouse", type: "new_listing", title: "Linen & Loom Men's Supima Cotton Polo T-Shirt, Navy", ageMins: 44 * H },
  { key: "serum-glow", seller: "s-glow", type: "edit", title: "Veda Naturals 10% Niacinamide Glow Serum with Zinc, 30 ml", warns: ["image"], ageMins: 41 * H, changes: [{ field: "Title", from: "Veda Naturals 10% Niacinamide Glow Serum, 30 ml", to: "Veda Naturals 10% Niacinamide Glow Serum with Zinc, 30 ml" }, { field: "Main image", from: "Bottle on white", to: "Bottle with model, off-white background" }] },
  { key: "sofa-oslo", seller: "s-terra", type: "new_listing", title: "Oaken Oslo 2 Seater Fabric Sofa, Sage Green", ageMins: 39 * H },
  { key: "airfryer-crisp", seller: "s-ganesh", type: "new_listing", title: "Voltix Crisp 18 L Oven Toaster Grill with Rotisserie", warns: ["mrp"], ageMins: 37 * H, priceAdj: 1.3 },
  { key: "watch-smart", seller: "s-urbankart", type: "new_listing", title: "Orbit Watch S3 Pro AMOLED Smartwatch, Bluetooth Calling, GPS, SpO2, Heart Rate, Sleep Tracking, 100+ Sports Modes, Always On Display", fails: ["legal"], warns: ["title"], ageMins: 35 * H },
  { key: "almonds-premium", seller: "s-greenleaf", type: "new_listing", title: "Harvest Basket Premium Cashews W320, 500 g", ageMins: 33 * H },
  { key: "perfume-noir", seller: "s-glow", type: "new_listing", title: "Noir Atelier Santal Nuit Eau de Parfum, 100 ml", fails: ["mrp"], flags: ["M.R.P. raised from ₹4,500 to ₹6,200 on 22 Sep"], ageMins: 30 * H, priceAdj: 1.1 },
  { key: "sneakers-white", seller: "s-profit", type: "new_listing", title: "Stride Court Classic Leather Sneakers Best Price 100% Original", fails: ["duplicate", "watermark", "title"], flags: ["Seller account on payout hold", "Phone number visible on image 2"], dupOf: "sneakers-white", ageMins: 28 * H },
  { key: "lamp-arc", seller: "s-kiln", type: "new_listing", title: "Terra Home Arc Floor Lamp with Linen Shade, 160 cm", ageMins: 26 * H, priceAdj: 1.9 },
  { key: "laptop-air", seller: "s-apex", type: "edit", title: "Kestrel Air 14 Thin and Light Laptop (Core Ultra 7, 16 GB, 1 TB SSD, Windows 11)", ageMins: 24 * H, changes: [{ field: "Title", from: "Kestrel Air 14 Thin and Light Laptop (Core Ultra 7, 16 GB, 1 TB SSD)", to: "Kestrel Air 14 Thin and Light Laptop (Core Ultra 7, 16 GB, 1 TB SSD, Windows 11)" }, { field: "Images", from: "4 images", to: "7 images" }] },
  { key: "kurta-ethnic", seller: "s-loomhouse", type: "new_listing", title: "Rangrez Women's Hand Block Print Anarkali Kurta, Indigo", warns: ["image"], ageMins: 22 * H },
  { key: "yoga-mat", seller: "s-profit", type: "edit", title: "Asana Pro 6 mm Non-Slip Yoga Mat with Carry Strap and Alignment Lines for Home Gym Workout Pilates Stretching Exercise Fitness Men Women", warns: ["title"], ageMins: 20 * H, changes: [{ field: "Title", from: "Asana Pro 6 mm Non-Slip Yoga Mat with Carry Strap", to: "Asana Pro 6 mm Non-Slip Yoga Mat with Carry Strap and Alignment Lines for Home Gym..." }] },
  { key: "teddy-bear", seller: "s-tinytots", type: "new_listing", title: "Cuddle Co Musical Plush Elephant with Lullabies, 30 cm", fails: ["legal"], flags: ["BIS licence number missing for a battery operated toy"], ageMins: 18 * H },
  { key: "coffee-beans", seller: "s-greenleaf", type: "new_listing", title: "Estate Roasters Coorg Dark Roast Coffee Beans, 250 g", ageMins: 15 * H, priceAdj: 0.55 },
  { key: "earbuds-pods", seller: "s-apex", type: "new_listing", title: "Auralis Pods Pro 2 True Wireless Earbuds with Adaptive ANC", warns: ["duplicate"], dupOf: "earbuds-pods", ageMins: 12 * H, priceAdj: 1.2 },
  { key: "book-novel", seller: "s-pageturn", type: "new_listing", title: "Salt and Saffron: Stories from the Deccan (Paperback)", ageMins: 10 * H, priceAdj: 0.8 },
  { key: "dumbbells-hex", seller: "s-profit", type: "appeal", title: "Kinetic Rubber Coated Hex Dumbbells, 2 x 7.5 kg", ageMins: 8 * H, priceAdj: 1.3, changes: [{ field: "Block reason", from: "Weight mismatch reported by 6 customers", to: "Seller uploaded weighing scale photos and test certificate" }] },
  { key: "cream-hydra", seller: "s-greenleaf", type: "gated_brand", title: "Dermalab Hydra Ceramide Night Repair Cream, 50 g", fails: ["brand"], warns: ["prohibited"], ageMins: 6 * H },
  { key: "backpack-urban", seller: "s-urbankart", type: "edit", title: "Northbound Urban 30 L Laptop Backpack, Water Resistant, Charcoal", ageMins: 5 * H, changes: [{ field: "Variant", from: "25 L", to: "30 L (new size variant)" }] },
  { key: "monitor-ultra", seller: "s-urbankart", type: "new_listing", title: "Lumora 32 inch 4K IPS Monitor, 144 Hz, USB-C 90 W", ageMins: 4 * H, priceAdj: 1.25 },
  { key: "vase-ceramic", seller: "s-kiln", type: "new_listing", title: "Kiln & Co Speckled Stoneware Planter, Set of 3", ageMins: 2.5 * H },
  { key: "speaker-boom", seller: "s-ganesh", type: "new_listing", title: "Pulse Boom 2 Max Portable Bluetooth Speaker, Military Grade", fails: ["watermark"], warns: ["prohibited"], flags: ["Unverified claim: \"military grade\"", "Seller website URL on image 4"], ageMins: 75 },
];

function attrValues(p: (typeof products)[number], missingLegal: boolean) {
  const meta = getCategoryMeta(p.categoryId)!;
  const brand = brands.find((b) => b.id === p.brandId)?.name ?? "";
  const sample: Record<string, string> = {
    brand, model_name: p.title.split(/[,(]/)[0]!.replace(brand, "").trim(), colour: p.variants.find((v) => v.name === "Colour")?.values[0]?.label ?? "Natural",
    storage: "128 GB", ram: "8 GB", display_size: "6.7 inch", battery: "5000 mAh", network: "5G", imei_required: "Yes", connectivity: "Bluetooth 5.4, USB-C",
    warranty: "1 year", battery_life: "40 hours", bis_registration: "R-41027719", size: "M", fabric: "Cotton", fit: "Regular", pattern: "Solid", occasion: "Casual", care: "Machine wash",
    material: "Solid wood", dimensions: "180 x 85 x 80 cm", weight: "1.2 kg", assembly: "Yes", pieces: "1", wattage: "1500 W", capacity: "18 L", energy_rating: "4 star",
    installation: "No", skin_type: "All", volume: "30 ml", shade: "Natural", expiry: "Aug 2028", ingredients: "Niacinamide, zinc PCA", net_weight: "500 g", fssai_licence: "10019043002871",
    food_type: "Vegetarian", shelf_life: "9 months", allergens: "Processed in a facility with tree nuts", author: "Ira Deshpande", publisher: "Penrose Press", isbn: "978-93-5571-204-8",
    language: "English", binding: "Paperback", pages: "312", sport: "Fitness", age_group: "3 years and up", bis_licence: "", battery_operated: "Yes",
  };
  const attrs = meta.attributes.slice(0, 6).map((d) => ({ label: d.label, value: sample[d.code] || "", missing: d.mandatory && !sample[d.code] }));
  const legal = [
    { label: "Country of origin", value: "India" },
    { label: "Net quantity", value: "1 unit" },
    { label: "Manufacturer name and address", value: missingLegal ? "" : `${brand} India, Plot 14, Industrial Area Phase 2`, missing: missingLegal },
    { label: "Consumer care details", value: missingLegal ? "" : `care@${brand.toLowerCase().replace(/[^a-z]/g, "")}.in, 1800 200 4410`, missing: missingLegal },
  ];
  return [...attrs, ...legal];
}

export const moderationQueue: ModerationItem[] = modSeeds.map((s, i) => {
  const p = productByKey(s.key);
  const r = seeded(800 + i);
  const fails = s.fails ?? [];
  const warns = s.warns ?? [];
  const keys = s.type === "gated_brand" ? ["image", "watermark", "title", "prohibited", "mrp", "legal", "duplicate", "brand"] : ["image", "watermark", "title", "prohibited", "mrp", "legal", "duplicate"];
  const checks: QcCheck[] = keys.map((k) => {
    const result: CheckResult = fails.includes(k) ? "fail" : warns.includes(k) ? "warn" : "pass";
    return { key: k, label: checkCopy[k]!.label, result, detail: checkCopy[k]![result] };
  });
  const risk: RiskLevel = fails.length >= 2 || (s.flags?.length ?? 0) >= 2 ? "high" : fails.length || warns.length ? "medium" : "low";
  const price = Math.round((p.price * (s.priceAdj ?? 1)) / 10) * 10 - 1;
  const dupProduct = s.dupOf ? productByKey(s.dupOf) : undefined;
  const seller = sellerById(s.seller)!;
  return {
    id: `LQ-${48211 + i * 7}`,
    bsin: bsinFor(`mod-${s.key}-${i}`),
    productId: p.id,
    title: s.title,
    image: p.image,
    gallery: p.gallery,
    brand: brands.find((b) => b.id === p.brandId)?.name ?? "",
    categoryId: p.categoryId,
    subcategory: p.subcategory,
    sellerId: s.seller,
    sellerName: seller.displayName,
    type: s.type,
    price,
    mrp: fails.includes("mrp") ? Math.round(p.mrp * 1.38) : Math.max(price, Math.round((p.mrp * (s.priceAdj ?? 1)) / 100) * 100 - 1),
    submittedAt: ago(s.ageMins),
    slaDueAt: ago(s.ageMins - 48 * H),
    risk,
    autoScore: risk === "low" ? between(r, 88, 98) : risk === "medium" ? between(r, 61, 79) : between(r, 18, 44),
    attributes: attrValues(p, fails.includes("legal")),
    checks,
    flags: s.flags ?? [],
    duplicate: dupProduct
      ? { bsin: bsinFor(dupProduct.id), title: dupProduct.title, image: dupProduct.image, similarity: fails.includes("duplicate") ? 97 : 86, sellerName: sellerById(dupProduct.featuredSellerId)?.displayName ?? "" }
      : undefined,
    changes: s.changes,
  };
});

export interface SuppressedListing {
  bsin: string;
  productId: string;
  title: string;
  image: string;
  sellerId: string;
  reason: string;
  trigger: "Automated check" | "Moderator" | "IP complaint" | "Quality alert";
  since: string;
  views7d: number;
  status: "suppressed" | "blocked";
}

const suppressSeeds: [key: string, seller: string, reason: string, trigger: SuppressedListing["trigger"], days: number, status: SuppressedListing["status"]][] = [
  ["speaker-boom", "s-apex", "Main image missing after media migration", "Automated check", 2, "suppressed"],
  ["cushions-linen", "s-terra", "Price above M.R.P. after a bulk price upload", "Automated check", 1, "suppressed"],
  ["sunglasses-aviator", "s-urbankart", "Country of origin missing after template change", "Automated check", 4, "suppressed"],
  ["shoes-running", "s-profit", "Quality alert: return rate 18% against a 6% category benchmark", "Quality alert", 6, "suppressed"],
  ["oil-olive", "s-greenleaf", "FSSAI licence expired on 28 Sep", "Automated check", 3, "suppressed"],
  ["watch-analog", "s-urbankart", "Rights owner complaint: unauthorised use of brand images", "IP complaint", 9, "blocked"],
  ["lipstick-velvet", "s-glow", "Shade name differs from images, flagged by 4 customers", "Moderator", 5, "suppressed"],
  ["bicycle-city", "s-profit", "Safety recall notice for front brake assembly", "Moderator", 12, "blocked"],
];

export const suppressedListings: SuppressedListing[] = suppressSeeds.map(([key, seller, reason, trigger, days, status], i) => {
  const p = productByKey(key);
  return { bsin: bsinFor(p.id), productId: p.id, title: p.title, image: p.image, sellerId: seller, reason, trigger, since: ago(days * D + i * 37), views7d: between(seeded(60 + i), 400, 9000), status };
});

/* ---------------------------- KYC queue ------------------------------- */

export type KycStatus = "kyc_in_progress" | "submitted" | "under_review" | "action_required" | "approved" | "rejected";
export type KycDocStatus = "auto_verified" | "verified" | "pending" | "rejected" | "missing" | "expired";
export type VerifyResult = "verified" | "partial" | "failed" | "pending";

export interface KycApplication {
  id: string;
  sellerId?: string;
  displayName: string;
  legalName: string;
  ownerName: string;
  constitution: "Private limited company" | "LLP" | "Proprietorship" | "Partnership firm";
  city: string;
  state: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  status: KycStatus;
  submittedAt: string;
  slaDueAt: string;
  assignee?: string;
  expectedSkus: number;
  pickupAddress: string;
  gst: { result: VerifyResult; legalNameOnPortal: string; tradeName: string; registeredOn: string; state: string; filing: string };
  panCheck: { result: VerifyResult; holderName: string; score: number; aadhaarLinked: boolean };
  bank: { result: VerifyResult; bankName: string; ifsc: string; account: string; beneficiary: string; score: number; at?: string };
  documents: { key: string; label: string; status: KycDocStatus; file?: string; note?: string }[];
  categoryRequests: { categoryId: string; status: "pending" | "approved" | "rejected" | "not_required"; evidence: string }[];
  riskFlags: { label: string; severity: RiskLevel }[];
  notes: { by: string; at: string; body: string }[];
}

const kycDocs = (overrides: Partial<Record<string, [KycDocStatus, string?]>> = {}) =>
  [
    ["gst_certificate", "GST registration certificate (REG-06)", "auto_verified", "gst-reg-06.pdf"],
    ["pan_card", "PAN card of the business", "auto_verified", "pan-business.jpg"],
    ["cancelled_cheque", "Cancelled cheque or bank statement", "auto_verified", "cancelled-cheque.jpg"],
    ["address_proof", "Principal place of business proof", "pending", "electricity-bill-aug.pdf"],
    ["signature", "Authorised signatory specimen", "pending", "signature.png"],
    ["constitution", "Incorporation or partnership deed", "pending", "incorporation.pdf"],
    ["grievance", "Seller grievance officer details", "verified", undefined],
  ].map(([key, label, status, file]) => {
    const o = overrides[key!];
    return { key: key!, label: label!, status: (o?.[0] ?? status) as KycDocStatus, file: o?.[0] === "missing" ? undefined : file, note: o?.[1] };
  });

export const kycApplications: KycApplication[] = [
  {
    id: "APP-26-0412", sellerId: "s-kitchenkraft", displayName: "Kitchen Kraft India", legalName: "Kitchen Kraft India Private Limited", ownerName: "Vikram Reddy",
    constitution: "Private limited company", city: "Hyderabad", state: "Telangana", email: "vikram@kitchenkraft.in", phone: sellerById("s-kitchenkraft")!.phone,
    gstin: sellerById("s-kitchenkraft")!.gstin, pan: sellerById("s-kitchenkraft")!.pan, status: "submitted", submittedAt: ago(3 * D + 2 * H), slaDueAt: ago(3 * D + 2 * H - 72 * H),
    expectedSkus: 140, pickupAddress: "Unit 7, Kukatpally Industrial Estate, Hyderabad 500072",
    gst: { result: "verified", legalNameOnPortal: "KITCHEN KRAFT INDIA PRIVATE LIMITED", tradeName: "Kitchen Kraft", registeredOn: "14 Mar 2021", state: "Telangana", filing: "GSTR-3B filed for Aug 2026" },
    panCheck: { result: "verified", holderName: "KITCHEN KRAFT INDIA PRIVATE LIMITED", score: 100, aadhaarLinked: true },
    bank: { result: "verified", bankName: "Aranya Bank", ifsc: "ARNY0001042", account: "XXXXXXXX4471", beneficiary: "KITCHEN KRAFT INDIA PVT LTD", score: 96, at: ago(3 * D) },
    documents: kycDocs(),
    categoryRequests: [{ categoryId: "cat-home", status: "not_required", evidence: "Open category" }, { categoryId: "cat-appliances", status: "pending", evidence: "BIS certificates for 3 models" }],
    riskFlags: [],
    notes: [],
  },
  {
    id: "APP-26-0418", sellerId: "s-vastra", displayName: "Vastra Weaves", legalName: "Vastra Weaves Handloom Co.", ownerName: "Meera Joshi",
    constitution: "Partnership firm", city: "Varanasi", state: "Uttar Pradesh", email: "meera@vastra.in", phone: sellerById("s-vastra")!.phone,
    gstin: sellerById("s-vastra")!.gstin, pan: sellerById("s-vastra")!.pan, status: "under_review", submittedAt: ago(2 * D + 5 * H), slaDueAt: ago(2 * D + 5 * H - 72 * H), assignee: "Dev Malhotra",
    expectedSkus: 320, pickupAddress: "C 21/14, Lallapura, Varanasi 221001",
    gst: { result: "verified", legalNameOnPortal: "VASTRA WEAVES HANDLOOM CO", tradeName: "Vastra Weaves", registeredOn: "2 Aug 2019", state: "Uttar Pradesh", filing: "GSTR-3B filed for Aug 2026" },
    panCheck: { result: "verified", holderName: "VASTRA WEAVES HANDLOOM CO", score: 100, aadhaarLinked: true },
    bank: { result: "partial", bankName: "Vistar Gramin Bank", ifsc: "VSTR0000318", account: "XXXXXXX2208", beneficiary: "VASTRA WEAVES", score: 78, at: ago(2 * D) },
    documents: kycDocs({ address_proof: ["verified"], signature: ["verified"], constitution: ["pending", "Partnership deed page 3 is unreadable"] }),
    categoryRequests: [{ categoryId: "cat-fashion", status: "not_required", evidence: "Open category" }],
    riskFlags: [{ label: "Bank beneficiary name is a partial match (78%)", severity: "low" }],
    notes: [{ by: "Dev Malhotra", at: ago(20 * H), body: "Handloom Mark certificate attached. Asked seller for a clearer partnership deed scan." }],
  },
  {
    id: "APP-26-0421", sellerId: "s-ayurveda", displayName: "Ayurveda Roots", legalName: "Ayurveda Roots Wellness", ownerName: "Dr. Anil Menon",
    constitution: "Proprietorship", city: "Thrissur", state: "Kerala", email: "anil@ayurveda.in", phone: sellerById("s-ayurveda")!.phone,
    gstin: sellerById("s-ayurveda")!.gstin, pan: sellerById("s-ayurveda")!.pan, status: "under_review", submittedAt: ago(1 * D + 9 * H), slaDueAt: ago(1 * D + 9 * H - 72 * H), assignee: "Dev Malhotra",
    expectedSkus: 60, pickupAddress: "Near Vadakkunnathan Temple, Round North, Thrissur 680001",
    gst: { result: "verified", legalNameOnPortal: "ANIL MENON", tradeName: "Ayurveda Roots Wellness", registeredOn: "11 Jan 2024", state: "Kerala", filing: "GSTR-3B filed for Aug 2026" },
    panCheck: { result: "verified", holderName: "ANIL KUMAR MENON", score: 92, aadhaarLinked: true },
    bank: { result: "verified", bankName: "Tarang Co-operative Bank", ifsc: "TRNG0000219", account: "XXXXXXXX9013", beneficiary: "ANIL KUMAR MENON", score: 94, at: ago(1 * D + 6 * H) },
    documents: kycDocs({ address_proof: ["verified"], signature: ["verified"], constitution: ["verified", "Not applicable for proprietorship; Udyam certificate attached"] }),
    categoryRequests: [{ categoryId: "cat-beauty", status: "pending", evidence: "AYUSH manufacturing licence 25D/KL/2023/114" }, { categoryId: "cat-grocery", status: "pending", evidence: "FSSAI licence 21324010000871" }],
    riskFlags: [{ label: "Ayurvedic proprietary medicine: AYUSH licence must cover each product", severity: "medium" }],
    notes: [],
  },
  {
    id: "APP-26-0397", sellerId: "s-bytezone", displayName: "ByteZone Electronics", legalName: "ByteZone Electronics", ownerName: "Imran Shaikh",
    constitution: "Proprietorship", city: "Pune", state: "Maharashtra", email: "imran@bytezone.in", phone: sellerById("s-bytezone")!.phone,
    gstin: sellerById("s-bytezone")!.gstin, pan: sellerById("s-bytezone")!.pan, status: "action_required", submittedAt: ago(6 * D), slaDueAt: ago(6 * D - 72 * H), assignee: "Dev Malhotra",
    expectedSkus: 85, pickupAddress: "Shop 12, Budhwar Peth, Pune 411002",
    gst: { result: "partial", legalNameOnPortal: "IMRAN SHAIKH", tradeName: "BYTE ZONE MOBILES", registeredOn: "6 Jun 2025", state: "Maharashtra", filing: "GSTR-3B not filed for Jul and Aug 2026" },
    panCheck: { result: "verified", holderName: "IMRAN YUSUF SHAIKH", score: 88, aadhaarLinked: true },
    bank: { result: "failed", bankName: "Kesari National Bank", ifsc: "KSRI0004410", account: "XXXXXXXX0712", beneficiary: "ZENITH MOBILE WORLD", score: 21, at: ago(6 * D) },
    documents: kycDocs({ cancelled_cheque: ["rejected", "Beneficiary name does not match the applicant"], address_proof: ["rejected", "Rental agreement expired in June 2026"], signature: ["verified"], constitution: ["verified"] }),
    categoryRequests: [{ categoryId: "cat-electronics", status: "pending", evidence: "BIS registration for power banks not provided" }, { categoryId: "cat-mobiles", status: "rejected", evidence: "No brand authorisation letters" }],
    riskFlags: [
      { label: "Bank account linked to a seller suspended in 2025 (Zenith Mobile World)", severity: "high" },
      { label: "Trade name on GST portal differs from the application", severity: "medium" },
      { label: "GST returns not filed for 2 months", severity: "medium" },
    ],
    notes: [{ by: "Dev Malhotra", at: ago(5 * D), body: "Requested a fresh cancelled cheque in the applicant's name and a current rental agreement." }],
  },
  {
    id: "APP-26-0425", sellerId: "s-petpals", displayName: "PetPals Supplies", legalName: "PetPals Supplies LLP", ownerName: "Ritika Arora",
    constitution: "LLP", city: "Gurugram", state: "Haryana", email: "ritika@petpals.in", phone: sellerById("s-petpals")!.phone,
    gstin: sellerById("s-petpals")!.gstin, pan: sellerById("s-petpals")!.pan, status: "kyc_in_progress", submittedAt: ago(14 * H), slaDueAt: ahead(30 * D), expectedSkus: 210,
    pickupAddress: "Plot 88, Sector 37, Gurugram 122001",
    gst: { result: "verified", legalNameOnPortal: "PETPALS SUPPLIES LLP", tradeName: "PetPals", registeredOn: "19 Feb 2025", state: "Haryana", filing: "GSTR-3B filed for Aug 2026" },
    panCheck: { result: "pending", holderName: "", score: 0, aadhaarLinked: false },
    bank: { result: "pending", bankName: "", ifsc: "", account: "", beneficiary: "", score: 0 },
    documents: kycDocs({ pan_card: ["missing"], cancelled_cheque: ["missing"], address_proof: ["missing"], signature: ["missing"], constitution: ["missing"], grievance: ["missing"] }),
    categoryRequests: [{ categoryId: "cat-home", status: "not_required", evidence: "Open category" }],
    riskFlags: [],
    notes: [],
  },
  {
    id: "APP-26-0389", displayName: "Himalayan Harvest Co.", legalName: "Himalayan Harvest Foods Private Limited", ownerName: "Tenzin Negi",
    constitution: "Private limited company", city: "Dehradun", state: "Uttarakhand", email: "tenzin@himalayanharvest.in", phone: "+91 9837041192",
    gstin: "05AAHCH4471K1Z3", pan: "AAHCH4471K", status: "approved", submittedAt: ago(9 * D), slaDueAt: ago(6 * D), assignee: "Dev Malhotra", expectedSkus: 48,
    pickupAddress: "Selaqui Industrial Area, Dehradun 248011",
    gst: { result: "verified", legalNameOnPortal: "HIMALAYAN HARVEST FOODS PRIVATE LIMITED", tradeName: "Himalayan Harvest", registeredOn: "3 May 2022", state: "Uttarakhand", filing: "Up to date" },
    panCheck: { result: "verified", holderName: "HIMALAYAN HARVEST FOODS PRIVATE LIMITED", score: 100, aadhaarLinked: true },
    bank: { result: "verified", bankName: "Aranya Bank", ifsc: "ARNY0000877", account: "XXXXXXXX3390", beneficiary: "HIMALAYAN HARVEST FOODS PVT LTD", score: 99, at: ago(9 * D) },
    documents: kycDocs({ address_proof: ["verified"], signature: ["verified"], constitution: ["verified"] }),
    categoryRequests: [{ categoryId: "cat-grocery", status: "approved", evidence: "FSSAI central licence 10024012000419" }],
    riskFlags: [],
    notes: [{ by: "Dev Malhotra", at: ago(7 * D), body: "All checks verified. Approved." }],
  },
  {
    id: "APP-26-0376", displayName: "Zenith Mobile Hub", legalName: "Zenith Mobile Hub", ownerName: "Rakesh Paswan",
    constitution: "Proprietorship", city: "Patna", state: "Bihar", email: "rakesh@zenithhub.in", phone: "+91 9431180027",
    gstin: "10BXRPP2219L1Z8", pan: "BXRPP2219L", status: "rejected", submittedAt: ago(12 * D), slaDueAt: ago(9 * D), assignee: "Elena D'Souza", expectedSkus: 400,
    pickupAddress: "Exhibition Road, Patna 800001",
    gst: { result: "failed", legalNameOnPortal: "Registration cancelled on 12 Jul 2026", tradeName: "", registeredOn: "1 Apr 2023", state: "Bihar", filing: "Cancelled" },
    panCheck: { result: "verified", holderName: "RAKESH PASWAN", score: 100, aadhaarLinked: true },
    bank: { result: "verified", bankName: "Kesari National Bank", ifsc: "KSRI0004410", account: "XXXXXXXX0712", beneficiary: "RAKESH PASWAN", score: 97, at: ago(12 * D) },
    documents: kycDocs({ gst_certificate: ["rejected", "GSTIN cancelled"], address_proof: ["verified"], signature: ["verified"], constitution: ["verified"] }),
    categoryRequests: [{ categoryId: "cat-mobiles", status: "rejected", evidence: "No authorisation letters" }],
    riskFlags: [{ label: "Same device used by 3 other applicants this month", severity: "high" }, { label: "GSTIN cancelled by the department", severity: "high" }],
    notes: [{ by: "Elena D'Souza", at: ago(10 * D), body: "Rejected: cancelled GSTIN and linked device cluster. Escalated to Risk." }],
  },
];

/* ---------------------------- Brand registry -------------------------- */

export interface BrandRequest {
  id: string;
  brandName: string;
  sellerId: string;
  type: "registry" | "authorisation" | "new_brand";
  trademarkNo: string;
  trademarkClass: string;
  trademarkStatus: "Registered" | "Accepted and advertised" | "Objected" | "Applied";
  ipIndiaMatch: boolean;
  documents: string[];
  submittedAt: string;
  status: "pending" | "info_requested" | "approved" | "rejected";
  note?: string;
}

export const brandRequests: BrandRequest[] = [
  { id: "BRQ-2041", brandName: "Pulse", sellerId: "s-apex", type: "registry", trademarkNo: "5187720", trademarkClass: "Class 9 (audio equipment)", trademarkStatus: "Registered", ipIndiaMatch: true, documents: ["Trademark certificate", "Brand website domain proof", "Product packaging photos"], submittedAt: ago(2 * D + 3 * H), status: "pending" },
  { id: "BRQ-2043", brandName: "Northbound", sellerId: "s-urbankart", type: "authorisation", trademarkNo: "4410938", trademarkClass: "Class 18 (bags) and 25 (apparel)", trademarkStatus: "Registered", ipIndiaMatch: true, documents: ["Authorisation letter from Northbound Outdoor Pvt Ltd", "Distributor invoice"], submittedAt: ago(1 * D + 20 * H), status: "pending" },
  { id: "BRQ-2047", brandName: "Kesar Kitchen", sellerId: "s-ganesh", type: "new_brand", trademarkNo: "6022145", trademarkClass: "Class 30 (spices)", trademarkStatus: "Applied", ipIndiaMatch: true, documents: ["TM-A application receipt", "Packaging artwork"], submittedAt: ago(1 * D + 4 * H), status: "pending", note: "Trademark application pending; brand can be created as unregistered." },
  { id: "BRQ-2048", brandName: "Dermalab", sellerId: "s-glow", type: "registry", trademarkNo: "4877213", trademarkClass: "Class 3 (cosmetics)", trademarkStatus: "Registered", ipIndiaMatch: true, documents: ["Trademark certificate", "CDSCO import licence"], submittedAt: ago(22 * H), status: "pending" },
  { id: "BRQ-2050", brandName: "Trailmark", sellerId: "s-profit", type: "new_brand", trademarkNo: "6101877", trademarkClass: "Class 28 (sporting goods)", trademarkStatus: "Objected", ipIndiaMatch: false, documents: ["TM-A application receipt"], submittedAt: ago(16 * H), status: "pending", note: "Similar to an existing registered mark in Class 28." },
  { id: "BRQ-2052", brandName: "Novatek", sellerId: "s-ganesh", type: "authorisation", trademarkNo: "3920114", trademarkClass: "Class 9 (mobile phones)", trademarkStatus: "Registered", ipIndiaMatch: true, documents: ["Authorisation letter (unsigned)"], submittedAt: ago(9 * H), status: "info_requested", note: "Letter is unsigned and not on Novatek India letterhead." },
  { id: "BRQ-2053", brandName: "Little Oak", sellerId: "s-tinytots", type: "registry", trademarkNo: "5530921", trademarkClass: "Class 28 (toys)", trademarkStatus: "Accepted and advertised", ipIndiaMatch: true, documents: ["Journal publication extract", "BIS licence"], submittedAt: ago(6 * H), status: "pending" },
  { id: "BRQ-2033", brandName: "Brewline", sellerId: "s-kiln", type: "registry", trademarkNo: "5011734", trademarkClass: "Class 21 (kitchenware)", trademarkStatus: "Registered", ipIndiaMatch: true, documents: ["Trademark certificate"], submittedAt: ago(5 * D), status: "approved" },
  { id: "BRQ-2029", brandName: "Royal Oud", sellerId: "s-glow", type: "new_brand", trademarkNo: "N/A", trademarkClass: "Class 3", trademarkStatus: "Applied", ipIndiaMatch: false, documents: ["Packaging artwork"], submittedAt: ago(8 * D), status: "rejected", note: "Name conflicts with a registered fragrance mark." },
];

/** Verified brand registry: owner, trademark and live footprint. */
export const verifiedBrands = brands
  .filter((b) => b.verified)
  .map((b, i) => {
    const ps = products.filter((p) => p.brandId === b.id);
    const owner = ps[0]?.featuredSellerId;
    const r = seeded(120 + i);
    return {
      ...b,
      ownerSellerId: owner,
      trademarkNo: String(between(r, 3200000, 6100000)),
      products: ps.length,
      offers: ps.reduce((acc, p) => acc + p.offers.length, 0) * between(r, 6, 40),
      ipComplaints: i % 7 === 2 ? between(r, 1, 4) : 0,
      verifiedOn: ago(between(r, 60, 700) * D),
    };
  });

/* --------------------------- Seller extras ---------------------------- */

export interface SellerViolation {
  id: string;
  sellerId: string;
  policy: string;
  severity: "low" | "medium" | "high" | "critical";
  points: number;
  at: string;
  status: "open" | "appealed" | "resolved";
  detail: string;
}

export const sellerViolations: SellerViolation[] = [
  { id: "VIO-7711", sellerId: "s-profit", policy: "Order defect rate above target", severity: "medium", points: 50, at: ago(6 * D), status: "open", detail: "ODR 1.4% over the last 60 days against a 1% target." },
  { id: "VIO-7698", sellerId: "s-profit", policy: "Product authenticity complaint", severity: "high", points: 100, at: ago(11 * D), status: "appealed", detail: "Two customers reported Stride Velocity shoes as not genuine. Seller appealed with distributor invoices." },
  { id: "VIO-7650", sellerId: "s-desihandloom", policy: "Review manipulation", severity: "critical", points: 200, at: ago(19 * D), status: "open", detail: "31 reviews from accounts linked to the seller's devices and addresses." },
  { id: "VIO-7644", sellerId: "s-urbankart", policy: "Restricted product listed", severity: "low", points: 20, at: ago(24 * D), status: "resolved", detail: "Laser pointer above 1 mW listed in Electronics. Listing removed by seller." },
  { id: "VIO-7602", sellerId: "s-glow", policy: "Off-platform contact in package insert", severity: "medium", points: 50, at: ago(41 * D), status: "resolved", detail: "WhatsApp number printed on thank you card. Warning acknowledged." },
  { id: "VIO-7588", sellerId: "s-ganesh", policy: "Price gouging during sale event", severity: "medium", points: 50, at: ago(52 * D), status: "resolved", detail: "Mixer grinder price raised 30% in the week before Plus Day." },
  { id: "VIO-7561", sellerId: "s-apex", policy: "Late dispatch above target", severity: "low", points: 30, at: ago(70 * D), status: "resolved", detail: "LDR 4.6% for one weekly evaluation." },
];

export interface PayoutHold {
  id: string;
  sellerId: string;
  reason: string;
  category: "Account health" | "Risk investigation" | "KYC lapse" | "Dispute reserve";
  since: string;
  amountHeld: number;
  placedBy: string;
  releaseWhen: string;
}

export const payoutHolds: PayoutHold[] = [
  { id: "HLD-118", sellerId: "s-profit", reason: "Order defect rate 1.4% and an open authenticity appeal", category: "Account health", since: ago(6 * D), amountHeld: 1842390, placedBy: "Trust and Safety (automated)", releaseWhen: "ODR under 1% at the weekly evaluation, or appeal accepted" },
  { id: "HLD-121", sellerId: "s-desihandloom", reason: "Seller suspended for review manipulation", category: "Risk investigation", since: ago(19 * D), amountHeld: 412880, placedBy: "Elena D'Souza", releaseWhen: "Investigation closed; final settlement after 90 day claims window" },
  { id: "HLD-124", sellerId: "s-ganesh", reason: "Reserve for 4 open BluBuy Guarantee claims", category: "Dispute reserve", since: ago(2 * D), amountHeld: 68420, placedBy: "Claims engine", releaseWhen: "Claims decided" },
  { id: "HLD-125", sellerId: "s-pageturn", reason: "GSTIN status under verification after address amendment", category: "KYC lapse", since: ago(1 * D), amountHeld: 214550, placedBy: "Dev Malhotra", releaseWhen: "Amended GST certificate verified" },
];

export function sellerKycDocs(s: Seller) {
  const onboarding = ["registration_started", "documents_submitted", "under_review", "action_required"].includes(s.status);
  return [
    { label: "GST registration (REG-06)", value: s.gstin, status: (onboarding ? "auto_verified" : "verified") as KycDocStatus, at: s.joinedAt },
    { label: "PAN", value: s.pan, status: "verified" as KycDocStatus, at: s.joinedAt },
    { label: "Bank account (penny drop)", value: `Aranya Bank, XXXXXXXX${String(hashOf(s.id)).slice(-4)}`, status: (s.status === "registration_started" ? "pending" : "verified") as KycDocStatus, at: s.joinedAt },
    { label: "Principal place of business", value: `${s.city}, ${s.state} ${s.pincode}`, status: (onboarding ? "pending" : "verified") as KycDocStatus, at: s.joinedAt },
    { label: "Authorised signatory", value: s.ownerName, status: (onboarding ? "pending" : "verified") as KycDocStatus, at: s.joinedAt },
    { label: "Seller grievance officer", value: `${s.ownerName}, ${s.email}`, status: (s.id === "s-pageturn" ? "expired" : "verified") as KycDocStatus, at: s.joinedAt },
  ];
}

/** Admin view of settlements: two older payouts bounced at the bank, with reasons. */
export interface AdminSettlement {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  scheduledFor: string;
  orders: number;
  grossSales: number;
  feesTotal: number;
  tcs: number;
  tds: number;
  refunds: number;
  netPayout: number;
  status: SettlementStatus;
  utr?: string;
  failure?: string;
}

const failedPayouts: Record<string, string> = {
  "s-kiln": "Beneficiary account closed (bank return code R03)",
  "s-pageturn": "IFSC no longer valid after bank merger",
};

export const adminSettlements: AdminSettlement[] = allSettlements.map((s) => {
  const fee = (label: string) => -(s.fees.find((f) => f.label.startsWith(label))?.amount ?? 0);
  const fail = s.status === "paid" && failedPayouts[s.sellerId];
  return {
    id: s.id,
    sellerId: s.sellerId,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    scheduledFor: s.scheduledFor,
    orders: s.orders,
    grossSales: s.grossSales,
    feesTotal: -s.fees.filter((f) => !f.label.startsWith("TCS") && !f.label.startsWith("TDS")).reduce((acc, f) => acc + f.amount, 0),
    tcs: fee("TCS"),
    tds: fee("TDS"),
    refunds: -s.refunds,
    netPayout: s.netPayout,
    status: fail ? "failed" : s.status,
    utr: fail ? undefined : s.utr,
    failure: fail || undefined,
  };
});

/* --------------------------- Customer extras -------------------------- */

export function customerProfile(customerId: string) {
  const r = seeded(hashOf(customerId));
  const c = customers.find((x) => x.id === customerId)!;
  const high = c.riskScore >= 70;
  return {
    codRefusals90d: high ? between(r, 2, 5) : between(r, 0, 1),
    returns90d: high ? between(r, 6, 11) : between(r, 0, 3),
    returnRate: high ? between(r, 38, 61) : between(r, 2, 18),
    linkedAccounts: high ? between(r, 2, 4) : 0,
    devices: between(r, 1, high ? 6 : 3),
    creditsBalance: between(r, 0, 4) * 250 + between(r, 0, 99),
    coinsExpiring: Math.min(c.bluCoins, between(r, 0, 300)),
    plusSince: c.plusMember ? ago(between(r, 60, 900) * D) : undefined,
    plusPlan: r() > 0.5 ? "Annual, ₹999" : "Monthly, ₹149",
    lastLogin: ago(between(r, 5, 4 * D)),
    codEnabled: !(high || c.status === "blocked"),
  };
}

/* ----------------------------- Order risk ----------------------------- */

export function orderRisk(o: Order) {
  const r = seeded(hashOf(o.id));
  const c = customers.find((x) => x.id === o.customerId);
  const signals: { label: string; tone: "neutral" | "warning" | "danger" | "success" }[] = [];
  let score = between(r, 4, 22);
  if (c && c.riskScore >= 70) {
    score += 45;
    signals.push({ label: `Customer risk score ${c.riskScore} of 100`, tone: "danger" });
  }
  if (o.payment.method === "cod" && o.total > 10000) {
    score += 18;
    signals.push({ label: "Cash on delivery above ₹10,000", tone: "warning" });
  }
  if (o.total > 15000) signals.push({ label: "Secure Delivery: OTP required at the door", tone: "neutral" });
  if (r() < 0.18) {
    score += 12;
    signals.push({ label: "Delivery pincode COD return rate 27% (30 days)", tone: "warning" });
  }
  if (r() < 0.12) {
    score += 10;
    signals.push({ label: "Address used by 3 accounts in 30 days", tone: "warning" });
  }
  if (!signals.length) signals.push({ label: "No risk rules matched at checkout", tone: "success" });
  score = Math.min(98, score);
  return { score, level: (score >= 60 ? "high" : score >= 35 ? "medium" : "low") as RiskLevel, signals };
}

/* -------------------------------- Risk -------------------------------- */

export interface RiskRule {
  id: string;
  name: string;
  scope: "Orders" | "Customers" | "Payments" | "Sellers" | "Logistics" | "Reviews";
  trigger: string;
  action: string;
  hits7d: number;
  trend: number[];
  precision: number;
  status: "enabled" | "simulating" | "disabled";
  lastHitAt: string;
  owner: string;
}

const trendOf = (seed: number, base: number) => {
  const r = seeded(seed);
  return Array.from({ length: 7 }, (_, i) => Math.round(base * (0.7 + r() * 0.6) * (i >= 4 ? 1.6 : 1)));
};

export const riskRules: RiskRule[] = [
  { id: "RR-01", name: "New account high-value COD", scope: "Orders", trigger: "Account under 7 days old and COD order over ₹10,000", action: "Disable COD for the order, offer prepaid", hits7d: 1842, trend: trendOf(1, 240), precision: 91, status: "enabled", lastHitAt: ago(3), owner: "Elena D'Souza" },
  { id: "RR-02", name: "COD refusal history", scope: "Customers", trigger: "2 or more COD refusals in 90 days", action: "Disable COD for the customer", hits7d: 6120, trend: trendOf(2, 820), precision: 96, status: "enabled", lastHitAt: ago(1), owner: "Elena D'Souza" },
  { id: "RR-03", name: "High RTO pincode", scope: "Logistics", trigger: "Pincode COD RTO rate over 25% in 30 days", action: "Disable COD for the pincode", hits7d: 3410, trend: trendOf(3, 470), precision: 88, status: "enabled", lastHitAt: ago(2), owner: "Manoj Tiwari" },
  { id: "RR-04", name: "Return abuse", scope: "Customers", trigger: "Return rate over 40% with 5 or more returns in 90 days (customer-fault reasons)", action: "Disable refund at pickup, require receipt QC, manual review", hits7d: 412, trend: trendOf(4, 55), precision: 84, status: "enabled", lastHitAt: ago(14), owner: "Elena D'Souza" },
  { id: "RR-05", name: "Empty box or swap", scope: "Logistics", trigger: "Pickup weight differs over 30% from dispatch weight, or serial mismatch", action: "Hold refund, open risk case", hits7d: 96, trend: trendOf(5, 12), precision: 79, status: "enabled", lastHitAt: ago(48), owner: "Elena D'Souza" },
  { id: "RR-06", name: "Payment velocity", scope: "Payments", trigger: "5 or more failed card attempts in 10 minutes, or 3 or more cards in 24 hours", action: "Block card payments for 24 hours, flag account", hits7d: 2280, trend: trendOf(6, 300), precision: 93, status: "enabled", lastHitAt: ago(4), owner: "Fatima Sheikh" },
  { id: "RR-07", name: "Multi-account coupon abuse", scope: "Customers", trigger: "Same device, address or payment instrument across 3 or more accounts redeeming new-user coupons", action: "Void coupons, flag accounts", hits7d: 1530, trend: trendOf(7, 190), precision: 87, status: "enabled", lastHitAt: ago(6), owner: "Kunal Bhatia" },
  { id: "RR-08", name: "Seller fake orders", scope: "Sellers", trigger: "Orders from accounts linked to the seller (device, address, payment)", action: "Hold payout, open case", hits7d: 38, trend: trendOf(8, 5), precision: 82, status: "enabled", lastHitAt: ago(5 * H), owner: "Elena D'Souza" },
  { id: "RR-09", name: "Review manipulation", scope: "Reviews", trigger: "Review bursts, reviewer clusters or seller-linked reviewers", action: "Hold reviews, case to Trust and Safety", hits7d: 264, trend: trendOf(9, 35), precision: 76, status: "enabled", lastHitAt: ago(35), owner: "Aparna Krishnan" },
  { id: "RR-10", name: "DA cash shortage", scope: "Logistics", trigger: "Declared cash less than expected COD by over ₹100", action: "Block DA from COD stops, hub manager review", hits7d: 57, trend: trendOf(10, 8), precision: 98, status: "enabled", lastHitAt: ago(9 * H), owner: "Manoj Tiwari" },
  { id: "RR-11", name: "High-value Secure Delivery", scope: "Orders", trigger: "Order item above ₹15,000 or category in the sensitive list", action: "Require OTP at delivery, tamper-evident packaging", hits7d: 21840, trend: trendOf(11, 2900), precision: 100, status: "enabled", lastHitAt: ago(1), owner: "Manoj Tiwari" },
  { id: "RR-12", name: "Gift card velocity (draft)", scope: "Payments", trigger: "Gift card purchases over ₹25,000 in 24 hours from one account", action: "Hold order for manual review", hits7d: 140, trend: trendOf(12, 18), precision: 64, status: "simulating", lastHitAt: ago(22), owner: "Fatima Sheikh" },
  { id: "RR-13", name: "Mismatched shipping state", scope: "Orders", trigger: "Billing and shipping state differ for first order above ₹30,000", action: "Require OTP verification", hits7d: 0, trend: [0, 0, 0, 0, 0, 0, 0], precision: 0, status: "disabled", lastHitAt: ago(40 * D), owner: "Elena D'Souza" },
];

export interface HeldOrder {
  orderId: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: string;
  score: number;
  reasons: string[];
  heldAt: string;
}

export const heldOrders: HeldOrder[] = orders
  .filter((o) => ["placed", "pending_payment", "confirmed"].includes(o.status))
  .slice(0, 9)
  .map((o, i) => {
    const reasonsPool = [
      ["New account high-value COD", "Pincode 845401 COD RTO rate 31%"],
      ["Payment velocity: 4 cards tried in 2 hours"],
      ["Address shared by 4 accounts", "New-user coupon BLUFIRST redeemed"],
      ["Customer risk score above 80"],
      ["Billing and shipping state differ", "Order value ₹38,000 on first purchase"],
      ["Device linked to a blocked account"],
    ];
    return {
      orderId: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      amount: o.total,
      method: o.payment.method,
      score: 62 + ((i * 7) % 33),
      reasons: reasonsPool[i % reasonsPool.length]!,
      heldAt: ago(12 + i * 23),
    };
  });

export const codRiskPincodes = [
  { pincode: "845401", city: "Motihari, Bihar", codOrders30d: 1840, rtoRate: 34.2, status: "COD disabled" },
  { pincode: "243001", city: "Bareilly, Uttar Pradesh", codOrders30d: 3120, rtoRate: 28.9, status: "COD disabled" },
  { pincode: "470001", city: "Sagar, Madhya Pradesh", codOrders30d: 1290, rtoRate: 26.4, status: "COD disabled" },
  { pincode: "331001", city: "Churu, Rajasthan", codOrders30d: 980, rtoRate: 23.8, status: "Watching" },
  { pincode: "524001", city: "Nellore, Andhra Pradesh", codOrders30d: 2210, rtoRate: 22.1, status: "Watching" },
  { pincode: "686001", city: "Kottayam, Kerala", codOrders30d: 1460, rtoRate: 19.6, status: "Watching" },
];

export const returnAbuseSignals = customers
  .filter((c) => c.riskScore >= 55 || c.status === "flagged")
  .slice(0, 6)
  .map((c) => {
    const p = customerProfile(c.id);
    return { customerId: c.id, name: c.name, city: c.city, returns90d: Math.max(5, p.returns90d), returnRate: Math.max(41, p.returnRate), signal: pick(seeded(hashOf(c.id) + 3), ["Wardrobing pattern in Fashion", "Empty box claim on 2 returns", "Serial mismatch on returned phone", "Returns within 24 hours of delivery"]) };
  });

export interface BlocklistEntry {
  id: string;
  type: "Device" | "Phone" | "Pincode" | "UPI ID" | "Address" | "Card BIN" | "Email domain";
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
  hits30d: number;
}

export const blocklist: BlocklistEntry[] = [
  { id: "BL-3301", type: "Device", value: "a91f-4c22-88e0-7b1d", reason: "Linked to 14 accounts redeeming new-user coupons", addedBy: "Elena D'Souza", addedAt: ago(4 * D), hits30d: 61 },
  { id: "BL-3298", type: "Phone", value: maskPhone("+91 9876543120"), reason: "Repeated COD refusals across 5 accounts", addedBy: "Rule RR-02", addedAt: ago(6 * D), expiresAt: ahead(84 * D), hits30d: 9 },
  { id: "BL-3290", type: "Pincode", value: "845401", reason: "COD RTO rate 34% over 30 days", addedBy: "Rule RR-03", addedAt: ago(9 * D), expiresAt: ahead(21 * D), hits30d: 1840 },
  { id: "BL-3287", type: "UPI ID", value: "quickcash***@okpay", reason: "Chargebacks on 3 orders, mule account suspected", addedBy: "Fatima Sheikh", addedAt: ago(11 * D), hits30d: 4 },
  { id: "BL-3279", type: "Address", value: "Shop 4, Station Road, Motihari 845401", reason: "Drop address for 22 fraudulent COD orders", addedBy: "Elena D'Souza", addedAt: ago(15 * D), hits30d: 17 },
  { id: "BL-3266", type: "Card BIN", value: "4593 21XX", reason: "Issuer reported compromised range", addedBy: "Fatima Sheikh", addedAt: ago(20 * D), expiresAt: ahead(10 * D), hits30d: 112 },
  { id: "BL-3254", type: "Email domain", value: "tempinbox.example", reason: "Disposable email domain used in coupon abuse", addedBy: "Kunal Bhatia", addedAt: ago(28 * D), hits30d: 230 },
  { id: "BL-3241", type: "Device", value: "77ce-01ab-f3d2-9a40", reason: "Seller-linked device posting reviews", addedBy: "Rule RR-09", addedAt: ago(33 * D), hits30d: 12 },
];

/* ------------------------------ Disputes ------------------------------ */

export type GuaranteeStatus = "submitted" | "awaiting_seller" | "under_review" | "granted" | "denied" | "appealed" | "withdrawn";
export interface GuaranteeClaim {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  productTitle: string;
  image: string;
  reason: string;
  amount: number;
  filedAt: string;
  sellerRespondBy: string;
  decideBy: string;
  status: GuaranteeStatus;
  sellerResponse?: string;
  fundedBy?: "seller" | "blubuy";
  evidence: string[];
}

const gReasons = ["Item not delivered", "Damaged item, return refused by seller", "Materially different from listing", "Refund not received 2 days after return", "Wrong item, seller unresponsive"];
const gStatuses: GuaranteeStatus[] = ["awaiting_seller", "awaiting_seller", "under_review", "under_review", "under_review", "submitted", "granted", "denied", "appealed", "granted", "withdrawn", "under_review", "awaiting_seller", "granted"];

export const guaranteeClaims: GuaranteeClaim[] = orders
  .filter((o) => ["delivered", "undelivered", "rto_in_transit", "returned", "return_requested"].includes(o.status))
  .slice(3, 3 + gStatuses.length)
  .map((o, i) => {
    const status = gStatuses[i]!;
    const filedMins = 8 * H + i * 13 * H;
    const item = o.items[0]!;
    const reason = o.status === "undelivered" ? gReasons[0]! : gReasons[i % gReasons.length]!;
    return {
      id: `GC-26-${1041 + i * 3}`,
      orderId: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      sellerId: item.sellerId,
      productTitle: item.title,
      image: item.image,
      reason,
      amount: item.price * item.quantity,
      filedAt: ago(filedMins),
      sellerRespondBy: ago(filedMins - 72 * H),
      decideBy: ago(filedMins - 7 * D),
      status,
      sellerResponse: status === "awaiting_seller" || status === "submitted" ? undefined : pick(seeded(i + 9), ["Shared courier proof of delivery with OTP verification.", "Offered a replacement; customer declined.", "No response within 72 hours.", "Product matches listing; photos attached from dispatch."]),
      fundedBy: status === "granted" ? (i % 2 ? "blubuy" : "seller") : undefined,
      evidence: ["Customer photos (3)", reason === gReasons[0] ? "Tracking history" : "Return request RT record", "Chat transcript"],
    };
  });

export type SafeClaimStatus = "submitted" | "under_review" | "info_requested" | "approved" | "partially_approved" | "rejected" | "appealed" | "reimbursed";
export interface SafeClaim {
  id: string;
  sellerId: string;
  reference: string;
  referenceType: "Return" | "RTO" | "Shipment";
  grade: string;
  productTitle: string;
  image: string;
  claimed: number;
  approved?: number;
  filedAt: string;
  decideBy: string;
  status: SafeClaimStatus;
  evidence: { photos: number; unboxingVideo: boolean; dispatchWeight?: number; receivedWeight?: number };
}

const scGrades = ["Customer damaged", "Empty box", "Wrong item returned", "Missing item", "Carrier damaged", "Lost in transit", "Weight dispute"];
const scStatuses: SafeClaimStatus[] = ["submitted", "under_review", "under_review", "info_requested", "approved", "partially_approved", "rejected", "appealed", "reimbursed", "under_review", "submitted", "reimbursed"];

export const safeClaims: SafeClaim[] = scStatuses.map((status, i) => {
  const ret = returns[i % returns.length]!;
  const grade = scGrades[i % scGrades.length]!;
  const r = seeded(700 + i);
  const claimed = grade === "Weight dispute" ? between(r, 30, 120) : ret.amount;
  const filedMins = 6 * H + i * 17 * H;
  const dispatchWeight = Math.round((0.4 + r() * 2.4) * 100) / 100;
  return {
    id: `SC-26-${711 + i * 4}`,
    sellerId: ret.sellerId,
    reference: grade === "Lost in transit" || grade === "Carrier damaged" ? `BBL${between(r, 1000000000, 9999999999)}` : ret.id,
    referenceType: grade === "Lost in transit" || grade === "Carrier damaged" ? "Shipment" : grade === "Weight dispute" ? "Shipment" : "Return",
    grade,
    productTitle: ret.productTitle,
    image: ret.image,
    claimed,
    approved: status === "approved" || status === "reimbursed" ? claimed : status === "partially_approved" ? Math.round(claimed * 0.6) : undefined,
    filedAt: ago(filedMins),
    decideBy: ago(filedMins - 7 * D),
    status,
    evidence: { photos: between(r, 2, 8), unboxingVideo: claimed > 5000 ? r() > 0.25 : r() > 0.6, dispatchWeight, receivedWeight: grade === "Empty box" ? Math.round(dispatchWeight * 0.22 * 100) / 100 : Math.round(dispatchWeight * (0.95 + r() * 0.08) * 100) / 100 },
  };
});

export interface Chargeback {
  id: string;
  orderId: string;
  network: "Credit card" | "Debit card";
  reasonCode: string;
  amount: number;
  openedAt: string;
  respondBy: string;
  status: "open" | "evidence_submitted" | "won" | "lost" | "accepted";
}

export const chargebacks: Chargeback[] = orders
  .filter((o) => o.payment.method === "card")
  .slice(2, 8)
  .map((o, i) => ({
    id: `CB-${90412 + i * 9}`,
    orderId: o.id,
    network: (["Credit card", "Debit card"] as const)[i % 2],
    reasonCode: ["Fraud, card not present", "Merchandise not received", "Not as described", "Not as described", "No cardholder authorisation", "Merchandise not received"][i]!,
    amount: o.total,
    openedAt: ago((2 + i * 3) * D),
    respondBy: ago((2 + i * 3) * D - 10 * D),
    status: (["open", "open", "evidence_submitted", "won", "lost", "accepted"] as const)[i]!,
  }));

/* -------------------------------- Audit ------------------------------- */

export interface AuditEntry {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entity: "Order" | "Refund" | "Seller" | "Listing" | "Coupon" | "Payout" | "Customer" | "Rate card" | "Setting" | "Staff" | "Risk rule" | "Review" | "Banner";
  target: string;
  summary: string;
  reason?: string;
  ip: string;
  device: string;
  at: string;
}

const clip = (t: string, n = 46) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n)).replace(/[,\s]+$/, "")}...`);

const actorRoles: Record<string, string> = {
  "Rawahul Islam": "Super Admin",
  "Aparna Krishnan": "Category Manager",
  "Dev Malhotra": "Seller Onboarding Verifier",
  "Fatima Sheikh": "Finance Manager",
  "Kunal Bhatia": "Marketing and Promotions Manager",
  "Revathi Subramanian": "Support Supervisor",
  "Manoj Tiwari": "Logistics Admin",
  "Elena D'Souza": "Risk and Fraud Analyst",
  System: "Automation",
};

type AuditTemplate = (r: () => number, i: number) => Omit<AuditEntry, "id" | "ip" | "device" | "at">;

const auditTemplates: AuditTemplate[] = [
  (r) => { const o = pick(r, orders); return { actor: "Revathi Subramanian", actorRole: "", action: "order:cancel", entity: "Order", target: o.id, summary: `Cancelled item 1 of ${o.id} on behalf of the customer`, reason: "CUSTOMER_REQUESTED_VIA_SUPPORT" }; },
  (r) => { const o = pick(r, orders); return { actor: "Fatima Sheikh", actorRole: "", action: "refund:approve", entity: "Refund", target: `RF-${between(r, 80200, 82900)}`, summary: `Approved refund of ₹${between(r, 11, 64)},${between(r, 100, 999)} above the L2 limit for ${o.id}`, reason: "Above actor limit" }; },
  (r) => { const s = pick(r, sellers.filter((x) => x.status === "active")); return { actor: "Dev Malhotra", actorRole: "", action: "seller:kyc_decide", entity: "Seller", target: s.id, summary: `Verified bank account re-submission for ${s.displayName}` }; },
  (r) => { const m = pick(r, moderationQueue); return { actor: "Aparna Krishnan", actorRole: "", action: "listing:qc_decide", entity: "Listing", target: m.bsin, summary: `Rejected listing "${clip(m.title)}"`, reason: "IMAGE_QUALITY" }; },
  (r) => { const m = pick(r, moderationQueue); return { actor: "Aparna Krishnan", actorRole: "", action: "listing:qc_decide", entity: "Listing", target: m.bsin, summary: `Approved listing "${clip(m.title)}"` }; },
  () => ({ actor: "Kunal Bhatia", actorRole: "", action: "coupon:pause", entity: "Coupon", target: "APEXKITCHEN", summary: "Paused seller coupon APEXKITCHEN after budget review", reason: "Budget review" }),
  (r) => ({ actor: "Fatima Sheikh", actorRole: "", action: "payout:approve", entity: "Payout", target: `RUN-${between(r, 2609, 2610)}${between(r, 10, 30)}`, summary: "Approved payout run prepared by the Finance Executive (checker)" }),
  (r) => { const c = pick(r, customers.filter((x) => x.riskScore > 60)); return { actor: "Elena D'Souza", actorRole: "", action: "customer:flag", entity: "Customer", target: c.id, summary: `Flagged ${c.name} for return abuse review`, reason: "RETURN_ABUSE" }; },
  (r) => { const o = pick(r, orders); return { actor: "System", actorRole: "", action: "order:hold", entity: "Order", target: o.id, summary: "Order held by rule RR-01 New account high-value COD" }; },
  () => ({ actor: "Rawahul Islam", actorRole: "", action: "setting:update", entity: "Setting", target: "cod.max_order_value", summary: "Changed COD maximum order value from ₹40,000 to ₹50,000", reason: "Big Days policy" }),
  (r) => ({ actor: "Manoj Tiwari", actorRole: "", action: "risk_rule:update", entity: "Risk rule", target: "RR-03", summary: `Raised high RTO pincode threshold review cadence to daily for ${between(r, 3, 9)} pincodes` }),
  (r) => { const rv = pick(r, reviews.filter((x) => x.status !== "published")); return { actor: "Aparna Krishnan", actorRole: "", action: "review:moderate", entity: "Review", target: rv.id, summary: "Removed review for external link and phone number", reason: "PII_OR_LINKS" }; },
  () => ({ actor: "Kunal Bhatia", actorRole: "", action: "cms:publish", entity: "Banner", target: "hero-bigdays-day6", summary: "Published homepage hero for BluBuy Big Days day 6" }),
  (r) => { const s = pick(r, sellers.filter((x) => x.status === "active")); return { actor: "Rawahul Islam", actorRole: "", action: "pii:reveal", entity: "Seller", target: s.id, summary: `Revealed phone number of ${s.ownerName}`, reason: "Escalated support case" }; },
  () => ({ actor: "Rawahul Islam", actorRole: "", action: "staff:invite", entity: "Staff", target: "harsh@blubuy.in", summary: "Invited Harsh Vardhan as Catalog Moderator" }),
  (r) => { const s = pick(r, sellers.filter((x) => x.status === "active")); return { actor: "System", actorRole: "", action: "payout:hold", entity: "Payout", target: s.id, summary: `Placed dispute reserve on ${s.displayName}`, reason: "OPEN_GUARANTEE_CLAIMS" }; },
  () => ({ actor: "Fatima Sheikh", actorRole: "", action: "ratecard:submit", entity: "Rate card", target: "RC-2026-EXAMPLE", summary: "Submitted rate card draft for approval (maker)" }),
];

const ips = ["10.40.12.88", "10.40.12.91", "10.40.18.204", "10.52.3.17", "10.40.22.5", "172.18.4.60"];
const devices = ["Chrome 141 on macOS", "Edge 140 on Windows 11", "Chrome 141 on Windows 11", "Safari 19 on macOS"];

export const auditEntries: AuditEntry[] = (() => {
  const r = seeded(4040);
  let mins = 4;
  return Array.from({ length: 96 }, (_, i) => {
    const t = auditTemplates[i % auditTemplates.length]!(r, i);
    mins += between(r, 3, 95);
    return {
      ...t,
      actorRole: actorRoles[t.actor] ?? "",
      id: `AE-${String(912400 - i * 13)}`,
      ip: t.actor === "System" ? "internal" : pick(r, ips),
      device: t.actor === "System" ? "Rules engine" : pick(r, devices),
      at: ago(mins),
    };
  });
})();

/* ------------------------------ Payments ------------------------------ */

export interface GatewayStat {
  key: string;
  method: "UPI" | "Cards" | "Net banking" | "Wallets" | "EMI" | "BluBuy Credits";
  channel: string;
  provider: string;
  success15m: number;
  success24h: number;
  volume24h: number;
  latencyMs: number;
  status: "operational" | "degraded" | "down";
}

export const gatewayStats: GatewayStat[] = [
  { key: "upi-intent", method: "UPI", channel: "Intent", provider: "Kanakpay", success15m: 95.2, success24h: 97.4, volume24h: 98400, latencyMs: 1840, status: "operational" },
  { key: "upi-collect", method: "UPI", channel: "Collect request", provider: "Kanakpay", success15m: 87.9, success24h: 93.1, volume24h: 21600, latencyMs: 4120, status: "degraded" },
  { key: "upi-qr", method: "UPI", channel: "QR", provider: "Kanakpay", success15m: 96.8, success24h: 97.9, volume24h: 9800, latencyMs: 2210, status: "operational" },
  { key: "card-credit", method: "Cards", channel: "Credit cards", provider: "Veloce Payments", success15m: 92.4, success24h: 92.9, volume24h: 26900, latencyMs: 2650, status: "operational" },
  { key: "card-debit", method: "Cards", channel: "Debit cards", provider: "Veloce Payments", success15m: 91.8, success24h: 92.6, volume24h: 19300, latencyMs: 2710, status: "operational" },
  { key: "card-prepaid", method: "Cards", channel: "Saved card tokens", provider: "Veloce Payments", success15m: 93.6, success24h: 94.2, volume24h: 11200, latencyMs: 2380, status: "operational" },
  { key: "nb", method: "Net banking", channel: "All banks", provider: "Veloce Payments", success15m: 89.7, success24h: 90.4, volume24h: 9700, latencyMs: 5200, status: "operational" },
  { key: "wallets", method: "Wallets", channel: "Partner wallets", provider: "Kanakpay", success15m: 97.1, success24h: 97.6, volume24h: 4600, latencyMs: 1320, status: "operational" },
  { key: "emi", method: "EMI", channel: "Card EMI", provider: "Veloce Payments", success15m: 90.2, success24h: 91.5, volume24h: 7400, latencyMs: 3050, status: "operational" },
  { key: "credits", method: "BluBuy Credits", channel: "Internal tender", provider: "BluBuy ledger", success15m: 99.9, success24h: 99.9, volume24h: 12800, latencyMs: 180, status: "operational" },
];

/** Payment failure rate (percent of attempts) for the last 24 completed hours. */
export const failureRateHourly = (() => {
  const r = seeded(5150);
  const endHour = istHour(NOW); // the current hour is still in progress
  return Array.from({ length: 24 }, (_, i) => {
    const h = (endHour - 24 + i + 24) % 24;
    const evening = h >= 19 && h <= 23 ? 0.6 : 0;
    const last = i === 23 ? 1.4 : 0;
    return {
      label: hourLabel(h),
      upi: Math.round((2.4 + r() * 0.9 + evening + last) * 10) / 10,
      cards: Math.round((6.8 + r() * 1.2 + evening) * 10) / 10,
      netbanking: Math.round((9 + r() * 1.4) * 10) / 10,
    };
  });
})();

export const failureReasons = [
  { label: "Customer left the UPI app without paying", value: 4120 },
  { label: "Debit failed at remitter bank (U30)", value: 2310 },
  { label: "Insufficient funds", value: 1980 },
  { label: "Card declined by issuer", value: 1760 },
  { label: "OTP not entered in time", value: 1240 },
  { label: "3-D Secure authentication failed", value: 860 },
  { label: "Net banking server unavailable", value: 640 },
  { label: "Blocked by risk rule RR-06", value: 212 },
];

export interface OrphanPayment {
  id: string;
  customer: string;
  method: string;
  amount: number;
  debitedAt: string;
  tatDue: string;
  status: "auto_refund_initiated" | "refunded" | "order_revived";
  bankRef: string;
}

export const orphanPayments: OrphanPayment[] = [
  { id: "PY261001004417", customer: "Vivek Iyer", method: "UPI", amount: 12999, debitedAt: ago(38), tatDue: ahead(D - 38), status: "auto_refund_initiated", bankRef: "627410093318" },
  { id: "PY261001003982", customer: "Tanvi Gupta", method: "UPI", amount: 2499, debitedAt: ago(1 * H + 12), tatDue: ahead(D - 72), status: "order_revived", bankRef: "627410081142" },
  { id: "PY261001002210", customer: "Farhan Malhotra", method: "Card", amount: 54999, debitedAt: ago(3 * H), tatDue: ahead(D - 3 * H), status: "auto_refund_initiated", bankRef: "ARN74219920" },
  { id: "PY260930019907", customer: "Simran Rao", method: "UPI", amount: 899, debitedAt: ago(14 * H), tatDue: ahead(10 * H), status: "refunded", bankRef: "627309771205" },
  { id: "PY260930017741", customer: "Nikhil Das", method: "Net banking", amount: 6499, debitedAt: ago(19 * H), tatDue: ahead(5 * H), status: "refunded", bankRef: "NB0930A88172" },
];

const providerFor = (m: string) => (m === "upi" || m === "wallet" ? "Kanakpay" : m === "cod" ? "Cash on delivery" : "Veloce Payments");

export const paymentTransactions = orders.slice(0, 60).map((o, i) => ({
  id: `PY${o.placedAt.slice(2, 10).replace(/-/g, "")}${String(4400 + i * 37).padStart(6, "0")}`,
  orderId: o.id,
  customer: o.customerName,
  method: o.payment.method,
  status: o.payment.status,
  amount: o.total,
  provider: providerFor(o.payment.method),
  gatewayRef: o.payment.method === "cod" ? "" : o.payment.txnId,
  at: o.placedAt,
}));

export interface ReconFile {
  date: string;
  provider: "Kanakpay" | "Veloce Payments";
  captured: number;
  capturedAmount: number;
  settledAmount: number;
  refundsAmount: number;
  mismatches: number;
  status: "matched" | "mismatch" | "pending" | "resolved";
}

export const reconFiles: ReconFile[] = Array.from({ length: 7 }, (_, d) => {
  const day = platformDaily.at(-2 - d)!;
  return (["Kanakpay", "Veloce Payments"] as const).map((provider, k) => {
    const share = provider === "Kanakpay" ? 0.58 : 0.21;
    const capturedAmount = Math.round(day.gmv * share);
    const mismatch = d === 3 && k === 1 ? 3 : d === 1 && k === 0 ? 1 : 0;
    const status: ReconFile["status"] = d === 0 && k === 1 ? "pending" : mismatch && d === 3 ? "resolved" : mismatch ? "mismatch" : "matched";
    return {
      date: day.date,
      provider,
      captured: Math.round(day.orders * share * 1.02),
      capturedAmount,
      settledAmount: status === "pending" ? 0 : capturedAmount - Math.round(capturedAmount * 0.018) - mismatch * 13760,
      refundsAmount: Math.round(capturedAmount * 0.018),
      mismatches: mismatch,
      status,
    };
  });
}).flat();

export const codRemittance = hubs
  .filter((h) => h.type === "delivery_hub")
  .map((h, i) => {
    const r = seeded(330 + i);
    const expected = between(r, 9, 26) * 100000 + between(r, 0, 99999);
    const short = i === 2 ? 4280 : i === 4 ? 960 : 0;
    const collected = expected - short;
    const deposited = collected;
    const banked = i === 5 ? 0 : deposited;
    const reconciled = i >= 4 ? 0 : banked;
    const status = short ? "short" : reconciled ? "reconciled" : banked ? "banked" : "deposited";
    return { hubId: h.id, hubCode: h.code, hubName: h.name, city: h.city, expected, collected, deposited, banked, reconciled, short, status: status as "short" | "reconciled" | "banked" | "deposited", lastDepositAt: ago(between(r, 40, 16 * H)) };
  });

/* --------------------------------- Ads -------------------------------- */

/** 30 completed days of BluBuy Ads platform revenue and delivery. */
export const adsDaily = platformDaily.slice(-31, -1).map((d, i) => {
  const r = seeded(6000 + i);
  const impressions = Math.round(d.visitors * (11.5 + r() * 1.5));
  const ctr = 0.42 + r() * 0.08;
  const clicks = Math.round((impressions * ctr) / 100);
  const cpc = 6.8 + r() * 1.6;
  return { date: d.date, impressions, clicks, revenue: Math.round(clicks * cpc), attributedSales: Math.round(clicks * cpc * (7.2 + r() * 1.8)) };
});

export const adPlacements = [
  { name: "Search results, top slots", page: "Search", format: "Sponsored Products", limit: "4 per 20 organic results", share: 0.38, ctr: 0.71, fill: 94, floor: 2 },
  { name: "Search results, in-grid", page: "Search", format: "Sponsored Products", limit: "Positions 9 and 15", share: 0.21, ctr: 0.44, fill: 88, floor: 1 },
  { name: "Product page, sponsored carousel", page: "Product page", format: "Sponsored Products", limit: "Up to 12 cards", share: 0.19, ctr: 0.36, fill: 91, floor: 1 },
  { name: "Search header banner", page: "Search", format: "Sponsored Brands", limit: "1 per query", share: 0.11, ctr: 0.52, fill: 63, floor: 4 },
  { name: "Homepage, sponsored rail", page: "Homepage", format: "Sponsored Products", limit: "1 rail, 10 cards", share: 0.07, ctr: 0.29, fill: 100, floor: 3 },
  { name: "Category page, display banner", page: "Category page", format: "Sponsored Display", limit: "1 per page", share: 0.04, ctr: 0.18, fill: 57, floor: 2 },
];

export const advertisers = sellers
  .filter((s) => s.status === "active" || s.status === "on_hold")
  .map((s, i) => {
    const r = seeded(6100 + i);
    const spend = Math.round(s.gmv30d * (0.018 + r() * 0.03));
    const roas = Math.round((4.2 + r() * 6.5) * 10) / 10;
    const wallet = s.status === "on_hold" ? 1840 : between(r, 8, 260) * 1000;
    return {
      sellerId: s.id,
      name: s.displayName,
      campaigns: between(r, 2, 18),
      spend30d: spend,
      attributedSales: Math.round(spend * roas),
      roas,
      acos: Math.round((100 / roas) * 10) / 10,
      wallet,
      status: (s.status === "on_hold" ? "paused" : wallet < 20000 ? "low_balance" : "active") as "active" | "low_balance" | "paused",
    };
  })
  .sort((x, y) => y.spend30d - x.spend30d);

export interface AdCreative {
  id: string;
  sellerId: string;
  format: "Sponsored Brands" | "Sponsored Display";
  headline: string;
  image: string;
  landing: string;
  submittedAt: string;
  flags: string[];
}

export const adReviewQueue: AdCreative[] = [
  { id: "CRV-5521", sellerId: "s-apex", format: "Sponsored Brands", headline: "Big Days on Auralis: studio sound, festival prices", image: productByKey("headphones-studio").image, landing: "Brand store: Auralis", submittedAt: ago(3 * H), flags: [] },
  { id: "CRV-5524", sellerId: "s-glow", format: "Sponsored Display", headline: "Guaranteed glow in 3 days or your money back", image: productByKey("serum-glow").image, landing: "Product page", submittedAt: ago(2 * H + 20), flags: ["Unsubstantiated claim: \"guaranteed\" results", "Refund promise outside BluBuy policy"] },
  { id: "CRV-5527", sellerId: "s-terra", format: "Sponsored Brands", headline: "Living rooms that feel like home", image: productByKey("sofa-oslo").image, landing: "Collection: Oaken living room", submittedAt: ago(95), flags: [] },
  { id: "CRV-5530", sellerId: "s-urbankart", format: "Sponsored Display", headline: "Cheapest smartwatch in India, only today!", image: productByKey("watch-smart").image, landing: "Product page", submittedAt: ago(70), flags: ["Superlative claim without evidence: \"cheapest\"", "False urgency: offer is not time-limited"] },
  { id: "CRV-5533", sellerId: "s-loomhouse", format: "Sponsored Brands", headline: "Handcrafted kurtas for the festive season", image: productByKey("kurta-ethnic").image, landing: "Brand store: Rangrez", submittedAt: ago(40), flags: [] },
];

/* ----------------------------- Promotions ----------------------------- */

export interface SaleEvent {
  id: string;
  name: string;
  code: string;
  startsAt: string;
  endsAt: string;
  status: "ended" | "live" | "submissions_open" | "planning";
  earlyAccess?: string;
  submissionsClose?: string;
  dealsApproved: number;
  dealsPending: number;
  gmv?: number;
  targetGmv: number;
}

export const saleEvents: SaleEvent[] = [
  { id: "ev-plus", name: "BluBuy Plus Day", code: "EVENT_PLUS_DAY", startsAt: "2026-07-15T00:00:00+05:30", endsAt: "2026-07-16T23:59:00+05:30", status: "ended", dealsApproved: 9240, dealsPending: 0, gmv: 1_412_000_000, targetGmv: 1_300_000_000, earlyAccess: "Members only" },
  { id: "ev-bigdays", name: SALE_EVENT.name, code: "EVENT_BIG_DAYS", startsAt: SALE_EVENT.startsAt, endsAt: SALE_EVENT.endsAt, status: "live", dealsApproved: 18640, dealsPending: 312, gmv: Math.round(platformDaily.filter((d) => new Date(d.date) >= new Date(SALE_EVENT.startsAt)).reduce((acc, d) => acc + d.gmv, 0)), targetGmv: 6_000_000_000, earlyAccess: "25 Sep for Plus members", submissionsClose: "2026-09-12T23:59:00+05:30" },
  { id: "ev-diwali", name: "Diwali Dhamaka", code: "EVENT_DIWALI", startsAt: "2026-10-28T00:00:00+05:30", endsAt: "2026-11-09T23:59:00+05:30", status: "submissions_open", dealsApproved: 2140, dealsPending: 1186, targetGmv: 4_500_000_000, earlyAccess: "27 Oct for Plus members", submissionsClose: "2026-10-12T23:59:00+05:30" },
  { id: "ev-yearend", name: "Year End Sale", code: "EVENT_YEAR_END", startsAt: "2026-12-20T00:00:00+05:30", endsAt: "2026-12-31T23:59:00+05:30", status: "planning", dealsApproved: 0, dealsPending: 0, targetGmv: 2_200_000_000 },
];

export interface DealSubmission {
  id: string;
  productId: string;
  title: string;
  image: string;
  sellerId: string;
  dealType: "Blu Flash Deal" | "Blu Deal of the Day" | "Big Days deal" | "Diwali Dhamaka deal";
  dealPrice: number;
  low30d: number;
  mrp: number;
  requiredPct: number;
  stock: number;
  submittedAt: string;
}

const dealSeeds: [key: string, seller: string, type: DealSubmission["dealType"], pctOff30: number, required: number, stock: number][] = [
  ["laptop-air", "s-apex", "Diwali Dhamaka deal", 14, 12, 420],
  ["phone-nova", "s-novatek", "Diwali Dhamaka deal", 11, 10, 3000],
  ["airfryer-crisp", "s-ganesh", "Blu Flash Deal", 9, 15, 250],
  ["sofa-oslo", "s-terra", "Diwali Dhamaka deal", 22, 15, 60],
  ["kurta-ethnic", "s-loomhouse", "Blu Deal of the Day", 24, 20, 1200],
  ["perfume-noir", "s-glow", "Diwali Dhamaka deal", -6, 15, 300],
  ["watch-smart", "s-urbankart", "Blu Flash Deal", 18, 15, 800],
  ["dumbbells-hex", "s-profit", "Blu Deal of the Day", 21, 20, 150],
  ["lamp-arc", "s-kiln", "Diwali Dhamaka deal", 17, 15, 220],
  ["almonds-premium", "s-greenleaf", "Big Days deal", 12, 10, 2400],
];

export const dealSubmissions: DealSubmission[] = dealSeeds.map(([key, seller, dealType, pct, requiredPct, stock], i) => {
  const p = productByKey(key);
  const low30d = Math.round(p.price * 1.02);
  return {
    id: `DL-${66120 + i * 11}`,
    productId: p.id,
    title: p.title,
    image: p.image,
    sellerId: seller,
    dealType,
    dealPrice: Math.round((low30d * (100 - pct)) / 100 / 10) * 10 - 1,
    low30d,
    mrp: p.mrp,
    requiredPct,
    stock,
    submittedAt: ago(30 + i * 97),
  };
});

/* --------------------------------- CMS -------------------------------- */

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string;
  startsAt: string;
  endsAt: string;
  status: "live" | "scheduled" | "draft" | "ended";
  audience: string;
  impressions: number;
  ctr: number;
}

export const heroBanners: HeroBanner[] = [
  { id: "hero-bigdays-day6", title: "BluBuy Big Days: day 6", subtitle: "Up to 60% off festive home, fashion and electronics. Plus members save an extra 10%.", cta: "Shop the sale", href: "/deals", image: "/images/banners/hero-festive.jpg", startsAt: "2026-10-01T00:00:00+05:30", endsAt: "2026-10-01T23:59:00+05:30", status: "live", audience: "Everyone", impressions: 4_820_000, ctr: 3.4 },
  { id: "hero-electronics", title: "Laptops and audio, festival prices", subtitle: "No cost EMI up to 12 months on Kestrel, Auralis and Lumora.", cta: "Explore electronics", href: "/c/electronics", image: "/images/banners/hero-electronics.jpg", startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "live", audience: "Everyone", impressions: 3_160_000, ctr: 2.7 },
  { id: "hero-fashion", title: "The festive edit", subtitle: "Handcrafted kurtas, sarees and juttis from independent labels.", cta: "Shop fashion", href: "/c/fashion", image: "/images/banners/hero-fashion.jpg", startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "live", audience: "Women, metro cities", impressions: 2_410_000, ctr: 3.1 },
  { id: "hero-home", title: "Make room for Diwali", subtitle: "Furniture, lighting and decor with free installation in 40 cities.", cta: "Shop home", href: "/c/home", image: "/images/banners/hero-home.jpg", startsAt: "2026-10-06T00:00:00+05:30", endsAt: "2026-10-27T23:59:00+05:30", status: "scheduled", audience: "Everyone", impressions: 0, ctr: 0 },
  { id: "promo-beauty", title: "Beauty Fest", subtitle: "Buy 2, get 1 free on skincare from Veda Naturals and Dermalab.", cta: "Shop beauty", href: "/c/beauty", image: "/images/banners/promo-beauty.jpg", startsAt: "2026-10-10T00:00:00+05:30", endsAt: "2026-10-14T23:59:00+05:30", status: "draft", audience: "Plus members", impressions: 0, ctr: 0 },
  { id: "promo-sports", title: "Monsoon fitness", subtitle: "Yoga mats, dumbbells and cycles from ₹499.", cta: "Shop sports", href: "/c/sports", image: "/images/banners/promo-sports.jpg", startsAt: "2026-07-01T00:00:00+05:30", endsAt: "2026-08-31T23:59:00+05:30", status: "ended", audience: "Everyone", impressions: 6_940_000, ctr: 1.9 },
];

export interface HomeSlot {
  id: string;
  type: "hero_carousel" | "category_tiles" | "product_rail" | "deal_strip" | "banner_pair" | "brand_spotlight";
  name: string;
  status: "live" | "scheduled" | "draft";
  audience: string;
  source: string;
  startsAt?: string;
  endsAt?: string;
  productIds?: string[];
  categoryIds?: string[];
}

export const homeSlots: HomeSlot[] = [
  { id: "slot-hero", type: "hero_carousel", name: "Hero carousel", status: "live", audience: "Everyone", source: "3 live banners, rotating every 6 seconds" },
  { id: "slot-deals", type: "deal_strip", name: "Big Days deals of the hour", status: "live", audience: "Everyone", source: "Rule: approved Blu Flash Deals, ending soonest", startsAt: SALE_EVENT.startsAt, endsAt: SALE_EVENT.endsAt, productIds: ["p-headphones-studio", "p-earbuds-pods", "p-watch-smart", "p-airfryer-crisp", "p-phone-nova", "p-backpack-urban"] },
  { id: "slot-cats", type: "category_tiles", name: "Shop by category", status: "live", audience: "Everyone", source: "Manual, 8 tiles", categoryIds: categories.slice(0, 8).map((c) => c.id) },
  { id: "slot-rail-reco", type: "product_rail", name: "Recommended for you", status: "live", audience: "Signed-in customers", source: "Model: personalised ranking v4", productIds: ["p-laptop-air", "p-monitor-ultra", "p-keyboard-mech", "p-camera-mirrorless", "p-speaker-boom", "p-tablet-slate"] },
  { id: "slot-banners", type: "banner_pair", name: "Fashion and beauty banners", status: "live", audience: "Everyone", source: "Manual", startsAt: SALE_EVENT.startsAt, endsAt: SALE_EVENT.endsAt },
  { id: "slot-rail-home", type: "product_rail", name: "Festive home picks", status: "scheduled", audience: "Everyone", source: "Collection: Diwali home", startsAt: "2026-10-06T00:00:00+05:30", endsAt: "2026-11-09T23:59:00+05:30", productIds: ["p-sofa-oslo", "p-chair-lounge", "p-lamp-arc", "p-vase-ceramic", "p-cushions-linen", "p-mugs-stone"] },
  { id: "slot-brand", type: "brand_spotlight", name: "Brand spotlight: Kestrel", status: "draft", audience: "Electronics shoppers", source: "Sponsored Brands placement" },
  { id: "slot-rail-plus", type: "product_rail", name: "Plus member exclusives", status: "live", audience: "Plus members", source: "Rule: products tagged Plus", productIds: ["p-phone-aurora", "p-laptop-air", "p-bag-leather", "p-perfume-noir"] },
];

/* ------------------------------- Reports ------------------------------ */

export interface ReportDef {
  id: string;
  name: string;
  group: "Tax and compliance" | "Finance" | "Sales" | "Operations" | "Sellers" | "Customers";
  description: string;
  formats: string[];
  cadence: string;
  owner: string;
  lastRunAt: string;
}

export const reportLibrary: ReportDef[] = [
  { id: "rpt-gstr8", name: "GST TCS report (GSTR-8)", group: "Tax and compliance", description: "TCS collected under section 52 per supplier GSTIN and state, with net taxable supplies after returns. Ready to upload to the GST portal.", formats: ["GSTR-8 JSON", "CSV"], cadence: "Monthly, file by the 10th", owner: "Finance", lastRunAt: ago(1 * D + 3 * H) },
  { id: "rpt-tds194o", name: "TDS under section 194-O", group: "Tax and compliance", description: "TDS deducted on gross sales per seller PAN, with exemptions applied. Feeds Form 26Q and Form 16A certificates.", formats: ["Form 26Q text", "CSV"], cadence: "Monthly, quarterly return", owner: "Finance", lastRunAt: ago(1 * D + 5 * H) },
  { id: "rpt-feeinv", name: "Seller fee invoices", group: "Tax and compliance", description: "Monthly GST invoices and credit notes for commission, fixed fee and shipping per seller.", formats: ["PDF bundle", "CSV"], cadence: "Monthly", owner: "Finance", lastRunAt: ago(1 * D) },
  { id: "rpt-settle", name: "Seller settlements", group: "Finance", description: "Settlement lines per seller with sale, fees, TCS, TDS, refunds, holds and payout UTRs.", formats: ["XLSX", "CSV"], cadence: "Each payout run", owner: "Finance", lastRunAt: ago(2 * D) },
  { id: "rpt-recon", name: "Gateway and COD reconciliation", group: "Finance", description: "Captured payments against gateway settlement files, and delivered COD against hub deposits and bank credits.", formats: ["XLSX"], cadence: "Daily", owner: "Finance", lastRunAt: ago(9 * H) },
  { id: "rpt-liability", name: "BluCoins and Credits liability", group: "Finance", description: "Outstanding BluCoins, BluBuy Credits and gift card balances with expiry ageing.", formats: ["XLSX"], cadence: "Monthly", owner: "Finance", lastRunAt: ago(30 * D) },
  { id: "rpt-sales", name: "Sales and GMV by category", group: "Sales", description: "GMV, orders, units, AOV and conversion by category, brand and region.", formats: ["XLSX", "CSV"], cadence: "Daily", owner: "Growth", lastRunAt: ago(6 * H) },
  { id: "rpt-orders", name: "Orders and cancellations", group: "Sales", description: "Order items by status with cancellation reasons and actor (customer, seller, system, admin).", formats: ["CSV"], cadence: "On demand", owner: "Operations", lastRunAt: ago(3 * D) },
  { id: "rpt-returns", name: "Returns and refunds", group: "Operations", description: "Returns by reason and fault, QC outcomes, refund destination and time to refund.", formats: ["XLSX", "CSV"], cadence: "Weekly", owner: "Operations", lastRunAt: ago(4 * D) },
  { id: "rpt-logistics", name: "Logistics SLA and NDR", group: "Operations", description: "On-time pickup and delivery, NDR reasons, RTO rate by hub, lane and pincode.", formats: ["XLSX"], cadence: "Daily", owner: "Operations", lastRunAt: ago(10 * H) },
  { id: "rpt-sellerperf", name: "Seller performance and health", group: "Sellers", description: "Seller Health scores, metric breaches, violations and tier evaluation results.", formats: ["XLSX"], cadence: "Weekly", owner: "Trust and Safety", lastRunAt: ago(2 * D) },
  { id: "rpt-plus", name: "BluBuy Plus membership", group: "Customers", description: "Members by plan, renewals, cancellations, grace period and benefit usage.", formats: ["XLSX"], cadence: "Monthly", owner: "Growth", lastRunAt: ago(30 * D) },
];

export const scheduledExports = [
  { id: "SCH-11", reportId: "rpt-gstr8", cadence: "Monthly on the 2nd, 6:00 am", recipients: "tax@blubuy.in", format: "GSTR-8 JSON", nextRunAt: "2026-10-02T06:00:00+05:30", active: true },
  { id: "SCH-12", reportId: "rpt-tds194o", cadence: "Monthly on the 3rd, 6:00 am", recipients: "tax@blubuy.in", format: "Form 26Q text", nextRunAt: "2026-10-03T06:00:00+05:30", active: true },
  { id: "SCH-14", reportId: "rpt-recon", cadence: "Daily, 7:00 am", recipients: "finance-ops@blubuy.in", format: "XLSX", nextRunAt: "2026-10-02T07:00:00+05:30", active: true },
  { id: "SCH-17", reportId: "rpt-sales", cadence: "Daily, 8:00 am", recipients: "leadership@blubuy.in", format: "XLSX", nextRunAt: "2026-10-02T08:00:00+05:30", active: true },
  { id: "SCH-19", reportId: "rpt-sellerperf", cadence: "Mondays, 9:00 am", recipients: "trust@blubuy.in", format: "XLSX", nextRunAt: "2026-10-05T09:00:00+05:30", active: false },
];

export const reportRuns = [
  { id: "RPT-60418", reportId: "rpt-sales", period: "30 Sep 2026", requestedBy: "Schedule SCH-17", at: ago(2 * H + 30), status: "ready" as const, rows: 48210, size: "6.2 MB" },
  { id: "RPT-60417", reportId: "rpt-recon", period: "30 Sep 2026", requestedBy: "Schedule SCH-14", at: ago(3 * H + 30), status: "ready" as const, rows: 312440, size: "41.8 MB" },
  { id: "RPT-60416", reportId: "rpt-settle", period: "21 to 27 Sep 2026", requestedBy: "Fatima Sheikh", at: ago(5 * H), status: "running" as const, rows: 0, size: "" },
  { id: "RPT-60409", reportId: "rpt-gstr8", period: "Aug 2026", requestedBy: "Schedule SCH-11", at: ago(29 * D), status: "ready" as const, rows: 1288, size: "1.1 MB" },
  { id: "RPT-60408", reportId: "rpt-tds194o", period: "Aug 2026", requestedBy: "Schedule SCH-12", at: ago(28 * D), status: "ready" as const, rows: 1288, size: "0.6 MB" },
  { id: "RPT-60402", reportId: "rpt-returns", period: "Week 39, 2026", requestedBy: "Manoj Tiwari", at: ago(4 * D), status: "failed" as const, rows: 0, size: "" },
  { id: "RPT-60398", reportId: "rpt-orders", period: "1 to 30 Sep 2026", requestedBy: "Revathi Subramanian", at: ago(3 * D), status: "ready" as const, rows: 211904, size: "28.4 MB" },
];

/* ---------------------------- Team and RBAC --------------------------- */

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string;
  members: number;
  limit?: string;
  makerChecker?: "Maker" | "Checker";
  scope: string;
}

export const adminRoles: AdminRole[] = [
  { id: "super_admin", code: "A1", name: "Super Admin", description: "Platform configuration and role management; break-glass access, every action audited", members: 2, scope: "Global" },
  { id: "ops_admin", code: "A2", name: "Operations Admin", description: "Orders, cancellations, SLA monitoring and manual overrides with a reason", members: 9, limit: "Refund on behalf up to ₹25,000", scope: "Global" },
  { id: "kyc", code: "A3", name: "Seller Onboarding Verifier", description: "Reviews seller applications, documents and bank verification", members: 6, scope: "Global" },
  { id: "catalog_mod", code: "A4", name: "Catalog Moderator", description: "Listing QC queue, suppress and unsuppress, duplicate merge", members: 14, scope: "Assigned categories" },
  { id: "category_mgr", code: "A5", name: "Category Manager", description: "Category tree, attributes, category approvals and deal approvals for own categories", members: 8, scope: "Assigned categories" },
  { id: "brand_ip", code: "A6", name: "Brand and IP Manager", description: "Brand creation, Brand Registry, authorisation letters and IP complaints", members: 3, scope: "Global" },
  { id: "merch", code: "A7", name: "Merchandiser", description: "Homepage, banners, collections and search merchandising", members: 5, scope: "Global" },
  { id: "marketing", code: "A8", name: "Marketing and Promotions Manager", description: "Platform coupons, bank offers, sale events, BluCoins rules", members: 4, limit: "Coupon budget up to ₹50 lakh", scope: "Global" },
  { id: "ads_ops", code: "A9", name: "Ads Operations", description: "Ad policies, creative review, CPC floors and billing issues", members: 4, scope: "Global" },
  { id: "finance_mgr", code: "A10", name: "Finance Manager", description: "Approves payouts and high-value refunds, publishes rate cards, signs off reconciliation", members: 3, makerChecker: "Checker", scope: "Global" },
  { id: "finance_exec", code: "A11", name: "Finance Executive", description: "Prepares payout runs, reconciles gateway and COD files, handles refund failures", members: 7, makerChecker: "Maker", limit: "Refund reroute up to ₹1 lakh", scope: "Global" },
  { id: "risk", code: "A12", name: "Risk and Fraud Analyst", description: "Risk cases, block and unblock entities, COD controls, claims investigation", members: 6, scope: "Global" },
  { id: "trust", code: "A13", name: "Trust and Safety", description: "Account health enforcement, policy violations, suspensions and appeals", members: 5, scope: "Global" },
  { id: "reviews_mod", code: "A14", name: "Reviews and Q&A Moderator", description: "Review moderation queue and abuse reports", members: 10, scope: "Global" },
  { id: "logistics", code: "A15", name: "Logistics Admin", description: "Network, pincode serviceability, transit matrix and courier partners", members: 4, scope: "Global" },
  { id: "grievance", code: "A16", name: "Compliance and Grievance Officer", description: "Grievance cases, legal requests, takedowns and regulatory reports", members: 2, scope: "Global" },
  { id: "auditor", code: "A17", name: "Auditor", description: "Read-only access to everything including audit logs; no PII export", members: 2, scope: "Global, read only" },
  { id: "analyst", code: "A18", name: "Data Analyst", description: "Reports and dashboards with masked PII", members: 11, scope: "Global, masked PII" },
];

export type PermissionLevel = "full" | "view" | "maker" | "checker" | "limited" | "none";

export interface PermissionRow {
  group: string;
  label: string;
  perm: string;
  levels: Record<string, PermissionLevel>;
}

export const MATRIX_ROLES = ["super_admin", "ops_admin", "kyc", "catalog_mod", "category_mgr", "marketing", "finance_mgr", "finance_exec", "risk", "trust", "auditor"];

const row = (group: string, label: string, perm: string, levels: string): PermissionRow => {
  const map: Record<string, PermissionLevel> = { F: "full", V: "view", M: "maker", C: "checker", L: "limited", "-": "none" };
  return { group, label, perm, levels: Object.fromEntries(MATRIX_ROLES.map((r, i) => [r, map[levels[i]!] ?? "none"])) };
};

// Columns:                                                  SA OP KY CM CG MK FM FE RK TS AU
export const permissionMatrix: PermissionRow[] = [
  row("Orders", "View orders and customers", "order:read", "FFVVVVVVFFV"),
  row("Orders", "Cancel an order item", "order:cancel", "FF------L--"),
  row("Orders", "Force a status transition", "order:force_transition", "FL---------"),
  row("Refunds", "Approve a refund above limit", "refund:approve", "FL----C-L--"),
  row("Refunds", "Retry or reroute a failed refund", "refund:retry", "FL-----M---"),
  row("Sellers", "Decide seller KYC", "seller:kyc_decide", "F-F------V-"),
  row("Sellers", "Suspend or reinstate a seller", "seller:suspend", "F--------FV"),
  row("Sellers", "Place or release a payout hold", "payout:hold", "F-----FMFFV"),
  row("Catalog", "Decide listing QC", "listing:qc_decide", "F--FF-----V"),
  row("Catalog", "Edit the category tree", "category:edit", "F---F-----V"),
  row("Finance", "Create a payout run", "payout:create", "F-----VM--V"),
  row("Finance", "Approve a payout run", "payout:approve", "F-----C---V"),
  row("Finance", "Publish a rate card", "ratecard:publish", "F---V-CM--V"),
  row("Growth", "Create a platform coupon", "coupon:create", "F---LF----V"),
  row("Growth", "Publish homepage changes", "cms:publish", "F----L----V"),
  row("Trust", "Decide a risk case", "risk:decide", "F-------FLV"),
  row("Trust", "Edit blocklists", "blocklist:edit", "F-------F-V"),
  row("Trust", "Decide Guarantee and SafeClaims", "claim:decide", "FL----C-F-V"),
  row("Access", "Invite and manage staff", "staff:manage", "F----------"),
  row("Access", "Edit roles and limits", "role:edit", "F---------V"),
  row("Access", "Reveal masked PII", "pii:reveal", "FL------L--"),
  row("Access", "Export the audit log", "audit:export", "F---------F"),
];

export const staffMeta: Record<string, { roleId: string; mfa: boolean; scope: string; lastIp: string }> = {
  "u-1": { roleId: "super_admin", mfa: true, scope: "Global", lastIp: "10.40.12.88" },
  "u-2": { roleId: "category_mgr", mfa: true, scope: "Electronics, Mobiles, Appliances", lastIp: "10.40.12.91" },
  "u-3": { roleId: "kyc", mfa: true, scope: "Global", lastIp: "10.40.18.204" },
  "u-4": { roleId: "finance_mgr", mfa: true, scope: "Global", lastIp: "10.52.3.17" },
  "u-5": { roleId: "marketing", mfa: true, scope: "Global", lastIp: "10.40.22.5" },
  "u-6": { roleId: "ops_admin", mfa: true, scope: "Customer Experience", lastIp: "172.18.4.60" },
  "u-7": { roleId: "logistics", mfa: false, scope: "South and West network", lastIp: "10.40.12.91" },
  "u-8": { roleId: "risk", mfa: true, scope: "Global", lastIp: "10.52.3.17" },
  "u-9": { roleId: "catalog_mod", mfa: false, scope: "Fashion, Home", lastIp: "" },
  "u-10": { roleId: "analyst", mfa: false, scope: "Global, masked PII", lastIp: "10.40.22.5" },
};

export const staffDirectory = staff.map((s) => ({ ...s, ...(staffMeta[s.id] ?? { roleId: "analyst", mfa: false, scope: "Global", lastIp: "" }) }));

/* ----------------------------- Moderation ----------------------------- */

export interface ReviewFlagInfo {
  reviewId: string;
  flags: string[];
  signals: string[];
  reports: number;
  source: "Automated filter" | "Customer report" | "Brand report";
}

const flagPool = [
  ["External link in review text", "Phone number detected"],
  ["Incentivised language: \"got a gift card for this review\""],
  ["Review ring: reviewer shares a device with 5 accounts"],
  ["About delivery, not the product"],
  ["Profanity"],
  ["Reviewer linked to the seller's address"],
  ["Burst: 14 five-star reviews in 2 hours on this product"],
];

export const reviewFlags: ReviewFlagInfo[] = reviews
  .filter((r) => r.status !== "published")
  .concat(reviews.filter((r) => r.status === "published" && r.rating <= 2).slice(0, 3))
  .map((rv, i) => ({
    reviewId: rv.id,
    flags: rv.status === "pending" ? (i % 3 === 0 ? [] : flagPool[(i + 3) % flagPool.length]!) : flagPool[i % flagPool.length]!,
    signals: [`Reviewer account ${between(seeded(i + 41), 3, 400)} days old`, rv.verified ? "Verified purchase" : "Not a verified purchase", ...(i % 4 === 1 ? ["Same IP as 3 other reviewers this week"] : [])],
    reports: rv.status === "flagged" ? between(seeded(i + 51), 1, 9) : 0,
    source: rv.status === "flagged" ? (i % 3 === 2 ? "Brand report" : "Customer report") : "Automated filter",
  }));

export const reviewClusters = [
  { id: "CL-118", product: "Pulse Boom 2 Portable Bluetooth Speaker", reviews: 14, accounts: 6, signal: "6 accounts on one device posted 14 five-star reviews in 2 hours", status: "Held" },
  { id: "CL-117", product: "Stride Velocity Cushioned Running Shoes", reviews: 9, accounts: 9, signal: "Reviewers ordered with a seller-funded 90% coupon", status: "Under investigation" },
  { id: "CL-112", product: "Veda Naturals 10% Niacinamide Glow Serum", reviews: 22, accounts: 4, signal: "Reviewer addresses match the seller's warehouse pincode", status: "Removed, seller warned" },
];

/* ------------------------------ Settings ------------------------------ */

export const platformSettings = {
  returnWindows: categoryMeta.map((m) => ({ categoryId: m.categoryId, days: m.returnDays, resolution: m.resolution })),
  cod: { maxOrderValue: 50000, maxUndelivered: 3, pincodeRtoThreshold: 25, refusalsToDisable: 2 },
  delivery: { freeAbove: 499, fee: 40, platformFee: 0 },
  plus: { monthly: 149, annual: 999, trialDays: 0, members: 4_812_300 },
  coins: { earnPer100: 1, plusEarnPer100: 2, capPerOrder: 100, redeemPercent: 10, expiryMonths: 6 },
  grievance: { name: "Meenakshi Raghavan", designation: "Grievance Officer", email: "grievance@blubuy.in", phone: "+91 80 4718 2200", address: "BluBuy Technologies Private Limited, 7th Floor, Orion Tech Park, Outer Ring Road, Bengaluru 560103" },
  maintenance: { enabled: false, message: "Scheduled maintenance on 4 Oct from 2:00 am to 4:00 am. Payments may be slower than usual.", audience: "Everyone" },
};

/* --------------------------- Payout runs ------------------------------ */

export const payoutRun = {
  id: "RUN-261002",
  scheduledFor: "2026-10-02T10:00:00+05:30",
  status: "pending_approval" as const,
  sellers: 11,
  lines: 48_216,
  amount: adminSettlements.filter((s) => s.status === "scheduled").reduce((acc, s) => acc + s.netPayout, 0),
  preparedBy: "Arvind Nair (Finance Executive)",
  preparedAt: ago(2 * H + 10),
  exceptions: 2,
};

/* --------------------------- Ops snapshot ----------------------------- */

/** Platform-wide operating metrics for the overview (live, as of NOW). */
export const opsSnapshot = {
  slaBreaches: 1284,
  dispatchAtRisk: 3920,
  ndrRate: 4.8,
  rtoRate: 7.9,
  cancellationRate: 2.1,
  openRiskCases: 342,
  refundsFailed: 57,
  claimsDueToday: 23,
  oldestQcHours: 52,
};

/* -------------------------- Order shipments --------------------------- */

const SHIP_FROM_ORDER: Partial<Record<OrderStatus, ShipmentStatus>> = {
  packed: "manifested",
  ready_to_ship: "pickup_scheduled",
  shipped: "picked_up",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  return_requested: "delivered",
  returned: "delivered",
  undelivered: "ndr",
  rto_in_transit: "rto_in_transit",
  returned_to_seller: "rto_delivered",
};

export interface OrderShipment {
  sellerId: string;
  awb?: string;
  status?: ShipmentStatus;
  originHubId: string;
  destinationHubId: string;
  weightKg: number;
  codAmount: number;
  attempts: number;
  ndrReason?: NdrReason;
  lastUpdate: string;
}

/**
 * One shipment per seller in an order, with a status consistent with the
 * order (the AWB is generated at packing, so early orders have none yet).
 */
export function orderShipments(o: Order): OrderShipment[] {
  const sellerIds = [...new Set(o.items.map((it) => it.sellerId))];
  const status = SHIP_FROM_ORDER[o.status];
  const mock = shipments.find((x) => x.orderId === o.id);
  return sellerIds.map((sellerId, i) => {
    const r = seeded(hashOf(`${o.id}-${sellerId}`));
    const value = o.items.filter((it) => it.sellerId === sellerId).reduce((acc, it) => acc + it.price * it.quantity, 0);
    const rto = status === "rto_in_transit" || status === "rto_delivered";
    return {
      sellerId,
      awb: status ? (i === 0 && mock ? mock.id : `BBL${between(r, 1000000000, 9999999999)}`) : undefined,
      status,
      originHubId: (i === 0 && mock?.originHubId) || pick(r, ["h-bom-fc", "h-del-fc", "h-blr-fc", "h-hyd-sc"]),
      destinationHubId: (i === 0 && mock?.destinationHubId) || pick(r, ["h-blr-wfd", "h-blr-hsr", "h-bom-and", "h-del-skt", "h-pun-kth", "h-chn-ady"]),
      weightKg: (i === 0 && mock?.weightKg) || Math.round((0.3 + r() * 4) * 10) / 10,
      codAmount: o.payment.method === "cod" ? value : 0,
      attempts: status === "ndr" ? 1 : rto ? 3 : status === "delivered" || status === "out_for_delivery" ? 1 : 0,
      ndrReason: status === "ndr" || rto ? ((i === 0 && mock?.ndrReason) || "customer_unavailable") : undefined,
      lastUpdate: o.timeline.at(-1)?.at ?? o.placedAt,
    };
  });
}

/* ------------------------------ Refund ops ---------------------------- */

export interface AdminRefund {
  id: string;
  orderId: string;
  returnId?: string;
  customerName: string;
  amount: number;
  method: PaymentMethod | "bluwallet";
  status: RefundStatus | "on_hold";
  initiatedAt: string;
  note?: string;
  attempts: number;
  creditedInMins?: number;
}

const failReasons = ["UPI ID closed by the customer's bank", "Card account closed by issuer", "Beneficiary account frozen", "UPI switch timeout at remitter bank", "IFSC invalid after bank merger", "Account holder name mismatch"];
const holdReasons = ["Above the L2 agent limit of ₹10,000", "Risk hold: customer flagged for return abuse", "Above the L2 agent limit of ₹10,000", "Empty box signal on pickup weight"];

/** Shared refunds plus the failed and on-hold refunds operations works on. */
export const adminRefunds: AdminRefund[] = [
  ...refunds.map((r, i) => ({ ...r, attempts: 1, creditedInMins: r.method === "bluwallet" && r.status === "completed" ? 20 + ((i * 17) % 70) : undefined })),
  ...orders
    .filter((o) => o.status === "delivered" && o.payment.method !== "cod")
    .slice(10, 16)
    .map((o, i) => ({ id: `RF-${83010 + i * 13}`, orderId: o.id, customerName: o.customerName, amount: o.items[0]!.price, method: o.payment.method, status: "failed" as const, initiatedAt: ago(5 * H + i * 7 * H), note: failReasons[i]!, attempts: 1 + (i % 3) })),
  ...orders
    .filter((o) => o.status === "delivered" && o.total > 10000)
    .slice(2, 6)
    .map((o, i) => ({ id: `RF-${83120 + i * 9}`, orderId: o.id, customerName: o.customerName, amount: o.items[0]!.price, method: o.payment.method, status: "on_hold" as const, initiatedAt: ago(2 * H + i * 5 * H), note: holdReasons[i]!, attempts: 0 })),
  ...orders
    .filter((o) => o.status === "delivered")
    .slice(20, 26)
    .map((o, i) => ({ id: `RF-${83200 + i * 7}`, orderId: o.id, customerName: o.customerName, amount: o.items[0]!.price, method: "bluwallet" as const, status: "completed" as const, initiatedAt: ago(30 + i * 95), attempts: 1, creditedInMins: [4, 11, 26, 7, 41, 15][i]! })),
].sort((x, y) => +new Date(y.initiatedAt) - +new Date(x.initiatedAt));

/** Fault attribution for a return reason (spec 10.5.3). */
export function returnFault(reason: string): "Seller" | "Customer" | "Logistics" {
  if (/transit/i.test(reason)) return "Logistics";
  if (/different item|not working|missing/i.test(reason)) return "Seller";
  return "Customer";
}
