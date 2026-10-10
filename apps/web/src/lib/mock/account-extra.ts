/**
 * Extra mock data for the customer account area ("Your account").
 *
 * Everything here is deterministic and anchored to NOW (1 Oct 2026, 10:30 IST).
 * Where possible it is derived from the shared mock (myOrders, products) so the
 * account pages stay consistent with the storefront and the consoles. Each export
 * maps to a future API resource (noted beside it).
 */
import type { Notification, Order, OrderEvent, OrderItem, Product } from "../types";
import type { PaymentMethod, RefundStatus, ReturnStatus, TicketPriority, TicketStatus } from "../status";
import { NOW } from "../utils";
import { getProduct, products } from "./catalog";
import { customerNotifications } from "./engagement";
import { myOrders, refunds } from "./orders";
import { CURRENT_CUSTOMER, customerAddresses } from "./people";

const HOUR = 3600_000;
const DAY = 86400_000;

/** ISO timestamp for an IST wall-clock time, e.g. ist("2026-09-26", "14:05"). */
const ist = (date: string, time = "10:00") => new Date(`${date}T${time}:00+05:30`).toISOString();
/** ISO timestamp a number of hours before NOW. */
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR).toISOString();

/* ------------------------------- Profile ------------------------------- */
/** GET /v1/me */

export const ACCOUNT_PROFILE = {
  name: CURRENT_CUSTOMER.name,
  firstName: CURRENT_CUSTOMER.name.split(" ")[0]!,
  mobile: "+91 98450 12345",
  mobileVerified: true,
  email: CURRENT_CUSTOMER.email,
  emailVerified: false,
  gender: "Female",
  dateOfBirth: "1994-06-18",
  memberSince: "2021-03-14",
  language: "English",
  twoStepEnabled: true,
};

/* ----------------------------- AltasGoods Credits -------------------------- */
/** GET /v1/me/credits and /v1/me/credits/ledger */

export type WalletKind = "refund" | "gift_card" | "goodwill" | "spent" | "withdrawal";

export interface WalletTxn {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: WalletKind;
  amount: number;
  balance: number;
  ref?: string;
}

// oldest first; running balance is computed so the ledger always reconciles
const walletSeed: Omit<WalletTxn, "balance">[] = [
  { id: "WT-88120", at: ist("2026-03-08", "20:15"), title: "Gift card added", detail: "AltasGoods Gift Card ending 7731", kind: "gift_card", amount: 2000, ref: "GC-7731" },
  { id: "WT-88904", at: ist("2026-04-19", "13:30"), title: "Used on an order", detail: "Part payment, Maison Vara leather tote", kind: "spent", amount: -1200, ref: "BB-260419-30871" },
  { id: "WT-89261", at: ist("2026-06-02", "16:45"), title: "Refund to AltasGoods Credits", detail: "Return of Kiln & Co Stoneware Coffee Mugs", kind: "refund", amount: 899, ref: "RT-29711" },
  { id: "WT-89630", at: ist("2026-07-15", "11:10"), title: "Goodwill credit", detail: "Sorry your order arrived a day late", kind: "goodwill", amount: 250, ref: "TK-58210" },
  { id: "WT-90118", at: ist("2026-09-06", "18:20"), title: "Used on an order", detail: "Part payment, Voltix ProBlend mixer grinder", kind: "spent", amount: -500, ref: "BB-260906-92983" },
  { id: "WT-90412", at: ist("2026-09-30", "09:32"), title: "Refund to AltasGoods Credits", detail: "Return of Kiln & Co Handcrafted Ceramic Vase", kind: "refund", amount: 1299, ref: "RT-30916" },
];

let running = 0;
export const walletTransactions: WalletTxn[] = walletSeed
  .map((t) => {
    running += t.amount;
    return { ...t, balance: running };
  })
  .reverse();

const creditsTotal = walletTransactions[0]!.balance;

/** Balance split by origin. Spend draws down the earliest expiring credits first. */
export const CREDITS = {
  balance: creditsTotal,
  giftCard: { amount: 300, expiresOn: ist("2027-03-08") },
  goodwill: { amount: 250, expiresOn: ist("2027-07-15") },
  /** refund-origin credits never expire and can be withdrawn to the source account */
  refund: { amount: creditsTotal - 300 - 250 },
};

export const giftCards = [
  { id: "gc-7731", direction: "received" as const, code: "7731", design: "Birthday", amount: 2000, from: "Rohan Sharma", status: "Redeemed", activatedAt: ist("2026-03-08"), expiresOn: ist("2027-03-08") },
  { id: "gc-5108", direction: "sent" as const, code: "5108", design: "Festive", amount: 1500, to: "Sunita Sharma", status: "Delivered", activatedAt: ist("2025-10-28"), expiresOn: ist("2026-10-28") },
];

export const GIFT_CARD_DESIGNS = [
  { id: "festive", name: "Festive", tone: "accent" as const },
  { id: "birthday", name: "Birthday", tone: "brand" as const },
  { id: "thanks", name: "Thank you", tone: "success" as const },
  { id: "wedding", name: "Wedding", tone: "danger" as const },
];

