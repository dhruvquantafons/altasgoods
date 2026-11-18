import "server-only";
import { cache } from "react";
import { apiUrl } from "@/lib/api/session";
import type { paths } from "@/lib/api/schema";

export type StorefrontSettings = paths["/v1/storefront/settings"]["get"]["responses"][200]["content"]["application/json"];

/** Revalidated when an admin saves Settings (updateTag(SETTINGS_TAG)), and every minute otherwise. */
export const SETTINGS_TAG = "settings";

/** Placeholders, never made-up details; used only while the API is unreachable. */
const FALLBACK: StorefrontSettings = {
  delivery: { feePaise: 4_000, freeFromPaise: 49_900 },
  cod: { enabled: true, maxOrderPaise: 5_000_000 },
  notice: { enabled: false, message: "" },
  company: {
    legalName: "Your Company Private Limited (not set)",
    cin: "NOT SET",
    gstin: "NOT SET",
    registeredOffice: "Registered office address not set",
    customerCare: "Not set",
    customerCareHours: "Not set",
    email: "care@example.com",
    website: "https://example.com",
  },
  grievance: {
    name: "Grievance Officer (name not set)",
    designation: "Grievance Officer",
    email: "grievance@example.com",
    phone: "Not set",
    hours: "Not set",
    address: "Not set",
    ackHours: 48,
    resolutionDays: 30,
  },
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
