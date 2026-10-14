"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Delivery and cash on delivery rules from Settings, in rupees, for prices worked out in the browser. */
export interface DeliveryRules {
  fee: number;
  freeFrom: number;
  codLimit: number;
}

/** Today's defaults, for anything rendered outside a provider. */
export const DEFAULT_RULES: DeliveryRules = { fee: 40, freeFrom: 499, codLimit: 50_000 };

const Ctx = createContext<DeliveryRules>(DEFAULT_RULES);

export function StoreSettingsProvider({ rules, children }: { rules: DeliveryRules; children: ReactNode }) {
  return <Ctx.Provider value={rules}>{children}</Ctx.Provider>;
}

export const useDeliveryRules = () => useContext(Ctx);

/** "Free delivery by Sat, 3 Oct" when the price clears the free delivery threshold, otherwise "Delivery by ...". */
export function DeliveryText({ price, days, when }: { price: number; days: number; when: string }) {
  const { freeFrom } = useDeliveryRules();
  const text = `${price >= freeFrom ? "Free delivery" : "Delivery"} ${days <= 1 ? when : `by ${when}`}`;
  return price >= freeFrom ? <span className="font-medium">{text}</span> : <>{text}</>;
}
