/**
 * Storefront content that is not in the catalog yet: merchandising slots,
 * deals, bank offers, Q&A, search facets, legal and help content. Helpers that
 * pick products take the live catalog's products (lib/store-catalog.ts);
 * client components receive plain snapshots built at the bottom of this file.
 */
import type { Brand, Category, Product, Seller } from "../types";
import { addDays, NOW, seeded, slugify } from "../utils";
import { coupons } from "./engagement";
import type { BankOffer, CartProduct, CouponLite, NavCategory, Suggestion, WalletLite } from "@/components/store/types";

/* ------------------------------ Company ------------------------------- */

export const COMPANY = {
  legalName: "AltasGoods Commerce Private Limited",
  cin: "U47912KA2025PTC204817",
  gstin: "29AALCB4821Q1Z6",
  registeredOffice: "Level 9, Lakeview Square, 14 Residency Road, Ashok Nagar, Bengaluru, Karnataka 560025",
  customerCare: "1800 210 4455",
  customerCareHours: "8 am to 10 pm, every day",
  email: "care@altasgoods.in",
  website: "www.altasgoods.in",
};

/** Required by the Consumer Protection (E-Commerce) Rules, 2020. */
export const GRIEVANCE_OFFICER = {
  name: "Meenakshi Raghavan",
  designation: "Grievance Officer, AltasGoods Commerce Private Limited",
  email: "grievance.officer@altasgoods.in",
  phone: "+91 80 4718 2200",
  hours: "Monday to Saturday, 9:30 am to 6:30 pm",
  address: "Level 9, Lakeview Square, 14 Residency Road, Bengaluru, Karnataka 560025",
  ackHours: 48,
  resolutionDays: 30,
};

/* ----------------------------- Hero slides ---------------------------- */

export interface HeroSlide {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** where the copy sits and whether it reads light-on-dark */
  align: "left" | "right";
  theme: "dark" | "light";
  position?: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "festive",
    image: "/images/banners/hero-festive.jpg",
    alt: "Lit clay diya with warm bokeh lights in the dark",
    eyebrow: "AltasGoods Big Days, live now",
    title: "The festive sale, done calmly",
    body: "Up to 60% off across 30 categories. Real prices, honest timers and easy returns on every deal.",
    cta: "Shop the sale",
    href: "/deals",
    align: "left",
    theme: "dark",
    position: "center",
  },
  {
    id: "electronics",
    image: "/images/banners/hero-electronics.jpg",
    alt: "Partly open laptop glowing with colourful light in a dark room",
    eyebrow: "New: Kestrel Air 14",
    title: "Thin, light and ready for anything",
    body: "Core Ultra 7, 16 GB, 1 TB SSD from ₹84,990. No cost EMI from ₹14,165 a month.",
    cta: "Explore laptops",
    href: "/p/laptop-air",
    align: "left",
    theme: "dark",
    position: "70% center",
  },
  {
    id: "fashion",
    image: "/images/banners/hero-fashion.jpg",
    alt: "Folded garments on a wooden ladder rack beside dried pampas grass",
    eyebrow: "New season essentials",
    title: "Easy layers for the festive season",
    body: "Supima cotton, linen and handloom from ₹799, with 10 day returns and free exchange.",
    cta: "Shop fashion",
    href: "/c/fashion",
    align: "right",
    theme: "light",
    position: "left center",
  },
  {
    id: "home",
    image: "/images/banners/hero-home.jpg",
    alt: "Calm beige living room with a sectional sofa and framed art",
    eyebrow: "Home and furniture",
    title: "Quiet rooms, considered pieces",
    body: "Sofas, lighting and ceramics from independent studios across India.",
    cta: "Shop home",
    href: "/c/home",
    align: "left",
    theme: "light",
    position: "right center",
  },
];

export const PROMO_TILES = [
  {
    id: "beauty",
    image: "/images/banners/promo-beauty.jpg",
    alt: "White serum bottle with a gold collar on a soft neutral backdrop",
    eyebrow: "Beauty edit",
    title: "Skincare that keeps it simple",
    body: "Serums and moisturisers from ₹499",
    href: "/c/beauty",
    align: "right" as const,
  },
  {
    id: "sports",
    image: "/images/banners/promo-sports.jpg",
    alt: "Trail runner on a grassy ridge above misty mountains",
    eyebrow: "Sports and fitness",
    title: "Train for the hills",
    body: "Running shoes, mats and more from ₹899",
    href: "/c/sports",
    align: "left" as const,
  },
];

