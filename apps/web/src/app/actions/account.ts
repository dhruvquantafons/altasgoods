"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import type { Address, User } from "@/lib/api/types";

/** My Account mutations, made with the session cookie on the server. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};
const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };

async function run<T>(call: () => Promise<{ data?: T; error?: unknown; response: Response }>, fallback: string, revalidate?: string): Promise<Result<T>> {
  try {
    const r = await call();
    if (!r.response.ok) return fail(r.error, fallback);
    if (revalidate) revalidatePath(revalidate, "layout");
    return { ok: true, data: r.data as T };
  } catch {
    return offline;
  }
}

export async function updateProfile(patch: { name?: string; phone?: string | null }): Promise<Result<User>> {
  return run(async () => (await api()).PATCH("/v1/me", { body: patch }), "Could not save your details", "/account");
}

/** Sends a code to confirm the current email, or a new one that will become the sign in email. */
export async function requestEmailCode(email: string): Promise<Result<{ email: string; devCode?: string }>> {
  return run(async () => (await api()).POST("/v1/me/email/otp", { body: { email } }), "Could not send the code");
}

export async function verifyEmailCode(code: string): Promise<Result<User>> {
  return run(async () => (await api()).POST("/v1/me/email/verify", { body: { code } }), "Could not verify the code", "/account");
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<Result<undefined>> {
  return run(async () => (await api()).POST("/v1/me/password", { body: input }), "Could not change your password");
}

export async function signOutOtherDevices(): Promise<Result<undefined>> {
  return run(async () => (await api()).POST("/v1/me/sessions/sign-out-others"), "Could not sign out your other devices");
}

export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault?: boolean;
}

export async function saveAddress(id: string | undefined, input: AddressInput): Promise<Result<Address>> {
  return id
    ? run(async () => (await api()).PATCH("/v1/me/addresses/{id}", { params: { path: { id } }, body: input }), "Could not save this address", "/account/addresses")
    : run(async () => (await api()).POST("/v1/me/addresses", { body: { ...input, isDefault: input.isDefault ?? false } }), "Could not save this address", "/account/addresses");
}

export async function makeDefaultAddress(id: string): Promise<Result<Address>> {
  return run(async () => (await api()).PATCH("/v1/me/addresses/{id}", { params: { path: { id } }, body: { isDefault: true } }), "Could not update your default address", "/account/addresses");
}

export async function deleteAddress(id: string): Promise<Result<undefined>> {
  return run(async () => (await api()).DELETE("/v1/me/addresses/{id}", { params: { path: { id } } }), "Could not remove this address", "/account/addresses");
}