/* ------------------------------ Payments ------------------------------- */
/** GET /v1/me/payment-methods */

export const savedUpis = [
  { id: "upi-1", vpa: "ananya.sharma@kaveri", bank: "Kaveri Bank", preferred: true, lastUsed: ist("2026-09-30", "18:40") },
  { id: "upi-2", vpa: "9845012345@sahyadri", bank: "Sahyadri Bank", preferred: false, lastUsed: ist("2026-08-14", "12:15") },
];

export const savedCards = [
  { id: "card-1", bank: "Kaveri Bank", kind: "Credit card", last4: "4821", expiry: "08/29", holder: "ANANYA SHARMA", preferred: true, expired: false, noCostEmi: true },
  { id: "card-2", bank: "Sahyadri Bank", kind: "Debit card", last4: "0937", expiry: "11/27", holder: "ANANYA SHARMA", preferred: false, expired: false, noCostEmi: false },
  { id: "card-3", bank: "Coastal Union Bank", kind: "Credit card", last4: "6612", expiry: "03/26", holder: "ANANYA SHARMA", preferred: false, expired: true, noCostEmi: false },
];

const payLaterUsed = myOrders
  .filter((o) => o.payment.method === "paylater" && o.payment.status === "captured")
  .reduce((a, o) => a + o.total, 0);

export const PAY_LATER = {
  status: "active" as const,
  partner: "Avanti Finance Limited",
  limit: 60000,
  used: payLaterUsed,
  dueOn: ist("2026-10-05"),
  statementAmount: payLaterUsed,
  interestFreeDays: 30,
  autopay: true,
};

export const emiOptions = [
  { id: "emi-1", title: "No cost EMI", source: "Kaveri Bank credit card ending 4821", detail: "3 and 6 month plans on orders above ₹3,000", limit: 185000, eligible: true },
  { id: "emi-2", title: "Debit card EMI", source: "Sahyadri Bank debit card ending 0937", detail: "Pre-approved, 3 to 12 months", limit: 75000, eligible: true },
  { id: "emi-3", title: "Cardless EMI", source: "AltasGoods Pay Later with Avanti Finance", detail: "3 to 12 months, instant approval", limit: 120000, eligible: true },
];

/* ------------------------------- Orders -------------------------------- */
/** The customer's orders, newest first. GET /v1/me/orders */

function lineFor(slug: string, id: string, status: Order["status"], variant?: string): OrderItem {
  const p = getProduct(slug)!;
  const offer = p.offers[0]!;
  return { id, productId: p.id, title: p.title, image: p.image, variant, sellerId: offer.sellerId, quantity: 1, price: offer.price, mrp: offer.mrp, status };
}

const ofdItems = [lineFor("camera-mirrorless", "x1-0", "out_for_delivery"), lineFor("headphones-studio", "x1-1", "out_for_delivery", "Ocean")];
const ofdSubtotal = ofdItems.reduce((a, it) => a + it.price * it.quantity, 0);
const ofdTimeline: OrderEvent[] = [
  { status: "placed", label: "Order placed", at: ist("2026-09-29", "08:12") },
  { status: "confirmed", label: "Seller confirmed your order", at: ist("2026-09-29", "08:20") },
  { status: "packed", label: "Item packed and invoice generated", at: ist("2026-09-29", "13:05"), location: "AltasGoods fulfilment centre, Hoskote" },
  { status: "ready_to_ship", label: "Ready to ship, sealed in a tamper-evident bag", at: ist("2026-09-29", "16:30"), location: "AltasGoods fulfilment centre, Hoskote" },
  { status: "shipped", label: "Shipped from fulfilment centre", at: ist("2026-09-29", "21:10"), location: "Hoskote origin hub" },
  { status: "in_transit", label: "In transit, reached sort centre", at: ist("2026-09-30", "14:45"), location: "Bengaluru sort centre" },
  { status: "out_for_delivery", label: "Out for delivery", at: ist("2026-10-01", "08:05"), location: "Whitefield delivery hub" },
];

const outForDeliveryOrder: Order = {
  id: "BB-260929-40482",
  customerId: CURRENT_CUSTOMER.id,
  customerName: CURRENT_CUSTOMER.name,
  placedAt: ist("2026-09-29", "08:12"),
  items: ofdItems,
  status: "out_for_delivery",
  payment: { method: "card", status: "captured", txnId: "TXN604118273" },
  address: customerAddresses[0]!,
  subtotal: ofdSubtotal,
  discount: 1500,
  couponCode: "BIGDAYS10",
  shippingFee: 0,
  platformFee: 7,
  total: ofdSubtotal - 1500 + 7,
  promisedBy: ist("2026-10-01", "19:00"),
  timeline: ofdTimeline,
  channel: "web",
};

export const accountOrders: Order[] = [outForDeliveryOrder, ...myOrders].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));

export function getAccountOrder(id: string) {
  return accountOrders.find((o) => o.id === id);
}