/* -------------------------------- Deals ------------------------------- */

export interface DealSlot {
  productId: string;
  kind: "deal_of_the_day" | "flash";
  startsAt: string;
  endsAt: string;
  /** share of the deal allocation already sold, from real allocation data */
  claimedPct: number;
}

const endOfToday = "2026-10-01T23:59:00+05:30";
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

export const DEALS_OF_THE_DAY: DealSlot[] = [
  { productId: "p-headphones-studio", kind: "deal_of_the_day", startsAt: "2026-10-01T00:00:00+05:30", endsAt: endOfToday, claimedPct: 64 },
  { productId: "p-airfryer-crisp", kind: "deal_of_the_day", startsAt: "2026-10-01T00:00:00+05:30", endsAt: endOfToday, claimedPct: 48 },
  { productId: "p-phone-nova", kind: "deal_of_the_day", startsAt: "2026-10-01T00:00:00+05:30", endsAt: endOfToday, claimedPct: 71 },
  { productId: "p-kurta-ethnic", kind: "deal_of_the_day", startsAt: "2026-10-01T00:00:00+05:30", endsAt: endOfToday, claimedPct: 39 },
  { productId: "p-sofa-oslo", kind: "deal_of_the_day", startsAt: "2026-10-01T00:00:00+05:30", endsAt: endOfToday, claimedPct: 22 },
];

const flash: [string, number, number][] = [
  ["p-earbuds-pods", 2.2, 82],
  ["p-watch-smart", 3.6, 57],
  ["p-backpack-urban", 5.1, 44],
  ["p-almonds-premium", 6.4, 68],
  ["p-speaker-boom", 7.8, 35],
  ["p-blender-pro", 9.2, 26],
  ["p-cushions-linen", 10.5, 18],
  ["p-serum-glow", 11.6, 52],
];

/** Blu Flash Deals: up to 12 hours, quantity capped (spec 10.16). */
export const FLASH_DEALS: DealSlot[] = flash.map(([productId, h, claimedPct]) => ({
  productId,
  kind: "flash",
  startsAt: hoursFromNow(h - 12),
  endsAt: hoursFromNow(h),
  claimedPct,
}));

export function dealFor(productId: string) {
  return DEALS_OF_THE_DAY.find((d) => d.productId === productId) ?? FLASH_DEALS.find((d) => d.productId === productId);
}

/* ---------------------------- Bank offers ----------------------------- */

export const BANK_OFFERS: BankOffer[] = [
  { id: "bo-kaveri", kind: "Bank offer", bank: "Kaveri Bank", title: "10% instant discount with Kaveri Bank credit cards", detail: "Up to ₹1,500 off on orders of ₹5,000 and above. Once per card during AltasGoods Big Days.", minOrder: 5000, percent: 10, cap: 1500, method: "card" },
  { id: "bo-sahyadri", kind: "Bank offer", bank: "Sahyadri Bank", title: "Flat ₹750 off with Sahyadri Bank debit card EMI", detail: "On orders of ₹15,000 and above, 6 month tenure or longer.", minOrder: 15000, flat: 750, method: "emi" },
  { id: "bo-upi", kind: "UPI offer", title: "Flat ₹150 off on UPI payments", detail: "On orders of ₹1,999 and above. Applied automatically when you pay by UPI.", minOrder: 1999, flat: 150, method: "upi" },
  { id: "bo-emi", kind: "No cost EMI", title: "No cost EMI for 3 and 6 months", detail: "On orders of ₹3,000 and above with Kaveri Bank and Coral Bank credit cards. Interest is given as an upfront discount.", minOrder: 3000, method: "emi" },
  { id: "bo-paylater", kind: "Cashback", title: "₹100 back as AltasGoods Credits on your first Pay Later order", detail: "Credited within 48 hours of delivery. Minimum order ₹999.", minOrder: 999, flat: 100, method: "paylater" },
  { id: "bo-coral", kind: "Partner offer", bank: "Coral Bank", title: "5% back as AltasGoods Credits with the AltasGoods Coral credit card", detail: "On card spends, up to ₹500 back a month.", minOrder: 0, percent: 5 },
];

export function bankOffersFor(price: number) {
  return BANK_OFFERS.filter((o) => price >= o.minOrder || o.kind === "Partner offer");
}

