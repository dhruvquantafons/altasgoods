import "server-only";
import type { RefundStatus, ReturnStatus as UiReturnStatus } from "@/lib/status";
import type { AccountRefund, AccountReturn, ReturnReasonCode } from "@/lib/mock/account-extra";
import { api } from "./server";
import type { ApiReturnStatus, ReturnRequest } from "./types";

/** API return statuses (spec 11.3) to the account screens' badge keys. */
export const UI_STATUS: Record<ApiReturnStatus, UiReturnStatus> = {
  REQUESTED: "requested",
  PENDING_SELLER_REVIEW: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  PICKUP_SCHEDULED: "pickup_scheduled",
  OUT_FOR_PICKUP: "pickup_scheduled",
  PICKUP_FAILED: "pickup_scheduled",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "picked_up",
  RECEIVED: "received",
  QC_PASSED: "qc_passed",
  QC_FAILED: "qc_failed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  LOST: "picked_up",
};

const REFUND: Record<string, RefundStatus> = { COMPLETED: "completed", PROCESSING: "processing", INITIATED: "initiated", PENDING: "processing", FAILED: "failed" };

const at = (r: ReturnRequest, ...statuses: ApiReturnStatus[]) => r.events.find((e) => statuses.includes(e.toStatus))?.at;

/** An API return in the shape the account screens use. */
export function toAccountReturn(r: ReturnRequest, paymentLabel: string): AccountReturn {
  const status = r.resolution !== "REFUND" && r.status === "COMPLETED" ? "replacement_shipped" : UI_STATUS[r.status];
  const order = ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "PICKED_UP", "RECEIVED", "QC_PASSED", "COMPLETED"] as const;
  const reached = (s: ApiReturnStatus) => r.events.some((e) => e.toStatus === s) || order.indexOf(s as (typeof order)[number]) <= order.indexOf(r.status as (typeof order)[number]);
  const closed = r.status === "CANCELLED" || r.status === "REJECTED";
  const destination = r.refundTo === "CREDITS" ? "AltasGoods Credits" : r.refundTo === "BANK" ? "your UPI ID" : paymentLabel;
  return {
    id: r.id,
    orderId: r.orderId,
    itemId: r.orderItemId,
    productId: r.item.productId,
    productTitle: r.item.title,
    image: r.item.image,
    variant: r.item.variant || undefined,
    sellerId: r.sellerId,
    reasonCode: r.reasonCode as ReturnReasonCode,
    reason: r.reasonLabel,
    comment: r.comments ?? undefined,
    resolution: r.resolution.toLowerCase() as AccountReturn["resolution"],
    status,
    amount: r.refundAmountPaise / 100,
    requestedAt: r.createdAt,
    pickup: r.pickupDate ? { date: `${r.pickupDate}T09:00:00+05:30`, window: r.pickupSlot ?? "", addressId: "" } : undefined,
    rejectionReason: r.status === "REJECTED" ? (r.sellerNote ?? r.qcNote ?? "The seller did not accept this return") : undefined,
    refund:
      r.resolution === "REFUND"
        ? {
            id: `${r.id}-refund`,
            amount: r.refundAmountPaise / 100,
            destination,
            instant: r.instantRefund,
            status: r.refundStatus ? (REFUND[r.refundStatus] ?? "processing") : "initiated",
            initiatedAt: at(r, "PICKED_UP", "QC_PASSED") ?? r.createdAt,
            completedAt: r.refundStatus === "COMPLETED" ? (at(r, "COMPLETED", "PICKED_UP") ?? r.updatedAt) : undefined,
            expectedBy: r.refundStatus ? undefined : undefined,
          }
        : undefined,
    events: closed
      ? r.events.map((e) => ({ label: e.toStatus === "CANCELLED" ? "Cancelled" : e.toStatus === "REJECTED" ? "Not accepted" : e.toStatus.charAt(0) + e.toStatus.slice(1).toLowerCase().replace(/_/g, " "), at: e.at, note: e.note ?? undefined, done: true }))
      : [
          { label: "Requested", at: at(r, "REQUESTED"), done: true, note: r.status === "PENDING_SELLER_REVIEW" ? "Outside the return window, the seller reviews within 48 hours" : undefined },
          { label: "Approved, pickup booked", at: at(r, "PICKUP_SCHEDULED"), done: reached("PICKUP_SCHEDULED") },
          { label: "Picked up", at: at(r, "PICKED_UP"), done: reached("PICKED_UP"), note: r.instantRefund && r.refundStatus ? "Refund issued at the doorstep" : undefined },
          { label: "Received by the seller", at: at(r, "RECEIVED"), done: reached("RECEIVED") },
          { label: r.status === "QC_FAILED" ? "Quality check failed" : "Quality check", at: at(r, "QC_PASSED", "QC_FAILED"), done: reached("QC_PASSED") || r.status === "QC_FAILED", note: r.qcNote ?? undefined },
          { label: r.resolution === "REFUND" ? "Refunded" : "Replacement dispatched", at: at(r, "COMPLETED"), done: r.status === "COMPLETED" },
        ],
  };
}

const REFUND_SOURCE: Record<string, AccountRefund["source"]> = { RETURN: "Return", CANCELLATION: "Cancellation", SUPPORT: "Cancellation" };
const METHOD: Record<string, string> = { UPI: "UPI", CARD: "Credit or debit card", NETBANKING: "Net banking", EMI: "EMI", PAY_LATER: "Pay Later", COD: "Bank account" };

export async function loadMyReturns() {
  const client = await api();
  const [r, f] = await Promise.all([client.GET("/v1/me/returns"), client.GET("/v1/me/refunds")]);
  const returns = r.data ?? [];
  const refunds: AccountRefund[] = (f.data ?? []).map((x) => ({
    id: x.id,
    orderId: x.orderId,
    returnId: x.returnId ?? undefined,
    source: REFUND_SOURCE[x.source] ?? "Cancellation",
    title: x.source === "SUPPORT" ? `${x.title} (AltasGoods Care)` : x.title,
    image: x.image ?? undefined,
    amount: x.amountPaise / 100,
    destination: METHOD[x.method] ?? x.method,
    instant: false,
    status: REFUND[x.status] ?? "processing",
    initiatedAt: x.createdAt,
    completedAt: x.completedAt ?? undefined,
    reference: x.id.slice(0, 12).toUpperCase(),
  }));
  return { returns, refunds };
}
