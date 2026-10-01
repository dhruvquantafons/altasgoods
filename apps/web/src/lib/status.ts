/**
 * Canonical state machines for BluBuy. Every dashboard renders statuses through
 * these maps so a status always has the same label and colour everywhere.
 * See docs/architecture/state-machines.md for the transition rules.
 */

export type Tone = "neutral" | "info" | "brand" | "success" | "warning" | "danger" | "accent";

export interface StatusMeta {
  label: string;
  tone: Tone;
  description?: string;
}

type StatusMap<K extends string> = Record<K, StatusMeta>;

/* ------------------------------- Order ------------------------------- */

export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "confirmed"
  | "packed"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "undelivered"
  | "rto_in_transit"
  | "returned_to_seller"
  | "return_requested"
  | "returned";

export const ORDER_STATUS: StatusMap<OrderStatus> = {
  pending_payment: { label: "Payment pending", tone: "neutral", description: "Awaiting payment confirmation from the gateway" },
  placed: { label: "Placed", tone: "info", description: "Order received, waiting for seller confirmation" },
  confirmed: { label: "Confirmed", tone: "info", description: "Seller accepted the order" },
  packed: { label: "Packed", tone: "brand", description: "Packed, invoice and label generated" },
  ready_to_ship: { label: "Ready to ship", tone: "brand", description: "Manifested and awaiting pickup" },
  shipped: { label: "Shipped", tone: "brand", description: "Picked up by BluBuy Logistics" },
  in_transit: { label: "In transit", tone: "brand", description: "Moving between hubs" },
  out_for_delivery: { label: "Out for delivery", tone: "accent", description: "With a delivery associate today" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  undelivered: { label: "Delivery failed", tone: "warning", description: "Delivery attempt failed, re-attempt scheduled" },
  rto_in_transit: { label: "Returning to seller", tone: "danger", description: "Return to origin after failed attempts" },
  returned_to_seller: { label: "Returned to seller", tone: "neutral" },
  return_requested: { label: "Return requested", tone: "warning" },
  returned: { label: "Returned", tone: "neutral" },
};

/** Allowed forward transitions. Anything not listed is rejected by the backend. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["placed", "cancelled"],
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["in_transit"],
  in_transit: ["out_for_delivery", "rto_in_transit"],
  out_for_delivery: ["delivered", "undelivered"],
  undelivered: ["out_for_delivery", "rto_in_transit"],
  rto_in_transit: ["returned_to_seller"],
  returned_to_seller: [],
  delivered: ["return_requested"],
  return_requested: ["returned", "delivered"],
  returned: [],
  cancelled: [],
};

/** Customer-facing progress steps used by the tracking timeline. */
export const ORDER_TRACKING_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "placed", label: "Ordered" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

/* ------------------------------ Return ------------------------------- */

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "picked_up"
  | "received"
  | "qc_passed"
  | "qc_failed"
  | "refund_initiated"
  | "replacement_shipped"
  | "completed"
  | "cancelled";

export const RETURN_STATUS: StatusMap<ReturnStatus> = {
  requested: { label: "Requested", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  rejected: { label: "Rejected", tone: "danger" },
  pickup_scheduled: { label: "Pickup scheduled", tone: "info" },
  picked_up: { label: "Picked up", tone: "brand" },
  received: { label: "Received", tone: "brand" },
  qc_passed: { label: "QC passed", tone: "success" },
  qc_failed: { label: "QC failed", tone: "danger" },
  refund_initiated: { label: "Refund initiated", tone: "accent" },
  replacement_shipped: { label: "Replacement shipped", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ------------------------------ Refund ------------------------------- */

export type RefundStatus = "initiated" | "processing" | "completed" | "failed";

export const REFUND_STATUS: StatusMap<RefundStatus> = {
  initiated: { label: "Initiated", tone: "info" },
  processing: { label: "Processing", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/* ------------------------------ Payment ------------------------------ */

export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater" | "cod" | "giftcard";

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Credit / Debit card",
  netbanking: "Net banking",
  wallet: "BluBuy Credits",
  emi: "EMI",
  paylater: "BluBuy Pay Later",
  cod: "Cash on delivery",
  giftcard: "Gift card",
};

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cod_pending"
  | "cod_collected";

export const PAYMENT_STATUS: StatusMap<PaymentStatus> = {
  pending: { label: "Pending", tone: "neutral" },
  authorized: { label: "Authorised", tone: "info" },
  captured: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Part refunded", tone: "warning" },
  cod_pending: { label: "COD due", tone: "warning" },
  cod_collected: { label: "COD collected", tone: "success" },
};

/* --------------------------- Seller account -------------------------- */

export type SellerStatus =
  | "registration_started"
  | "documents_submitted"
  | "under_review"
  | "action_required"
  | "active"
  | "on_hold"
  | "suspended"
  | "deactivated";

export const SELLER_STATUS: StatusMap<SellerStatus> = {
  registration_started: { label: "Registering", tone: "neutral" },
  documents_submitted: { label: "Docs submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  action_required: { label: "Action required", tone: "warning" },
  active: { label: "Active", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
  deactivated: { label: "Deactivated", tone: "neutral" },
};

/* ------------------------------ Listing ------------------------------ */

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "live"
  | "inactive"
  | "out_of_stock"
  | "suppressed"
  | "rejected"
  | "blocked";

export const LISTING_STATUS: StatusMap<ListingStatus> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "In review", tone: "info" },
  live: { label: "Live", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  out_of_stock: { label: "Out of stock", tone: "warning" },
  suppressed: { label: "Suppressed", tone: "warning", description: "Hidden from search until quality issues are fixed" },
  rejected: { label: "Rejected", tone: "danger" },
  blocked: { label: "Blocked", tone: "danger" },
};

/* ----------------------------- Settlement ---------------------------- */

export type SettlementStatus = "open" | "scheduled" | "processing" | "paid" | "on_hold" | "failed";

export const SETTLEMENT_STATUS: StatusMap<SettlementStatus> = {
  open: { label: "Open", tone: "neutral", description: "Current cycle still accumulating orders" },
  scheduled: { label: "Scheduled", tone: "info" },
  processing: { label: "Processing", tone: "brand" },
  paid: { label: "Paid", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

/* ------------------------------ Shipment ----------------------------- */

export type ShipmentStatus =
  | "manifested"
  | "pickup_scheduled"
  | "picked_up"
  | "at_origin_hub"
  | "in_transit"
  | "at_destination_hub"
  | "out_for_delivery"
  | "delivered"
  | "ndr"
  | "rto_initiated"
  | "rto_in_transit"
  | "rto_delivered"
  | "lost"
  | "damaged";

export const SHIPMENT_STATUS: StatusMap<ShipmentStatus> = {
  manifested: { label: "Manifested", tone: "neutral" },
  pickup_scheduled: { label: "Pickup scheduled", tone: "info" },
  picked_up: { label: "Picked up", tone: "info" },
  at_origin_hub: { label: "At origin hub", tone: "brand" },
  in_transit: { label: "In transit", tone: "brand" },
  at_destination_hub: { label: "At delivery hub", tone: "brand" },
  out_for_delivery: { label: "Out for delivery", tone: "accent" },
  delivered: { label: "Delivered", tone: "success" },
  ndr: { label: "NDR", tone: "warning", description: "Non-delivery report raised after a failed attempt" },
  rto_initiated: { label: "RTO initiated", tone: "danger" },
  rto_in_transit: { label: "RTO in transit", tone: "danger" },
  rto_delivered: { label: "RTO delivered", tone: "neutral" },
  lost: { label: "Lost", tone: "danger" },
  damaged: { label: "Damaged", tone: "danger" },
};

export type NdrReason =
  | "customer_unavailable"
  | "address_incomplete"
  | "customer_refused"
  | "cod_not_ready"
  | "reschedule_requested"
  | "premises_closed"
  | "out_of_delivery_area";

export const NDR_REASON: Record<NdrReason, string> = {
  customer_unavailable: "Customer not available",
  address_incomplete: "Incomplete address",
  customer_refused: "Refused by customer",
  cod_not_ready: "COD amount not ready",
  reschedule_requested: "Customer asked to reschedule",
  premises_closed: "Premises closed",
  out_of_delivery_area: "Outside delivery area",
};

/* ------------------------------- Support ----------------------------- */

export type TicketStatus = "open" | "in_progress" | "awaiting_customer" | "pending_internal" | "escalated" | "resolved" | "reopened" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const TICKET_STATUS: StatusMap<TicketStatus> = {
  open: { label: "Open", tone: "info" },
  in_progress: { label: "In progress", tone: "brand" },
  awaiting_customer: { label: "Awaiting customer", tone: "neutral" },
  pending_internal: { label: "Pending internal", tone: "accent" },
  escalated: { label: "Escalated", tone: "danger" },
  resolved: { label: "Resolved", tone: "success" },
  reopened: { label: "Reopened", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
};

export const TICKET_PRIORITY: StatusMap<TicketPriority> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

/* ------------------------------ Marketing ---------------------------- */

export type CouponStatus = "scheduled" | "active" | "paused" | "expired";

export const COUPON_STATUS: StatusMap<CouponStatus> = {
  scheduled: { label: "Scheduled", tone: "info" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  expired: { label: "Expired", tone: "neutral" },
};

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

export const CAMPAIGN_STATUS: StatusMap<CampaignStatus> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
};
