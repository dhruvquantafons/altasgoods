/**
 * Pure helpers for the customer account area: IST date formatting, the
 * customer-facing status mapping (spec 11.20), cancellation and return
 * eligibility (spec 10.4 and 10.5). Server safe, no client code.
 */
import type { Order, OrderItem } from "@/lib/types";
import {
  ORDER_STATUS,
  REFUND_STATUS,
  RETURN_STATUS,
  TICKET_STATUS,
  type OrderStatus,
  type PaymentMethod,
  type RefundStatus,
  type ReturnStatus,
  type StatusMeta,
  type TicketStatus,
} from "@/lib/status";
import { getProduct, getSeller } from "@/lib/mock";
import { returnForItem, returnPolicyFor, SECURE_DELIVERY, type AccountReturn, type ReturnPolicy } from "@/lib/mock/account-extra";
import { formatINR, NOW } from "@/lib/utils";

/* ------------------------------ Dates (IST) ----------------------------- */

const TZ = "Asia/Kolkata";
const fmtDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const fmtDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const fmtShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const fmtKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

/** "Sat, 26 Sept" */
export const dayLabel = (d: string | Date) => fmtDay.format(new Date(d));
/** "26 Sept 2026" */
export const dateLabel = (d: string | Date) => fmtDate.format(new Date(d));
/** "26 Sept" */
export const shortDate = (d: string | Date) => fmtShort.format(new Date(d));
/** "3:30 pm" */
export const timeLabel = (d: string | Date) => fmtTime.format(new Date(d));
/** "26 Sept, 3:30 pm" */
export const dateTimeLabel = (d: string | Date) => `${shortDate(d)}, ${timeLabel(d)}`;

const dayKey = (d: string | Date) => fmtKey.format(new Date(d));
const DAY = 86400_000;

/** "today", "tomorrow" or "Sat, 26 Sept" relative to NOW. */
export function relativeDay(d: string | Date) {
  const key = dayKey(d);
  if (key === dayKey(NOW)) return "today";
  if (key === dayKey(new Date(NOW.getTime() + DAY))) return "tomorrow";
  if (key === dayKey(new Date(NOW.getTime() - DAY))) return "yesterday";
  return dayLabel(d);
}

export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(NOW));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ---------------------------- Order buckets ---------------------------- */

export const ACTIVE_STATUSES: OrderStatus[] = ["pending_payment", "placed", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "undelivered"];
export const DELIVERED_STATUSES: OrderStatus[] = ["delivered", "return_requested", "returned"];
export const CANCELLED_STATUSES: OrderStatus[] = ["cancelled", "rto_in_transit", "returned_to_seller"];

export const isActive = (s: OrderStatus) => ACTIVE_STATUSES.includes(s);

export function deliveredAt(order: Order) {
  return order.deliveredAt ?? order.timeline.find((e) => e.status === "delivered")?.at;
}

/* ------------------------- Customer-facing labels ------------------------ */

const label = (text: string, tone: StatusMeta["tone"]): StatusMeta => ({ label: text, tone });

/** Customer audience labels for an order item (spec 11.20). */
export const CUSTOMER_ITEM_STATUS: Record<OrderStatus, StatusMeta> = {
  pending_payment: label("Payment pending", "warning"),
  placed: label("Ordered", "info"),
  confirmed: label("Ordered", "info"),
  packed: label("Packed", ORDER_STATUS.packed.tone),
  ready_to_ship: label("Packed", ORDER_STATUS.ready_to_ship.tone),
  shipped: label("Shipped", ORDER_STATUS.shipped.tone),
  in_transit: label("Shipped", ORDER_STATUS.in_transit.tone),
  out_for_delivery: label("Out for delivery", ORDER_STATUS.out_for_delivery.tone),
  delivered: label("Delivered", "success"),
  cancelled: label("Cancelled", "neutral"),
  undelivered: label("Delivery attempted", "warning"),
  rto_in_transit: label("Returning to seller", "warning"),
  returned_to_seller: label("Returned to seller", "neutral"),
  return_requested: label("Return in progress", "info"),
  returned: label("Returned", "neutral"),
};

/** Return statuses for the customer: same words as RETURN_STATUS, customer tones (spec 17.4). */
export const CUSTOMER_RETURN_STATUS: Record<ReturnStatus, StatusMeta> = {
  ...RETURN_STATUS,
  requested: label("Requested", "info"),
  rejected: label("Not accepted", "danger"),
  received: label("Received by seller", "brand"),
  qc_passed: label("Quality check passed", "success"),
  qc_failed: label("Quality check failed", "danger"),
  refund_initiated: label("Refund initiated", "info"),
};

