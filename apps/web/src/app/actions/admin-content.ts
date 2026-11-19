"use server";

import { revalidatePath, updateTag } from "next/cache";
import { api } from "@/lib/api/server";
import type { paths } from "@/lib/api/schema";
import { CONTENT_TAG } from "@/lib/store-content";

/** Edits to the storefront's policy, help, careers, press, about and spotlight content. The API checks the role and validates every field. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

export type PageInput = NonNullable<paths["/v1/admin/content/pages"]["post"]["requestBody"]>["content"]["application/json"];
export type FaqInput = NonNullable<paths["/v1/admin/content/faqs"]["post"]["requestBody"]>["content"]["application/json"];
export type TopicInput = NonNullable<paths["/v1/admin/content/help-topics"]["post"]["requestBody"]>["content"]["application/json"];
export type RoleInput = NonNullable<paths["/v1/admin/content/roles"]["post"]["requestBody"]>["content"]["application/json"];
export type PressInput = NonNullable<paths["/v1/admin/content/press"]["post"]["requestBody"]>["content"]["application/json"];
export type AboutInput = NonNullable<paths["/v1/admin/content/about"]["put"]["requestBody"]>["content"]["application/json"];
export type SpotlightInput = NonNullable<paths["/v1/admin/content/spotlights"]["post"]["requestBody"]>["content"]["application/json"];

const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

function problem(e: unknown, fallback: string): { ok: false; error: string; fields?: Record<string, string> } {
  const p = (e ?? {}) as { detail?: string; errors?: { path: string; message: string }[] };
  const fields = p.errors?.length ? Object.fromEntries(p.errors.map((x) => [x.path, x.message])) : undefined;
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, fields };
}

/** Storefront pages each kind of content shows on, refreshed after a save. */
const PAGES: Record<string, string[]> = {
  pages: ["/policies", "/policies/[slug]", "/help"],
  help: ["/help"],
  careers: ["/careers", "/careers/[slug]"],
  press: ["/press"],
  about: ["/about", "/press"],
  spotlights: ["/"],
};

async function save<T>(kind: keyof typeof PAGES, call: () => Promise<{ data?: T; error?: unknown; response: Response }>, fallback: string): Promise<Result<T | null>> {
  try {
    const r = await call();
    if (!r.response.ok) return problem(r.error, fallback);
    // the storefront picks the change up on its next page load
    updateTag(CONTENT_TAG);
    revalidatePath("/admin/content");
    revalidatePath("/admin/audit");
    for (const p of PAGES[kind]!) revalidatePath(p, p.includes("[") ? "page" : undefined);
    return { ok: true, data: r.data ?? null };
  } catch {
    return offline;
  }
}

/* Pages and policies */
export async function savePage(slug: string | null, input: PageInput) {
  if (slug) {
    const patch: Partial<PageInput> = { ...input };
    delete patch.slug;
    delete patch.kind;
    return save("pages", async () => (await api()).PATCH("/v1/admin/content/pages/{slug}", { params: { path: { slug } }, body: patch }), "Could not save the page");
  }
  return save("pages", async () => (await api()).POST("/v1/admin/content/pages", { body: input }), "Could not add the page");
}
export const setPagePublished = async (slug: string, published: boolean) => save("pages", async () => (await api()).PATCH("/v1/admin/content/pages/{slug}", { params: { path: { slug } }, body: { published } }), "Could not update the page");
export const deletePage = async (slug: string) => save("pages", async () => (await api()).DELETE("/v1/admin/content/pages/{slug}", { params: { path: { slug } } }), "Could not delete the page");
export const reorderPages = async (slugs: string[]) => save("pages", async () => (await api()).POST("/v1/admin/content/pages/reorder", { body: { slugs } }), "Could not change the order");

