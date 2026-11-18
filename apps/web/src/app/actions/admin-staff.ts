"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import type { StaffMember } from "@/lib/api/admin-system";
import type { paths } from "@/lib/api/schema";

/** Staff management in AltasGoods Control. The API allows it for Super Admins only and checks every rule. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; fields?: Record<string, string> };
export type StaffInput = NonNullable<paths["/v1/admin/staff"]["post"]["requestBody"]>["content"]["application/json"];
export type StaffRoles = NonNullable<paths["/v1/admin/staff/{id}"]["patch"]["requestBody"]>["content"]["application/json"]["roles"];

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

function problem(e: unknown, fallback: string): { ok: false; error: string; code?: string; fields?: Record<string, string> } {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { path: string; message: string }[] };
  const fields = p.errors?.length ? Object.fromEntries(p.errors.map((x) => [x.path, x.message])) : undefined;
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code, fields };
}

async function run<T>(call: () => Promise<{ data?: T; error?: unknown; response: Response }>, fallback: string): Promise<Result<T | null>> {
  try {
    const r = await call();
    if (!r.response.ok) return problem(r.error, fallback);
    revalidatePath("/admin/staff");
    revalidatePath("/admin/audit");
    return { ok: true, data: r.data ?? null };
  } catch {
    return offline;
  }
}

/** Adds a staff member. With an invite, `inviteLink` comes back only when no email really goes out (development). */
export async function addStaff(input: StaffInput) {
  return run(async () => (await api()).POST("/v1/admin/staff", { body: input }), "Could not add this staff member");
}

export async function setStaffRoles(id: string, roles: StaffRoles): Promise<Result<StaffMember | null>> {
  return run(async () => (await api()).PATCH("/v1/admin/staff/{id}", { params: { path: { id } }, body: { roles } }), "Could not change the roles");
}

/** Disabling signs them out everywhere and stops them signing in. */
export async function setStaffEnabled(id: string, enabled: boolean): Promise<Result<StaffMember | null>> {
  return enabled
    ? run(async () => (await api()).POST("/v1/admin/staff/{id}/enable", { params: { path: { id } } }), "Could not enable this staff member")
    : run(async () => (await api()).POST("/v1/admin/staff/{id}/disable", { params: { path: { id } } }), "Could not disable this staff member");
}

/** Takes away every staff role. Their account stays, as a shopper. */
export async function removeStaff(id: string) {
  return run(async () => (await api()).DELETE("/v1/admin/staff/{id}", { params: { path: { id } } }), "Could not remove this staff member");
}

export async function resendInvite(id: string) {
  return run(async () => (await api()).POST("/v1/admin/staff/{id}/invite", { params: { path: { id } } }), "Could not send the invite");
}