/** Secure Delivery: OTP shared only at the doorstep for high-value or sensitive items. */
export const SECURE_DELIVERY = {
  otp: "4821",
  /** item value threshold above which OTP delivery is mandatory (section 10.14) */
  threshold: 15000,
  sensitiveCategories: ["cat-mobiles", "cat-electronics"],
};

export const DELIVERY_ASSOCIATES: Record<string, { name: string; phone: string; rating: number; vehicle: string; eta: string; stopsAway: number }> = {
  "BB-260929-40482": { name: "Suresh Kumar", phone: "+91 80 4718 2290", rating: 4.8, vehicle: "Electric scooter", eta: ist("2026-10-01", "13:30"), stopsAway: 6 },
};

/* --------------------------- Return policy ----------------------------- */

export type Resolution = "refund" | "replacement" | "exchange";

export interface ReturnPolicy {
  days: number;
  resolutions: Resolution[];
  summary: string;
  note?: string;
}

/** Launch defaults from the returns policy (counted from the delivery date). */
export function returnPolicyFor(product: Product | undefined): ReturnPolicy {
  const cat = product?.categoryId ?? "";
  const hasVariants = (product?.variants.length ?? 0) > 0;
  switch (cat) {
    case "cat-fashion":
      return {
        days: 10,
        resolutions: hasVariants ? ["refund", "replacement", "exchange"] : ["refund", "replacement"],
        summary: hasVariants ? "10 days return, replacement or size exchange" : "10 days return or replacement",
        note: "Tags intact and unworn",
      };
    case "cat-home":
      return product?.subcategory === "Furniture"
        ? { days: 10, resolutions: ["refund", "replacement"], summary: "10 days return or replacement", note: "Only if installed by AltasGoods or the brand" }
        : { days: 7, resolutions: ["refund", "replacement"], summary: "7 days return or replacement" };
    case "cat-mobiles":
      return { days: 7, resolutions: ["replacement"], summary: "7 days replacement only", note: "For defective, damaged or wrong items. Reset the device and remove locks" };
    case "cat-electronics":
    case "cat-appliances":
      return { days: 7, resolutions: ["replacement"], summary: "7 days replacement only", note: "For defective, damaged or wrong items" };
    case "cat-beauty":
      return { days: 7, resolutions: ["refund", "replacement"], summary: "7 days return or replacement", note: "Refund only if unopened and sealed" };
    case "cat-grocery":
      return { days: 2, resolutions: ["refund"], summary: "2 days refund for damaged or wrong items" };
    default:
      return { days: 7, resolutions: ["replacement"], summary: "7 days replacement only" };
  }
}

export type ReturnReasonCode =
  | "DAMAGED_IN_TRANSIT"
  | "DEFECTIVE"
  | "WRONG_ITEM"
  | "MISSING_PARTS"
  | "NOT_AS_DESCRIBED"
  | "SIZE_FIT_ISSUE"
  | "QUALITY_NOT_EXPECTED"
  | "NO_LONGER_NEEDED"
  | "BETTER_PRICE"
  | "ORDERED_BY_MISTAKE";

export const RETURN_REASONS: { code: ReturnReasonCode; label: string; fault: "store" | "logistics" | "customer"; photos: boolean; fashionOnly?: boolean }[] = [
  { code: "DAMAGED_IN_TRANSIT", label: "Item arrived damaged", fault: "logistics", photos: true },
  { code: "DEFECTIVE", label: "Item is defective or not working", fault: "store", photos: true },
  { code: "WRONG_ITEM", label: "Received a different item", fault: "store", photos: true },
  { code: "MISSING_PARTS", label: "Parts or accessories are missing", fault: "store", photos: true },
  { code: "NOT_AS_DESCRIBED", label: "Item is not as described", fault: "store", photos: true },
  { code: "SIZE_FIT_ISSUE", label: "Size or fit is not right", fault: "customer", photos: false, fashionOnly: true },
  { code: "QUALITY_NOT_EXPECTED", label: "Quality is not as expected", fault: "customer", photos: false },
  { code: "NO_LONGER_NEEDED", label: "No longer needed", fault: "customer", photos: false },
  { code: "BETTER_PRICE", label: "Found a better price", fault: "customer", photos: false },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake", fault: "customer", photos: false },
];

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery date is too late",
  "Want to change the delivery address",
  "Want to change the payment method",
  "Want a different size, colour or quantity",
  "Other reason",
];

/** Next pickup slots for a return, skipping Sundays. */
export function pickupSlots(days = 4, from = NOW.getTime()) {
  const out: { date: string; windows: string[] }[] = [];
  let d = new Date(from + DAY);
  while (out.length < days) {
    const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(d);
    if (weekday !== "Sun") out.push({ date: d.toISOString(), windows: ["9 AM to 12 PM", "12 PM to 3 PM", "3 PM to 7 PM"] });
    d = new Date(d.getTime() + DAY);
  }
  return out;
}

/* ------------------------------- Returns ------------------------------- */
/** GET /v1/me/returns */

export interface ReturnEvent {
  label: string;
  at?: string;
  note?: string;
  done: boolean;
}

