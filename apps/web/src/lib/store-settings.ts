import "server-only";
import { cache } from "react";
import { apiUrl } from "@/lib/api/session";
import type { paths } from "@/lib/api/schema";

export type StorefrontSettings = paths["/v1/storefront/settings"]["get"]["responses"][200]["content"]["application/json"];

/** Revalidated when an admin saves Settings (updateTag(SETTINGS_TAG)), and every minute otherwise. */
export const SETTINGS_TAG = "settings";

/** What the store ran with before Settings existed; used only while the API is unreachable. */
const FALLBACK: StorefrontSettings = {
  delivery: { feePaise: 4_000, freeFromPaise: 49_900 },
  cod: { maxOrderPaise: 5_000_000 },
  notice: { enabled: false, message: "" },
  company: {
    legalName: "AltasGoods Commerce Private Limited",
    cin: "",
    gstin: "",
    registeredOffice: "",
    customerCare: "",
    customerCareHours: "",
    email: "care@altasgoods.in",
    website: "www.altasgoods.in",
  },
  grievance: { name: "Grievance Officer", designation: "", email: "grievance.officer@altasgoods.in", phone: "", hours: "", address: "", ackHours: 48, resolutionDays: 30 },
};

export const getStoreSettings = cache(async (): Promise<StorefrontSettings> => {
  try {
    const r = await fetch(`${apiUrl()}/v1/storefront/settings`, { next: { tags: [SETTINGS_TAG], revalidate: 60 } });
    if (!r.ok) throw new Error(`settings ${r.status}`);
    return (await r.json()) as StorefrontSettings;
  } catch {
    return FALLBACK;
  }
});
