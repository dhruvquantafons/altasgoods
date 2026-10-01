/**
 * Pure pricing rules. Everything is integer paise. Rates follow the example
 * rate card RC-2026-EXAMPLE (docs/research/01-marketplace-workflows.md
 * sections 13 and 14); the commercial team owns the real numbers.
 */
import type { FeeLine } from "../../db/schema.js";
import { istAt, istParts } from "../../common/time.js";

export const RATE_CARD_VERSION = "RC-2026-EXAMPLE";

export type Tier = "Platinum" | "Gold" | "Silver" | "Bronze";

/** Items priced up to this (inclusive) pay 0% commission. */
export const COMMISSION_FREE_UPTO_PAISE = 99_900;
const FIXED_FEE_SLABS: { upTo: number; fee: number }[] = [
  { upTo: 25_000, fee: 400 },
  { upTo: 50_000, fee: 800 },
  { upTo: 100_000, fee: 2_000 },
  { upTo: 500_000, fee: 4_000 },
  { upTo: Infinity, fee: 5_500 },
];
const TIER_FIXED_MODIFIER: Record<Tier, number> = { Platinum: 0, Gold: 200, Silver: 500, Bronze: 1_000 };
/** Regional lane (the common case until zones are computed from pincodes). */
const SHIPPING_REGIONAL: { upToGrams: number; fee: number }[] = [
  { upToGrams: 500, fee: 3_800 },
  { upToGrams: 1_000, fee: 5_000 },
  { upToGrams: 2_000, fee: 6_500 },
  { upToGrams: 5_000, fee: 9_500 },
];
const SHIPPING_EXTRA_PER_KG = 1_500;
const TIER_SHIPPING_DISCOUNT_PCT: Record<Tier, number> = { Platinum: 15, Gold: 10, Silver: 5, Bronze: 0 };
const GST_RATE = 0.18;
const TCS_RATE = 0.005;
const TDS_RATE = 0.001;

/** Customer delivery fee: free for Plus members and seller shipments of ₹499 or more. */
export const FREE_DELIVERY_FROM_PAISE = 49_900;
export const DELIVERY_FEE_PAISE = 4_000;
export const COD_LIMIT_PAISE = 5_000_000;
export const PAYMENT_WINDOW_MS = 30 * 60_000;

const roundHalfUp = (v: number) => Math.round(v + Number.EPSILON);

export function shippingFee(weightGrams: number, tier: Tier) {
  const slab = SHIPPING_REGIONAL.find((s) => weightGrams <= s.upToGrams);
  const base = slab ? slab.fee : SHIPPING_REGIONAL.at(-1)!.fee + Math.ceil((weightGrams - 5_000) / 1_000) * SHIPPING_EXTRA_PER_KG;
  return roundHalfUp(base * (1 - TIER_SHIPPING_DISCOUNT_PCT[tier] / 100));
}

export function fixedFee(unitPricePaise: number, qty: number, tier: Tier) {
  const perUnit = FIXED_FEE_SLABS.find((s) => unitPricePaise <= s.upTo)!.fee + TIER_FIXED_MODIFIER[tier];
  // second and later units of the same product in one package pay half
  return roundHalfUp(perUnit + (qty - 1) * perUnit * 0.5);
}

/**
 * Settlement for one order line (spec 14.1). Deductions are negative.
 * Commission is on the GST inclusive selling price; TCS and TDS on taxable value.
 */
export function settleLine(input: { unitPricePaise: number; qty: number; commissionBps: number; tier: Tier; weightGrams: number }) {
  const gross = input.unitPricePaise * input.qty;
  const pct = input.unitPricePaise <= COMMISSION_FREE_UPTO_PAISE ? 0 : input.commissionBps / 100;
  const commission = roundHalfUp((gross * pct) / 100);
  const fixed = fixedFee(input.unitPricePaise, input.qty, input.tier);
  const shipping = shippingFee(input.weightGrams, input.tier);
  const fees = commission + fixed + shipping;
  const gst = roundHalfUp(fees * GST_RATE);
  const taxable = gross / 1.18;
  const tcs = roundHalfUp(taxable * TCS_RATE);
  const tds = roundHalfUp(taxable * TDS_RATE);
  const lines: FeeLine[] = [
    { code: "COMMISSION", label: `Commission (${pct}%)`, amountPaise: -commission },
    { code: "FIXED_FEE", label: "Fixed fee", amountPaise: -fixed },
    { code: "SHIPPING_FEE", label: "Shipping fee", amountPaise: -shipping },
    { code: "GST_ON_FEES", label: "GST on fees (18%)", amountPaise: -gst },
    { code: "TCS", label: "TCS (0.5%)", amountPaise: -tcs },
    { code: "TDS", label: "TDS u/s 194-O (0.1%)", amountPaise: -tds },
  ];
  return { fees: lines, netPaise: gross + lines.reduce((a, l) => a + l.amountPaise, 0) };
}

export interface CouponRule {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  startsAt: Date;
  endsAt: Date;
  status: "ACTIVE" | "PAUSED";
  usageLimit: number | null;
  usageCount: number;
}

/** Discount for a coupon on an order subtotal, or the reason it does not apply. */
export function couponDiscount(c: CouponRule, subtotalPaise: number, now: Date): { discountPaise: number; message: string } {
  if (c.status !== "ACTIVE" || now < c.startsAt) return { discountPaise: 0, message: "This coupon is not active yet" };
  if (now > c.endsAt) return { discountPaise: 0, message: "This coupon has expired" };
  if (c.usageLimit !== null && c.usageCount >= c.usageLimit) return { discountPaise: 0, message: "This coupon has been fully redeemed" };
  if (subtotalPaise < c.minOrderPaise) return { discountPaise: 0, message: `Add items worth ₹${Math.ceil((c.minOrderPaise - subtotalPaise) / 100)} more to use this coupon` };
  const raw = c.type === "PERCENT" ? Math.floor((subtotalPaise * c.value) / 100) : c.value;
  const capped = c.maxDiscountPaise !== null ? Math.min(raw, c.maxDiscountPaise) : raw;
  return { discountPaise: Math.min(capped, subtotalPaise), message: "Coupon applied" };
}

export function deliveryFee(shipmentSubtotalPaise: number, isPlus: boolean) {
  return isPlus || shipmentSubtotalPaise >= FREE_DELIVERY_FROM_PAISE ? 0 : DELIVERY_FEE_PAISE;
}

/** Orders confirmed before 2 pm IST count from today. */
const CUTOFF_HOUR = 14;
const startDays = (now: Date) => (istParts(now).hour >= CUTOFF_HOUR ? 1 : 0);

/** Delivery promise: end of day (9 pm IST) after the offer's delivery days. */
export function promiseDate(now: Date, deliveryDays: number) {
  return istAt(now, startDays(now) + deliveryDays, 21);
}

/** Seller must hand over by 6 pm IST after the handling days. */
export function dispatchByDate(now: Date, handlingDays: number) {
  return istAt(now, startDays(now) + Math.max(0, handlingDays - 1), 18);
}