export const CUSTOMER_REFUND_STATUS: Record<RefundStatus, StatusMeta> = {
  ...REFUND_STATUS,
  initiated: label("Refund initiated", "info"),
  processing: label("Refund processing", "brand"),
  completed: label("Refunded", "success"),
  failed: label("Refund failed", "danger"),
};

export const CUSTOMER_TICKET_STATUS: Record<TicketStatus, StatusMeta> = {
  ...TICKET_STATUS,
  open: label("Received", "info"),
  awaiting_customer: label("Awaiting your reply", "warning"),
  pending_internal: label("We are looking into it", "info"),
  escalated: label("With a specialist", "warning"),
};

export interface ItemState {
  meta: StatusMeta;
  /** e.g. "Delivered on Sat, 26 Sept" or "Arriving by Fri, 3 Oct" */
  headline: string;
  detail?: string;
  ret?: AccountReturn;
}

function arrivalHeadline(order: Order) {
  const promised = new Date(order.promisedBy);
  if (order.status === "out_for_delivery") return `Arriving today by ${timeLabel(promised)}`;
  if (promised.getTime() < NOW.getTime()) return `Running late, now arriving ${relativeDay(new Date(NOW.getTime() + DAY))}`;
  const rel = relativeDay(promised);
  return rel === "today" || rel === "tomorrow" ? `Arriving ${rel}` : `Arriving by ${rel}`;
}

/** Everything a list or detail row needs to show the state of one item. */
/** The open or latest return of a line: from the API for live orders, else the sample data. */
const returnOf = (order: Order, item: OrderItem) =>
  order.returns ? (order.returns.find((r) => r.itemId === item.id && r.status !== "cancelled") ?? order.returns.find((r) => r.itemId === item.id)) : returnForItem(order.id, item.id);

export function itemState(order: Order, item: OrderItem): ItemState {
  const ret = returnOf(order, item);
  if (ret && ret.status !== "cancelled") {
    const refundDone = ret.refund?.status === "completed";
    if (ret.status === "rejected") return { meta: label("Return not accepted", "danger"), headline: "Return closed after the doorstep check", ret };
    if (ret.resolution === "refund" && refundDone)
      return { meta: label("Refunded", "success"), headline: `${formatINR(ret.refund!.amount)} refunded on ${shortDate(ret.refund!.completedAt!)}`, detail: `To ${ret.refund!.destination}`, ret };
    if (ret.status === "completed") return { meta: label(ret.resolution === "refund" ? "Returned" : "Replaced", "success"), headline: `Completed on ${shortDate(ret.events.at(-1)?.at ?? ret.requestedAt)}`, ret };
    if (ret.status === "replacement_shipped")
      return { meta: label("Replacement on the way", "brand"), headline: ret.replacementEta ? `Arriving by ${relativeDay(ret.replacementEta)}` : "Replacement shipped", ret };
    if (ret.refund && ret.refund.status !== "completed")
      return { meta: CUSTOMER_REFUND_STATUS[ret.refund.status], headline: `${formatINR(ret.refund.amount)} to ${ret.refund.destination}`, detail: ret.refund.expectedBy ? `Expected by ${relativeDay(ret.refund.expectedBy)}` : undefined, ret };
    const noun = ret.resolution === "refund" ? "Return" : ret.resolution === "replacement" ? "Replacement" : "Exchange";
    return {
      meta: label(`${noun} in progress`, "info"),
      headline: ret.status === "pickup_scheduled" && ret.pickup ? `Pickup ${relativeDay(ret.pickup.date)}, ${ret.pickup.window}` : `${CUSTOMER_RETURN_STATUS[ret.status].label}`,
      ret,
    };
  }

  const s = item.status;
  const meta = CUSTOMER_ITEM_STATUS[s];
  switch (s) {
    case "pending_payment":
      return { meta, headline: "Complete payment to confirm this order" };
    case "delivered": {
      const d = deliveredAt(order);
      return { meta, headline: d ? `Delivered on ${dayLabel(d)}` : "Delivered" };
    }
    case "cancelled": {
      const at = order.timeline.at(-1)?.at ?? order.placedAt;
      return { meta, headline: `Cancelled on ${dayLabel(at)}`, detail: order.payment.method === "cod" ? "No payment was taken" : "Refund completed to your original payment method" };
    }
    case "undelivered":
      return { meta, headline: "We missed you. Next attempt tomorrow", detail: "Choose a new date or update the address details" };
    case "rto_in_transit":
      return { meta, headline: "Delivery could not be completed", detail: order.payment.method === "cod" ? "No payment was taken" : "Refund starts when the seller receives it" };
    case "returned_to_seller":
      return { meta, headline: "Returned to the seller", detail: order.payment.method === "cod" ? "No payment was taken" : "Refund completed" };
    case "return_requested":
      return { meta, headline: "Return requested" };
    case "returned":
      return { meta, headline: "Returned, refund completed" };
    default:
      return { meta, headline: arrivalHeadline(order) };
  }
}

