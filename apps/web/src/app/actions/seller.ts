"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";

type To = "ACCEPTED" | "PACKED" | "READY_TO_SHIP" | "CANCELLED";
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

/** Moves seller order lines along the state machine; each line succeeds or fails on its own. */
export async function transitionSellerItems(ids: string[], to: To, reason?: string): Promise<Result<{ done: number; failed: { id: string; error: string }[] }>> {
  if (!ids.length) return { ok: true, data: { done: 0, failed: [] } };
  try {
    const r = await (await api()).POST("/v1/seller/order-items/transition", { body: { ids, to, reason } });
    if (!r.data) return { ok: false, error: (r.error as { detail?: string } | undefined)?.detail ?? "The update did not go through" };
    revalidatePath("/seller/orders");
    revalidatePath("/seller");
    return {
      ok: true,
      data: { done: r.data.results.filter((x) => x.ok).length, failed: r.data.results.filter((x) => !x.ok).map((x) => ({ id: x.id, error: x.error ?? "Failed" })) },
    };
  } catch {
    return offline;
  }
}

/** Development only: simulates AltasGoods Logistics scans for a shipped line. */
export async function simulateCourierScan(orderItemId: string, to: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED"): Promise<Result<{ status: string }>> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Not available in production" };
  try {
    const r = await (await api()).POST("/v1/dev/logistics/advance", { body: { orderItemId, to } });
    if (!r.data) return { ok: false, error: (r.error as { detail?: string } | undefined)?.detail ?? "The scan did not go through" };
    revalidatePath("/seller/orders");
    return { ok: true, data: { status: r.data.status } };
  } catch {
    return offline;
  }
}
