import "server-only";
import { cache } from "react";
import { maskName, type SellerLine } from "@/lib/mock/seller-extra";
import { ORDER_STATUS, RETURN_STATUS, type StatusMeta } from "@/lib/status";
import { formatDateShort } from "@/lib/utils";
import { UI_STATUS } from "./returns";
import { api, unwrap } from "./server";
import type { ApiReturnStatus, ReturnRequest } from "./types";

const HOUR = 3_600_000;

export type ReturnTab = "action" | "progress" | "done" | "rto" | "claims";

/** One row of Seller Hub's returns list: a customer return from the API, or an order line coming back as RTO. */
export interface SellerReturnRow {
  id: string;
  kind: "return" | "rto";
  href: string;
  orderId: string;
  title: string;
  image: string;
  buyer: string;
  reason: string;
  resolution?: string;
  status: StatusMeta;
  amount: number;
  requestedAt: string;
  outOfPolicy: boolean;
  sellerFault: boolean;
  /** an out-of-policy request the seller approves or rejects */
  canDecide: boolean;
  tab: Exclude<ReturnTab, "claims">;
  next: { text: string; due?: string };
  awb: string;
}

const RESOLUTION: Record<ReturnRequest["resolution"], string> = { REFUND: "Refund", REPLACEMENT: "Replacement", EXCHANGE: "Exchange" };

const ACTION: ApiReturnStatus[] = ["PENDING_SELLER_REVIEW", "RECEIVED"];
const PROGRESS: ApiReturnStatus[] = ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKUP_FAILED", "PICKED_UP", "IN_TRANSIT", "QC_FAILED"];

/** When a return last entered a status, from its events. */
export const enteredAt = (r: ReturnRequest, status: ApiReturnStatus) => r.events.findLast((e) => e.toStatus === status)?.at;

/** What the return is worth: the refund, or the item value for a replacement or exchange. */
export const valueOf = (r: ReturnRequest) => (r.resolution === "REFUND" ? r.refundAmountPaise : r.item.unitPricePaise * r.qty) / 100;

const plus = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * HOUR).toISOString();
/** Pickup dates are calendar days in India; noon IST keeps them on the right day. */
const pickupDay = (date: string) => `${date}T12:00:00+05:30`;

/** Out-of-policy requests: the seller decides within 48 hours of the request going to review. */
export const reviewDueOf = (r: ReturnRequest) => {
  const at = r.status === "PENDING_SELLER_REVIEW" ? enteredAt(r, "PENDING_SELLER_REVIEW") : undefined;
  return at ? plus(at, 48) : undefined;
};

/** Received items are graded within 48 hours of arriving. */
export const gradeDueOf = (r: ReturnRequest) => {
  const at = r.status === "RECEIVED" ? enteredAt(r, "RECEIVED") : undefined;
  return at ? plus(at, 48) : undefined;
};

/** When a picked up item should reach the seller: three days after pickup. */
export const arrivesByOf = (r: ReturnRequest) => {
  const picked = enteredAt(r, "PICKED_UP");
  return picked ? plus(picked, 72) : r.pickupDate ? plus(pickupDay(r.pickupDate), 72) : undefined;
};

export function nextStepOf(r: ReturnRequest): SellerReturnRow["next"] {
  switch (r.status) {
    case "PENDING_SELLER_REVIEW":
      return { text: "Approve or reject", due: reviewDueOf(r) };
    case "REQUESTED":
      return { text: "Being approved" };
    case "APPROVED":
    case "PICKUP_SCHEDULED":
      return { text: r.pickupDate ? `Pickup ${formatDateShort(pickupDay(r.pickupDate))}` : "Pickup being booked" };
    case "OUT_FOR_PICKUP":
      return { text: "Out for pickup" };
    case "PICKUP_FAILED":
      return { text: "Pickup failed, AltasGoods re-attempts" };
    case "PICKED_UP":
    case "IN_TRANSIT": {
      const by = arrivesByOf(r);
      return { text: by ? `Arrives by ${formatDateShort(by)}` : "On the way back" };
    }
    case "RECEIVED":
      return { text: "Grade the item", due: gradeDueOf(r) };
    case "QC_FAILED":
      return { text: "AltasGoods is reviewing your check" };
    case "REJECTED":
      return { text: "Rejected" };
    case "CANCELLED":
      return { text: "Cancelled by the customer" };
    case "LOST":
      return { text: "Lost in transit" };
    default:
      return { text: "No action needed" };
  }
}

export function toSellerReturnRow(r: ReturnRequest): SellerReturnRow {
  const outOfPolicy = r.events.some((e) => e.toStatus === "PENDING_SELLER_REVIEW");
  return {
    id: r.id,
    kind: "return",
    href: `/seller/returns/${r.id}`,
    orderId: r.orderId,
    title: r.item.title,
    image: r.item.image,
    buyer: maskName(r.customerName),
    reason: r.reasonLabel,
    resolution: RESOLUTION[r.resolution],
    status: r.status === "LOST" ? { label: "Lost in transit", tone: "danger" } : RETURN_STATUS[UI_STATUS[r.status]],
    amount: valueOf(r),
    requestedAt: r.createdAt,
    outOfPolicy,
    sellerFault: r.fault === "SELLER",
    canDecide: r.status === "PENDING_SELLER_REVIEW",
    tab: ACTION.includes(r.status) ? "action" : PROGRESS.includes(r.status) ? "progress" : "done",
    next: nextStepOf(r),
    awb: r.awb ?? "",
  };
}

/** An order line the customer did not accept, heading back to the seller (return to origin). */
export function rtoRow(l: SellerLine): SellerReturnRow {
  const back = l.status === "returned_to_seller";
  return {
    id: l.lineId,
    kind: "rto",
    href: `/seller/orders/${l.orderId}`,
    orderId: l.orderId,
    title: l.title,
    image: l.image,
    buyer: maskName(l.buyer),
    reason: "Not accepted at delivery",
    status: ORDER_STATUS[l.status],
    amount: l.total,
    requestedAt: l.placedAt,
    outOfPolicy: false,
    sellerFault: false,
    canDecide: false,
    tab: "rto",
    next: { text: back ? "Check the package" : "Arriving at your warehouse" },
    awb: l.awb ?? "",
  };
}

/** The signed-in seller's returns, newest activity first. */
export const loadSellerReturns = cache(async () => unwrap(await (await api()).GET("/v1/seller/returns", { params: { query: {} } })));

export const loadSellerReturn = cache(async (id: string) => unwrap(await (await api()).GET("/v1/seller/returns/{id}", { params: { path: { id } } }), { notFoundOn404: true }));
