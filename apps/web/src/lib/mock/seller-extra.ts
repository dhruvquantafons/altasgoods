/**
 * Seller Hub mock data for the signed-in seller (Apex Retail, CURRENT_SELLER_ID).
 * Enriches the shared order lines, listings and settlements with the fields the
 * Seller Hub screens need (channels, SLAs, BSINs, inventory, inbound shipments,
 * ads, promotions, ledger, tax documents, health, messages, cases, settings).
 * Everything is deterministic and anchored to NOW so server and client agree.
 */
import type { Coupon, Order, Review, Settlement } from "../types";
import type { ListingStatus, OrderStatus, PaymentMethod, ReturnStatus, StatusMeta, Tone } from "../status";
import { addDays, NOW, seeded } from "../utils";
import { categories, getBrand, getCategory, getProduct, products } from "./catalog";
import { orders, returns, sellerOrderLines } from "./orders";
import { CURRENT_SELLER_ID, getSeller, sellers } from "./people";
import { campaigns, coupons, reviews } from "./engagement";
import { sellerDaily } from "./analytics";
import {
  COMMISSION_FREE_UPTO,
  FIXED_FEE_SLABS,
  GST_ON_FEES_PERCENT,
  PAYOUT_HOLD_DAYS,
  settlementsForSeller,
  TCS_PERCENT,
  TDS_PERCENT,
  TIER_FIXED_FEE_MODIFIER,
  TIER_SHIPPING_DISCOUNT,
  feesForLine,
} from "./finance";

/* ------------------------------------------------------------------ */
/* Identity and helpers                                                */
/* ------------------------------------------------------------------ */

export const SELLER = getSeller(CURRENT_SELLER_ID)!;
export type SellerTier = "Bronze" | "Silver" | "Gold" | "Platinum";

function hashOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ALNUM = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function code(seed: string, len: number, chars = ALNUM) {
  const r = seeded(hashOf(seed));
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(r() * chars.length)];
  return out;
}

function digits(seed: string, len: number) {
  return code(seed, len, "0123456789");
}

/** BluBuy Standard Identification Number: "B0" plus 8 alphanumerics, one per sellable variant. */
export function bsinFor(productId: string) {
  return `B0${code(productId, 8)}`;
}

export function sellerSku(productId: string) {
  const p = getProduct(productId);
  const brand = (p && getBrand(p.brandId)?.name) || "GEN";
  return `APX-${brand.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-${digits(`${productId}:sku`, 4)}`;
}

/** NOW shifted by a (possibly fractional) number of days. addDays only moves whole calendar days. */
function fromNow(days: number) {
  return new Date(NOW.getTime() + days * 86400_000);
}

const IST = 330 * 60_000;

function istParts(d: Date | string) {
  const x = new Date(new Date(d).getTime() + IST);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours() + x.getUTCMinutes() / 60, dow: x.getUTCDay() };
}

/** A Date at an IST wall-clock time on the IST calendar day of `d` (plus `dayOffset`). */
export function istAt(d: Date | string, hours: number, minutes = 0, dayOffset = 0) {
  const p = istParts(d);
  return new Date(Date.UTC(p.y, p.m, p.d + dayOffset, hours, minutes) - IST);
}

function addBusinessDays(d: Date, n: number) {
  let x = new Date(d);
  let left = n;
  while (left > 0) {
    x = addDays(x, 1);
    if (istParts(x).dow !== 0) left--;
  }
  return x;
}

/** Next payout run (Monday, Wednesday or Friday) on or after the given date. */
export function nextPayoutRun(d: Date | string) {
  let x = istAt(d, 11, 0);
  if (x.getTime() < new Date(d).getTime()) x = addDays(x, 1);
  while (![1, 3, 5].includes(istParts(x).dow)) x = addDays(x, 1);
  return x;
}

/** "7 h 30 min", "1 d 7 h", "45 min". */
export function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

export interface Sla {
  label: string;
  tone: Tone;
  overdue: boolean;
}

/** Countdown to a deadline relative to NOW: neutral, warning under `warnHours`, danger once overdue. */
export function slaFor(dueAt: string | Date, warnHours = 8): Sla {
  const ms = new Date(dueAt).getTime() - NOW.getTime();
  if (ms < 0) return { label: `Overdue by ${formatDuration(ms)}`, tone: "danger", overdue: true };
  return { label: `${formatDuration(ms)} left`, tone: ms < warnHours * 3600_000 ? "warning" : "neutral", overdue: false };
}

export function maskName(name: string) {
  const [f, l] = name.split(" ");
  return l ? `${f} ${l[0]}.` : (f ?? name);
}

