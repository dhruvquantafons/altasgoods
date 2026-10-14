"use server";

import { revalidatePath, updateTag } from "next/cache";
import { api } from "@/lib/api/server";
import type { AdminSettings } from "@/lib/api/admin-system";
import { SETTINGS_TAG } from "@/lib/store-settings";
import { CATALOG_TAG } from "@/lib/store-catalog";
import { CMS_TAG } from "@/lib/store-banners";
import type { paths } from "@/lib/api/schema";

/** Settings and other store-wide changes in AltasGoods Control. The API checks the role and validates every field. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
export type SettingsInput = Omit<AdminSettings, "updatedAt" | "updatedBy">;

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

function problem(e: unknown, fallback: string): { ok: false; error: string; fields?: Record<string, string> } {
  const p = (e ?? {}) as { detail?: string; errors?: { path: string; message: string }[] };
  const fields = p.errors?.length ? Object.fromEntries(p.errors.map((x) => [x.path, x.message])) : undefined;
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, fields };
}

export async function saveSettings(input: SettingsInput): Promise<Result<AdminSettings>> {
  try {
    const r = await (await api()).PUT("/v1/admin/settings", { body: input });
    if (!r.data) return problem(r.error, "Could not save the settings");
    // the storefront picks the change up on its next page load
    updateTag(SETTINGS_TAG);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/audit");
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Blocks or unblocks a customer's account. Blocking signs them out everywhere. */
export async function setCustomerStatus(id: string, status: "ACTIVE" | "BLOCKED", reason?: string): Promise<Result<{ status: string }>> {
  try {
    const r = await (await api()).PATCH("/v1/admin/customers/{id}", { params: { path: { id } }, body: { status, reason } });
    if (!r.data) return problem(r.error, "Could not change the account");
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return { ok: true, data: { status: r.data.status } };
  } catch {
    return offline;
  }
}

/* ------------------------------ Sales and coupons ------------------------------ */

export type SaleInput = NonNullable<paths["/v1/admin/sales"]["post"]["requestBody"]>["content"]["application/json"];
export type CouponInput = NonNullable<paths["/v1/admin/coupons"]["post"]["requestBody"]>["content"]["application/json"];

/** Sales and coupons change what shoppers pay, so the storefront's cached catalog refreshes too. */
function refreshPromotions() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/promotions");
  revalidatePath("/admin/audit");
}

async function promo<T>(call: () => Promise<{ data?: T; error?: unknown; response: Response }>, fallback: string): Promise<Result<T | null>> {
  try {
    const r = await call();
    if (!r.response.ok) return problem(r.error, fallback);
    refreshPromotions();
    return { ok: true, data: r.data ?? null };
  } catch {
    return offline;
  }
}

export async function saveSale(id: string | null, input: SaleInput) {
  return id
    ? promo(async () => (await api()).PATCH("/v1/admin/sales/{id}", { params: { path: { id } }, body: input }), "Could not save the sale")
    : promo(async () => (await api()).POST("/v1/admin/sales", { body: input }), "Could not create the sale");
}

export async function setSaleStatus(id: string, status: "ACTIVE" | "PAUSED") {
  return promo(async () => (await api()).PATCH("/v1/admin/sales/{id}", { params: { path: { id } }, body: { status } }), "Could not update the sale");
}

export async function deleteSale(id: string) {
  return promo(async () => (await api()).DELETE("/v1/admin/sales/{id}", { params: { path: { id } } }), "Could not delete the sale");
}

export async function saveCoupon(code: string | null, input: CouponInput) {
  if (code) {
    // the code names the coupon and cannot change
    const patch: Partial<CouponInput> = { ...input };
    delete patch.code;
    return promo(async () => (await api()).PATCH("/v1/admin/coupons/{code}", { params: { path: { code } }, body: patch }), "Could not save the coupon");
  }
  return promo(async () => (await api()).POST("/v1/admin/coupons", { body: input }), "Could not create the coupon");
}

export async function setCouponStatus(code: string, status: "ACTIVE" | "PAUSED") {
  return promo(async () => (await api()).PATCH("/v1/admin/coupons/{code}", { params: { path: { code } }, body: { status } }), "Could not update the coupon");
}

export async function deleteCoupon(code: string) {
  return promo(async () => (await api()).DELETE("/v1/admin/coupons/{code}", { params: { path: { code } } }), "Could not delete the coupon");
}

/* ------------------------------ Storefront CMS ------------------------------ */

export type BannerInput = NonNullable<paths["/v1/admin/banners"]["post"]["requestBody"]>["content"]["application/json"];

async function cms<T>(call: () => Promise<{ data?: T; error?: unknown; response: Response }>, fallback: string): Promise<Result<T | null>> {
  try {
    const r = await call();
    if (!r.response.ok) return problem(r.error, fallback);
    // the homepage picks the change up on its next load
    updateTag(CMS_TAG);
    revalidatePath("/admin/cms");
    revalidatePath("/admin/audit");
    return { ok: true, data: r.data ?? null };
  } catch {
    return offline;
  }
}

export async function saveBanner(id: string | null, input: BannerInput) {
  if (id) {
    const patch: Partial<BannerInput> = { ...input };
    delete patch.placement;
    return cms(async () => (await api()).PATCH("/v1/admin/banners/{id}", { params: { path: { id } }, body: patch }), "Could not save the banner");
  }
  return cms(async () => (await api()).POST("/v1/admin/banners", { body: input }), "Could not add the banner");
}

export async function setBannerActive(id: string, active: boolean) {
  return cms(async () => (await api()).PATCH("/v1/admin/banners/{id}", { params: { path: { id } }, body: { active } }), "Could not update the banner");
}

export async function deleteBanner(id: string) {
  return cms(async () => (await api()).DELETE("/v1/admin/banners/{id}", { params: { path: { id } } }), "Could not remove the banner");
}

export async function reorderBanners(placement: "HERO" | "PROMO", ids: string[]) {
  return cms(async () => (await api()).POST("/v1/admin/banners/reorder", { body: { placement, ids } }), "Could not change the order");
}

/* --------------------------------- Reviews --------------------------------- */

export async function moderateReview(id: string, change: { status?: "PUBLISHED" | "HIDDEN"; reply?: string | null; adminNote?: string | null }, slug?: string) {
  try {
    const r = await (await api()).PATCH("/v1/admin/reviews/{id}", { params: { path: { id } }, body: change });
    if (!r.data) return problem(r.error, "Could not update the review");
    // the product's rating and its review list change
    updateTag(CATALOG_TAG);
    if (slug) revalidatePath(`/p/${slug}`);
    revalidatePath("/admin/reviews");
    return { ok: true as const, data: r.data };
  } catch {
    return offline;
  }
}
