"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import type { AdminOrder, AdminRefund, OrderNote, ReturnRequest } from "@/lib/api/types";

/** Store operations in AltasGoods Control. The API checks the staff role on every call. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type To = "ACCEPTED" | "PACKED" | "READY_TO_SHIP" | "CANCELLED" | "LOST" | "RTO_RECEIVED";

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };
const problem = (e: unknown, fallback: string) => {
  const p = (e ?? {}) as { detail?: string; errors?: { message: string }[] };
  return { ok: false as const, error: p.errors?.[0]?.message ?? p.detail ?? fallback };
};
/** Like problem(), with the message for each field the API rejected, to show beside the field. */
const fieldProblem = (e: unknown, fallback: string) => {
  const p = (e ?? {}) as { detail?: string; errors?: { path: string; message: string }[] };
  const fields = p.errors?.length ? Object.fromEntries(p.errors.map((x) => [x.path, x.message])) : undefined;
  return { ok: false as const, error: p.errors?.[0]?.message ?? p.detail ?? fallback, fields };
};
const devOnly = () => (process.env.NODE_ENV === "production" ? { ok: false as const, error: "Not available in production" } : null);

function refreshOrders(orderId?: string) {
  revalidatePath("/admin/orders");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}
function refreshReturns(id: string) {
  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${id}`);
}
function refreshMoney(orderId: string) {
  refreshOrders(orderId);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

/* --------------------------------- Refunds -------------------------------- */

export type RefundInput = { amountPaise: number; reason: string; method: "SOURCE" | "MANUAL"; reference?: string; orderItemId?: string };

/** A goodwill refund to the payment method, or a record of money the store already sent by UPI or bank transfer. */
export async function createOrderRefund(orderId: string, input: RefundInput): Promise<Result<AdminRefund>> {
  try {
    const r = await (await api()).POST("/v1/admin/orders/{id}/refunds", {
      params: { path: { id: orderId } },
      body: { ...input, reference: input.method === "MANUAL" ? input.reference : undefined },
    });
    if (!r.data) return problem(r.error, "The refund did not go through");
    refreshMoney(orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Sends a failed refund, or one that needs attention, to the gateway again under the same receipt. */
export async function retryRefund(refundId: string, orderId: string): Promise<Result<AdminRefund>> {
  try {
    const r = await (await api()).POST("/v1/admin/refunds/{id}/retry", { params: { path: { id: refundId } } });
    if (!r.data) return problem(r.error, "Could not send the refund again");
    refreshMoney(orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Records the payout of a manual refund that was waiting for one, with its UTR or UPI reference. */
export async function markRefundPaid(refundId: string, orderId: string, reference: string): Promise<Result<AdminRefund>> {
  try {
    const r = await (await api()).POST("/v1/admin/refunds/{id}/mark-paid", { params: { path: { id: refundId } }, body: { reference } });
    if (!r.data) return problem(r.error, "Could not record the payout");
    refreshMoney(orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/* ------------------------------ Address, notes ----------------------------- */

export type OrderAddressInput = { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; type: "HOME" | "WORK" | "OTHER" };

/** Corrects the delivery address before the parcel is booked with the courier. */
export async function updateOrderAddress(orderId: string, input: OrderAddressInput): Promise<Result<AdminOrder> & { fields?: Record<string, string> }> {
  try {
    const r = await (await api()).PATCH("/v1/admin/orders/{id}/address", {
      params: { path: { id: orderId } },
      body: { ...input, line2: input.line2 || undefined, landmark: input.landmark || undefined },
    });
    if (!r.data) return fieldProblem(r.error, "Could not change the address");
    refreshOrders(orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Adds an internal note; customers never see these. */
export async function addOrderNote(orderId: string, body: string): Promise<Result<OrderNote>> {
  try {
    const r = await (await api()).POST("/v1/admin/orders/{id}/notes", { params: { path: { id: orderId } }, body: { body } });
    if (!r.data) return problem(r.error, "Could not save the note");
    refreshOrders(orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Moves order lines along the state machine; each line succeeds or fails on its own. */
export async function transitionOrderItems(ids: string[], to: To, reason?: string, orderId?: string): Promise<Result<{ done: number; failed: { id: string; error: string }[] }>> {
  if (!ids.length) return { ok: true, data: { done: 0, failed: [] } };
  try {
    const r = await (await api()).POST("/v1/admin/order-items/transition", { body: { ids, to, reason } });
    if (!r.data) return problem(r.error, "The update did not go through");
    refreshOrders(orderId);
    return { ok: true, data: { done: r.data.results.filter((x) => x.ok).length, failed: r.data.results.filter((x) => !x.ok).map((x) => ({ id: x.id, error: x.error ?? "Failed" })) } };
  } catch {
    return offline;
  }
}

/** Asks the courier for a line's latest scan now, instead of waiting for the next poll. */
export async function refreshTracking(orderItemId: string, orderId?: string): Promise<Result<{ status: string; trackingStatus: string | null }>> {
  try {
    const r = await (await api()).POST("/v1/admin/order-items/{id}/tracking/refresh", { params: { path: { id: orderItemId } } });
    if (!r.data) return problem(r.error, "Could not reach the courier");
    refreshOrders(orderId);
    return { ok: true, data: { status: r.data.status, trackingStatus: r.data.trackingStatus } };
  } catch {
    return offline;
  }
}

/** Development only: simulates courier scans for a line that has been handed over. */
export async function simulateCourierScan(orderItemId: string, to: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED", orderId?: string): Promise<Result<{ status: string }>> {
  const blocked = devOnly();
  if (blocked) return blocked;
  try {
    const r = await (await api()).POST("/v1/dev/logistics/advance", { body: { orderItemId, to } });
    if (!r.data) return problem(r.error, "The scan did not go through");
    refreshOrders(orderId);
    return { ok: true, data: { status: r.data.status } };
  } catch {
    return offline;
  }
}

async function returnCall(id: string, fn: () => Promise<{ data?: ReturnRequest; error?: unknown }>, fallback: string): Promise<Result<ReturnRequest>> {
  try {
    const r = await fn();
    if (!r.data) return problem(r.error, fallback);
    refreshReturns(id);
    refreshOrders(r.data.orderId);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Approves (books the pickup) or rejects a return that is outside the policy. */
export async function decideStoreReturn(id: string, approve: boolean, note?: string) {
  return returnCall(id, async () => (await api()).POST("/v1/admin/returns/{id}/decision", { params: { path: { id } }, body: { approve, note: note || undefined } }), "Could not save the decision");
}

/** Grades a returned item: a pass releases the refund or replacement. */
export async function gradeStoreReturn(id: string, pass: boolean, note?: string) {
  return returnCall(id, async () => (await api()).POST("/v1/admin/returns/{id}/qc", { params: { path: { id } }, body: { pass, note: note || undefined } }), "Could not save the check");
}

/** Records the reverse pickup by hand (steps in between are recorded too), with the courier's AWB if there is one. */
export async function recordReturnPickup(id: string, to: "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED", awb?: string, note?: string) {
  return returnCall(id, async () => (await api()).POST("/v1/admin/returns/{id}/pickup", { params: { path: { id } }, body: { to, awb: awb || undefined, note: note || undefined } }), "Could not update the pickup");
}

/** Settles a failed check: accept the return anyway, or reject it and send the item back. */
export async function settleStoreReturn(id: string, accept: boolean, note: string) {
  return returnCall(id, async () => (await api()).POST("/v1/admin/returns/{id}/settle", { params: { path: { id } }, body: { accept, note } }), "Could not settle the return");
}

/** Records that the store paid a return's bank (UPI) refund by hand, with the payout's reference. */
export async function markReturnRefundPaid(id: string, reference: string) {
  const r = await returnCall(id, async () => (await api()).POST("/v1/admin/returns/{id}/refund/mark-paid", { params: { path: { id } }, body: { reference } }), "Could not record the payout");
  if (r.ok) refreshMoney(r.data.orderId);
  return r;
}

/** Development only: stands in for reverse pickup scans. */
export async function simulateReturnScan(id: string, to: "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED") {
  const blocked = devOnly();
  if (blocked) return blocked;
  return returnCall(id, async () => (await api()).POST("/v1/dev/returns/{id}/advance", { params: { path: { id } }, body: { to } }), "Could not record the scan");
}