/* ------------------------------- Tracking ------------------------------- */

export const TRACK_STEPS = ["Ordered", "Packed", "Shipped", "Out for delivery", "Delivered"] as const;

/** Stepper `current`: index of the first step not yet reached (5 = all done). */
export function trackIndex(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return 0;
    case "placed":
    case "confirmed":
      return 1;
    case "packed":
    case "ready_to_ship":
      return 2;
    case "shipped":
    case "in_transit":
    case "undelivered":
    case "rto_in_transit":
      return 3;
    case "out_for_delivery":
      return 4;
    case "delivered":
    case "return_requested":
    case "returned":
      return 5;
    default:
      return -1;
  }
}

/** Date shown under each tracking step: when it happened, or the promise. */
export function trackSteps(order: Order) {
  const find = (...keys: string[]) => [...order.timeline].reverse().find((e) => keys.includes(e.status))?.at;
  const at = [find("placed"), find("packed", "ready_to_ship"), find("shipped", "in_transit"), find("out_for_delivery"), find("delivered")];
  const current = trackIndex(order.status);
  return TRACK_STEPS.map((stepLabel, i) => ({
    label: stepLabel,
    description: at[i] && i < current ? dayLabel(at[i]!) : i === 4 && current < 5 ? `By ${dayLabel(order.promisedBy)}` : undefined,
  }));
}

/* ----------------------------- Eligibility ------------------------------ */

/** Spec 10.4: self-cancel before shipment, request cancellation once shipped. */
export function cancelMode(status: OrderStatus): "cancel" | "request" | null {
  if (["pending_payment", "placed", "confirmed", "packed", "ready_to_ship"].includes(status)) return "cancel";
  if (["shipped", "in_transit"].includes(status)) return "request";
  return null;
}

export interface ReturnInfo {
  eligible: boolean;
  policy: ReturnPolicy;
  /** last day to request any return (damage claims get at least 7 days) */
  windowEndsAt?: string;
  reason?: string;
}

export function returnInfo(order: Order, item: OrderItem): ReturnInfo {
  const policy = returnPolicyFor(getProduct(item.productId));
  const existing = returnOf(order, item);
  // live orders are judged against the real clock, sample orders against the demo clock
  const now = order.returns ? Date.now() : NOW.getTime();
  if (existing && existing.status !== "cancelled") return { eligible: false, policy, reason: "A return is already open for this item" };
  if (item.status !== "delivered") return { eligible: false, policy, reason: "Returns open once the item is delivered" };
  const d = deliveredAt(order);
  if (!d) return { eligible: false, policy, reason: "Returns open once the item is delivered" };
  const ends = new Date(new Date(d).getTime() + Math.max(policy.days, 7) * DAY);
  if (ends.getTime() < now) return { eligible: false, policy, windowEndsAt: ends.toISOString(), reason: `Return window closed on ${shortDate(ends)}` };
  return { eligible: true, policy, windowEndsAt: ends.toISOString() };
}

/** BluBuy Secure Delivery applies to high-value or sensitive items (spec 10.14). */
export function needsSecureDelivery(order: Order) {
  return order.items.some((it) => it.price >= SECURE_DELIVERY.threshold || SECURE_DELIVERY.sensitiveCategories.includes(getProduct(it.productId)?.categoryId ?? ""));
}

/* ------------------------------- Payments ------------------------------- */

export function paymentLabel(method: PaymentMethod) {
  switch (method) {
    case "upi":
      return "UPI, ananya.sharma@kaveri";
    case "card":
      return "Kaveri Bank credit card ending 4821";
    case "emi":
      return "No cost EMI, Kaveri Bank credit card";
    case "netbanking":
      return "Net banking, Sahyadri Bank";
    case "wallet":
      return "BluBuy Credits";
    case "paylater":
      return "BluBuy Pay Later";
    case "giftcard":
      return "BluBuy Gift Card";
    case "cod":
      return "Pay on delivery";
  }
}

/** Refund timing for the original method (spec 10.5.5). */
export function refundTiming(method: PaymentMethod) {
  switch (method) {
    case "upi":
    case "wallet":
    case "paylater":
      return method === "wallet" ? "Under 2 hours" : "1 to 2 business days";
    case "giftcard":
      return "Under 2 hours";
    default:
      return "3 to 5 business days";
  }
}

export function sellerName(id: string) {
  return getSeller(id)?.displayName ?? "BluBuy seller";
}

export function shortTitle(title: string) {
  return title.split(/[,(]/)[0]!.trim();
}

export function itemCountLabel(n: number) {
  return `${n} ${n === 1 ? "item" : "items"}`;
}
