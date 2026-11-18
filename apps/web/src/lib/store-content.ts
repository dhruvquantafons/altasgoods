import "server-only";
import { cache } from "react";
import { apiUrl } from "@/lib/api/session";
import type { paths } from "@/lib/api/schema";

type Json<P extends keyof paths> = paths[P] extends { get: { responses: { 200: { content: { "application/json": infer T } } } } } ? T : never;

export type StorePolicyCard = Json<"/v1/storefront/content/policies">[number];
export type StorePolicy = Json<"/v1/storefront/content/policies/{slug}">;
export type HelpContent = Json<"/v1/storefront/content/help">;
export type StoreRole = Json<"/v1/storefront/content/careers">[number];
export type StorePress = Json<"/v1/storefront/content/press">[number];
export type AboutContent = Json<"/v1/storefront/content/about">;
export type StoreSpotlight = Json<"/v1/storefront/content/brand-spotlights">[number];

/** Refreshed when Content saves (updateTag(CONTENT_TAG)), and every minute otherwise. */
export const CONTENT_TAG = "content";

/** Reads one content endpoint. Null when the API is down or has no such page, so the page can say so instead of breaking. */
async function read<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${apiUrl()}/v1/storefront/content/${path}`, { next: { tags: [CONTENT_TAG], revalidate: 60 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export const getStorePolicies = cache(async (): Promise<StorePolicyCard[]> => (await read<StorePolicyCard[]>("policies")) ?? []);

/** A published policy, or null when there is none with this address (the page shows Not found). */
export const getStorePolicy = cache(async (slug: string): Promise<StorePolicy | null> => read<StorePolicy>(`policies/${encodeURIComponent(slug)}`));

export const getHelpContent = cache(async (): Promise<HelpContent> => (await read<HelpContent>("help")) ?? { topics: [], faqs: [] });

export const getCareers = cache(async (): Promise<StoreRole[]> => (await read<StoreRole[]>("careers")) ?? []);

export const getRole = cache(async (slug: string): Promise<StoreRole | null> => read<StoreRole>(`careers/${encodeURIComponent(slug)}`));

export const getPress = cache(async (): Promise<StorePress[]> => (await read<StorePress[]>("press")) ?? []);

export const getAbout = cache(async (): Promise<AboutContent> => (await read<AboutContent>("about")) ?? { numbers: [], principles: [], milestones: [], offices: [], updatedAt: null });

export const getBrandSpotlights = cache(async (): Promise<StoreSpotlight[]> => (await read<StoreSpotlight[]>("brand-spotlights")) ?? []);
