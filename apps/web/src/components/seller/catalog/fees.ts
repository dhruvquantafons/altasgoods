import type { RateCard } from "@/lib/mock/seller-extra";
import type { Channel } from "../shared";

/**
 * Client-safe fee estimate per unit following section 14.1 of the workflow spec.
 * Rate card values arrive as plain props from the server (RATE_CARD).
 */
export function estimateFees(rc: RateCard, input: { price: number; categoryId: string; channel: Channel; heavy?: boolean }) {
  const { price, categoryId, channel, heavy } = input;
  if (!price || price <= 0) return null;
  const pct = price <= rc.commissionFreeUpto ? 0 : (rc.categoryCommission[categoryId] ?? 8);
  const commission = Math.round((price * pct) / 100);
  const fixed = (rc.fixedSlabs.find((s) => price <= s.upTo)?.fee ?? 55) + rc.tierModifier;
  const shipping = channel === "self" ? 0 : Math.round((heavy ? 95 : 50) * (1 - rc.shippingDiscount / 100));
  const pickPack = channel === "fulfilled" ? 14 : 0;
  const gst = Math.round(((commission + fixed + shipping + pickPack) * rc.gst) / 100);
  const taxable = price / 1.18;
  const tcs = Math.round((taxable * rc.tcs) / 100);
  const tds = Math.round((taxable * rc.tds) / 100);
  const rows = [
    { label: `Commission (${pct}%)`, value: -commission },
    { label: "Fixed fee", value: -fixed },
    { label: channel === "self" ? "Shipping (your courier)" : "Shipping fee", value: -shipping },
    ...(pickPack ? [{ label: "Pick and pack", value: -pickPack }] : []),
    { label: "GST on fees (18%)", value: -gst },
    { label: "TCS (0.5%)", value: -tcs },
    { label: "TDS u/s 194-O (0.1%)", value: -tds },
  ];
  const deductions = rows.reduce((a, r) => a + r.value, 0);
  return { pct, rows, deductions, net: price + deductions };
}
