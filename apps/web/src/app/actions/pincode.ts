"use server";

import { api } from "@/lib/api/server";
import type { PincodeInfo } from "@/components/store/delivery";

/** Asks the API whether the store delivers to a pincode, and how. Null when it cannot answer. */
export async function checkPincode(pin: string): Promise<PincodeInfo | null> {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  try {
    const r = await (await api()).GET("/v1/storefront/pincodes/{pin}", { params: { path: { pin } } });
    return r.data ?? null;
  } catch {
    return null;
  }
}
