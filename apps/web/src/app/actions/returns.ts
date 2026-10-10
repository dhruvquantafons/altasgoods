"use server";

import { revalidatePath } from "next/cache";
import { api, authHeader } from "@/lib/api/server";
import { apiUrl } from "@/lib/api/session";
import type { ReturnRequest } from "@/lib/api/types";

/** Returns for shoppers. The API checks ownership and the return policy on every call. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};
const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

async function call<T>(fn: () => Promise<{ data?: T; error?: unknown }>, fallback: string, paths: string[]): Promise<Result<T>> {
  try {
    const r = await fn();
    if (r.data === undefined) return fail(r.error, fallback);
    for (const p of paths) revalidatePath(p);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

const path = (id: string) => ({ params: { path: { id } } });

export async function createReturn(input: {
  orderId: string;
  orderItemId: string;
  qty: number;
  reasonCode: string;
  reasonLabel: string;
  fault: "STORE" | "LOGISTICS" | "CUSTOMER";
  comments?: string;
  photoIds: string[];
  resolution: "REFUND" | "REPLACEMENT" | "EXCHANGE";
  exchangeSize?: string;
  refundTo?: "SOURCE" | "CREDITS" | "BANK";
  refundUpi?: string;
  pickupDate: string;
  pickupSlot: string;
  addressId?: string;
}): Promise<Result<ReturnRequest>> {
  const { orderId, ...body } = input;
  return call(async () => (await api()).POST("/v1/me/returns", { body }), "Could not create the return", [`/account/orders/${orderId}`, "/account/returns", "/account/orders"]);
}

export async function cancelReturn(id: string, orderId: string): Promise<Result<ReturnRequest>> {
  return call(async () => (await api()).POST("/v1/me/returns/{id}/cancel", path(id)), "Could not cancel the return", [`/account/orders/${orderId}`, "/account/returns"]);
}

export async function rescheduleReturn(id: string, orderId: string, pickupDate: string, pickupSlot: string): Promise<Result<ReturnRequest>> {
  return call(async () => (await api()).POST("/v1/me/returns/{id}/reschedule", { ...path(id), body: { pickupDate, pickupSlot } }), "Could not move the pickup", [`/account/orders/${orderId}`, "/account/returns"]);
}

/** Uploads a return photo; the form carries `file`. */
export async function uploadReturnPhoto(form: FormData): Promise<Result<{ id: string; name: string }>> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a photo" };
  const body = new FormData();
  body.set("file", file, file.name);
  try {
    const r = await fetch(`${apiUrl()}/v1/me/uploads`, { method: "POST", headers: await authHeader(), body, cache: "no-store" });
    const json = await r.json().catch(() => null);
    return r.ok ? { ok: true, data: json as { id: string; name: string } } : fail(json, r.status === 413 ? "That photo is too large" : "Could not add this photo");
  } catch {
    return offline;
  }
}