export interface AccountRefund {
  id: string;
  orderId: string;
  returnId?: string;
  source: "Return" | "Cancellation";
  title: string;
  image?: string;
  amount: number;
  destination: string;
  instant: boolean;
  status: RefundStatus;
  initiatedAt: string;
  completedAt?: string;
  expectedBy?: string;
  reference?: string;
}

export interface AccountReturn {
  id: string;
  orderId: string;
  itemId: string;
  productId: string;
  productTitle: string;
  image: string;
  variant?: string;
  sellerId: string;
  reasonCode: ReturnReasonCode;
  reason: string;
  comment?: string;
  resolution: Resolution;
  status: ReturnStatus;
  amount: number;
  requestedAt: string;
  pickup?: { date: string; window: string; addressId: string };
  rejectionReason?: string;
  replacementEta?: string;
  refund?: Omit<AccountRefund, "source" | "title" | "image" | "orderId" | "returnId">;
  events: ReturnEvent[];
}

function deliveredLine(slug: string, preferStatus?: Order["status"]) {
  const pool = preferStatus ? [...myOrders.filter((o) => o.status === preferStatus), ...myOrders] : myOrders;
  for (const order of pool) {
    const item = order.items.find((it) => it.productId === `p-${slug}`);
    if (item && order.deliveredAt) return { order, item };
  }
  return undefined;
}

type ReturnSeed = Omit<AccountReturn, "orderId" | "itemId" | "productId" | "productTitle" | "image" | "variant" | "sellerId" | "amount" | "reason"> & {
  slug: string;
  preferStatus?: Order["status"];
};

const returnSeeds: ReturnSeed[] = [
  {
    slug: "vase-ceramic",
    id: "RT-30916",
    reasonCode: "DAMAGED_IN_TRANSIT",
    comment: "One of the two vases has a chip on the rim.",
    resolution: "refund",
    status: "picked_up",
    requestedAt: ist("2026-09-26", "18:40"),
    pickup: { date: ist("2026-09-30", "08:00"), window: "8 AM to 11 AM", addressId: "addr-2" },
    refund: { id: "RF-82107", amount: 1299, destination: "AltasGoods Credits", instant: true, status: "completed", initiatedAt: ist("2026-09-30", "09:05"), completedAt: ist("2026-09-30", "09:32"), reference: "BBCR-90412" },
    events: [
      { label: "Return requested", at: ist("2026-09-26", "18:40"), done: true },
      { label: "Approved", at: ist("2026-09-26", "18:41"), note: "Within the 7 day return window", done: true },
      { label: "Pickup scheduled", at: ist("2026-09-26", "18:41"), note: "Wed, 30 Sept, 8 AM to 11 AM", done: true },
      { label: "Picked up", at: ist("2026-09-30", "08:52"), note: "Doorstep check passed", done: true },
      { label: "Refunded to AltasGoods Credits", at: ist("2026-09-30", "09:32"), note: "Instant refund at pickup", done: true },
      { label: "Received by seller", done: false },
    ],
  },
  {
    slug: "tablet-slate",
    preferStatus: "return_requested",
    id: "RT-30924",
    reasonCode: "DEFECTIVE",
    comment: "Touch screen stops responding after a few minutes.",
    resolution: "replacement",
    status: "pickup_scheduled",
    requestedAt: ist("2026-09-21", "21:15"),
    pickup: { date: ist("2026-10-02", "09:00"), window: "9 AM to 12 PM", addressId: "addr-1" },
    replacementEta: ist("2026-10-04", "19:00"),
    events: [
      { label: "Replacement requested", at: ist("2026-09-21", "21:15"), done: true },
      { label: "Approved after technician check", at: ist("2026-09-24", "16:20"), note: "Fault confirmed by video call", done: true },
      { label: "Pickup scheduled", at: ist("2026-09-29", "10:05"), note: "Rescheduled at your request to Fri, 2 Oct", done: true },
      { label: "Pickup", done: false },
      { label: "Replacement shipped", done: false },
    ],
  },
  {
    slug: "dress-summer",
    id: "RT-30931",
    reasonCode: "SIZE_FIT_ISSUE",
    comment: "Runs one size small around the shoulders.",
    resolution: "refund",
    status: "received",
    requestedAt: ist("2026-09-27", "10:05"),
    pickup: { date: ist("2026-09-29", "12:00"), window: "12 PM to 3 PM", addressId: "addr-2" },
    refund: { id: "RF-82131", amount: 1999, destination: "UPI, ananya.sharma@kaveri", instant: false, status: "processing", initiatedAt: ist("2026-09-29", "13:25"), expectedBy: ist("2026-10-01", "23:59"), reference: "UTR 627310458812" },
    events: [
      { label: "Return requested", at: ist("2026-09-27", "10:05"), done: true },
      { label: "Approved", at: ist("2026-09-27", "10:05"), note: "Within the 10 day return window", done: true },
      { label: "Picked up", at: ist("2026-09-29", "13:20"), note: "Doorstep check passed", done: true },
      { label: "Refund initiated", at: ist("2026-09-29", "13:25"), note: "To your UPI account", done: true },
      { label: "Received by Loom House Fashions", at: ist("2026-09-30", "17:10"), done: true },
      { label: "Refund credited", note: "Expected by today", done: false },
    ],
  },
  {
    slug: "watch-smart",
    id: "RT-30902",
    reasonCode: "MISSING_PARTS",
    comment: "Charging cable was not in the box.",
    resolution: "replacement",
    status: "replacement_shipped",
    requestedAt: ist("2026-09-27", "19:30"),
    pickup: { date: ist("2026-09-29", "09:00"), window: "9 AM to 12 PM", addressId: "addr-2" },
    replacementEta: ist("2026-10-02", "19:00"),
    events: [
      { label: "Replacement requested", at: ist("2026-09-27", "19:30"), done: true },
      { label: "Approved", at: ist("2026-09-27", "19:31"), note: "Replacement ships before the pickup", done: true },
      { label: "Replacement shipped", at: ist("2026-09-28", "15:10"), note: "Arriving by Fri, 2 Oct", done: true },
      { label: "Original item picked up", at: ist("2026-09-29", "10:40"), done: true },
      { label: "Replacement delivered", done: false },
    ],
  },
  {
    slug: "bag-leather",
    id: "RT-30887",
    reasonCode: "NOT_AS_DESCRIBED",
    comment: "The colour is a lot darker than the photos.",
    resolution: "refund",
    status: "rejected",
    requestedAt: ist("2026-09-23", "08:50"),
    pickup: { date: ist("2026-09-25", "12:00"), window: "12 PM to 3 PM", addressId: "addr-1" },
    rejectionReason: "The doorstep check could not be completed because the brand tag had been removed. If you think this is a mistake you can file an AltasGoods Guarantee claim.",
    events: [
      { label: "Return requested", at: ist("2026-09-23", "08:50"), done: true },
      { label: "Approved", at: ist("2026-09-23", "08:51"), done: true },
      { label: "Pickup attempted", at: ist("2026-09-25", "13:35"), note: "Doorstep check not passed: brand tag missing", done: true },
      { label: "Return closed", at: ist("2026-09-25", "13:40"), done: true },
    ],
  },
  {
    slug: "tea-assam",
    id: "RT-30744",
    reasonCode: "DAMAGED_IN_TRANSIT",
    comment: "Pouch was torn and the tea had spilled.",
    resolution: "refund",
    status: "completed",
    requestedAt: ist("2026-08-31", "20:10"),
    refund: { id: "RF-81988", amount: 399, destination: "Bank account ending 2210 (IMPS)", instant: false, status: "completed", initiatedAt: ist("2026-09-01", "10:15"), completedAt: ist("2026-09-02", "11:40"), reference: "UTR 624519730021" },
    events: [
      { label: "Return requested", at: ist("2026-08-31", "20:10"), done: true },
      { label: "Approved without pickup", at: ist("2026-08-31", "20:11"), note: "Low value item, no need to send it back", done: true },
      { label: "Refund initiated", at: ist("2026-09-01", "10:15"), note: "Cash on delivery order, refunded to your verified bank account", done: true },
      { label: "Refund credited", at: ist("2026-09-02", "11:40"), done: true },
    ],
  },
];