/** Instant bank discount for a payment method and order value, the best single offer (one per order). */
export function bestInstantOffer(total: number, method: BankOffer["method"]) {
  const eligible = BANK_OFFERS.filter((o) => o.method === method && total >= o.minOrder && (o.flat || o.percent) && o.kind !== "Cashback");
  const value = (o: BankOffer) => (o.flat ? o.flat : Math.min(Math.floor((total * (o.percent ?? 0)) / 100), o.cap ?? Infinity));
  return eligible.sort((a, b) => value(b) - value(a))[0];
}

export const NET_BANKING_BANKS = ["Kaveri Bank", "Sahyadri Bank", "Coral Bank", "Deccan National Bank", "Narmada Bank", "Vindhya Co-operative Bank"];

/* ------------------------------- Coupons ------------------------------ */

/** Customer-facing coupons. Bank-specific codes are surfaced as bank offers instead. */
export function storefrontCoupons(): CouponLite[] {
  return coupons
    .filter((c) => c.status === "active" && c.fundedBy !== "seller" && !/HDFC/i.test(c.code))
    .map((c) => ({
      code: c.code,
      description: c.description.replace(/(\d[\d,]*)/g, (m) => (/^\d/.test(m) && Number(m.replace(/,/g, "")) >= 100 ? `₹${m}` : m)),
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minOrder: c.minOrder,
      endsAt: c.endsAt,
      fundedBy: c.fundedBy === "bank" ? ("bank" as const) : ("store" as const),
      upiOnly: c.code.startsWith("UPI") || undefined,
      firstOrderOnly: c.code === "BLUFIRST" || undefined,
    }));
}

/* ------------------------------- Wallet ------------------------------- */

export const CUSTOMER_WALLET: WalletLite = {
  credits: 1299,
  giftCard: 500,
  payLaterLimit: 20000,
};

/* ------------------------------ Search ------------------------------- */

export const SORT_OPTIONS = [
  { key: "relevance", label: "Relevance" },
  { key: "popularity", label: "Popularity" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "newest", label: "Newest first" },
  { key: "discount", label: "Discount" },
  { key: "rating", label: "Customer rating" },
] as const;

export const PRICE_BANDS = [
  { key: "0-999", label: "Under ₹1,000", min: 0, max: 999 },
  { key: "1000-4999", label: "₹1,000 to ₹4,999", min: 1000, max: 4999 },
  { key: "5000-19999", label: "₹5,000 to ₹19,999", min: 5000, max: 19999 },
  { key: "20000-49999", label: "₹20,000 to ₹49,999", min: 20000, max: 49999 },
  { key: "50000-", label: "₹50,000 and above", min: 50000, max: Infinity },
];

export const DISCOUNT_BANDS = [10, 25, 40, 50];
export const RATING_OPTIONS = [4, 3];
export const DELIVERY_OPTIONS = [
  { key: "1", label: "Get it by tomorrow", days: 1 },
  { key: "2", label: "Get it in 2 days", days: 2 },
  { key: "3", label: "Get it in 3 days", days: 3 },
];

/* --------------------------- Merchandising --------------------------- */

export function isBrowsable(p: Product) {
  return p.listingStatus !== "suppressed";
}

export function inStock(p: Product) {
  return p.offers.some((o) => o.stock > 0);
}

export const bestSellers = (products: Product[]) =>
  products
    .filter((p) => isBrowsable(p) && inStock(p))
    .sort((a, b) => b.soldLast30d - a.soldLast30d)
    .slice(0, 12);

const recommendedKeys = ["laptop-air", "bag-leather", "coffee-maker", "lamp-arc", "perfume-noir", "shoes-running", "camera-mirrorless", "mugs-stone", "dress-summer", "keyboard-mech", "chair-lounge", "tea-assam"];
/** Hand-picked slugs first (when they are on sale), topped up with recent best sellers. */
export const recommendedForYou = (products: Product[]) => {
  const picked = recommendedKeys.map((k) => products.find((p) => p.slug === k)).filter((p): p is Product => !!p);
  const more = [...products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).filter((p) => !picked.includes(p));
  return [...picked, ...more].slice(0, 12);
};

export const BRAND_SPOTLIGHTS = [
  { brand: "Kestrel", tagline: "Laptops engineered in Bengaluru", productKey: "laptop-air", tone: "bg-[#eef1f6]" },
  { brand: "Auralis", tagline: "Sound, with nothing in the way", productKey: "headphones-studio", tone: "bg-[#f1efea]" },
  { brand: "Kiln & Co", tagline: "Handmade stoneware from Khurja", productKey: "vase-ceramic", tone: "bg-[#f4efe8]" },
  { brand: "Linen & Loom", tagline: "Everyday cotton, honestly made", productKey: "tee-classic", tone: "bg-[#eef0ee]" },
].map((b) => ({ ...b, slug: slugify(b.brand), image: `/images/products/${b.productKey}.jpg` }));

