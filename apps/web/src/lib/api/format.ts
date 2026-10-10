import type { OrderStatus as UiOrderStatus, PaymentMethod as UiMethod, PaymentStatus as UiPaymentStatus } from "@/lib/status";
import { formatINR } from "@/lib/utils";
import type { ApiOrderItemStatus, ApiOrderStatus, Order } from "./types";

/** The built-in store record every real order line belongs to (the API's HOUSE_SELLER_ID). */
export const STORE_ID = "s-altasgoods";

/** The API speaks paise; the UI shows rupees with Indian grouping. */
export const paise = (p: number) => formatINR(p / 100);
export const paiseExact = (p: number) => formatINR(p / 100, { paise: p % 100 !== 0 });
export const toPaise = (rupees: number) => Math.round(rupees * 100);

/**
 * Canonical API item statuses (spec section 11) to the UI status keys used by
 * StatusBadge and ORDER_STATUS in lib/status.ts.
 */
const ITEM_TO_UI: Record<ApiOrderItemStatus, UiOrderStatus> = {
  PENDING: "pending_payment",
  NEW: "placed",
  ACCEPTED: "confirmed",
  PACKED: "packed",
  READY_TO_SHIP: "ready_to_ship",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLATION_REQUESTED: "cancelled",
  CANCELLED: "cancelled",
  RTO_IN_TRANSIT: "rto_in_transit",
  RTO_RECEIVED: "returned_to_seller",
  LOST: "undelivered",
  RETURN_REQUESTED: "return_requested",
  RETURN_IN_PROGRESS: "return_requested",
  RETURNED: "returned",
  REPLACED: "delivered",
  CLOSED: "delivered",
};
export const uiItemStatus = (s: ApiOrderItemStatus) => ITEM_TO_UI[s];

const ORDER_TO_UI: Record<ApiOrderStatus, UiOrderStatus> = {
  PAYMENT_PENDING: "pending_payment",
  PAYMENT_FAILED: "pending_payment",
  ABANDONED: "cancelled",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "packed",
  PARTIALLY_SHIPPED: "shipped",
  SHIPPED: "shipped",
  PARTIALLY_DELIVERED: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  CLOSED: "delivered",
};
export const uiOrderStatus = (s: ApiOrderStatus) => ORDER_TO_UI[s];

const METHOD: Record<Order["paymentMethod"], UiMethod> = { UPI: "upi", CARD: "card", NETBANKING: "netbanking", EMI: "emi", PAY_LATER: "paylater", COD: "cod" };
export const uiPaymentMethod = (m: Order["paymentMethod"]) => METHOD[m];

const PAYMENT: Record<Order["paymentStatus"], UiPaymentStatus> = {
  CREATED: "pending",
  PENDING: "pending",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  FAILED: "failed",
  EXPIRED: "failed",
  CANCELLED: "failed",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
  COD_PENDING: "cod_pending",
  COD_COLLECTED: "cod_collected",
};
export const uiPaymentStatus = (s: Order["paymentStatus"]) => PAYMENT[s];
