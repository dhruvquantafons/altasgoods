import "server-only";
import { cache } from "react";
import type { CouponLite } from "@/components/store/types";
import { apiUrl } from "@/lib/api/session";
import type { paths } from "@/lib/api/schema";
import { CATALOG_TAG } from "@/lib/store-catalog";

export type LiveSale = paths["/v1/storefront/sales/live"]["get"]["responses"][200]["content"]["application/json"][number];
type ApiCoupon = paths["/v1/storefront/coupons"]["get"]["responses"][200]["content"]["application/json"][number];

/** Refreshed with the catalog (sales change prices), and every minute so sales start and end on time. */
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${apiUrl()}${path}`, { next: { tags: [CATALOG_TAG], revalidate: 60 } });
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Sales running now, biggest discount first. */
export const getLiveSales = cache(() => get<LiveSale[]>("/v1/storefront/sales/live", []));

/** Coupons the store lists, in the shape cart and checkout work with (rupees). */
export const getStoreCoupons = cache(async (): Promise<CouponLite[]> => {
  const list = await get<ApiCoupon[]>("/v1/storefront/coupons", []);
  return list.map((c) => ({
    code: c.code,
    description: c.description,
    type: c.type === "PERCENT" ? "percent" : "flat",
    value: c.type === "PERCENT" ? c.value : c.value / 100,
    maxDiscount: c.maxDiscountPaise === null ? undefined : c.maxDiscountPaise / 100,
    minOrder: c.minOrderPaise / 100,
    endsAt: c.endsAt,
    fundedBy: "store",
  }));
});