export function similarProducts(products: Product[], p: Product, n = 10) {
  const sameSub = products.filter((x) => x.id !== p.id && x.subcategory === p.subcategory && isBrowsable(x));
  const sameCat = products.filter((x) => x.id !== p.id && x.categoryId === p.categoryId && x.subcategory !== p.subcategory && isBrowsable(x));
  const rest = products.filter((x) => x.id !== p.id && x.categoryId !== p.categoryId && isBrowsable(x)).sort((a, b) => b.soldLast30d - a.soldLast30d);
  return [...sameSub, ...sameCat, ...rest].slice(0, n);
}

const FBT: Record<string, string[]> = {
  "phone-aurora": ["earbuds-pods", "watch-smart"],
  "phone-nova": ["earbuds-pods", "watch-smart"],
  "tablet-slate": ["keyboard-mech", "earbuds-pods"],
  "laptop-air": ["keyboard-mech", "backpack-urban"],
  "laptop-pro": ["monitor-ultra", "keyboard-mech"],
  "headphones-studio": ["earbuds-pods", "speaker-boom"],
  "coffee-maker": ["coffee-beans", "mugs-stone"],
  "coffee-beans": ["coffee-maker", "mugs-stone"],
  "mugs-stone": ["coffee-beans", "tea-assam"],
  "sofa-oslo": ["cushions-linen", "lamp-arc"],
  "tee-classic": ["jacket-denim", "sneakers-white"],
  "yoga-mat": ["dumbbells-hex", "shoes-running"],
  "serum-glow": ["cream-hydra", "lipstick-velvet"],
};

export function frequentlyBoughtWith(products: Product[], p: Product) {
  // suppressed listings cannot be ordered, so they never appear in (or anchor) a bundle; the curated pairs are filtered too
  if (!isBrowsable(p)) return [];
  const keys = FBT[p.slug];
  if (keys) return keys.map((k) => products.find((x) => x.slug === k)).filter((x): x is Product => !!x && isBrowsable(x));
  return products
    .filter((x) => x.id !== p.id && x.categoryId === p.categoryId && x.subcategory !== p.subcategory && isBrowsable(x) && inStock(x))
    .sort((a, b) => b.soldLast30d - a.soldLast30d)
    .slice(0, 2);
}

/** Brands with products in a category, most products first. */
export function topBrandsIn(products: Product[], categoryId: string) {
  const counts = new Map<string, { name: string; slug: string; n: number }>();
  for (const p of products.filter((x) => x.categoryId === categoryId)) {
    const c = counts.get(p.brandId) ?? { name: p.brandName, slug: p.brandSlug, n: 0 };
    c.n++;
    counts.set(p.brandId, c);
  }
  return [...counts.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, b]) => ({ id, name: b.name, slug: b.slug }));
}

/* ------------------------------ Ratings ------------------------------ */

/** Star distribution whose weighted mean equals the product rating (deterministic). */
export function ratingHistogram(avg: number, count: number) {
  const mean = (l: number) => {
    const w = [1, 2, 3, 4, 5].map((k) => Math.exp(l * k));
    const s = w.reduce((a, b) => a + b, 0);
    return w.reduce((a, x, i) => a + x * (i + 1), 0) / s;
  };
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mean(mid) < avg) lo = mid;
    else hi = mid;
  }
  const l = (lo + hi) / 2;
  const w = [5, 4, 3, 2, 1].map((k) => Math.exp(l * k));
  const s = w.reduce((a, b) => a + b, 0);
  return [5, 4, 3, 2, 1].map((stars, i) => ({ stars, count: Math.round((w[i]! / s) * count), pct: Math.round((w[i]! / s) * 100) }));
}

