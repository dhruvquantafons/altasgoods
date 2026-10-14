import type { Address } from "@/lib/api/types";

/** An address as the My Account address book shows it. Shared by the server page and the client component. */
export interface BookAddress {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
  isDefault?: boolean;
}

export function toBookAddress(a: Address): BookAddress {
  return { ...a, line2: a.line2 ?? undefined, landmark: a.landmark ?? undefined, type: a.type.toLowerCase() as BookAddress["type"] };
}