export function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 2)}XXX XX${d.slice(-3)}`;
}

/* ------------------------------------------------------------------ */
/* Fulfilment channels                                                 */
/* ------------------------------------------------------------------ */

export type Channel = "fulfilled" | "ship" | "flex" | "self";

export const CHANNELS: Record<Channel, { label: string; description: string }> = {
  fulfilled: { label: "BluBuy Fulfilled", description: "Stored, packed and shipped by a BluBuy fulfilment centre" },
  ship: { label: "BluBuy Ship", description: "You pack, BluBuy Logistics picks up and delivers" },
  flex: { label: "BluBuy Flex", description: "Your warehouse on BluBuy systems, BluBuy picks up" },
  self: { label: "Self Ship", description: "You ship with your own courier and upload tracking" },
};

export const FULFILMENT_CENTRES = [
  { code: "BOM-FC-02", name: "Bhiwandi Fulfilment Centre", city: "Mumbai" },
  { code: "BLR-FC-01", name: "Hoskote Fulfilment Centre", city: "Bengaluru" },
  { code: "DEL-FC-01", name: "Farukhnagar Fulfilment Centre", city: "Gurugram" },
];

/** Handling time in business days per Apex listing (0 means same-day dispatch). */
const HANDLING: Record<string, number> = {
  "p-cookware-pan": 0,
  "p-earbuds-pods": 0,
  "p-headphones-studio": 0,
  "p-speaker-boom": 0,
  "p-laptop-pro": 2,
  "p-airfryer-crisp": 2,
};

export function handlingDaysFor(productId: string) {
  return HANDLING[productId] ?? 1;
}

/* ------------------------------------------------------------------ */
/* Order lines                                                         */
/* ------------------------------------------------------------------ */

export type OrderStage = "new" | "to_pack" | "ready" | "shipped" | "delivered" | "cancelled" | "returns";

export const ORDER_STAGES: { key: OrderStage; label: string; statuses: OrderStatus[]; hint: string }[] = [
  { key: "new", label: "New", statuses: ["placed"], hint: "Confirm new orders to start the dispatch clock." },
  { key: "to_pack", label: "To pack", statuses: ["confirmed"], hint: "Generate the invoice and label, then pack the item." },
  { key: "ready", label: "Ready to ship", statuses: ["packed", "ready_to_ship"], hint: "Mark ready to ship, add to a manifest and hand over at pickup." },
  { key: "shipped", label: "Shipped", statuses: ["shipped", "in_transit", "out_for_delivery", "undelivered"], hint: "With BluBuy Logistics, on the way to the customer." },
  { key: "delivered", label: "Delivered", statuses: ["delivered"], hint: "Delivered and inside the return window." },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "pending_payment"], hint: "Cancelled before shipment by the customer, you or the system." },
  { key: "returns", label: "Returns", statuses: ["return_requested", "returned", "rto_in_transit", "returned_to_seller"], hint: "Customer returns and shipments returning to origin." },
];

export function stageOf(status: OrderStatus): OrderStage {
  return ORDER_STAGES.find((s) => s.statuses.includes(status))?.key ?? "new";
}

export interface SellerLine {
  lineId: string;
  orderId: string;
  itemId: string;
  productId: string;
  title: string;
  image: string;
  variant?: string;
  sku: string;
  bsin: string;
  quantity: number;
  price: number;
  mrp: number;
  total: number;
  status: OrderStatus;
  stage: OrderStage;
  channel: Channel;
  fc?: string;
  placedAt: string;
  handlingDays: number;
  acceptBy?: string;
  dispatchBy?: string;
  pickupSlot?: string;
  awb?: string;
  manifestId?: string;
  buyer: string;
  buyerPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  payment: PaymentMethod;
  cod: boolean;
  promisedBy: string;
  deliveredAt?: string;
  returnWindowEnds?: string;
  cancelledBy?: "Customer" | "Seller" | "System";
  cancelReason?: string;
}

const PRE_SHIP: OrderStatus[] = ["placed", "confirmed", "packed", "ready_to_ship"];
const LABELLED: OrderStatus[] = ["packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "undelivered", "delivered", "return_requested", "returned", "rto_in_transit", "returned_to_seller"];

function buildLine(order: Order, item: Order["items"][number]): SellerLine {
  const k = Number(item.id.split("-")[1] ?? 0);
  const h = hashOf(order.id + item.id);
  const p = getProduct(item.productId);
  const offer = p?.offers.find((o) => o.sellerId === CURRENT_SELLER_ID);
  const preShip = PRE_SHIP.includes(item.status);
  const channel: Channel = offer?.fulfilledBy === "seller" ? "ship" : h % 10 < (preShip ? 2 : 4) ? "fulfilled" : "ship";
  const handlingDays = handlingDaysFor(item.productId);
  const placed = new Date(order.placedAt);
  // orders confirmed before the 2 PM cutoff count as day 0 for handling time
  const day0 = istParts(placed).h < 14 ? placed : istAt(placed, 9, 0, 1);
  const dispatchBy = istAt(addBusinessDays(day0, handlingDays), 18, 0);
  const sameDay = istParts(dispatchBy).d === istParts(NOW).d && istParts(dispatchBy).m === istParts(NOW).m;
  const acceptBy = sameDay ? istAt(NOW, 14, 0) : new Date(placed.getTime() + 24 * 3600_000);
  const lineId = `${order.id}-${String(k + 1).padStart(2, "0")}`;
  const cancelledBy = item.status === "cancelled" ? (h % 10 < 7 ? "Customer" : h % 10 < 9 ? "Seller" : "System") : undefined;
  const cancelReason =
    cancelledBy === "Customer"
      ? ["Ordered by mistake", "Found a better price elsewhere", "Delivery date too late"][h % 3]
      : cancelledBy === "Seller"
        ? "Item out of stock at the pickup location"
        : cancelledBy === "System"
          ? "Not handed over before the auto-cancel deadline"
          : undefined;
  const fc = channel === "fulfilled" ? (["BOM-FC-02", "BLR-FC-01", "DEL-FC-01"] as const)[h % 3] : undefined;
  const delivered = order.deliveredAt;
  return {
    lineId,
    orderId: order.id,
    itemId: item.id,
    productId: item.productId,
    title: item.title,
    image: item.image,
    variant: item.variant,
    sku: sellerSku(item.productId),
    bsin: bsinFor(item.productId),
    quantity: item.quantity,
    price: item.price,
    mrp: item.mrp,
    total: item.price * item.quantity,
    status: item.status,
    stage: stageOf(item.status),
    channel,
    fc,
    placedAt: order.placedAt,
    handlingDays,
    acceptBy: item.status === "placed" ? acceptBy.toISOString() : undefined,
    dispatchBy: preShip ? dispatchBy.toISOString() : undefined,
    pickupSlot: preShip && channel === "ship" ? dispatchBy.toISOString() : undefined,
    awb: LABELLED.includes(item.status) ? `BBL${digits(lineId, 10)}` : undefined,
    manifestId: item.status === "ready_to_ship" && channel === "ship" ? `MF-BOM-${order.id.slice(3, 9)}-0${(h % 3) + 1}` : undefined,
    buyer: maskName(order.customerName),
    buyerPhone: maskPhone(order.address.phone),
    addressLine: order.address.line1.replace(/^[^,]+/, (m) => m.replace(/\w/g, "*")),
    city: order.address.city,
    state: order.address.state,
    pincode: order.address.pincode,
    payment: order.payment.method,
    cod: order.payment.method === "cod",
    promisedBy: order.promisedBy,
    deliveredAt: delivered,
    returnWindowEnds: delivered ? addDays(delivered, offer?.returnWindowDays ?? 7).toISOString() : undefined,
    cancelledBy,
    cancelReason,
  };
}

/** Every order line that belongs to the signed-in seller, newest first. */
export const sellerLines: SellerLine[] = sellerOrderLines(CURRENT_SELLER_ID).map(({ order, item }) => buildLine(order, item));

export function getSellerOrder(orderId: string) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const lines = sellerLines.filter((l) => l.orderId === orderId);
  if (!lines.length) return undefined;
  return { order, lines };
}

/** Settlement estimate for a line: fees, taxes and the date it becomes payable. */
export function settlementEstimate(line: SellerLine) {
  const fees = feesForLine(line.productId, line.price, line.quantity, line.cod, SELLER.tier);
  const deductions = fees.reduce((a, f) => a + f.amount, 0);
  const holdDays = PAYOUT_HOLD_DAYS[SELLER.tier];
  const base = line.deliveredAt ? new Date(line.deliveredAt) : new Date(line.promisedBy);
  const eligibleOn = addDays(base, holdDays);
  return { fees, deductions, net: line.total + deductions, holdDays, eligibleOn: eligibleOn.toISOString(), payoutOn: nextPayoutRun(eligibleOn).toISOString(), estimated: !line.deliveredAt };
}

/* ------------------------------------------------------------------ */
/* Listings                                                            */
/* ------------------------------------------------------------------ */

const HSN: Record<string, [string, number]> = {
  Smartphones: ["8517", 18],
  Tablets: ["8471", 18],
  Laptops: ["8471", 18],
  Headphones: ["8518", 18],
  Speakers: ["8518", 18],
  Wearables: ["8517", 18],
  Cameras: ["8525", 18],
  Monitors: ["8528", 18],
  "Computer Accessories": ["8471", 18],
  Bags: ["4202", 18],
  Cookware: ["7323", 12],
  "Kitchen Appliances": ["8516", 18],
  Lighting: ["9405", 12],
  Watches: ["9102", 18],
  "Kitchen and Dining": ["7013", 12],
};

export interface SellerListing {
  id: string;
  productId: string;
  title: string;
  image: string;
  brand: string;
  category: string;
  categoryId: string;
  subcategory: string;
  bsin: string;
  sku: string;
  price: number;
  mrp: number;
  stock: number;
  channel: Channel;
  handlingDays: number;
  status: ListingStatus;
  /** 0 to 100 listing quality score */
  quality: number;
  issues: string[];
  featured: "won" | "lost" | "ineligible";
  featuredPct: number;
  featuredPrice: number;
  lowestPrice?: number;
  lowestSeller?: string;
  offers: number;
  sessions30d: number;
  units30d: number;
  sales30d: number;
  conversion: number;
  hsn: string;
  gst: number;
  weightKg: number;
  dims: [number, number, number];
  updatedAt: string;
  /** why the listing is in its current state, shown for non-live statuses */
  note?: string;
  bullets: string[];
}

const QUALITY_TIPS = [
  "Add 2 more images (7 recommended, 5 present)",
  "Write 5 bullet points (3 present)",
  "Add search keywords for regional names",
  "Add a lifestyle image showing the product in use",
  "Add A+ content to lift conversion",
  "Fill optional attribute: warranty type",
];

const STATUS_OVERRIDE: Record<string, { status: ListingStatus; note: string; issues?: string[] }> = {
  "p-speaker-boom": { status: "suppressed", note: "Main image has a non-white background. Replace it to restore search visibility.", issues: ["Main image background is not pure white", "Image under 1000 px on the longest side"] },
  "p-monitor-ultra": { status: "suppressed", note: "Required attribute missing after the Monitors template update: refresh rate (Hz).", issues: ["Missing required attribute: refresh rate"] },
};

const EXTRA_LISTINGS: { productId: string; status: ListingStatus; note: string; stock: number; channel: Channel }[] = [
  { productId: "p-lamp-arc", status: "draft", note: "Draft saved 2 days ago. Add images and compliance details to submit.", stock: 60, channel: "ship" },
  { productId: "p-keyboard-mech", status: "pending_review", note: "Submitted for QC on 30 Sept. Keystone is a gated brand: authorisation letter under review.", stock: 80, channel: "ship" },
  { productId: "p-watch-analog", status: "rejected", note: "Rejected: Watches is a restricted category. Upload a brand authorisation letter from Meridian and resubmit.", stock: 25, channel: "ship" },
  { productId: "p-coffee-maker", status: "inactive", note: "Paused by you on 12 Sept. Resume to make it buyable again.", stock: 34, channel: "ship" },
];

function listingFrom(productId: string, override?: { status: ListingStatus; note: string; stock: number; channel: Channel }): SellerListing {
  const p = getProduct(productId)!;
  const r = seeded(hashOf(`${productId}:listing`));
  const offer = p.offers.find((o) => o.sellerId === CURRENT_SELLER_ID);
  const price = offer?.price ?? p.price;
  const stock = override ? override.stock : (offer?.stock ?? 0);
  const fix = STATUS_OVERRIDE[productId];
  const status: ListingStatus = override ? override.status : fix ? fix.status : stock === 0 ? "out_of_stock" : "live";
  const others = p.offers.filter((o) => o.sellerId !== CURRENT_SELLER_ID);
  const lowest = others.slice().sort((a, b) => a.price - b.price)[0];
  const eligible = status === "live";
  const won = !override && p.featuredSellerId === CURRENT_SELLER_ID && eligible;
  const featured: SellerListing["featured"] = !eligible ? "ineligible" : won ? "won" : "lost";
  const featuredOffer = p.offers.find((o) => o.sellerId === p.featuredSellerId);
  const conversion = Math.round((3 + r() * 6) * 10) / 10;
  const units30d = override ? 0 : Math.round(p.soldLast30d * (won ? 0.68 + r() * 0.2 : 0.08 + r() * 0.12));
  const sessions30d = override ? 0 : Math.round((units30d / conversion) * 100);
  const qualityBase = fix ? 38 + Math.round(r() * 14) : override?.status === "draft" ? 46 : 64 + Math.round(r() * 33);
  const issues = fix?.issues ?? QUALITY_TIPS.filter((_, i) => (hashOf(productId) >> i) % 3 === 0).slice(0, qualityBase > 90 ? 0 : qualityBase > 80 ? 1 : 3);
  const [hsn, gst] = HSN[p.subcategory] ?? ["8543", 18];
  const heavy = ["Laptops", "Monitors", "Kitchen Appliances"].includes(p.subcategory);
  return {
    id: p.id,
    productId: p.id,
    title: p.title,
    image: p.image,
    brand: getBrand(p.brandId)?.name ?? "",
    category: getCategory(p.categoryId)?.name ?? "",
    categoryId: p.categoryId,
    subcategory: p.subcategory,
    bsin: bsinFor(p.id),
    sku: sellerSku(p.id),
    price,
    mrp: p.mrp,
    stock,
    channel: override ? override.channel : offer?.fulfilledBy === "seller" ? "ship" : "fulfilled",
    handlingDays: handlingDaysFor(p.id),
    status,
    quality: qualityBase,
    issues,
    featured,
    featuredPct: featured === "won" ? 74 + Math.round(r() * 22) : featured === "lost" ? 3 + Math.round(r() * 22) : 0,
    featuredPrice: featuredOffer?.price ?? price,
    lowestPrice: lowest?.price,
    lowestSeller: lowest ? sellers.find((s) => s.id === lowest.sellerId)?.displayName : undefined,
    offers: p.offers.length + (override ? 1 : 0),
    sessions30d,
    units30d,
    sales30d: units30d * price,
    conversion,
    hsn,
    gst,
    weightKg: heavy ? Math.round((2 + r() * 4) * 10) / 10 : Math.round((0.3 + r() * 0.9) * 10) / 10,
    dims: heavy ? [52, 38, 14] : [24, 20, 10],
    updatedAt: fromNow(-Math.round(r() * 20) - (override ? 2 : 0)).toISOString(),
    note: override?.note ?? fix?.note,
    bullets: p.highlights.slice(0, override?.status === "draft" ? 2 : 5),
  };
}

const apexProductIds = products.filter((p) => p.offers.some((o) => o.sellerId === CURRENT_SELLER_ID)).map((p) => p.id);

export const sellerListings: SellerListing[] = [
  ...apexProductIds.map((id) => listingFrom(id)),
  ...EXTRA_LISTINGS.map((x) => listingFrom(x.productId, x)),
];

export function getListing(id: string) {
  return sellerListings.find((l) => l.id === id || l.productId === id);
}

export const LISTING_TABS: { key: string; label: string; statuses: ListingStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "live", label: "Live", statuses: ["live"] },
  { key: "inactive", label: "Inactive", statuses: ["inactive"] },
  { key: "out_of_stock", label: "Out of stock", statuses: ["out_of_stock"] },
  { key: "suppressed", label: "Suppressed", statuses: ["suppressed", "blocked"] },
  { key: "pending_review", label: "In review", statuses: ["pending_review"] },
  { key: "draft", label: "Drafts", statuses: ["draft"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

/** Plain rate card values a client fee estimator can use (no functions, no Infinity). */
export const RATE_CARD = {
  commissionFreeUpto: COMMISSION_FREE_UPTO,
  categoryCommission: Object.fromEntries(categories.map((c) => [c.id, c.commission])) as Record<string, number>,
  fixedSlabs: FIXED_FEE_SLABS.map((s) => ({ upTo: Number.isFinite(s.upTo) ? s.upTo : 1e12, fee: s.fee })),
  tierModifier: TIER_FIXED_FEE_MODIFIER[SELLER.tier],
  shippingDiscount: TIER_SHIPPING_DISCOUNT[SELLER.tier],
  gst: GST_ON_FEES_PERCENT,
  tcs: TCS_PERCENT,
  tds: TDS_PERCENT,
  holdDays: PAYOUT_HOLD_DAYS[SELLER.tier],
  tier: SELLER.tier,
};
export type RateCard = typeof RATE_CARD;

/* ------------------------------------------------------------------ */
/* Returns, RTO and SafeClaims                                         */
/* ------------------------------------------------------------------ */

export type Grade = "SELLABLE" | "CUSTOMER_DAMAGED" | "CARRIER_DAMAGED" | "DEFECTIVE" | "WRONG_ITEM" | "MISSING_ITEM" | "EMPTY_BOX";

export const GRADES: { key: Grade; label: string; description: string; claimable: boolean }[] = [
  { key: "SELLABLE", label: "Sellable", description: "Unused, all parts present, can go back to stock", claimable: false },
  { key: "CUSTOMER_DAMAGED", label: "Damaged by customer", description: "Used, scratched or broken after delivery", claimable: true },
  { key: "CARRIER_DAMAGED", label: "Damaged in transit", description: "Package or product damaged by the carrier", claimable: true },
  { key: "DEFECTIVE", label: "Defective", description: "Manufacturing defect, not caused by handling", claimable: false },
  { key: "WRONG_ITEM", label: "Wrong item returned", description: "A different product came back", claimable: true },
  { key: "MISSING_ITEM", label: "Parts missing", description: "Accessories or components missing", claimable: true },
  { key: "EMPTY_BOX", label: "Empty box", description: "Package arrived without the product", claimable: true },
];

export interface SellerReturn {
  id: string;
  kind: "return" | "rto";
  orderId: string;
  productId: string;
  title: string;
  image: string;
  buyer: string;
  reason: string;
  resolution: "Refund" | "Replacement";
  status: ReturnStatus;
  /** RTO only: order item status while it heads back */
  rtoStatus?: "rto_in_transit" | "returned_to_seller";
  amount: number;
  requestedAt: string;
  updatedAt: string;
  channel: Channel;
  outOfPolicy: boolean;
  reviewBy?: string;
  pickupOn?: string;
  expectedBy?: string;
  receivedAt?: string;
  awb: string;
  doorstepQc: { label: string; passed: boolean }[];
  grade?: Grade;
  claimId?: string;
  claimBy?: string;
  ndr?: { at: string; reason: string }[];
  sellerFault: boolean;
}

const SELLER_FAULT = ["Item damaged in transit", "Received a different item", "Product not working", "Missing parts or accessories", "Quality not as expected"];

function doorstep(seed: string, pass = true) {
  const checks = ["Product matches the order (brand, model, colour)", "Serial number or IMEI matches the invoice", "All accessories and manuals present", "No physical damage or signs of use", "Original packaging with tags"];
  const fail = pass ? -1 : hashOf(seed) % checks.length;
  return checks.map((label, i) => ({ label, passed: i !== fail }));
}

const sharedApexReturns: SellerReturn[] = returns
  .filter((r) => r.sellerId === CURRENT_SELLER_ID)
  .map((raw) => {
    // a few shared requests are dated after NOW; clamp so SLAs read sensibly
    const cap = NOW.getTime() - 3 * 3600_000;
    const r = new Date(raw.requestedAt).getTime() > cap ? { ...raw, requestedAt: new Date(cap - (hashOf(raw.id) % 20) * 3600_000).toISOString(), updatedAt: new Date(cap).toISOString() } : raw;
    const line = sellerLines.find((l) => l.orderId === r.orderId);
    const outOfPolicy = r.status === "requested" && hashOf(r.id) % 2 === 0;
    const received = ["received", "qc_passed", "qc_failed", "refund_initiated", "completed"].includes(r.status);
    return {
      id: r.id,
      kind: "return" as const,
      orderId: r.orderId,
      productId: line?.productId ?? "",
      title: r.productTitle,
      image: r.image,
      buyer: maskName(r.customerName),
      reason: r.reason,
      resolution: r.type === "replacement" ? ("Replacement" as const) : ("Refund" as const),
      status: r.status,
      amount: r.amount,
      requestedAt: r.requestedAt,
      updatedAt: r.updatedAt,
      channel: line?.channel ?? "ship",
      outOfPolicy,
      reviewBy: outOfPolicy ? new Date(new Date(r.requestedAt).getTime() + 48 * 3600_000).toISOString() : undefined,
      pickupOn: ["pickup_scheduled", "approved"].includes(r.status) ? istAt(NOW, 11, 0, 1).toISOString() : addDays(r.requestedAt, 1).toISOString(),
      expectedBy: addDays(r.requestedAt, 5).toISOString(),
      receivedAt: received ? addDays(r.requestedAt, 4).toISOString() : undefined,
      awb: `BBR${digits(r.id, 10)}`,
      doorstepQc: doorstep(r.id, r.status !== "qc_failed"),
      grade: r.status === "qc_failed" ? ("MISSING_ITEM" as Grade) : received ? ("SELLABLE" as Grade) : undefined,
      claimId: undefined,
      claimBy: r.status === "qc_failed" ? addDays(r.requestedAt, 18).toISOString() : undefined,
      sellerFault: SELLER_FAULT.includes(r.reason),
    };
  });

function extraReturn(
  id: string,
  productId: string,
  orderIdx: number,
  status: ReturnStatus,
  reason: string,
  daysAgo: number,
  opts: Partial<SellerReturn> = {},
): SellerReturn {
  const p = getProduct(productId)!;
  const offer = p.offers.find((o) => o.sellerId === CURRENT_SELLER_ID);
  const delivered = sellerLines.filter((l) => l.stage === "delivered");
  const line = delivered[orderIdx % delivered.length]!;
  const requestedAt = fromNow(-daysAgo).toISOString();
  const received = ["received", "qc_passed", "qc_failed", "completed"].includes(status);
  return {
    id,
    kind: "return",
    orderId: line.orderId,
    productId,
    title: p.title,
    image: p.image,
    buyer: line.buyer,
    reason,
    resolution: "Refund",
    status,
    amount: offer?.price ?? p.price,
    requestedAt,
    updatedAt: addDays(requestedAt, Math.min(daysAgo, 4)).toISOString(),
    channel: offer?.fulfilledBy === "seller" ? "ship" : "fulfilled",
    outOfPolicy: false,
    pickupOn: addDays(requestedAt, 1).toISOString(),
    expectedBy: addDays(requestedAt, 5).toISOString(),
    receivedAt: received ? fromNow(-1).toISOString() : undefined,
    awb: `BBR${digits(id, 10)}`,
    doorstepQc: doorstep(id),
    claimBy: received ? fromNow(13).toISOString() : undefined,
    sellerFault: SELLER_FAULT.includes(reason),
    ...opts,
  };
}

const extraReturns: SellerReturn[] = [
  extraReturn("RT-30711", "p-earbuds-pods", 2, "received", "Product not working", 6, { receivedAt: istAt(NOW, 9, 40).toISOString() }),
  extraReturn("RT-30698", "p-headphones-studio", 5, "received", "Received a different item", 7, { receivedAt: istAt(NOW, 9, 10, -1).toISOString(), channel: "ship" }),
  extraReturn("RT-30684", "p-cookware-pan", 8, "picked_up", "Quality not as expected", 3),
  extraReturn("RT-30652", "p-speaker-boom", 11, "qc_failed", "No longer needed", 12, { grade: "CUSTOMER_DAMAGED", claimId: "SC-26091804", claimBy: fromNow(4).toISOString(), receivedAt: fromNow(-10).toISOString(), channel: "ship" }),
  extraReturn("RT-30640", "p-airfryer-crisp", 14, "completed", "Colour differs from image", 16, { grade: "SELLABLE", receivedAt: fromNow(-12).toISOString() }),
  extraReturn("RT-30633", "p-laptop-air", 17, "qc_passed", "No longer needed", 9, { grade: "SELLABLE", receivedAt: fromNow(-4).toISOString() }),
];

function rto(id: string, productId: string, orderIdx: number, status: "rto_in_transit" | "returned_to_seller", daysAgo: number, reasons: string[]): SellerReturn {
  const base = extraReturn(id, productId, orderIdx, status === "returned_to_seller" ? "received" : "picked_up", "Delivery failed after 3 attempts", daysAgo);
  return {
    ...base,
    kind: "rto",
    rtoStatus: status,
    reason: reasons.at(-1) ?? "Customer not available",
    channel: "ship",
    resolution: "Refund",
    awb: `BBL${digits(id, 10)}`,
    doorstepQc: [],
    receivedAt: status === "returned_to_seller" ? istAt(NOW, 10, 5).toISOString() : undefined,
    claimBy: status === "returned_to_seller" ? fromNow(14).toISOString() : undefined,
    ndr: reasons.map((reason, i) => ({ at: fromNow(-daysAgo + i).toISOString(), reason })),
    sellerFault: false,
  };
}

const rtoItems: SellerReturn[] = [
  rto("RTO-26092711", "p-airfryer-crisp", 3, "rto_in_transit", 5, ["Customer not available", "Customer not available", "Refused by customer"]),
  rto("RTO-26092504", "p-earbuds-pods", 6, "rto_in_transit", 6, ["Incomplete address", "Incomplete address", "Customer not reachable on phone"]),
  rto("RTO-26092219", "p-headphones-studio", 9, "returned_to_seller", 9, ["COD amount not ready", "Customer asked to reschedule", "Refused by customer"]),
];

export const sellerReturns: SellerReturn[] = [...extraReturns, ...sharedApexReturns, ...rtoItems].sort(
  (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
);

export function getSellerReturn(id: string) {
  return sellerReturns.find((r) => r.id === id);
}

export type ClaimStatus = "submitted" | "under_review" | "info_requested" | "approved" | "partially_approved" | "rejected" | "appealed" | "reimbursed";

export const CLAIM_STATUS: Record<ClaimStatus, StatusMeta> = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "brand" },
  info_requested: { label: "Info requested", tone: "warning", description: "Add evidence within 7 days or the claim closes" },
  approved: { label: "Approved", tone: "success" },
  partially_approved: { label: "Partly approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  appealed: { label: "Appealed", tone: "info" },
  reimbursed: { label: "Reimbursed", tone: "success" },
};

export interface SafeClaim {
  id: string;
  returnId: string;
  orderId: string;
  title: string;
  image: string;
  grade: Grade;
  claimed: number;
  approved?: number;
  status: ClaimStatus;
  filedAt: string;
  decisionBy?: string;
  note: string;
}

export const safeClaims: SafeClaim[] = [
  { id: "SC-26091804", returnId: "RT-30652", orderId: sellerReturns.find((r) => r.id === "RT-30652")!.orderId, title: "Pulse Boom 2 Portable Bluetooth Speaker, IP67 Waterproof", image: "/images/products/speaker-boom.jpg", grade: "CUSTOMER_DAMAGED", claimed: 3499, status: "info_requested", filedAt: fromNow(-8).toISOString(), decisionBy: fromNow(2).toISOString(), note: "Add the unboxing video recorded at receipt. Photos alone do not show the cracked grille clearly." },
  { id: "SC-26090911", returnId: "RT-30588", orderId: "BB-260902-55120", title: "Auralis Studio ANC Wireless Over-Ear Headphones", image: "/images/products/headphones-studio.jpg", grade: "WRONG_ITEM", claimed: 12999, status: "under_review", filedAt: fromNow(-4).toISOString(), decisionBy: fromNow(3).toISOString(), note: "A different, older model came back. Serial number does not match the invoice." },
  { id: "SC-26082702", returnId: "RT-30501", orderId: "BB-260818-20871", title: "Kestrel Air 14 Thin and Light Laptop (Core Ultra 7, 16 GB, 1 TB SSD)", image: "/images/products/laptop-air.jpg", grade: "EMPTY_BOX", claimed: 84990, approved: 84990, status: "reimbursed", filedAt: fromNow(-33).toISOString(), note: "Reimbursed in payout ST-APEX-260907 as a SafeClaim reimbursement line." },
  { id: "SC-26081520", returnId: "RT-30466", orderId: "BB-260806-11934", title: "Voltix Crisp 12 L Oven Toaster Grill, Retro Finish", image: "/images/products/airfryer-crisp.jpg", grade: "CARRIER_DAMAGED", claimed: 5999, approved: 4200, status: "partially_approved", filedAt: fromNow(-45).toISOString(), note: "Approved at 70%: outer carton intact, glass door damage partly attributable to packaging." },
  { id: "SC-26080308", returnId: "RT-30419", orderId: "BB-260724-90412", title: "Auralis Pods Pro True Wireless Earbuds with ANC", image: "/images/products/earbuds-pods.jpg", grade: "MISSING_ITEM", claimed: 4999, status: "rejected", filedAt: fromNow(-58).toISOString(), note: "Rejected: doorstep QC recorded the charging case as present. Appeal window closed." },
];

/* ------------------------------------------------------------------ */
/* Inventory and inbound shipments                                     */
/* ------------------------------------------------------------------ */

export type InboundStatus = "draft" | "confirmed" | "appointment_booked" | "in_transit" | "arrived" | "receiving" | "received" | "closed" | "cancelled";

export const INBOUND_STATUS: Record<InboundStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info", description: "Plan accepted, print box labels" },
  appointment_booked: { label: "Appointment booked", tone: "info" },
  in_transit: { label: "In transit", tone: "brand" },
  arrived: { label: "Arrived at dock", tone: "brand" },
  receiving: { label: "Receiving", tone: "brand" },
  received: { label: "Received", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export interface InboundShipment {
  id: string;
  name: string;
  fc: (typeof FULFILMENT_CENTRES)[number];
  status: InboundStatus;
  createdAt: string;
  appointmentAt?: string;
  boxes: number;
  unitsSent: number;
  unitsReceived: number;
  damaged: number;
  shortage: number;
  lines: { productId: string; qty: number }[];
}

const fcOf = (code: string) => FULFILMENT_CENTRES.find((f) => f.code === code)!;

export const inboundShipments: InboundShipment[] = (
  [
    ["IN-261001-01", "Speaker restock for Diwali", "BOM-FC-02", "draft", 0, undefined, [["p-speaker-boom", 150]]],
    ["IN-260930-02", "Cameras and creator laptops", "BLR-FC-01", "appointment_booked", 1, 2, [["p-camera-mirrorless", 25], ["p-laptop-pro", 20]]],
    ["IN-260929-01", "Audio top-up, Big Days week 2", "BOM-FC-02", "in_transit", 2, 1, [["p-headphones-studio", 120], ["p-earbuds-pods", 200]]],
    ["IN-260926-02", "Laptops and monitors", "DEL-FC-01", "receiving", 5, -1, [["p-laptop-air", 40], ["p-monitor-ultra", 30]]],
    ["IN-260920-01", "Kitchen appliances", "BLR-FC-01", "received", 11, -8, [["p-airfryer-crisp", 150], ["p-cookware-pan", 100]]],
    ["IN-260914-03", "Big Days pre-stock, audio", "BOM-FC-02", "closed", 17, -13, [["p-headphones-studio", 300], ["p-earbuds-pods", 400], ["p-speaker-boom", 120]]],
    ["IN-260902-02", "Tablets (replaced by IN-260914-03)", "DEL-FC-01", "cancelled", 29, undefined, [["p-tablet-slate", 60]]],
  ] as [string, string, string, InboundStatus, number, number | undefined, [string, number][]][]
).map(([id, name, fc, status, ageDays, apptOffset, lines]) => {
  const unitsSent = lines.reduce((a, [, q]) => a + q, 0);
  const done = status === "received" || status === "closed";
  const damaged = done ? Math.max(1, Math.round(unitsSent * 0.004)) : status === "receiving" ? 1 : 0;
  const shortage = status === "received" ? 2 : 0;
  return {
    id,
    name,
    fc: fcOf(fc),
    status,
    createdAt: fromNow(-ageDays).toISOString(),
    appointmentAt: apptOffset === undefined ? undefined : istAt(NOW, 10, 30, apptOffset).toISOString(),
    boxes: Math.ceil(unitsSent / 12),
    unitsSent,
    unitsReceived: done ? unitsSent - damaged - shortage : status === "receiving" ? Math.round(unitsSent * 0.6) : 0,
    damaged,
    shortage,
    lines: lines.map(([productId, qty]) => ({ productId, qty })),
  };
});

export interface InventoryRow {
  listingId: string;
  title: string;
  image: string;
  sku: string;
  bsin: string;
  channel: Channel;
  status: ListingStatus;
  fc?: string;
  sellerAvailable: number;
  sellerReserved: number;
  fcAvailable: number;
  fcInbound: number;
  fcReserved: number;
  fcUnfulfillable: number;
  /** units per day, last 30 days */
  velocity: number;
  daysOfCover: number;
  restockQty: number;
  restockBy?: string;
  ageing: [number, number, number, number];
}

export const inventoryRows: InventoryRow[] = sellerListings
  .filter((l) => ["live", "out_of_stock", "suppressed", "inactive"].includes(l.status))
  .map((l) => {
    const r = seeded(hashOf(`${l.id}:inv`));
    const openQty = sellerLines.filter((x) => x.productId === l.productId && PRE_SHIP.includes(x.status)).reduce((a, x) => a + x.quantity, 0);
    const inbound = inboundShipments
      .filter((s) => ["confirmed", "appointment_booked", "in_transit", "arrived", "receiving"].includes(s.status))
      .flatMap((s) => s.lines)
      .filter((x) => x.productId === l.productId)
      .reduce((a, x) => a + x.qty, 0);
    const fulfilled = l.channel === "fulfilled";
    const fcAvailable = fulfilled ? l.stock : 0;
    const sellerAvailable = fulfilled ? (l.stock > 0 ? Math.round(r() * 24) : 0) : l.stock;
    const velocity = Math.max(0.2, Math.round((l.units30d / 30) * 10) / 10);
    const available = fcAvailable + sellerAvailable;
    const daysOfCover = Math.round(available / velocity);
    const target = Math.round(velocity * 45);
    const restockQty = daysOfCover < 21 && l.status !== "inactive" ? Math.max(0, Math.ceil((target - available - inbound) / 10) * 10) : 0;
    const total = available + (fulfilled ? Math.round(r() * 8) : 0);
    const a1 = Math.round(total * (0.7 + r() * 0.2));
    const a2 = Math.round((total - a1) * 0.7);
    const a3 = Math.max(0, total - a1 - a2);
    return {
      listingId: l.id,
      title: l.title,
      image: l.image,
      sku: l.sku,
      bsin: l.bsin,
      channel: l.channel,
      status: l.status,
      fc: fulfilled ? (["BOM-FC-02", "BLR-FC-01", "DEL-FC-01"] as const)[hashOf(l.id) % 3] : undefined,
      sellerAvailable,
      sellerReserved: fulfilled ? 0 : openQty,
      fcAvailable,
      fcInbound: inbound,
      fcReserved: fulfilled ? openQty + Math.round(r() * 6) : 0,
      fcUnfulfillable: fulfilled ? Math.round(r() * 5) : 0,
      velocity,
      daysOfCover,
      restockQty,
      restockBy: restockQty ? fromNow(Math.max(1, Math.min(10, daysOfCover - 7))).toISOString() : undefined,
      ageing: [a1, a2, a3, 0],
    };
  });

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export interface PricingRule {
  id: string;
  name: string;
  strategy: string;
  detail: string;
  listings: string[];
  status: "active" | "paused";
  floor: string;
  lastRun: string;
  changes7d: number;
}

export const pricingRules: PricingRule[] = [
  { id: "pr-1", name: "Match featured offer, audio", strategy: "Match the featured offer", detail: "Match the featured offer price, never below your floor", listings: ["p-headphones-studio", "p-earbuds-pods", "p-speaker-boom"], status: "active", floor: "Floor: 30-day low minus 3%", lastRun: fromNow(-0.05).toISOString(), changes7d: 14 },
  { id: "pr-2", name: "Beat lowest by ₹50, tablets and wearables", strategy: "Beat the lowest offer", detail: "Price ₹50 below the lowest competing offer", listings: ["p-tablet-slate", "p-watch-smart"], status: "active", floor: "Floor: ₹7,499 and ₹23,999", lastRun: fromNow(-0.12).toISOString(), changes7d: 6 },
  { id: "pr-3", name: "Big Days price guard", strategy: "Stay within a band", detail: "Keep prices between the 30-day low and M.R.P. while the event price lock is on", listings: ["p-laptop-air", "p-laptop-pro", "p-camera-mirrorless", "p-monitor-ultra"], status: "active", floor: "Band: 30-day low to M.R.P.", lastRun: fromNow(-0.3).toISOString(), changes7d: 0 },
  { id: "pr-4", name: "Kitchen clearance", strategy: "Beat the lowest offer", detail: "Price ₹20 below the lowest offer until stock falls under 50 units", listings: ["p-blender-pro", "p-cookware-pan"], status: "paused", floor: "Floor: cost plus 8%", lastRun: fromNow(-9).toISOString(), changes7d: 0 },
];

export const pricingActivity = [
  { at: fromNow(-0.05).toISOString(), listingId: "p-headphones-studio", from: 13249, to: 12999, rule: "Match featured offer, audio" },
  { at: fromNow(-0.12).toISOString(), listingId: "p-watch-smart", from: 8549, to: 8488, rule: "Beat lowest by ₹50, tablets and wearables" },
  { at: fromNow(-0.4).toISOString(), listingId: "p-earbuds-pods", from: 5199, to: 4999, rule: "Match featured offer, audio" },
  { at: fromNow(-1.2).toISOString(), listingId: "p-tablet-slate", from: 25999, to: 25841, rule: "Beat lowest by ₹50, tablets and wearables" },
  { at: fromNow(-2.6).toISOString(), listingId: "p-speaker-boom", from: 3599, to: 3499, rule: "Match featured offer, audio" },
];

export interface PriceAlert {
  listingId: string;
  kind: "high" | "low";
  title: string;
  detail: string;
  reference: number;
}

export const priceAlerts: PriceAlert[] = [
  ...sellerListings
    .filter((l) => l.featured === "lost" && l.price > l.featuredPrice * 1.03)
    .map((l) => ({
      listingId: l.id,
      kind: "high" as const,
      title: `${Math.round(((l.price - l.featuredPrice) / l.featuredPrice) * 1000) / 10}% above the featured offer`,
      detail: "Offers priced well above the featured offer rarely win it. Consider matching or turning on an automated rule.",
      reference: l.featuredPrice,
    })),
  { listingId: "p-airfryer-crisp", kind: "low", title: "18% below its 30-day median", detail: "₹5,999 is unusually low against a 30-day median of ₹7,299. Check for a pricing error before peak Big Days traffic.", reference: 7299 },
];

/* ------------------------------------------------------------------ */
/* Advertising                                                         */
/* ------------------------------------------------------------------ */

const TARGETING: Record<string, string> = {
  sponsored_products: "Keyword",
  sponsored_brands: "Keyword",
  display: "Audience",
};

export const AD_TYPE_LABEL: Record<string, string> = {
  sponsored_products: "Sponsored Products",
  sponsored_brands: "Sponsored Brands",
  display: "Sponsored Display",
};

/** Attributed sales are modelled from spend with a realistic ROAS (3x to 9x) for the seller view. */
export const adCampaigns = campaigns
  .map((c) => ({ ...c, sales: Math.round(c.spend * (3.2 + (hashOf(c.id) % 60) / 10)) }))
  .map((c, i) => ({
  ...c,
  typeLabel: AD_TYPE_LABEL[c.type] ?? c.type,
  targeting: i === 2 ? "Automatic" : (TARGETING[c.type] ?? "Keyword"),
  products: [6, 3, 2, 8, 4, 3, 5, 6][i] ?? 3,
  endsAt: c.status === "ended" ? fromNow(-4).toISOString() : i < 2 ? "2026-10-05T23:59:00+05:30" : undefined,
  acos: c.sales ? (c.spend / c.sales) * 100 : 0,
  roas: c.spend ? c.sales / c.spend : 0,
  ctr: c.impressions ? (c.clicks / c.impressions) * 100 : 0,
  cpc: c.clicks ? c.spend / c.clicks : 0,
}));

export type AdCampaign = (typeof adCampaigns)[number];

/** Daily ads performance for completed days (oldest first), 28 days. */
export const adDaily = sellerDaily.slice(-29, -1).map((d, i) => {
  const r = seeded(hashOf(`${d.date}:ads`));
  const spend = d.adSpend;
  const roas = 4.4 + r() * 2.2;
  const cpc = 7 + r() * 2.5;
  const clicks = Math.round(spend / cpc);
  return {
    date: d.date,
    spend,
    sales: Math.round(spend * roas),
    clicks,
    impressions: Math.round(clicks / (0.009 + r() * 0.004)),
    orders: Math.round(clicks * (0.05 + r() * 0.03)),
    i,
  };
});

export interface AdKeyword {
  id: string;
  campaignId: string;
  keyword: string;
  match: "Exact" | "Phrase" | "Broad";
  bid: number;
  suggested: [number, number];
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  status: "active" | "paused";
}

const KEYWORDS: Record<string, [string, AdKeyword["match"], number][]> = {
  "cm-1": [["noise cancelling headphones", "Phrase", 14], ["auralis studio", "Exact", 9], ["wireless headphones", "Broad", 11], ["anc headphones under 15000", "Phrase", 12], ["over ear headphones", "Broad", 8], ["bluetooth headphones", "Broad", 7]],
  "cm-2": [["thin and light laptop", "Phrase", 22], ["kestrel air 14", "Exact", 16], ["laptop 16gb ram 1tb ssd", "Broad", 18], ["creator laptop rtx", "Phrase", 24]],
  "cm-3": [["air fryer oven", "Broad", 9], ["otg oven 12 litre", "Phrase", 8], ["voltix crisp", "Exact", 6]],
  "cm-4": [["kestrel laptop", "Exact", 19], ["premium laptop brand", "Broad", 15]],
  "cm-7": [["kitchen essentials", "Broad", 5], ["mixer grinder 1000w", "Phrase", 7]],
};

export const adKeywords: AdKeyword[] = Object.entries(KEYWORDS).flatMap(([campaignId, kws]) => {
  const c = adCampaigns.find((x) => x.id === campaignId)!;
  const weights = kws.map((_, i) => 1 / (i + 1.4));
  const wsum = weights.reduce((a, w) => a + w, 0);
  return kws.map(([keyword, match, bid], i) => {
    const w = weights[i]! / wsum;
    const r = seeded(hashOf(keyword));
    const sales = Math.round(c.sales * w * (0.8 + r() * 0.4));
    return {
      id: `kw-${campaignId}-${i}`,
      campaignId,
      keyword,
      match,
      bid,
      suggested: [Math.round(bid * 0.8), Math.round(bid * 1.35)] as [number, number],
      impressions: Math.round(c.impressions * w),
      clicks: Math.round(c.clicks * w),
      spend: Math.round(c.spend * w),
      sales,
      orders: Math.round(c.orders * w),
      status: (c.status === "ended" || (i === kws.length - 1 && kws.length > 3) ? "paused" : "active") as AdKeyword["status"],
    };
  });
});

export const AD_WALLET = {
  balance: 48250,
  autoRecharge: { enabled: true, below: 10000, amount: 50000 },
  deductFromPayouts: false,
  lastRecharge: { amount: 100000, at: fromNow(-6).toISOString(), method: "Net banking, HDFC Bank" },
};

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

export type PromoStatus = "draft" | "submitted" | "approved" | "rejected" | "live" | "paused" | "ended" | "cancelled";

export const PROMO_STATUS: Record<PromoStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  approved: { label: "Approved", tone: "brand" },
  rejected: { label: "Rejected", tone: "danger" },
  live: { label: "Live", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export interface SaleEventInfo {
  id: string;
  name: string;
  status: "live" | "nominations_open" | "upcoming" | "ended";
  startsAt: string;
  endsAt: string;
  nominateBy?: string;
  priceLockAt?: string;
  minDiscount: number;
  requirements: string[];
  nominated: number;
  approved: number;
  sales?: number;
  units?: number;
}

export const saleEvents: SaleEventInfo[] = [
  { id: "ev-bigdays", name: "BluBuy Big Days", status: "live", startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", priceLockAt: "2026-09-24T00:00:00+05:30", minDiscount: 20, requirements: ["At least 20% below the 30-day low price", "Stock of 50 units or more in a BluBuy fulfilment centre", "Seller Health of 600 or more"], nominated: 9, approved: 7, sales: 38_40_000, units: 612 },
  { id: "ev-diwali", name: "Diwali Dhamaka", status: "nominations_open", startsAt: "2026-10-28T00:00:00+05:30", endsAt: "2026-11-09T23:59:00+05:30", nominateBy: "2026-10-10T23:59:00+05:30", priceLockAt: "2026-10-26T00:00:00+05:30", minDiscount: 15, requirements: ["At least 15% below the 30-day low price", "Price locked from 26 Oct; you may only lower it", "Up to 50 products per seller"], nominated: 4, approved: 0 },
  { id: "ev-plusday", name: "BluBuy Plus Day", status: "ended", startsAt: "2026-07-14T00:00:00+05:30", endsAt: "2026-07-15T23:59:00+05:30", minDiscount: 20, requirements: ["Members-only pricing", "BluBuy Fulfilled stock only"], nominated: 6, approved: 6, sales: 21_15_000, units: 288 },
];

export interface DealNomination {
  id: string;
  eventId: string;
  listingId: string;
  low30: number;
  dealPrice: number;
  units: number;
  status: PromoStatus;
  note?: string;
}

export const dealNominations: DealNomination[] = [
  { id: "dn-1", eventId: "ev-diwali", listingId: "p-headphones-studio", low30: 12999, dealPrice: 10499, units: 300, status: "submitted" },
  { id: "dn-2", eventId: "ev-diwali", listingId: "p-airfryer-crisp", low30: 5999, dealPrice: 4999, units: 200, status: "submitted" },
  { id: "dn-3", eventId: "ev-diwali", listingId: "p-laptop-air", low30: 84990, dealPrice: 71990, units: 60, status: "draft" },
  { id: "dn-4", eventId: "ev-diwali", listingId: "p-cookware-pan", low30: 2199, dealPrice: 1949, units: 150, status: "rejected", note: "Deal price must be at least 15% below the 30-day low (₹1,869 or less)." },
  { id: "dn-5", eventId: "ev-bigdays", listingId: "p-earbuds-pods", low30: 5999, dealPrice: 4799, units: 400, status: "live" },
  { id: "dn-6", eventId: "ev-bigdays", listingId: "p-laptop-pro", low30: 159990, dealPrice: 127990, units: 40, status: "live" },
];

export interface FlashDeal {
  id: string;
  listingId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  dealPrice: number;
  units: number;
  claimed: number;
  status: PromoStatus;
}

export const flashDeals: FlashDeal[] = [
  { id: "fd-1", listingId: "p-earbuds-pods", startsAt: istAt(NOW, 8, 0).toISOString(), endsAt: istAt(NOW, 20, 0).toISOString(), price: 4999, dealPrice: 3999, units: 250, claimed: 171, status: "live" },
  { id: "fd-2", listingId: "p-speaker-boom", startsAt: istAt(NOW, 12, 0, 2).toISOString(), endsAt: istAt(NOW, 23, 59, 2).toISOString(), price: 3499, dealPrice: 2799, units: 150, claimed: 0, status: "approved" },
  { id: "fd-3", listingId: "p-cookware-pan", startsAt: istAt(NOW, 9, 0, 4).toISOString(), endsAt: istAt(NOW, 21, 0, 4).toISOString(), price: 2199, dealPrice: 1799, units: 120, claimed: 0, status: "submitted" },
  { id: "fd-4", listingId: "p-headphones-studio", startsAt: istAt(NOW, 10, 0, -3).toISOString(), endsAt: istAt(NOW, 22, 0, -3).toISOString(), price: 12999, dealPrice: 9999, units: 200, claimed: 200, status: "ended" },
];

export interface SellerCoupon extends Coupon {
  budget: number;
  spent: number;
  sales: number;
  redemptions: number;
  audience: string;
  perCustomer: number;
}

const couponPerf: Record<string, [number, number, string]> = {
  APEXAUDIO: [150000, 7_42_000, "All customers"],
  APEXKITCHEN: [50000, 1_04_500, "All customers"],
};

export const sellerCoupons: SellerCoupon[] = [
  ...coupons
    .filter((c) => c.fundedBy === "seller")
    .map((c) => {
      const [budget, sales, audience] = couponPerf[c.code] ?? [50000, 0, "All customers"];
      return { ...c, budget, spent: c.type === "flat" ? c.usage * c.value : Math.round(sales * (c.value / 100) * 0.92), sales, redemptions: c.usage, audience, perCustomer: 1 };
    }),
  { id: "cp-apx-3", code: "APEXLAPTOP5", description: "Apex Retail: 5% off Kestrel laptops for BluBuy Plus members", type: "percent", value: 5, maxDiscount: 5000, minOrder: 49999, usage: 0, limit: 300, startsAt: "2026-10-28T00:00:00+05:30", endsAt: "2026-11-09T23:59:00+05:30", status: "scheduled", fundedBy: "seller", budget: 300000, spent: 0, sales: 0, redemptions: 0, audience: "BluBuy Plus members", perCustomer: 1 },
  { id: "cp-apx-4", code: "APEXNEW200", description: "Apex Retail: 200 off for customers new to the store", type: "flat", value: 200, minOrder: 1999, usage: 412, limit: 500, startsAt: "2026-08-01T00:00:00+05:30", endsAt: "2026-08-31T23:59:00+05:30", status: "expired", fundedBy: "seller", budget: 100000, spent: 82400, sales: 9_86_300, redemptions: 412, audience: "New to your store", perCustomer: 1 },
];

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface ProductReportRow {
  listingId: string;
  title: string;
  image: string;
  sku: string;
  bsin: string;
  sessions: number;
  pageViews: number;
  unitSessionPct: number;
  units: number;
  sales: number;
  featuredPct: number;
}

/** Completed days only (today is partial), oldest first. */
export function completedDays(days: number) {
  return sellerDaily.slice(0, -1).slice(-days);
}

/** Business report by listing for the last `days` completed days. The remainder rolls up as other listings. */
export function productReport(days: number) {
  const window = completedDays(days);
  const totals = {
    pageViews: window.reduce((a, d) => a + d.pageViews, 0),
    units: window.reduce((a, d) => a + d.units, 0),
    sales: window.reduce((a, d) => a + d.sales, 0),
  };
  const live = sellerListings.filter((l) => l.units30d > 0);
  const wsum = live.reduce((a, l) => a + l.sales30d, 0) || 1;
  const share = 0.58;
  const rows: ProductReportRow[] = live
    .map((l) => {
      const w = (l.sales30d / wsum) * share;
      const r = seeded(hashOf(`${l.id}:${days}`));
      const pageViews = Math.round(totals.pageViews * w * (0.9 + r() * 0.2));
      const sessions = Math.round(pageViews * 0.74);
      const sales = Math.round(totals.sales * w);
      const units = Math.max(1, Math.round(sales / l.price));
      return {
        listingId: l.id,
        title: l.title,
        image: l.image,
        sku: l.sku,
        bsin: l.bsin,
        sessions,
        pageViews,
        unitSessionPct: sessions ? (units / sessions) * 100 : 0,
        units,
        sales,
        featuredPct: l.featuredPct,
      };
    })
    .sort((a, b) => b.sales - a.sales);
  const listed = rows.reduce((a, r) => ({ pageViews: a.pageViews + r.pageViews, sales: a.sales + r.sales, units: a.units + r.units }), { pageViews: 0, sales: 0, units: 0 });
  const otherPageViews = Math.max(0, totals.pageViews - listed.pageViews);
  const other = {
    count: Math.max(0, SELLER.liveListings - rows.length),
    pageViews: otherPageViews,
    sessions: Math.round(otherPageViews * 0.74),
    units: Math.max(0, totals.units - listed.units),
    sales: Math.max(0, totals.sales - listed.sales),
  };
  return { rows, other, totals };
}

/* ------------------------------------------------------------------ */
/* Payments: ledger, balances and tax documents                        */
/* ------------------------------------------------------------------ */

export type LedgerStatus = "pending" | "on_hold" | "eligible" | "batched" | "paid" | "cancelled";

export const LEDGER_STATUS: Record<LedgerStatus, StatusMeta> = {
  pending: { label: "Pending", tone: "neutral", description: "Not yet eligible: awaiting delivery, hold period or COD remittance" },
  on_hold: { label: "On hold", tone: "warning" },
  eligible: { label: "Eligible", tone: "info" },
  batched: { label: "In payout", tone: "brand" },
  paid: { label: "Paid", tone: "success" },
  cancelled: { label: "Voided", tone: "neutral" },
};

export type LedgerType = "Order payment" | "Refund" | "SafeClaim reimbursement" | "BluBuy Ads" | "Penalty" | "Fulfilled fees";

export interface LedgerEntry {
  id: string;
  at: string;
  type: LedgerType;
  orderId?: string;
  lineId?: string;
  description: string;
  gross: number;
  fees: number;
  gstOnFees: number;
  tcs: number;
  tds: number;
  net: number;
  status: LedgerStatus;
  payoutId?: string;
}

const statementsAll = settlementsForSeller(CURRENT_SELLER_ID);
export const sellerStatements: Settlement[] = statementsAll;

function payoutFor(at: string) {
  const t = new Date(at).getTime();
  return statementsAll.find((s) => t >= new Date(s.periodStart).getTime() && t < addDays(s.periodEnd, 1).getTime());
}

function statusFromPayout(s?: Settlement): LedgerStatus {
  if (!s) return "paid";
  return s.status === "paid" ? "paid" : s.status === "processing" ? "batched" : s.status === "on_hold" ? "on_hold" : s.status === "failed" ? "on_hold" : "eligible";
}

const orderEntries: LedgerEntry[] = sellerLines
  .filter((l) => l.stage !== "new" && l.stage !== "to_pack")
  .map((l) => {
    const fees = feesForLine(l.productId, l.price, l.quantity, l.cod, SELLER.tier);
    const amt = (prefix: string) => fees.filter((f) => f.label.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
    const feeSum = amt("Commission") + amt("Fixed fee") + amt("Shipping fee");
    const gst = amt("GST");
    const tcs = amt("TCS");
    const tds = amt("TDS");
    const est = settlementEstimate(l);
    const eligibleAt = est.eligibleOn;
    const voided = l.stage === "cancelled";
    const delivered = Boolean(l.deliveredAt);
    const payout = delivered ? payoutFor(eligibleAt) : undefined;
    let status: LedgerStatus = voided ? "cancelled" : !delivered ? "pending" : new Date(eligibleAt) > NOW ? "pending" : statusFromPayout(payout);
    if (l.status === "return_requested") status = "on_hold";
    return {
      id: `TX-${digits(l.lineId, 9)}`,
      at: l.deliveredAt ?? l.placedAt,
      type: "Order payment" as const,
      orderId: l.orderId,
      lineId: l.lineId,
      description: l.title,
      gross: voided ? 0 : l.total,
      fees: voided ? 0 : feeSum,
      gstOnFees: voided ? 0 : gst,
      tcs: voided ? 0 : tcs,
      tds: voided ? 0 : tds,
      net: voided ? 0 : l.total + feeSum + gst + tcs + tds,
      status,
      payoutId: status === "paid" || status === "batched" || status === "eligible" ? payout?.id : undefined,
    };
  });

const adjustmentEntries: LedgerEntry[] = [
  { id: "TX-300118274", at: fromNow(-1).toISOString(), type: "BluBuy Ads", description: "BluBuy Ads spend, 22 to 28 Sept (deducted from payout)", gross: 0, fees: -184320, gstOnFees: -33178, tcs: 0, tds: 0, net: -217498, status: "eligible" },
  { id: "TX-300117903", at: fromNow(-3).toISOString(), type: "Penalty", orderId: sellerLines[5]?.orderId, description: "Late dispatch penalty (first scan after dispatch by date)", gross: 0, fees: -30, gstOnFees: -5, tcs: 0, tds: 0, net: -35, status: "eligible" },
  { id: "TX-300116551", at: fromNow(-5).toISOString(), type: "Fulfilled fees", description: "BluBuy Fulfilled storage, September (Rs 35 per cubic foot)", gross: 0, fees: -42350, gstOnFees: -7623, tcs: 0, tds: 0, net: -49973, status: "eligible" },
  { id: "TX-300115012", at: fromNow(-24).toISOString(), type: "SafeClaim reimbursement", description: "SafeClaim SC-26082702, empty box returned (Kestrel Air 14)", gross: 84990, fees: 0, gstOnFees: 0, tcs: 0, tds: 0, net: 84990, status: "paid", payoutId: statementsAll[3]?.id },
  ...sellerReturns
    .filter((r) => r.kind === "return" && ["refund_initiated", "completed", "qc_failed"].includes(r.status))
    .map((r) => ({
      id: `TX-${digits(r.id, 9)}`,
      at: r.updatedAt,
      type: "Refund" as const,
      orderId: r.orderId,
      description: `Refund recovery for return ${r.id}`,
      gross: -r.amount,
      fees: Math.round(r.amount * 0.06),
      gstOnFees: Math.round(r.amount * 0.06 * 0.18),
      tcs: Math.round((r.amount / 1.18) * 0.005),
      tds: Math.round((r.amount / 1.18) * 0.001),
      net: -r.amount + Math.round(r.amount * 0.06) + Math.round(r.amount * 0.06 * 0.18) + Math.round((r.amount / 1.18) * 0.005) + Math.round((r.amount / 1.18) * 0.001),
      status: (r.status === "completed" ? "paid" : "eligible") as LedgerStatus,
    })),
];

export const ledger: LedgerEntry[] = [...orderEntries, ...adjustmentEntries].sort((a, b) => +new Date(b.at) - +new Date(a.at));

export const BANK_ACCOUNT = {
  bank: "HDFC Bank",
  branch: "Andheri East, Mumbai",
  holder: "Apex Retail Private Limited",
  last4: "4821",
  ifsc: "HDFC0000240",
  type: "Current account",
  verified: true,
  verifiedOn: "2026-02-11T12:20:00+05:30",
  method: "Penny drop (₹1 credited and name matched)",
};

export const balances = {
  /** current open cycle, still accumulating */
  open: statementsAll[0]!.netPayout,
  /** held for returns in progress and a reserve on new categories */
  onHold: ledger.filter((l) => l.status === "on_hold").reduce((a, l) => a + l.net, 0) + 42150,
  reserve: 0,
  upcoming: [
    { label: "BluBuy Ads spend, 29 Sept to 5 Oct", amount: -2_10_400, on: "Deducted from the 6 Oct payout" },
    { label: "BluBuy Fulfilled storage, October (peak rate)", amount: -61_200, on: "Billed 1 Nov" },
    { label: "Blu Flash Deal fees, Big Days (3 deals)", amount: -5_310, on: "Deducted from the 6 Oct payout" },
  ],
};

export interface TaxDocument {
  id: string;
  kind: "tcs" | "tds" | "fee_invoice" | "credit_note";
  title: string;
  period: string;
  number: string;
  issuedOn?: string;
  amount: number;
  status: "available" | "generating";
}

const monthTcs = (i: number) => Math.round((statementsAll.slice(i * 4, i * 4 + 4).reduce((a, s) => a + Math.abs(s.fees.find((f) => f.label.startsWith("TCS"))?.amount ?? 0), 0) || 150000));

export const taxDocuments: TaxDocument[] = [
  { id: "td-1", kind: "tcs", title: "TCS certificate (GSTR-8)", period: "September 2026", number: "TCS/27/2026-09/APX", amount: monthTcs(0), status: "generating" },
  { id: "td-2", kind: "tcs", title: "TCS certificate (GSTR-8)", period: "August 2026", number: "TCS/27/2026-08/APX", issuedOn: "2026-09-10", amount: monthTcs(1), status: "available" },
  { id: "td-3", kind: "tcs", title: "TCS certificate (GSTR-8)", period: "July 2026", number: "TCS/27/2026-07/APX", issuedOn: "2026-08-10", amount: Math.round(monthTcs(1) * 0.86), status: "available" },
  { id: "td-4", kind: "tds", title: "Form 16A, TDS u/s 194-O", period: "Q1 FY 2026-27 (Apr to Jun)", number: "16A/Q1/2026-27/GTJWY1805B", issuedOn: "2026-08-14", amount: 41_870, status: "available" },
  { id: "td-5", kind: "tds", title: "Form 16A, TDS u/s 194-O", period: "Q4 FY 2025-26 (Feb to Mar)", number: "16A/Q4/2025-26/GTJWY1805B", issuedOn: "2026-05-30", amount: 18_240, status: "available" },
  { id: "td-6", kind: "fee_invoice", title: "BluBuy tax invoice for fees", period: "September 2026", number: "BBFI/2026-27/0048213", amount: 0, status: "generating" },
  { id: "td-7", kind: "fee_invoice", title: "BluBuy tax invoice for fees", period: "August 2026", number: "BBFI/2026-27/0039905", issuedOn: "2026-09-01", amount: 31_84_520, status: "available" },
  { id: "td-8", kind: "fee_invoice", title: "BluBuy tax invoice for fees", period: "July 2026", number: "BBFI/2026-27/0031142", issuedOn: "2026-08-01", amount: 27_46_310, status: "available" },
  { id: "td-9", kind: "credit_note", title: "Credit note, fee reversals on returns", period: "August 2026", number: "BBCN/2026-27/0004410", issuedOn: "2026-09-01", amount: 1_12_840, status: "available" },
];

/** Sample delivered transactions shown inside a statement, dated within its cycle (deterministic per statement). */
export function statementTransactions(statement: Settlement, count = 12): LedgerEntry[] {
  const pool = ledger.filter((l) => l.type === "Order payment" && l.gross > 0 && !["pending", "cancelled"].includes(l.status));
  const r = seeded(hashOf(statement.id));
  const start = Math.floor(r() * Math.max(1, pool.length - count));
  return pool.slice(start, start + count).map((l, i) => ({
    ...l,
    at: istAt(addDays(statement.periodStart, (i * 3) % 7), 11 + (i % 7), 0).toISOString(),
    payoutId: statement.id,
    status: (statement.status === "paid" ? "paid" : statement.status === "processing" ? "batched" : "eligible") as LedgerStatus,
  }));
}

/* ------------------------------------------------------------------ */
/* Seller Health and tiers                                             */
/* ------------------------------------------------------------------ */

export const HEALTH_BANDS = [
  { key: "EXCELLENT", label: "Excellent", min: 800, tone: "success" as Tone, note: "Full access to deals, ads and the Assured badge" },
  { key: "GOOD", label: "Good", min: 600, tone: "success" as Tone, note: "Healthy. Keep metrics inside target to recover 10 points a week" },
  { key: "FAIR", label: "Fair", min: 400, tone: "warning" as Tone, note: "At risk. Fix red metrics to avoid restrictions" },
  { key: "POOR", label: "Poor", min: 200, tone: "danger" as Tone, note: "Restricted: no deals, no Assured, featured offer weight halved" },
  { key: "CRITICAL", label: "Critical", min: 0, tone: "danger" as Tone, note: "Account suspension review" },
];

export function bandFor(score: number) {
  return HEALTH_BANDS.find((b) => score >= b.min) ?? HEALTH_BANDS.at(-1)!;
}

export interface HealthMetric {
  key: string;
  label: string;
  value: number;
  target: number;
  comparator: "under" | "over";
  window: string;
  appliesTo: string;
  definition: string;
  consequence: string;
  affected: number;
  trend: number[];
}

const h = SELLER.health;
const trend = (v: number, seed: string) => {
  const r = seeded(hashOf(seed));
  return Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round((v * (0.75 + r() * 0.5) + (i - 7) * -v * 0.01) * 100) / 100)).concat(v);
};

export const healthMetrics: HealthMetric[] = [
  { key: "odr", label: "Order defect rate", value: h.odr, target: 1, comparator: "under", window: "60 days", appliesTo: "All orders", definition: "Items with 1 or 2 star seller feedback, a seller-funded BluBuy Guarantee claim or a chargeback, divided by all items.", consequence: "Above 1% removes featured offer eligibility and can lead to listing restrictions.", affected: 31, trend: trend(h.odr, "odr") },
  { key: "pfcr", label: "Pre-fulfilment cancel rate", value: h.cancellationRate, target: 2.5, comparator: "under", window: "7 days", appliesTo: "BluBuy Ship and Self Ship", definition: "Seller-attributable cancellations before shipment divided by items. Customer requested cancellations are excluded.", consequence: "Each seller cancellation carries a ₹60 penalty and lowers your Seller Health score.", affected: 2, trend: trend(h.cancellationRate, "pfcr") },
  { key: "ldr", label: "Late dispatch rate", value: h.lateDispatchRate, target: 4, comparator: "under", window: "10 days", appliesTo: "BluBuy Ship and Self Ship", definition: "Items first scanned after the dispatch by date, divided by items shipped.", consequence: "₹30 penalty per late item. Above 4% for two weeks pauses same-day badges on your offers.", affected: 46, trend: trend(h.lateDispatchRate, "ldr") },
  { key: "vtr", label: "Valid tracking rate", value: h.validTrackingRate, target: 95, comparator: "over", window: "30 days", appliesTo: "Self Ship", definition: "Self Ship items with a valid courier and AWB scanned within 24 hours, divided by Self Ship items.", consequence: "Below 95% removes Self Ship from your account for affected categories.", affected: 6, trend: trend(h.validTrackingRate, "vtr") },
  { key: "return", label: "Seller-fault return rate", value: h.returnRate, target: 6.5, comparator: "under", window: "90 days", appliesTo: "All orders", definition: "Returns for defective, wrong, missing or not-as-described items, divided by items delivered. Target is the category benchmark.", consequence: "Above benchmark triggers quality alerts and can suppress the affected listings.", affected: 118, trend: trend(h.returnRate, "ret") },
  { key: "response", label: "Buyer messages answered in 24 hours", value: 96.4, target: 90, comparator: "over", window: "90 days", appliesTo: "All orders", definition: "Buyer messages answered within 24 hours, including weekends, divided by messages needing a response.", consequence: "Below 90% lowers your Seller Health score by 30 points at the weekly evaluation.", affected: 9, trend: trend(96.4, "resp") },
];

export const scoreHistory = Array.from({ length: 12 }, (_, i) => {
  const weekStart = fromNow(-7 * (11 - i) - ((NOW.getDay() + 6) % 7));
  const base = [742, 748, 755, 712, 722, 731, 741, 751, 761, 771, 781, 791][i]!;
  return { label: weekStart.toISOString(), score: base };
});

export interface Violation {
  id: string;
  at: string;
  category: string;
  title: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  points: number;
  status: "open" | "appeal_submitted" | "resolved" | "appeal_accepted";
  detail: string;
}

export const VIOLATION_STATUS: Record<Violation["status"], StatusMeta> = {
  open: { label: "Action needed", tone: "warning" },
  appeal_submitted: { label: "Appeal submitted", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  appeal_accepted: { label: "Appeal accepted", tone: "success" },
};

export const violations: Violation[] = [
  { id: "PV-26-0912", at: "2026-07-02T11:00:00+05:30", category: "Intellectual property", title: "Trademark complaint on Auralis Pods Pro listing", severity: "Medium", points: 50, status: "appeal_accepted", detail: "Brand authorisation letter from the Auralis distributor accepted. 50 points restored." },
  { id: "PV-26-0688", at: "2026-06-18T16:20:00+05:30", category: "Listing policy", title: "Prohibited claim in title (\"best in India\")", severity: "Low", points: 20, status: "resolved", detail: "Title corrected within 48 hours. Points recover through weekly recovery." },
  { id: "PV-26-0431", at: "2026-05-04T09:45:00+05:30", category: "Pricing", title: "Price above M.R.P. on Lumora 27 inch monitor", severity: "Low", points: 20, status: "resolved", detail: "Price corrected. The listing was suppressed for 6 hours." },
];

export const TIERS: { key: SellerTier; scale: string; gates: string; benefits: string[] }[] = [
  { key: "Bronze", scale: "Default for new sellers", gates: "None", benefits: ["Fixed fee plus ₹10", "Payout 7 days after delivery"] },
  { key: "Silver", scale: "GMV ₹10 lakh or 1,500 units in 90 days", gates: "Cancel rate under 2%, late dispatch under 3%, health 600+, rating 3.8+", benefits: ["Fixed fee plus ₹5", "Payout 5 days after delivery", "5% off forward shipping"] },
  { key: "Gold", scale: "GMV ₹40 lakh or 5,000 units in 90 days", gates: "Cancel rate under 1%, late dispatch under 2%, health 700+, rating 4.0+", benefits: ["Fixed fee plus ₹2", "Payout 3 days after delivery", "10% off forward shipping", "Account manager"] },
  { key: "Platinum", scale: "GMV ₹1 crore or 12,000 units in 90 days", gates: "Cancel rate under 0.5%, late dispatch under 1%, health 800+, rating 4.2+", benefits: ["Base fixed fee", "Payout 2 days after delivery", "15% off forward shipping", "Account manager", "Priority in BluBuy Big Days"] },
];

/** Platinum gate progress for the current 90 day window. */
export const tierProgress = {
  current: SELLER.tier as SellerTier,
  windowEnds: "2026-12-31T23:59:00+05:30",
  evaluation: "2027-01-01T09:00:00+05:30",
  gates: [
    { label: "GMV, 90 days", value: Math.round(SELLER.gmv30d * 2.85), target: 1_00_00_000, format: "inr" as const, comparator: "over" as const },
    { label: "Pre-fulfilment cancel rate", value: h.cancellationRate, target: 0.5, format: "pct" as const, comparator: "under" as const },
    { label: "Late dispatch rate", value: h.lateDispatchRate, target: 1, format: "pct" as const, comparator: "under" as const },
    { label: "Seller Health score", value: h.score, target: 800, format: "num" as const, comparator: "over" as const },
    { label: "Average product rating", value: SELLER.rating, target: 4.2, format: "rating" as const, comparator: "over" as const },
  ],
};

/* ------------------------------------------------------------------ */
/* Reviews, seller feedback and questions                              */
/* ------------------------------------------------------------------ */

export const listingReviews: (Review & { title: string; productTitle: string; image: string })[] = reviews
  .filter((rv) => apexProductIds.includes(rv.productId))
  .map((rv) => {
    const p = getProduct(rv.productId)!;
    return { ...rv, productTitle: p.title, image: p.image };
  })
  .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

export interface SellerFeedback {
  id: string;
  orderId: string;
  buyer: string;
  rating: number;
  comment: string;
  at: string;
  response?: string;
  /** feedback about logistics on BluBuy Fulfilled orders is struck through and excluded from ODR */
  struck?: boolean;
}

const fbComments: [number, string][] = [
  [5, "Packed very well and arrived a day before the promised date. Invoice was inside the box."],
  [5, "Genuine product with full brand warranty. Smooth experience."],
  [4, "Good seller, but the delivery slot was changed once."],
  [5, "Seller answered my question about the warranty within an hour."],
  [2, "Box was dented on arrival. Product works fine."],
  [5, "Original sealed pack, GST invoice provided. Will buy again."],
  [1, "Delivery was late by three days and nobody called."],
  [4, "Quick dispatch. Would like better outer packaging for laptops."],
  [5, "Exactly as described."],
  [3, "Product fine, but the charger was missing a cable tie. Minor."],
];

export const sellerFeedback: SellerFeedback[] = fbComments.map(([rating, comment], i) => {
  const line = sellerLines.filter((l) => l.stage === "delivered")[i % 20]!;
  return {
    id: `fb-${i + 1}`,
    orderId: line.orderId,
    buyer: line.buyer,
    rating,
    comment,
    at: fromNow(-(i * 3 + 1)).toISOString(),
    response: i === 4 ? "We are sorry about the dented box. We have moved laptops and headphones to double-wall cartons from this week." : undefined,
    struck: i === 6,
  };
});

export interface CustomerQuestion {
  id: string;
  productId: string;
  question: string;
  askedBy: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
  votes: number;
}

export const customerQuestions: CustomerQuestion[] = [
  { id: "q-1", productId: "p-headphones-studio", question: "Does the ANC work in wired mode with the cable?", askedBy: "Karan M.", askedAt: fromNow(-0.2).toISOString(), votes: 4 },
  { id: "q-2", productId: "p-laptop-air", question: "Is the RAM soldered or can it be upgraded later?", askedBy: "Divya P.", askedAt: fromNow(-0.6).toISOString(), votes: 11 },
  { id: "q-3", productId: "p-airfryer-crisp", question: "Can it bake a cake? What is the maximum temperature?", askedBy: "Meera R.", askedAt: fromNow(-1.3).toISOString(), votes: 7 },
  { id: "q-4", productId: "p-camera-mirrorless", question: "Does the box include a battery charger or only a USB cable?", askedBy: "Yash S.", askedAt: fromNow(-2.1).toISOString(), votes: 3 },
  { id: "q-5", productId: "p-earbuds-pods", question: "Do these support multipoint connection with a laptop and phone?", askedBy: "Simran K.", askedAt: fromNow(-3).toISOString(), answer: "Yes. The Pods Pro connect to two devices at once and switch automatically when a call comes in.", answeredAt: fromNow(-2.8).toISOString(), votes: 18 },
  { id: "q-6", productId: "p-monitor-ultra", question: "Is a USB-C cable included in the box?", askedBy: "Nikhil J.", askedAt: fromNow(-5).toISOString(), answer: "Yes, a 1 m USB-C cable with 65 W power delivery is included along with an HDMI cable.", answeredAt: fromNow(-4.9).toISOString(), votes: 9 },
  { id: "q-7", productId: "p-cookware-pan", question: "Is it induction compatible?", askedBy: "Lavanya T.", askedAt: fromNow(-6).toISOString(), answer: "Yes, the tri-ply base works on induction, gas and electric cooktops.", answeredAt: fromNow(-5.9).toISOString(), votes: 22 },
];

/* ------------------------------------------------------------------ */
/* Buyer messages                                                      */
/* ------------------------------------------------------------------ */

export interface ThreadMessage {
  id: string;
  from: "buyer" | "seller" | "system";
  body: string;
  at: string;
  attachment?: string;
}

export interface MessageThread {
  id: string;
  buyer: string;
  orderId: string;
  productTitle: string;
  image: string;
  subject: string;
  status: "needs_reply" | "replied" | "no_response_needed";
  lastAt: string;
  dueAt?: string;
  messages: ThreadMessage[];
}

const mins = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function thread(id: string, lineIdx: number, subject: string, status: MessageThread["status"], msgs: [ThreadMessage["from"], string, number, string?][]): MessageThread {
  const line = sellerLines[lineIdx % sellerLines.length]!;
  const messages = msgs.map(([from, body, m, attachment], i) => ({ id: `${id}-${i}`, from, body, at: mins(m), attachment }));
  const lastBuyer = [...messages].reverse().find((m) => m.from === "buyer");
  return {
    id,
    buyer: line.buyer,
    orderId: line.orderId,
    productTitle: line.title,
    image: line.image,
    subject,
    status,
    lastAt: messages.at(-1)!.at,
    dueAt: status === "needs_reply" && lastBuyer ? new Date(new Date(lastBuyer.at).getTime() + 24 * 3600_000).toISOString() : undefined,
    messages,
  };
}

export const messageThreads: MessageThread[] = [
  thread("msg-1", 0, "Need a GST invoice with company name", "needs_reply", [
    ["buyer", "Hello, I placed this order for my office. Can you issue the invoice in the name of Brightline Studio LLP with our GSTIN 27AAKFB4410M1Z2?", 95],
  ]),
  thread("msg-2", 1, "Delivery before Saturday?", "needs_reply", [
    ["buyer", "Hi, I need this laptop before Saturday for a client presentation. Is that possible?", 410],
    ["system", "BluBuy sent the customer the promised delivery date: Sat, 3 Oct.", 405],
    ["buyer", "Also, does it come with the charger in the box?", 380],
  ]),
  thread("msg-3", 3, "Colour option for headphones", "needs_reply", [
    ["buyer", "Can I change the colour to Silver before it ships? Ordered Graphite by mistake.", 1210],
  ]),
  thread("msg-4", 20, "Warranty registration", "replied", [
    ["buyer", "How do I register the warranty for my Kestrel laptop?", 2900],
    ["seller", "Thank you for your order. The warranty starts from the invoice date. You can register on the Kestrel service portal using the serial number printed under the laptop and the invoice attached here.", 2780, "Invoice-BB-260925.pdf"],
    ["buyer", "Got it, thanks.", 2700],
  ]),
  thread("msg-5", 24, "Return pickup timing", "replied", [
    ["buyer", "The pickup for my return was missed today. Will it be rescheduled?", 4400],
    ["seller", "Sorry for the trouble. BluBuy Logistics has rescheduled the pickup for tomorrow between 10 AM and 1 PM. Please keep the item in its original box.", 4300],
  ]),
  thread("msg-6", 27, "Delivery confirmation", "no_response_needed", [
    ["buyer", "Received the air fryer, all good.", 7200],
  ]),
];

export const messageTemplates = [
  { id: "t-1", title: "Send invoice", body: "Thank you for your order. Please find the GST invoice for order {order} attached. Let us know if you need any changes to the billing details." },
  { id: "t-2", title: "Delivery timeline", body: "Thank you for reaching out. Your order {order} is scheduled to be dispatched today and BluBuy shows delivery by {date}. You can track it from Your orders." },
  { id: "t-3", title: "Warranty information", body: "The product carries the brand warranty from the invoice date. Keep the invoice and serial number handy and contact the brand service centre for any claim." },
  { id: "t-4", title: "Return information", body: "You can request a return from Your orders within the return window. BluBuy will schedule a pickup and the refund is issued after the quality check." },
  { id: "t-5", title: "Change before dispatch", body: "We cannot change items on an order once it is placed. You can cancel this order from Your orders before it ships and place a new one with the right option." },
];

/* ------------------------------------------------------------------ */
/* Support cases and Seller Academy                                    */
/* ------------------------------------------------------------------ */

export type CaseStatus = "new" | "open" | "pending_seller" | "pending_internal" | "resolved" | "closed";

export const CASE_STATUS: Record<CaseStatus, StatusMeta> = {
  new: { label: "New", tone: "info" },
  open: { label: "Open", tone: "brand" },
  pending_seller: { label: "Awaiting your reply", tone: "warning" },
  pending_internal: { label: "With BluBuy team", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const CASE_CATEGORIES = [
  { key: "SELLER_ORDERS", label: "Orders and shipping" },
  { key: "SELLER_PAYMENTS", label: "Payments and fees" },
  { key: "SELLER_CATALOG", label: "Listings and catalog" },
  { key: "SELLER_FULFILLED", label: "BluBuy Fulfilled" },
  { key: "SELLER_ACCOUNT_HEALTH", label: "Account health" },
  { key: "SELLER_ADS", label: "BluBuy Ads" },
  { key: "SELLER_TAX", label: "Tax and invoices" },
];

export interface SupportCase {
  id: string;
  subject: string;
  category: string;
  status: CaseStatus;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  respondBy?: string;
}

export const supportCases: SupportCase[] = [
  { id: "TK204517836", subject: "Weight discrepancy recovery on 4 laptop shipments", category: "Payments and fees", status: "pending_seller", reference: "TX-300117903", createdAt: fromNow(-2).toISOString(), updatedAt: fromNow(-0.3).toISOString(), lastMessage: "Please share the packed weight photos for the 4 AWBs so we can review the slab change.", respondBy: fromNow(1.2).toISOString() },
  { id: "TK204511290", subject: "Monitor listing suppressed after template change", category: "Listings and catalog", status: "open", reference: "p-monitor-ultra", createdAt: fromNow(-1).toISOString(), updatedAt: fromNow(-0.5).toISOString(), lastMessage: "Our catalog team is checking why the refresh rate attribute did not carry over." },
  { id: "TK204498877", subject: "Inbound IN-260926-02 shows 1 unit damaged at dock", category: "BluBuy Fulfilled", status: "pending_internal", reference: "IN-260926-02", createdAt: fromNow(-3).toISOString(), updatedAt: fromNow(-1).toISOString(), lastMessage: "Farukhnagar FC is reviewing the dock camera footage. Expect an update within 2 business days." },
  { id: "TK204470021", subject: "TCS certificate for August not matching GSTR-2X", category: "Tax and invoices", status: "resolved", createdAt: fromNow(-9).toISOString(), updatedAt: fromNow(-6).toISOString(), lastMessage: "A revised certificate has been issued. Download it from Payments, Tax documents." },
  { id: "TK204455109", subject: "Request account manager call before Diwali", category: "Account health", status: "closed", createdAt: fromNow(-15).toISOString(), updatedAt: fromNow(-12).toISOString(), lastMessage: "Call completed with Ananya from Seller Success. Notes shared by email." },
];

export const academyCourses = [
  { id: "ac-1", title: "Win the featured offer during sale events", topic: "Pricing", minutes: 12, level: "Intermediate", progress: 100 },
  { id: "ac-2", title: "Packaging that survives BluBuy Logistics", topic: "Fulfilment", minutes: 8, level: "Beginner", progress: 60 },
  { id: "ac-3", title: "Reading your settlement statement", topic: "Payments", minutes: 15, level: "Beginner", progress: 0 },
  { id: "ac-4", title: "Keyword bidding for Sponsored Products", topic: "Advertising", minutes: 18, level: "Intermediate", progress: 30 },
  { id: "ac-5", title: "Filing a SafeClaim with the right evidence", topic: "Returns", minutes: 9, level: "Beginner", progress: 0 },
  { id: "ac-6", title: "TCS, TDS and GST for marketplace sellers", topic: "Tax", minutes: 22, level: "Advanced", progress: 0 },
];

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const businessProfile = {
  legalName: SELLER.legalName,
  displayName: SELLER.displayName,
  constitution: "Private Limited Company",
  cin: "U52390MH2019PTC328114",
  pan: SELLER.pan,
  registeredAddress: "Unit 14, Marol Industrial Estate, Andheri East, Mumbai, Maharashtra 400072",
  storeDescription: "Authorised reseller of laptops, audio, cameras and kitchen appliances. Every order ships with a GST invoice and full brand warranty.",
  customerCare: "+91 22 4012 8821",
  supportEmail: "care@apexretail.in",
  grievanceOfficer: "Neha Desai, grievance@apexretail.in",
  joinedAt: SELLER.joinedAt,
  categories: SELLER.categories.map((c) => getCategory(c)?.name ?? c),
};

export const gstRegistrations = [
  { gstin: SELLER.gstin, state: "Maharashtra", type: "Principal place of business", address: "Andheri East, Mumbai 400072", verified: true },
  { gstin: `29${SELLER.pan}1Z8`, state: "Karnataka", type: "Additional place of business (BLR-FC-01)", address: "Hoskote Fulfilment Centre, Bengaluru 562114", verified: true },
  { gstin: `06${SELLER.pan}1Z3`, state: "Haryana", type: "Additional place of business (DEL-FC-01)", address: "Farukhnagar Fulfilment Centre, Gurugram 122506", verified: true },
];

export const pickupAddresses = [
  { id: "pa-1", label: "Andheri warehouse", line: "Unit 14, Marol Industrial Estate, Andheri East", city: "Mumbai", state: "Maharashtra", pincode: "400072", contact: "Suresh Pawar, +91 98XXX XX604", slot: "4:00 to 6:00 PM", handling: "Same day for audio and cookware, 1 to 2 days for laptops and appliances", isDefault: true, verified: true },
  { id: "pa-2", label: "Bhiwandi overflow store", line: "Gala 7, Rahnal Logistics Park, Bhiwandi", city: "Thane", state: "Maharashtra", pincode: "421302", contact: "Imran Shaikh, +91 99XXX XX218", slot: "2:00 to 4:00 PM", handling: "1 day", isDefault: false, verified: true },
];

export const returnAddress = { label: "Andheri warehouse, returns desk", line: "Unit 14, Marol Industrial Estate, Andheri East, Mumbai 400072", contact: "Returns desk, +91 22 4012 8830" };

export const SELLER_ROLES = [
  { key: "Owner", description: "Full access including bank account, users and legal details" },
  { key: "Admin", description: "Everything except bank account changes and ownership transfer" },
  { key: "Operations", description: "Orders, returns, inventory and inbound shipments" },
  { key: "Catalog", description: "Listings, images, pricing and bulk uploads" },
  { key: "Finance", description: "Payments, statements, tax documents and fee invoices (view only on bank)" },
  { key: "Marketing", description: "BluBuy Ads, coupons, deals and sale events" },
];

export const subUsers = [
  { id: "u-1", name: "Rohan Mehta", email: "rohan@apexretail.in", role: "Owner", lastActive: mins(2), twoFA: true, status: "active" as const },
  { id: "u-2", name: "Neha Desai", email: "neha@apexretail.in", role: "Admin", lastActive: mins(48), twoFA: true, status: "active" as const },
  { id: "u-3", name: "Suresh Pawar", email: "suresh@apexretail.in", role: "Operations", lastActive: mins(9), twoFA: true, status: "active" as const },
  { id: "u-4", name: "Fatima Khan", email: "fatima@apexretail.in", role: "Catalog", lastActive: mins(1440 * 2), twoFA: false, status: "active" as const },
  { id: "u-5", name: "Arvind Iyer", email: "accounts@apexretail.in", role: "Finance", lastActive: mins(1440 * 5), twoFA: true, status: "active" as const },
  { id: "u-6", name: "Pooja Nair", email: "pooja@apexretail.in", role: "Marketing", lastActive: mins(0), twoFA: false, status: "invited" as const },
];

export const notificationPrefs = [
  { group: "Orders", event: "New order received", email: false, sms: false, push: true, whatsapp: false },
  { group: "Orders", event: "Dispatch deadline in 2 hours", email: true, sms: true, push: true, whatsapp: true },
  { group: "Orders", event: "Cancellation requested by customer", email: true, sms: false, push: true, whatsapp: false },
  { group: "Returns", event: "Return received, grade within 48 hours", email: true, sms: false, push: true, whatsapp: false },
  { group: "Returns", event: "SafeClaim decision", email: true, sms: false, push: true, whatsapp: false },
  { group: "Payments", event: "Payout sent", email: true, sms: true, push: false, whatsapp: true },
  { group: "Payments", event: "Payout failed or on hold", email: true, sms: true, push: true, whatsapp: true },
  { group: "Account", event: "Seller Health metric off target", email: true, sms: false, push: true, whatsapp: false },
  { group: "Account", event: "Listing suppressed or rejected", email: true, sms: false, push: true, whatsapp: false },
  { group: "Growth", event: "Sale event invitations", email: true, sms: false, push: false, whatsapp: false },
];

/* ------------------------------------------------------------------ */
/* Registration reference data                                         */
/* ------------------------------------------------------------------ */

export const CONSTITUTIONS = ["Proprietorship", "Partnership firm", "Limited liability partnership (LLP)", "Private limited company", "Public limited company"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const ONBOARDING_CATEGORIES: { id: string; name: string; commission: number; gated?: string }[] = [
  ...categories.map((c) => ({
    id: c.id,
    name: c.name,
    commission: c.commission,
    gated:
      c.slug === "grocery"
        ? "Needs an FSSAI licence or registration"
        : c.slug === "toys"
          ? "Needs BIS certification (IS 9873) for every toy"
          : c.slug === "beauty"
            ? "Needs a cosmetics import or manufacturing licence for imported brands"
            : c.slug === "mobiles"
              ? "Needs BIS registration (CRS) and brand authorisation"
              : undefined,
  })),
  { id: "cat-jewellery", name: "Jewellery", commission: 12, gated: "Needs BIS hallmarking (HUID) and 90 days of selling history" },
  { id: "cat-health", name: "Health and wellness devices", commission: 8, gated: "Needs a medical device registration from CDSCO" },
];

/** Dates the dashboard and statements show, kept here so every screen agrees. */
export const SELLER_TIMELINE = {
  nextEvaluation: tierProgress.evaluation,
  payoutRuns: "Monday, Wednesday and Friday",
};

/** Customer count helper for audience estimates in promotions and ads. */
export const storeCustomers30d = Math.round(SELLER.orders30d * 0.86);

/* ------------------------------------------------------------------ */
/* Bulk listing uploads                                                */
/* ------------------------------------------------------------------ */

export type UploadStatus = "processing" | "completed" | "completed_with_errors" | "failed";

export const UPLOAD_STATUS: Record<UploadStatus, StatusMeta> = {
  processing: { label: "Processing", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  completed_with_errors: { label: "Completed with errors", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

export const CATEGORY_TEMPLATES = [
  { id: "tpl-headphones", category: "Electronics > Headphones", version: "v2026.09", updated: "2026-09-12", fields: 48, required: 19 },
  { id: "tpl-laptops", category: "Electronics > Laptops", version: "v2026.08", updated: "2026-08-21", fields: 61, required: 24 },
  { id: "tpl-monitors", category: "Electronics > Monitors", version: "v2026.09", updated: "2026-09-27", fields: 44, required: 18 },
  { id: "tpl-smartphones", category: "Mobiles & Tablets > Smartphones", version: "v2026.07", updated: "2026-07-30", fields: 57, required: 23 },
  { id: "tpl-kitchen", category: "Appliances > Kitchen Appliances", version: "v2026.09", updated: "2026-09-05", fields: 39, required: 16 },
  { id: "tpl-cookware", category: "Home & Furniture > Cookware", version: "v2026.06", updated: "2026-06-18", fields: 33, required: 14 },
];

export const uploadHistory: { id: string; file: string; template: string; at: string; rows: number; ok: number; errors: number; status: UploadStatus }[] = [
  { id: "UP-260930-02", file: "apex-headphones-diwali.xlsx", template: "Electronics > Headphones", at: fromNow(-0.9).toISOString(), rows: 42, ok: 38, errors: 4, status: "completed_with_errors" },
  { id: "UP-260927-01", file: "monitors-price-update.csv", template: "Electronics > Monitors", at: fromNow(-4).toISOString(), rows: 12, ok: 12, errors: 0, status: "completed" },
  { id: "UP-260919-03", file: "kitchen-new-launches.xlsx", template: "Appliances > Kitchen Appliances", at: fromNow(-12).toISOString(), rows: 26, ok: 0, errors: 26, status: "failed" },
  { id: "UP-260911-01", file: "laptops-festive-stock.xlsx", template: "Electronics > Laptops", at: fromNow(-20).toISOString(), rows: 18, ok: 18, errors: 0, status: "completed" },
];

export const uploadErrors = [
  { row: 7, sku: "APX-AUR-2210", field: "main_image_url", issue: "Image is 640 px on the longest side", fix: "Upload an image of at least 1000 px" },
  { row: 12, sku: "APX-AUR-2215", field: "mrp", issue: "Selling price ₹13,499 is above M.R.P. ₹12,999", fix: "Lower the price or correct the M.R.P." },
  { row: 19, sku: "APX-PUL-3301", field: "hsn_code", issue: "HSN code 851 is too short", fix: "Use a 4 to 8 digit HSN, for example 8518" },
  { row: 23, sku: "APX-AUR-2231", field: "brand", issue: "Brand Auralis Pro is not approved for your account", fix: "Use the approved brand name or request brand approval" },
  { row: 31, sku: "APX-AUR-2240", field: "bullet_point_3", issue: "Contains a prohibited claim (\"guaranteed best\")", fix: "Remove superlative claims" },
];