/** Aspect ratings shown under the histogram, by category. */
export function aspectRatings(p: Product) {
  const r = seeded(p.id.length * 31 + Math.round(p.rating * 10));
  const cat = p.categorySlug;
  const labels: Record<string, string[]> = {
    mobiles: ["Camera", "Battery", "Display", "Value for money"],
    electronics: ["Sound or performance", "Build quality", "Battery", "Value for money"],
    fashion: ["Fit", "Fabric quality", "Colour", "Value for money"],
    home: ["Quality", "Design", "Assembly", "Value for money"],
    appliances: ["Performance", "Ease of use", "Build quality", "Value for money"],
    beauty: ["Effectiveness", "Texture", "Fragrance", "Value for money"],
    grocery: ["Freshness", "Taste", "Packaging", "Value for money"],
    books: ["Print quality", "Story", "Binding", "Value for money"],
    sports: ["Grip", "Durability", "Comfort", "Value for money"],
    toys: ["Safety", "Fun", "Durability", "Value for money"],
  };
  return (labels[cat ?? ""] ?? labels.electronics!).map((label) => ({ label, value: Math.min(5, Math.round((p.rating - 0.3 + r() * 0.6) * 10) / 10) }));
}

/* -------------------------------- Q&A -------------------------------- */

export interface Answer {
  by: string;
  role: "seller" | "brand" | "buyer";
  body: string;
  at: string;
  helpful: number;
}
export interface Question {
  id: string;
  question: string;
  askedBy: string;
  askedAt: string;
  votes: number;
  answers: Answer[];
}

const qaByCat: Record<string, [string, string, Answer["role"]][]> = {
  mobiles: [
    ["Does it support dual 5G SIM?", "Yes, both SIM slots support 5G standalone and non-standalone networks used in India.", "brand"],
    ["Is the charger included in the box?", "Yes, a 67 W charger and a USB-C cable are included in the box.", "seller"],
    ["How is the battery life with heavy use?", "I get a full day with about 7 hours of screen time, including some gaming.", "buyer"],
  ],
  electronics: [
    ["Does it work with both Android and iPhone?", "Yes, it pairs over Bluetooth with any phone, tablet or laptop.", "brand"],
    ["Is there a GST invoice for business purchases?", "Yes, a GST invoice is generated for every order. Add your GSTIN at checkout to claim input tax credit.", "seller"],
    ["How long does it take to charge fully?", "About 1.5 hours from empty with a 20 W charger.", "buyer"],
  ],
  fashion: [
    ["Is the size true to fit?", "Yes, it is a regular fit. If you are between sizes, go one size up for a relaxed look.", "seller"],
    ["Does the colour fade after washing?", "Mine still looks new after a dozen washes on a cold cycle.", "buyer"],
    ["Can I exchange for a different size?", "Yes, size exchange is free within 10 days of delivery. Pickup and the new size are delivered in one visit.", "seller"],
  ],
  home: [
    ["Is assembly included?", "Free assembly is included in Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad and Chennai.", "seller"],
    ["How do I clean it?", "Wipe with a soft dry cloth. Avoid harsh chemicals on the finish.", "brand"],
    ["Is the colour the same as in the photos?", "Very close. It looks slightly warmer in daylight.", "buyer"],
  ],
  appliances: [
    ["What is the warranty period?", "2 years comprehensive warranty from the brand. Register on the brand site within 30 days.", "brand"],
    ["Is it safe for daily use?", "Yes, it has overload protection and auto shut-off.", "seller"],
    ["Does it come with a recipe book?", "Yes, a small recipe booklet is included in the box.", "buyer"],
  ],
  beauty: [
    ["Is it suitable for sensitive skin?", "It is dermatologically tested and fragrance free. Do a patch test first if your skin is very sensitive.", "brand"],
    ["What is the expiry date on current stock?", "Current stock expires in September 2028.", "seller"],
    ["How long does one bottle last?", "About two months with daily use.", "buyer"],
  ],
  grocery: [
    ["What is the roast date?", "We ship stock roasted within the last 3 weeks. The roast date is printed on the pouch.", "seller"],
    ["Is the pouch resealable?", "Yes, it has a zip lock and a one-way valve.", "buyer"],
    ["Is this FSSAI certified?", "Yes, the FSSAI licence number is printed on the pack.", "seller"],
  ],
  books: [
    ["Is this the unabridged edition?", "Yes, it is the complete and unabridged text.", "seller"],
    ["Is the paper quality good?", "Thick, acid-free paper. Lovely to read.", "buyer"],
    ["Does it come gift wrapped?", "Gift wrap can be added at checkout for selected sellers.", "seller"],
  ],
  sports: [
    ["Is it suitable for beginners?", "Yes, it is designed for everyday training at any level.", "brand"],
    ["Does it smell when new?", "A mild smell for the first day, it goes away quickly.", "buyer"],
    ["What is the warranty?", "6 months against manufacturing defects.", "seller"],
  ],
  toys: [
    ["Is it safe for a 1 year old?", "Yes, it is BIS certified and uses non-toxic, child safe finishes.", "brand"],
    ["Are the pieces large enough to avoid choking?", "Yes, every piece is larger than the small parts safety limit.", "seller"],
    ["Does it come in a storage box?", "Yes, it comes in a sturdy cotton drawstring bag.", "buyer"],
  ],
};

