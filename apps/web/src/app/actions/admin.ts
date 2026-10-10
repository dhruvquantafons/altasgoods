"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import type { ReturnRequest } from "@/lib/api/types";

/** Store operations in AltasGoods Control. The API checks the staff role on every call. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type To = "ACCEPTED" | "PACKED" | "READY_TO_SHIP" | "CANCELLED";

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };
const problem = (e: unknown, fallback: string) => {
  const p = (e ?? {}) as { detail?: string; errors?: { message: string }[] };
  return { ok: false as const, error: p.errors?.[0]?.message ?? p.detail ?? fallback };
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

/** Development only: stands in for reverse pickup scans. */
export async function simulateReturnScan(id: string, to: "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED") {
  const blocked = devOnly();
  if (blocked) return blocked;
  return returnCall(id, async () => (await api()).POST("/v1/dev/returns/{id}/advance", { params: { path: { id } }, body: { to } }), "Could not record the scan");
}
