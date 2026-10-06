"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, authHeader, publicApi } from "@/lib/api/server";
import { apiUrl, REFRESH_COOKIE, setSession } from "@/lib/api/session";
import type { Constitution, DocumentKind, EmailOtp, SellerApplication, User } from "@/lib/api/types";

/**
 * Seller registration (spec 9.2.1). Every step saves to the API, so the
 * application survives a closed tab and can be finished on another device.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; errors?: { path: string; message: string }[] };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string; errors?: { path: string; message: string }[] } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { path: string; message: string }[] };
  return { ok: false, error: p.errors?.length === 1 ? p.errors[0]!.message : (p.detail ?? fallback), code: p.code, errors: p.errors };
};
const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };

async function call<T>(fn: () => Promise<{ data?: T; error?: unknown }>, fallback: string): Promise<Result<T>> {
  try {
    const r = await fn();
    return r.data !== undefined ? { ok: true, data: r.data } : fail(r.error, fallback);
  } catch {
    return offline;
  }
}

export type ApplicationPatch = {
  constitution?: Constitution;
  gstExempt?: boolean;
  legalName?: string;
  registeredAddress?: string;
  storeName?: string;
  storeDescription?: string;
  careNumber?: string;
  grievanceContact?: string;
  pickup?: NonNullable<SellerApplication["pickup"]>;
  categories?: string[];
  brand?: NonNullable<SellerApplication["brand"]>;
};

export async function loadApplication(): Promise<Result<SellerApplication>> {
  return call(async () => (await api()).GET("/v1/me/seller-application"), "Could not load your application");
}

/** Starts the application (or returns the existing one). */
export async function startApplication(): Promise<Result<SellerApplication>> {
  return call(async () => (await api()).POST("/v1/me/seller-application"), "Could not start your application");
}

export async function saveApplication(patch: ApplicationPatch): Promise<Result<SellerApplication>> {
  return call(async () => (await api()).PATCH("/v1/me/seller-application", { body: patch }), "Could not save this step");
}

export async function updateOwnerName(name: string): Promise<Result<User>> {
  return call(async () => (await api()).PATCH("/v1/me", { body: { name } }), "Could not save your name");
}

export async function requestEmailCode(email: string): Promise<Result<EmailOtp>> {
  return call(async () => (await api()).POST("/v1/me/email/otp", { body: { email } }), "Could not send the code");
}

export async function verifyEmailCode(code: string): Promise<Result<User>> {
  return call(async () => (await api()).POST("/v1/me/email/verify", { body: { code } }), "Could not verify the code");
}

/** Saves the business type first, so the GST lookup can compare against it. */
export async function verifyGstin(gstin: string, constitution?: Constitution): Promise<Result<SellerApplication>> {
  if (constitution) {
    const saved = await saveApplication({ constitution });
    if (!saved.ok) return saved;
  }
  return call(async () => (await api()).POST("/v1/me/seller-application/verify/gstin", { body: { gstin } }), "Could not check this GSTIN");
}

export async function verifyPan(pan: string, legalName: string): Promise<Result<SellerApplication>> {
  return call(async () => (await api()).POST("/v1/me/seller-application/verify/pan", { body: { pan, legalName } }), "Could not check this PAN");
}

export async function verifyBank(input: { holder: string; account: string; ifsc: string }): Promise<Result<SellerApplication>> {
  return call(async () => (await api()).POST("/v1/me/seller-application/verify/bank", { body: input }), "Could not verify the bank account");
}

export async function checkStoreName(name: string): Promise<Result<{ available: boolean; reason?: string }>> {
  return call(async () => (await api()).GET("/v1/me/seller-application/store-name", { params: { query: { name } } }), "Could not check the name");
}

/** Uploads one document. The form carries `kind` and `file`. */
export async function uploadDocument(form: FormData): Promise<Result<SellerApplication>> {
  const kind = form.get("kind");
  const file = form.get("file");
  if (typeof kind !== "string" || !(file instanceof File) || !file.size) return { ok: false, error: "Choose a file to upload" };
  const body = new FormData();
  body.set("kind", kind as DocumentKind);
  body.set("file", file, file.name);
  try {
    const r = await fetch(`${apiUrl()}/v1/me/seller-application/documents`, { method: "POST", headers: await authHeader(), body, cache: "no-store" });
    const json = await r.json().catch(() => null);
    return r.ok ? { ok: true, data: json as SellerApplication } : fail(json, r.status === 413 ? "That file is too large" : "Could not upload this file");
  } catch {
    return offline;
  }
}

export async function removeDocument(id: string): Promise<Result<null>> {
  try {
    const r = await (await api()).DELETE("/v1/me/seller-application/documents/{id}", { params: { path: { id } } });
    return r.response.ok ? { ok: true, data: null } : fail(r.error, "Could not remove this file");
  } catch {
    return offline;
  }
}

export async function submitApplication(): Promise<Result<SellerApplication>> {
  const r = await call(async () => (await api()).POST("/v1/me/seller-application/submit", { body: { acceptAgreement: true } }), "Could not submit your application");
  if (r.ok) revalidatePath("/seller/register/status");
  return r;
}

/**
 * After approval: a fresh token carries the new seller membership, then
 * Seller Hub opens.
 */
export async function enterSellerHub() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const r = await publicApi()
      .POST("/v1/auth/refresh", { body: { refreshToken } })
      .catch(() => null);
    if (r?.data) await setSession(r.data);
  }
  redirect("/seller");
}