const askers = ["Pranav K.", "Shalini M.", "Abdul R.", "Neha G.", "Joseph T.", "Kriti S.", "Manoj V.", "Divya P."];
const buyerNames = ["Verified buyer, Pune", "Verified buyer, Kochi", "Verified buyer, Jaipur", "Verified buyer, Delhi"];

export function questionsFor(p: Product): Question[] {
  const r = seeded(p.title.length * 13 + 7);
  const cat = p.categorySlug || "electronics";
  const brand = p.brandName || "Brand";
  return (qaByCat[cat] ?? qaByCat.electronics!).map(([q, a, role], i) => ({
    id: `q-${p.slug}-${i}`,
    question: q,
    askedBy: askers[Math.floor(r() * askers.length)]!,
    askedAt: addDays(NOW, -Math.floor(10 + r() * 120)).toISOString(),
    votes: Math.floor(4 + r() * 80),
    answers: [
      {
        by: role === "brand" ? `${brand} (brand)` : role === "seller" ? "AltasGoods" : buyerNames[i % buyerNames.length]!,
        role,
        body: a,
        at: addDays(NOW, -Math.floor(2 + r() * 9)).toISOString(),
        helpful: Math.floor(r() * 60),
      },
    ],
  }));
}

/* --------------------------- Policy and legal -------------------------- */

export function returnPolicyFor(p: Product, windowDays?: number) {
  const cat = p.categorySlug;
  const sub = p.subcategory;
  if (cat === "fashion") return { days: 10, short: "10 day return or exchange", detail: "Return, replacement or size and colour exchange within 10 days of delivery. Tags intact and unworn." };
  if (cat === "home" && sub === "Furniture") return { days: 10, short: "10 day return or replacement", detail: "Returnable within 10 days if installed by AltasGoods or the brand installer." };
  if (cat === "home") return { days: 7, short: "7 day return or replacement", detail: "Return or replacement within 7 days of delivery." };
  if (cat === "mobiles") return { days: 7, short: "7 day replacement", detail: "Replacement within 7 days for defective, damaged or wrong items. Reset the device and remove locks before pickup." };
  if (cat === "beauty") return { days: 7, short: "7 day return if unopened", detail: "Refund if unopened and sealed. Replacement if damaged or wrong." };
  if (cat === "grocery") return { days: 2, short: "2 day refund on damage", detail: "Refund for damaged, expired or wrong items reported within 2 days." };
  return { days: windowDays ?? 7, short: `${windowDays ?? 7} day replacement`, detail: "Replacement within 7 days for defective, damaged or wrong items." };
}

export function warrantyFor(p: Product) {
  const spec = p.specs.flatMap((s) => s.items).find((i) => i.label === "Warranty")?.value;
  if (spec) return `${spec} warranty`;
  const cat = p.categorySlug;
  if (cat === "mobiles") return "1 year brand warranty on the device, 6 months on accessories";
  if (cat === "electronics") return "1 year brand warranty";
  if (cat === "appliances") return "2 years comprehensive brand warranty";
  return "No warranty applicable";
}

function netQuantity(title: string) {
  const m = title.match(/(\d+(?:\.\d+)?)\s?(g|kg|ml|L)\b/);
  if (m) return `${m[1]} ${m[2]}`;
  const set = title.match(/(?:Set|Pack) of (\d+)/i);
  if (set) return `${set[1]} N`;
  const pcs = title.match(/(\d+) Pieces/i);
  if (pcs) return `${pcs[1]} N`;
  return "1 N";
}

/** Legal Metrology declarations, shown in full on every PDP. */
export function legalDeclarations(p: Product) {
  const brand = p.brandName;
  const brandSlug = slugify(brand);
  return [
    { label: "Generic name", value: p.subcategory.replace(/s$/, "") },
    { label: "Net quantity", value: netQuantity(p.title) },
    { label: "M.R.P.", value: `₹${p.mrp.toLocaleString("en-IN")} (inclusive of all taxes)` },
    { label: "Country of origin", value: p.specs.flatMap((s) => s.items).find((i) => i.label === "Country of origin")?.value ?? "India" },
    { label: "Manufacturer", value: `${brand} India Private Limited, Plot 42, KIADB Industrial Area, Bengaluru, Karnataka 562114` },
    { label: "Packer", value: `${COMPANY.legalName}, ${COMPANY.registeredOffice}` },
    { label: "Importer", value: "Not applicable (made in India)" },
    { label: "Consumer care", value: `care@${brandSlug}.in, 1800 120 ${String(3000 + brand.length * 37).slice(0, 4)}` },
  ];
}