export const accountReturns: AccountReturn[] = returnSeeds
  .flatMap((seed) => {
    const { slug, preferStatus, ...rest } = seed;
    const line = deliveredLine(slug, preferStatus);
    if (!line) return [];
    const reason = RETURN_REASONS.find((r) => r.code === seed.reasonCode)!.label;
    return [
      {
        ...rest,
        orderId: line.order.id,
        itemId: line.item.id,
        productId: line.item.productId,
        productTitle: line.item.title,
        image: line.item.image,
        variant: line.item.variant,
        sellerId: line.item.sellerId,
        amount: line.item.price * line.item.quantity,
        reason,
      },
    ];
  })
  .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt));

export function returnForItem(orderId: string, itemId: string) {
  return accountReturns.find((r) => r.orderId === orderId && r.itemId === itemId);
}

const myOrderIds = new Set(accountOrders.map((o) => o.id));
const refundDestination: Record<PaymentMethod | "bluwallet", string> = {
  upi: "Original UPI account",
  card: "Original card",
  netbanking: "Original bank account",
  wallet: "AltasGoods Credits",
  bluwallet: "AltasGoods Credits",
  emi: "Original card (EMI reversed by the bank)",
  paylater: "AltasGoods Pay Later account",
  cod: "AltasGoods Credits",
  giftcard: "AltasGoods Credits",
};

/** Every refund for the customer: returns plus cancellations. */
export const accountRefunds: AccountRefund[] = [
  ...accountReturns
    .filter((r) => r.refund)
    .map((r) => ({ ...r.refund!, orderId: r.orderId, returnId: r.id, source: "Return" as const, title: r.productTitle, image: r.image })),
  ...refunds
    .filter((r) => myOrderIds.has(r.orderId))
    .map((r, i) => {
      const order = accountOrders.find((o) => o.id === r.orderId)!;
      return {
        id: r.id,
        orderId: r.orderId,
        source: "Cancellation" as const,
        title: order.items.length > 1 ? `${order.items[0]!.title} and ${order.items.length - 1} more` : order.items[0]!.title,
        image: order.items[0]!.image,
        amount: r.amount,
        destination: refundDestination[r.method],
        instant: false,
        status: r.status,
        initiatedAt: r.initiatedAt,
        completedAt: r.status === "completed" ? new Date(new Date(r.initiatedAt).getTime() + 26 * HOUR).toISOString() : undefined,
        reference: `UTR 6${String(24800193310 + i * 7919)}`,
      };
    }),
].sort((a, b) => +new Date(b.initiatedAt) - +new Date(a.initiatedAt));

