import "server-only";
import { cache } from "react";
import type { HeroSlideData } from "@/components/store/hero-carousel";
import { apiUrl } from "@/lib/api/session";
import type { paths } from "@/lib/api/schema";
import { HERO_SLIDES, PROMO_TILES } from "@/lib/mock/store-extra";

type Banners = paths["/v1/storefront/banners"]["get"]["responses"][200]["content"]["application/json"];

/** Refreshed when Storefront CMS saves (updateTag(CMS_TAG)), and every minute so schedules start and end on time. */
export const CMS_TAG = "cms";

export interface PromoTile {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  align: "left" | "right";
}

/**
 * The homepage hero slides and promo tiles from Storefront CMS. While none are
 * set up (a new store) or the API is unreachable, the built-in ones show, so
 * the homepage is never empty.
 */
export const getStoreBanners = cache(async (): Promise<{ hero: HeroSlideData[]; promo: PromoTile[] }> => {
  let data: Banners | null = null;
  try {
    const r = await fetch(`${apiUrl()}/v1/storefront/banners`, { next: { tags: [CMS_TAG], revalidate: 60 } });
    if (r.ok) data = (await r.json()) as Banners;
  } catch {
    data = null;
  }
  const hero: HeroSlideData[] = data?.hero.length
    ? data.hero.map((b) => ({ id: b.id, image: b.image, alt: b.alt, eyebrow: b.eyebrow, title: b.title, body: b.body, cta: b.ctaLabel || "Shop now", href: b.href, align: b.align, theme: b.theme, position: b.position }))
    : HERO_SLIDES;
  const promo: PromoTile[] = data?.promo.length ? data.promo.map((b) => ({ id: b.id, image: b.image, alt: b.alt, eyebrow: b.eyebrow, title: b.title, body: b.body, href: b.href, align: b.align })) : PROMO_TILES;
  return { hero, promo };
});