const sellerStreets = ["Unit 4, Commerce House, Station Road", "Plot 18, Industrial Area Phase 1", "B-27, Trade Centre, Ring Road", "12, Warehouse Lane, Industrial Estate", "G-14, Market Complex, Main Road", "Survey 88, Logistics Park Road", "C-56, Business Park, Sector 2", "Door 41, Godown Street", "7, Merchant Arcade, Park Road"];

export function sellerAddress(s: Seller) {
  const i = Math.abs([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % sellerStreets.length;
  return `${sellerStreets[i]}, ${s.city}, ${s.state} ${s.pincode}`;
}

export function sellerGrievance(s: Seller) {
  return { name: s.ownerName, email: `grievance@${s.slug}.in`, phone: s.phone };
}

/* ------------------------------- Help -------------------------------- */

export const HELP_TOPICS = [
  { icon: "Package", title: "Orders and delivery", body: "Track, change address, delivery OTP and missed deliveries", href: "/account/orders" },
  { icon: "Undo2", title: "Returns and refunds", body: "Return windows, pickup, refund timelines and status", href: "/policies/returns" },
  { icon: "XCircle", title: "Cancellations", body: "Cancel before dispatch for a full refund, no fees", href: "/policies/cancellation" },
  { icon: "CreditCard", title: "Payments and EMI", body: "UPI, cards, EMI, Pay Later and failed payments", href: "/policies/payments" },
  { icon: "Wallet", title: "AltasGoods Credits and gift cards", body: "Balance, expiry and using credits at checkout", href: "/policies/credits" },
  { icon: "ShieldCheck", title: "AltasGoods Guarantee", body: "Item not received or not as described", href: "/policies/guarantee" },
  { icon: "UserRound", title: "Account and privacy", body: "Login, mobile number, data and consent", href: "/policies/account-security" },
];

export const HELP_FAQS: { id: string; group: string; q: string; a: string }[] = [
  { id: "cancellation", group: "Cancellations", q: "How do I cancel an order?", a: "Open Your orders, choose the item and select Cancel. Items can be cancelled any time before they are shipped, with a full refund and no cancellation fee. After shipping you can request cancellation and the parcel will return to the seller, or simply refuse it at the door." },
  { id: "returns", group: "Returns and refunds", q: "What is the return window for my item?", a: "Return windows are counted from the delivery date: 10 days for fashion and furniture, 7 days for home, electronics, mobiles (replacement), books, toys and sports, 7 days for beauty if unopened, and 2 days for grocery. The exact window is shown on the product page and in your order." },
  { id: "refund-time", group: "Returns and refunds", q: "When will I get my refund?", a: "Refunds to AltasGoods Credits arrive within 2 hours. UPI refunds take 1 to 2 business days, cards and net banking 3 to 5 business days. Cash on delivery orders are refunded to AltasGoods Credits or your bank account via IMPS or UPI." },
  { id: "payments", group: "Payments", q: "Money was debited but my order failed. What happens now?", a: "If a payment fails after your money is debited, AltasGoods reverses it automatically within 1 business day as required by RBI rules. You do not need to raise a request. If you do not see the reversal, contact us with the transaction reference." },
  { id: "cod", group: "Payments", q: "Is there an extra charge for cash on delivery?", a: "No. AltasGoods never charges a fee for cash on delivery, a payment handling fee or a platform fee. Pay on delivery is available for orders up to ₹50,000 on serviceable pincodes, and you can pay by cash or UPI QR at the door." },
  { id: "credits", group: "AltasGoods Credits", q: "Do AltasGoods Credits expire?", a: "Credits from refunds never expire and can be moved back to your bank on request. Goodwill credits expire after 1 year. Gift card balances keep the gift card's 1 year validity." },
  { id: "guarantee", group: "AltasGoods Guarantee", q: "What does the AltasGoods Guarantee cover?", a: "If an item was not delivered, arrived materially different from its listing, or a refund was not issued, contact the seller first. If it is not resolved in 48 hours, file an AltasGoods Guarantee claim from the order page within 90 days of the latest delivery date." },
  { id: "account", group: "Account and privacy", q: "How do I download or delete my data?", a: "Go to Account, then Privacy and data. You can download a copy of your data, withdraw consent for promotional messages or request deletion of your account. Open orders or refunds must be completed before deletion." },
];

/* --------------------------- Sell on AltasGoods --------------------------- */

export const SELL_STEPS = [
  { title: "Register in 10 minutes", body: "Mobile number, GSTIN (or PAN for GST exempt categories like books), bank account and pickup address." },
  { title: "List your products", body: "Match an existing BSIN or create a new listing with photos, price, stock and the legal declarations we check for you." },
  { title: "Receive orders", body: "Orders confirm automatically. Pack before your dispatch-by date and AltasGoods Logistics picks up from your door." },
  { title: "Get paid fast", body: "Payouts run every Monday, Wednesday and Friday, as soon as delivery plus 2 days for Platinum sellers." },
];

export const SELL_PROGRAMS = [
  { name: "AltasGoods Fulfilled", icon: "Warehouse", body: "Send stock to our fulfilment centres. We store, pack, ship and handle returns. Automatically AltasGoods Assured." },
  { name: "AltasGoods Ship", icon: "Truck", body: "You pack at your warehouse, AltasGoods Logistics picks up and delivers to 19,000+ pincodes." },
  { name: "Self Ship", icon: "PackageCheck", body: "Use your own courier and upload tracking. Prepaid orders only, ideal for niche or local sellers." },
];

/* ------------------------- Client snapshots --------------------------- */

const LARGE_SUBS = new Set(["Furniture", "Large Appliances", "Air Conditioners", "Washing Machines", "Cycling"]);

export function toCartProduct(p: Product): CartProduct {
  const o = p.offers.find((x) => x.sellerId === p.featuredSellerId) ?? p.offers[0]!;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brandName,
    image: p.image,
    category: p.categoryName,
    categorySlug: p.categorySlug,
    subcategory: p.subcategory,
    rating: p.rating,
    ratingCount: p.ratingCount,
    large: LARGE_SUBS.has(p.subcategory),
    defaultVariant: p.variants.length ? p.variants.map((v) => v.values.find((x) => x.available)?.label).filter(Boolean).join(", ") : undefined,
    offer: {
      price: o.price,
      mrp: o.mrp,
      stock: o.stock,
      deliveryDays: o.deliveryDays,
      codAvailable: o.codAvailable,
      returnWindowDays: returnPolicyFor(p, o.returnWindowDays).days,
      assured: p.assured,
    },
  };
}

/** Whole catalogue as plain data for the cart and checkout. */
export function cartCatalog(products: Product[]) {
  return Object.fromEntries(products.map((p) => [p.id, toCartProduct(p)]));
}

/* --------------------------- Navigation data -------------------------- */

export function navCategories(categories: Category[], products: Product[]): NavCategory[] {
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    short: c.name.split(" & ")[0]!,
    icon: c.icon,
    image: c.image ?? "",
    subs: (c.children ?? []).map((s) => ({ name: s.name, slug: s.slug })),
    brands: topBrandsIn(products, c.id).slice(0, 6).map((b) => ({ name: b.name, slug: b.slug })),
    featured: products
      .filter((p) => p.categoryId === c.id && isBrowsable(p))
      .sort((a, b) => b.soldLast30d - a.soldLast30d)
      .slice(0, 2)
      .map((p) => ({ slug: p.slug, title: p.title.split(/[,(]/)[0]!.trim(), image: p.image, price: p.price })),
  }));
}

/** Autocomplete corpus for the header search (small, plain data). */
export function searchSuggestions(categories: Category[], brands: Brand[], products: Product[]): Suggestion[] {
  return [
    ...categories.flatMap((c) => [
      { label: c.name, href: `/c/${c.slug}`, kind: "category" as const },
      ...(c.children ?? []).map((s) => ({ label: s.name, href: `/s?q=${encodeURIComponent(s.name)}&cat=${c.slug}`, kind: "category" as const, context: c.name })),
    ]),
    ...brands.map((b) => ({ label: b.name, href: `/s?brand=${b.slug}`, kind: "brand" as const })),
    ...products.filter(isBrowsable).map((p) => ({ label: p.title.split(/[,(]/)[0]!.trim(), href: `/p/${p.slug}`, kind: "product" as const, context: p.categoryName })),
  ];
}