/* ------------------------------ Addresses ------------------------------ */

/** Fields the shared Address type does not carry yet. */
export const addressExtras: Record<string, { instructions?: string; weekendDelivery: boolean }> = {
  "addr-1": { instructions: "Leave with the security desk at Tower B if I am not home.", weekendDelivery: true },
  "addr-2": { instructions: "Reception closes at 7 PM. Call before arriving.", weekendDelivery: false },
  "addr-3": { weekendDelivery: true },
};

/** Small pincode directory used to auto-fill city and state. */
export const PINCODES: Record<string, { city: string; state: string; locality: string }> = {
  "560087": { city: "Bengaluru", state: "Karnataka", locality: "Whitefield" },
  "560103": { city: "Bengaluru", state: "Karnataka", locality: "Bellandur" },
  "560034": { city: "Bengaluru", state: "Karnataka", locality: "Koramangala" },
  "560038": { city: "Bengaluru", state: "Karnataka", locality: "Indiranagar" },
  "110048": { city: "New Delhi", state: "Delhi", locality: "Greater Kailash" },
  "400050": { city: "Mumbai", state: "Maharashtra", locality: "Bandra West" },
  "411038": { city: "Pune", state: "Maharashtra", locality: "Kothrud" },
  "600020": { city: "Chennai", state: "Tamil Nadu", locality: "Adyar" },
  "500033": { city: "Hyderabad", state: "Telangana", locality: "Jubilee Hills" },
  "700019": { city: "Kolkata", state: "West Bengal", locality: "Ballygunge" },
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab",
  "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

/* ------------------------------- Wishlist ------------------------------ */
/** GET /v1/me/lists */

export interface WishlistSeed {
  id: string;
  name: string;
  isDefault?: boolean;
  visibility: "private" | "shared";
  sharedWith?: number;
  items: { slug: string; addedAt: string; priceWhenAdded: number; alert: boolean }[];
}

export const wishlists: WishlistSeed[] = [
  {
    id: "wl-default",
    name: "Your wishlist",
    isDefault: true,
    visibility: "private",
    items: [
      { slug: "watch-analog", addedAt: ist("2026-08-02"), priceWhenAdded: 9999, alert: true },
      { slug: "perfume-noir", addedAt: ist("2026-09-10"), priceWhenAdded: 3199, alert: true },
      { slug: "shoes-running", addedAt: ist("2026-09-18"), priceWhenAdded: 3999, alert: false },
      { slug: "keyboard-mech", addedAt: ist("2026-07-21"), priceWhenAdded: 5999, alert: true },
      { slug: "sunglasses-aviator", addedAt: ist("2026-09-02"), priceWhenAdded: 2299, alert: false },
      { slug: "coffee-maker", addedAt: ist("2026-08-26"), priceWhenAdded: 1899, alert: true },
    ],
  },
  {
    id: "wl-diwali",
    name: "Diwali gifting",
    visibility: "shared",
    sharedWith: 2,
    items: [
      { slug: "kurta-ethnic", addedAt: ist("2026-09-21"), priceWhenAdded: 1899, alert: true },
      { slug: "books-stack", addedAt: ist("2026-09-22"), priceWhenAdded: 1999, alert: false },
      { slug: "teddy-bear", addedAt: ist("2026-09-22"), priceWhenAdded: 899, alert: true },
      { slug: "almonds-premium", addedAt: ist("2026-09-25"), priceWhenAdded: 949, alert: true },
    ],
  },
  {
    id: "wl-home",
    name: "Home refresh",
    visibility: "private",
    items: [
      { slug: "lamp-arc", addedAt: ist("2026-06-30"), priceWhenAdded: 2299, alert: true },
      { slug: "sofa-oslo", addedAt: ist("2026-07-05"), priceWhenAdded: 34999, alert: true },
      { slug: "mugs-stone", addedAt: ist("2026-08-11"), priceWhenAdded: 899, alert: false },
    ],
  },
];

export const wishlistCount = new Set(wishlists.flatMap((l) => l.items.map((i) => i.slug))).size;

/* ------------------------ Discovery and history ------------------------ */

export const recentlyViewed = ["camera-mirrorless", "lamp-arc", "perfume-noir", "shoes-running", "monitor-ultra", "bag-leather", "earbuds-pods", "kurta-ethnic"];

export const recommendations: { slug: string; reason: string }[] = [
  { slug: "speaker-boom", reason: "Pairs with your headphones" },
  { slug: "keyboard-mech", reason: "Popular with Kestrel laptop owners" },
  { slug: "mugs-stone", reason: "Because you bought from Kiln & Co" },
  { slug: "coffee-beans", reason: "Customers like you also bought" },
  { slug: "yoga-mat", reason: "Trending in Bengaluru" },
  { slug: "serum-glow", reason: "Bestseller in Beauty" },
  { slug: "backpack-urban", reason: "Fits your 14 inch laptop" },
  { slug: "cookware-pan", reason: "Top rated in Kitchen" },
];

/* ---------------------------- Reviews, Q&A ----------------------------- */

export const myReviews = [
  { id: "mr-1", slug: "blender-pro", rating: 5, title: "Grinds idli batter perfectly", body: "Powerful motor and the jars lock in firmly. Noise is lower than my old one. Worth it.", createdAt: ist("2026-09-20", "21:10"), status: "published" as const, helpful: 14 },
  { id: "mr-2", slug: "laptop-air", rating: 4, title: "Light, fast, great screen", body: "Battery easily lasts a work day. Speakers could be louder, otherwise excellent.", createdAt: ist("2026-09-18", "22:30"), status: "published" as const, helpful: 31 },
  { id: "mr-3", slug: "watch-smart", rating: 3, title: "Good tracking, average strap", body: "Step and sleep tracking is accurate. The strap feels cheap for the price.", createdAt: ist("2026-09-29", "08:15"), status: "pending" as const, helpful: 0 },
  { id: "mr-4", slug: "tea-assam", rating: 5, title: "Malty and fresh", body: "Lovely second flush, brews strong with milk. Will reorder.", createdAt: ist("2026-09-03", "18:45"), status: "published" as const, helpful: 6 },
  { id: "mr-5", slug: "jacket-denim", rating: 2, title: "Delivery was late", body: "The delivery came two days after the promised date and the associate did not call.", createdAt: ist("2026-09-24", "12:00"), status: "rejected" as const, helpful: 0, rejectionReason: "Reviews are about the product. Please share delivery feedback as seller feedback instead." },
];

export const myQuestions = [
  {
    id: "q-1",
    slug: "camera-mirrorless",
    question: "Does the kit lens have image stabilisation?",
    askedAt: ist("2026-09-26", "19:20"),
    answers: [
      { by: "AltasGoods", role: "AltasGoods", body: "Yes, the 18-55 mm kit lens has optical stabilisation rated at 4.5 stops.", at: ist("2026-09-27", "10:05") },
      { by: "Karthik V.", role: "Verified buyer", body: "Yes, handheld video is quite smooth with it.", at: ist("2026-09-28", "18:40") },
    ],
  },
  { id: "q-2", slug: "sofa-oslo", question: "Are the cushion covers removable for washing?", askedAt: ist("2026-09-30", "21:05"), answers: [] },
];

/* ------------------------------- Support ------------------------------- */
/** GET /v1/me/tickets */

export interface CustomerTicket {
  id: string;
  subject: string;
  orderId?: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  lastFrom: "You" | "AltasGoods Care";
  responseDueAt?: string;
}

const tablet = deliveredLine("tablet-slate", "return_requested");
const jacket = deliveredLine("jacket-denim");
const laptop = deliveredLine("laptop-pro");

export const customerTickets: CustomerTicket[] = [
  {
    id: "TK-60412",
    subject: "Replacement for my tablet is taking long",
    orderId: tablet?.order.id,
    category: "Return and refund",
    status: "in_progress",
    priority: "normal",
    createdAt: ist("2026-09-29", "09:40"),
    updatedAt: ist("2026-09-30", "16:05"),
    lastMessage: "We have moved your pickup to Fri, 2 Oct and asked the seller to keep a replacement unit ready.",
    lastFrom: "AltasGoods Care",
    responseDueAt: ist("2026-10-01", "16:05"),
  },
  {
    id: "TK-60377",
    subject: "Jacket colour looks different from the listing",
    orderId: jacket?.order.id,
    category: "Product quality",
    status: "awaiting_customer",
    priority: "normal",
    createdAt: ist("2026-09-27", "12:30"),
    updatedAt: ist("2026-09-28", "10:15"),
    lastMessage: "Could you share a photo of the jacket in daylight so we can compare it with the listing?",
    lastFrom: "AltasGoods Care",
  },
  {
    id: "TK-60218",
    subject: "Refund for cancelled order not in my account",
    orderId: accountRefunds.find((r) => r.source === "Cancellation")?.orderId,
    category: "Return and refund",
    status: "resolved",
    priority: "high",
    createdAt: ist("2026-09-10", "11:20"),
    updatedAt: ist("2026-09-11", "15:45"),
    lastMessage: "Your bank has confirmed the credit. The UTR is on the refund page. Glad we could help.",
    lastFrom: "AltasGoods Care",
  },
  {
    id: "TK-60105",
    subject: "Need a GST invoice with my company details",
    orderId: laptop?.order.id,
    category: "Other",
    status: "closed",
    priority: "low",
    createdAt: ist("2026-09-08", "17:10"),
    updatedAt: ist("2026-09-12", "10:00"),
    lastMessage: "The seller has issued a revised invoice with your GSTIN. You can download it from the order page.",
    lastFrom: "AltasGoods Care",
  },
];

export const guaranteeClaims = [
  { id: "GC-10872", orderId: "BB-260704-18823", title: "Item not received: Northbound Urban backpack", status: "Granted" as const, amount: 1799, filedAt: ist("2026-07-12"), decidedAt: ist("2026-07-16") },
];

/* ---------------------------- Notifications ---------------------------- */

const ofd = outForDeliveryOrder;

const extraNotifications: Notification[] = [
  { id: "c-5", kind: "alert", title: "Price drop on your wishlist", body: "Meridian Heritage Automatic Analog Watch is now ₹1,000 lower than when you saved it.", at: hoursAgo(6), read: false, href: "/account/wishlist" },
  { id: "c-6", kind: "order", title: "Return pickup on Fri, 2 Oct", body: "Keep the Novatek Slate 11 Tablet ready with its box and charger. Pickup between 9 AM and 12 PM.", at: hoursAgo(19), read: false, href: "/account/returns" },
  { id: "c-7", kind: "account", title: "New sign-in to your account", body: "A new sign-in from an Android phone in Bengaluru. If this was not you, sign out of all devices.", at: hoursAgo(52), read: true, href: "/account/profile" },
  { id: "c-9", kind: "order", title: "Replacement shipped", body: "Your replacement Orbit Watch S3 is on its way and will arrive by Fri, 2 Oct.", at: hoursAgo(67), read: true, href: "/account/returns" },
];

export const accountNotifications: Notification[] = [
  ...customerNotifications.map((n) => (n.id === "c-1" ? { ...n, href: `/account/orders/${ofd.id}` } : n)),
  ...extraNotifications,
].sort((a, b) => +new Date(b.at) - +new Date(a.at));

export type Channel = "push" | "sms" | "email" | "whatsapp";

export const NOTIFICATION_PREFS: { key: string; label: string; description: string; transactional: boolean; channels: Record<Channel, boolean> }[] = [
  { key: "orders", label: "Order and delivery updates", description: "Confirmation, shipping, out for delivery, delivery OTP", transactional: true, channels: { push: true, sms: true, email: true, whatsapp: true } },
  { key: "returns", label: "Returns and refunds", description: "Pickup reminders and refund status", transactional: true, channels: { push: true, sms: true, email: true, whatsapp: false } },
  { key: "security", label: "Account and security", description: "Sign-ins, OTPs and changes to your account", transactional: true, channels: { push: true, sms: true, email: true, whatsapp: false } },
  { key: "offers", label: "Offers and sale events", description: "AltasGoods Big Days, bank offers and coupons", transactional: false, channels: { push: true, sms: false, email: true, whatsapp: false } },
  { key: "price", label: "Price drops and back in stock", description: "For items in your wishlists", transactional: false, channels: { push: true, sms: false, email: false, whatsapp: true } },
  { key: "reminders", label: "Cart and wishlist reminders", description: "Items you left behind", transactional: false, channels: { push: false, sms: false, email: false, whatsapp: false } },
];

/* ------------------------- Security and privacy ------------------------ */

export const sessions = [
  { id: "ss-1", device: "Laptop, web browser", platform: "laptop" as const, location: "Bengaluru, Karnataka", ip: "49.207.xx.xx", lastActive: NOW.toISOString(), current: true },
  { id: "ss-2", device: "Android phone, AltasGoods app", platform: "phone" as const, location: "Bengaluru, Karnataka", ip: "106.51.xx.xx", lastActive: hoursAgo(2), current: false },
  { id: "ss-3", device: "Tablet, AltasGoods app", platform: "tablet" as const, location: "Bengaluru, Karnataka", ip: "49.207.xx.xx", lastActive: hoursAgo(76), current: false },
  { id: "ss-4", device: "Desktop, web browser", platform: "desktop" as const, location: "New Delhi, Delhi", ip: "122.161.xx.xx", lastActive: hoursAgo(24 * 19), current: false },
];

export const consents = [
  { key: "personalisation", label: "Personalised recommendations", description: "Use my orders and browsing on AltasGoods to suggest products.", granted: true, since: ist("2021-03-14") },
  { key: "marketing", label: "Promotional messages", description: "Send offers on the channels I have turned on in notification settings.", granted: true, since: ist("2023-10-02") },
  { key: "paylater", label: "Share data with the AltasGoods Pay Later lender", description: "Share my name, mobile and repayment history with Avanti Finance Limited for credit decisions.", granted: true, since: ist("2026-02-11") },
  { key: "research", label: "Product research", description: "Invite me to surveys and usability studies.", granted: false, since: undefined as string | undefined },
];

export const dataRequests = [
  { id: "DR-2291", type: "Download my data", requestedAt: ist("2026-04-11", "20:12"), status: "Completed", completedAt: ist("2026-04-12", "09:30") },
];

/* ------------------------------- Helpers ------------------------------- */

export function productBySlug(slug: string) {
  return products.find((p) => p.slug === slug);
}
