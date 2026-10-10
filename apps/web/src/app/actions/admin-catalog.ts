"use server";

import { revalidatePath, updateTag } from "next/cache";
import { api, authHeader } from "@/lib/api/server";
import { apiUrl } from "@/lib/api/session";
import { CATALOG_TAG } from "@/lib/store-catalog";
import type { AdminBrand, AdminCategory, AdminProduct } from "@/lib/api/types";
import type { paths } from "@/lib/api/schema";

/** Catalog edits in AltasGoods Control. The API checks the staff role and validates every field. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
export type ProductInput = NonNullable<paths["/v1/admin/products"]["post"]["requestBody"]>["content"]["application/json"];
export type CategoryInput = NonNullable<paths["/v1/admin/categories"]["post"]["requestBody"]>["content"]["application/json"];

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

/** The API's problem details as a message, plus messages per field for forms. */
function problem(e: unknown, fallback: string): { ok: false; error: string; fields?: Record<string, string> } {
  const p = (e ?? {}) as { detail?: string; errors?: { path: string; message: string }[] };
  const fields = p.errors?.length ? Object.fromEntries(p.errors.map((x) => [x.path.split(".")[0] ?? x.path, x.message])) : undefined;
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, fields };
}

/** Admin lists, and the storefront's cached catalog so shoppers see the change on their next page load. */
function refreshCatalog(...extra: string[]) {
  updateTag(CATALOG_TAG);
  for (const path of ["/admin/catalog", "/admin/categories", "/admin/brands", ...extra]) revalidatePath(path);
}

export async function saveProduct(id: string | null, input: ProductInput): Promise<Result<AdminProduct>> {
  try {
    const client = await api();
    const r = id ? await client.PATCH("/v1/admin/products/{id}", { params: { path: { id } }, body: input }) : await client.POST("/v1/admin/products", { body: input });
    if (!r.data) return problem(r.error, "The product could not be saved");
    refreshCatalog(`/admin/catalog/${r.data.id}`);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

export async function setProductActive(id: string, active: boolean): Promise<Result<AdminProduct>> {
  try {
    const r = await (await api()).PATCH("/v1/admin/products/{id}", { params: { path: { id } }, body: { active } });
    if (!r.data) return problem(r.error, "The product could not be updated");
    refreshCatalog(`/admin/catalog/${id}`);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

/** Uploads a product image; the form carries `file`. Returns the path to put in the product's images. */
export async function uploadProductImage(form: FormData): Promise<Result<{ id: string; url: string }>> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose an image" };
  const body = new FormData();
  body.set("file", file, file.name);
  try {
    const r = await fetch(`${apiUrl()}/v1/admin/media`, { method: "POST", headers: await authHeader(), body, cache: "no-store" });
    const json = await r.json().catch(() => null);
    if (!r.ok) return problem(json, r.status === 413 ? "Images can be up to 4 MB" : "The image could not be uploaded");
    return { ok: true, data: json as { id: string; url: string } };
  } catch {
    return offline;
  }
}

export async function saveCategory(id: string | null, input: CategoryInput): Promise<Result<AdminCategory>> {
  try {
    const client = await api();
    const r = id ? await client.PATCH("/v1/admin/categories/{id}", { params: { path: { id } }, body: input }) : await client.POST("/v1/admin/categories", { body: input });
    if (!r.data) return problem(r.error, "The category could not be saved");
    refreshCatalog();
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

export async function deleteCategory(id: string): Promise<Result<null>> {
  try {
    const r = await (await api()).DELETE("/v1/admin/categories/{id}", { params: { path: { id } } });
    if (!r.response.ok) return problem(r.error, "The category could not be deleted");
    refreshCatalog();
    return { ok: true, data: null };
  } catch {
    return offline;
  }
}

export async function saveBrand(id: string | null, name: string): Promise<Result<AdminBrand>> {
  try {
    const client = await api();
    const r = id ? await client.PATCH("/v1/admin/brands/{id}", { params: { path: { id } }, body: { name } }) : await client.POST("/v1/admin/brands", { body: { name } });
    if (!r.data) return problem(r.error, "The brand could not be saved");
    refreshCatalog();
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

export async function deleteBrand(id: string): Promise<Result<null>> {
  try {
    const r = await (await api()).DELETE("/v1/admin/brands/{id}", { params: { path: { id } } });
    if (!r.response.ok) return problem(r.error, "The brand could not be deleted");
    refreshCatalog();
    return { ok: true, data: null };
  } catch {
    return offline;
  }
}
