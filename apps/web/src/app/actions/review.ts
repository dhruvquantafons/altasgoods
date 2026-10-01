"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import type { ApplicationReview } from "@/lib/api/types";

/** BluBuy Control decisions on seller applications. The API checks the staff role on every call. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; errors?: { path: string; message: string }[] };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string; errors?: { path: string; message: string }[] } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { path: string; message: string }[] };
  return { ok: false, error: p.detail ?? fallback, code: p.code, errors: p.errors };
};

async function decide(fn: () => Promise<{ data?: ApplicationReview; error?: unknown }>, fallback: string): Promise<Result<ApplicationReview>> {
  try {
    const r = await fn();
    if (r.data === undefined) return fail(r.error, fallback);
    revalidatePath("/admin/sellers/approvals");
    revalidatePath("/admin");
    return { ok: true, data: r.data };
  } catch {
    return { ok: false, error: "BluBuy is unreachable right now. Please try again in a moment." };
  }
}

const path = (id: string) => ({ params: { path: { id } } });

export async function loadReview(id: string): Promise<Result<ApplicationReview>> {
  try {
    const r = await (await api()).GET("/v1/admin/seller-applications/{id}", path(id));
    return r.data ? { ok: true, data: r.data } : fail(r.error, "Could not load this application");
  } catch {
    return { ok: false, error: "BluBuy is unreachable right now. Please try again in a moment." };
  }
}

export async function approveApplication(id: string, note?: string) {
  return decide(async () => (await api()).POST("/v1/admin/seller-applications/{id}/approve", { ...path(id), body: { note: note || undefined } }), "Could not approve");
}

export async function requestApplicationChanges(id: string, items: string[], message: string) {
  return decide(async () => (await api()).POST("/v1/admin/seller-applications/{id}/request-changes", { ...path(id), body: { items, message } }), "Could not send the request");
}

export async function rejectApplication(id: string, reason: string, note?: string) {
  return decide(async () => (await api()).POST("/v1/admin/seller-applications/{id}/reject", { ...path(id), body: { reason, note: note || undefined } }), "Could not reject");
}

export async function reopenApplication(id: string) {
  return decide(async () => (await api()).POST("/v1/admin/seller-applications/{id}/reopen", path(id)), "Could not reopen");
}
