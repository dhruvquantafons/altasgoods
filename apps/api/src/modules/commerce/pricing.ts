/**
 * Pure pricing rules for customers: coupons, the delivery fee, delivery
 * promises and dispatch deadlines. Everything is integer paise.
 */
import { istAt, istParts } from "../../common/time.js";

/** Customer delivery fee: free for orders of ₹499 or more. */
export const FREE_DELIVERY_FROM_PAISE = 49_900;
export const DELIVERY_FEE_PAISE = 4_000;
export const COD_LIMIT_PAISE = 5_000_000;
export const PAYMENT_WINDOW_MS = 30 * 60_000;

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

export function deliveryFee(subtotalPaise: number) {
  return subtotalPaise >= FREE_DELIVERY_FROM_PAISE ? 0 : DELIVERY_FEE_PAISE;
}

/** Orders confirmed before 2 pm IST count from today. */
const CUTOFF_HOUR = 14;
const startDays = (now: Date) => (istParts(now).hour >= CUTOFF_HOUR ? 1 : 0);

/** Delivery promise: end of day (9 pm IST) after the offer's delivery days. */
export function promiseDate(now: Date, deliveryDays: number) {
  return istAt(now, startDays(now) + deliveryDays, 21);
}

/** The store hands the parcel to the courier by 6 pm IST after the handling days. */
export function dispatchByDate(now: Date, handlingDays: number) {
  return istAt(now, startDays(now) + Math.max(0, handlingDays - 1), 18);
}