/* Help */
export async function saveFaq(id: string | null, input: FaqInput) {
  if (id) return save("help", async () => (await api()).PATCH("/v1/admin/content/faqs/{id}", { params: { path: { id } }, body: input }), "Could not save the question");
  return save("help", async () => (await api()).POST("/v1/admin/content/faqs", { body: input }), "Could not add the question");
}
export const deleteFaq = async (id: string) => save("help", async () => (await api()).DELETE("/v1/admin/content/faqs/{id}", { params: { path: { id } } }), "Could not remove the question");
export const reorderFaqs = async (ids: string[]) => save("help", async () => (await api()).POST("/v1/admin/content/faqs/reorder", { body: { ids } }), "Could not change the order");
export async function saveTopic(id: string | null, input: TopicInput) {
  if (id) return save("help", async () => (await api()).PATCH("/v1/admin/content/help-topics/{id}", { params: { path: { id } }, body: input }), "Could not save the topic");
  return save("help", async () => (await api()).POST("/v1/admin/content/help-topics", { body: input }), "Could not add the topic");
}
export const deleteTopic = async (id: string) => save("help", async () => (await api()).DELETE("/v1/admin/content/help-topics/{id}", { params: { path: { id } } }), "Could not remove the topic");
export const reorderTopics = async (ids: string[]) => save("help", async () => (await api()).POST("/v1/admin/content/help-topics/reorder", { body: { ids } }), "Could not change the order");

/* Careers */
export async function saveRole(slug: string | null, input: RoleInput) {
  if (slug) {
    const patch: Partial<typeof input> = { ...input };
    delete patch.slug;
    return save("careers", async () => (await api()).PATCH("/v1/admin/content/roles/{slug}", { params: { path: { slug } }, body: patch }), "Could not save the role");
  }
  return save("careers", async () => (await api()).POST("/v1/admin/content/roles", { body: input }), "Could not add the role");
}
export const deleteRole = async (slug: string) => save("careers", async () => (await api()).DELETE("/v1/admin/content/roles/{slug}", { params: { path: { slug } } }), "Could not remove the role");
export const reorderRoles = async (slugs: string[]) => save("careers", async () => (await api()).POST("/v1/admin/content/roles/reorder", { body: { slugs } }), "Could not change the order");

/* Press */
export async function savePress(slug: string | null, input: PressInput) {
  if (slug) {
    const patch: Partial<typeof input> = { ...input };
    delete patch.slug;
    return save("press", async () => (await api()).PATCH("/v1/admin/content/press/{slug}", { params: { path: { slug } }, body: patch }), "Could not save the release");
  }
  return save("press", async () => (await api()).POST("/v1/admin/content/press", { body: input }), "Could not add the release");
}
export const deletePress = async (slug: string) => save("press", async () => (await api()).DELETE("/v1/admin/content/press/{slug}", { params: { path: { slug } } }), "Could not remove the release");

/* About */
export const saveAbout = async (input: AboutInput) => save("about", async () => (await api()).PUT("/v1/admin/content/about", { body: input }), "Could not save the About page");

/* Brand spotlights */
export async function saveSpotlight(id: string | null, input: SpotlightInput) {
  if (id) return save("spotlights", async () => (await api()).PATCH("/v1/admin/content/spotlights/{id}", { params: { path: { id } }, body: input }), "Could not save the spotlight");
  return save("spotlights", async () => (await api()).POST("/v1/admin/content/spotlights", { body: input }), "Could not add the spotlight");
}
export const deleteSpotlight = async (id: string) => save("spotlights", async () => (await api()).DELETE("/v1/admin/content/spotlights/{id}", { params: { path: { id } } }), "Could not remove the spotlight");
export const reorderSpotlights = async (ids: string[]) => save("spotlights", async () => (await api()).POST("/v1/admin/content/spotlights/reorder", { body: { ids } }), "Could not change the order");

/** Products matching a search, for the spotlight picker. */
export async function findProducts(q: string): Promise<Result<{ id: string; title: string; brand: string; image: string; status: string }[]>> {
  try {
    const r = await (await api()).GET("/v1/admin/products", { params: { query: { q: q.trim() || undefined, status: "all", stock: "all", page: 1, pageSize: 8 } } });
    if (!r.data) return problem(r.error, "Could not search products");
    return { ok: true, data: r.data.items.map((p) => ({ id: p.id, title: p.title, brand: p.brand.name, image: p.image, status: p.status ?? (p.active ? "ACTIVE" : "INACTIVE") })) };
  } catch {
    return offline;
  }
}
