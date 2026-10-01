import type { FeeLine, Settlement } from "../types";
import type { SettlementStatus } from "../status";
import { addDays, between, NOW, seeded } from "../utils";
import { categories, getProduct } from "./catalog";
import { sellerOrderLines } from "./orders";
import { sellers } from "./people";

/**
 * Example BluBuy rate card, version RC-2026-EXAMPLE. Mirrors section 13 of
 * docs/research/01-marketplace-workflows.md. Illustrative only; the commercial,
 * finance and legal teams own the real numbers.
 */
export const RATE_CARD_VERSION = "RC-2026-EXAMPLE";

/** Items priced up to this amount pay 0% commission in every category. */
export const COMMISSION_FREE_UPTO = 999;

/** Fixed fee per item (BluBuy Ship, Flex and Fulfilled; Platinum base). */
export const FIXED_FEE_SLABS = [
  { upTo: 250, fee: 4 },
  { upTo: 500, fee: 8 },
  { upTo: 1000, fee: 20 },
  { upTo: 5000, fee: 40 },
  { upTo: Infinity, fee: 55 },
];

/** Added to the fixed fee per item by seller tier. */
export const TIER_FIXED_FEE_MODIFIER = { Platinum: 0, Gold: 2, Silver: 5, Bronze: 10 } as const;

/** Forward shipping per package by chargeable weight and zone. */
export const SHIPPING_RATE_CARD = [
  { weight: "Up to 500 g", local: 25, regional: 38, national: 55, special: 75 },
  { weight: "500 g to 1 kg", local: 35, regional: 50, national: 70, special: 95 },
  { weight: "1 kg to 2 kg", local: 50, regional: 65, national: 88, special: 120 },
  { weight: "2 kg to 5 kg", local: 75, regional: 95, national: 125, special: 165 },
  { weight: "Each additional kg above 5 kg", local: 12, regional: 15, national: 20, special: 28 },
];

/** Summary view of SHIPPING_RATE_CARD kept for simple fee tables. */
export const SHIPPING_SLABS = [
  { label: "Local (same city)", first500g: 25, additional500g: 10 },
  { label: "Regional (same zone)", first500g: 38, additional500g: 12 },
  { label: "National", first500g: 55, additional500g: 15 },
];

/** Tier discount on forward shipping (percent). */
export const TIER_SHIPPING_DISCOUNT = { Platinum: 15, Gold: 10, Silver: 5, Bronze: 0 } as const;

/** No separate collection fee: gateway and COD costs are absorbed by BluBuy. Kept at zero for older screens. */
export const COLLECTION_FEE_PERCENT = { prepaid: 0, cod: 0 };
export const GST_ON_FEES_PERCENT = 18;
/** TCS under GST (section 52) on the taxable value. */
export const TCS_PERCENT = 0.5;
/** TDS under Income Tax section 194-O (working assumption D7: on taxable value). */
export const TDS_PERCENT = 0.1;
/** Settlement eligibility after delivery, in days, by tier. Payout runs Monday, Wednesday and Friday. */
export const PAYOUT_HOLD_DAYS = { Platinum: 2, Gold: 3, Silver: 5, Bronze: 7 } as const;

type Tier = keyof typeof TIER_FIXED_FEE_MODIFIER;

export function fixedFee(price: number, tier: Tier = "Platinum") {
  return FIXED_FEE_SLABS.find((s) => price <= s.upTo)!.fee + TIER_FIXED_FEE_MODIFIER[tier];
}

export function commissionPercent(categoryId: string | undefined, price: number) {
  if (price <= COMMISSION_FREE_UPTO) return 0;
  return categories.find((c) => c.id === categoryId)?.commission ?? 8;
}

/** Typical regional 1 kg parcel, heavier for laptops, appliances and furniture. */
function shippingFor(categoryId: string | undefined, subcategory: string | undefined, tier: Tier) {
  const base = subcategory === "Furniture" ? 300 : categoryId === "cat-appliances" || subcategory === "Laptops" || subcategory === "Monitors" ? 95 : 50;
  return Math.round(base * (1 - TIER_SHIPPING_DISCOUNT[tier] / 100));
}

/**
 * Fee breakdown for a single order line following section 14.1; deductions are negative.
 * COD carries no extra seller fee, the flag is kept so callers stay explicit.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function feesForLine(productId: string, price: number, qty = 1, cod = false, tier: Tier = "Platinum"): FeeLine[] {
  const p = getProduct(productId);
  const pct = commissionPercent(p?.categoryId, price);
  const gross = price * qty;
  const taxable = gross / 1.18;
  const commission = Math.round((gross * pct) / 100);
  const closing = Math.round(fixedFee(price, tier) * (qty > 1 ? 1 + (qty - 1) * 0.5 : 1));
  const shipping = shippingFor(p?.categoryId, p?.subcategory, tier);
  const gst = Math.round(((commission + closing + shipping) * GST_ON_FEES_PERCENT) / 100);
  const tcs = Math.round(taxable * (TCS_PERCENT / 100));
  const tds = Math.round(taxable * (TDS_PERCENT / 100));
  return [
    { label: `Commission (${pct}%)`, amount: -commission },
    { label: "Fixed fee", amount: -closing },
    { label: "Shipping fee", amount: -shipping },
    { label: "GST on fees (18%)", amount: -gst },
    { label: "TCS (0.5%)", amount: -tcs },
    { label: "TDS u/s 194-O (0.1%)", amount: -tds },
  ];
}

function sumFees(lines: FeeLine[][]): FeeLine[] {
  const map = new Map<string, number>();
  for (const ls of lines)
    for (const l of ls) {
      const key = l.label.startsWith("Commission") ? "Commission" : l.label;
      map.set(key, (map.get(key) ?? 0) + l.amount);
    }
  return [...map.entries()].map(([label, amount]) => ({ label, amount }));
}

/* ----------------------------- Settlements ---------------------------- */

const RUN_DAYS = new Set([1, 3, 5]); // Monday, Wednesday, Friday

function nextRunAfter(d: Date) {
  let x = addDays(d, 1);
  while (!RUN_DAYS.has(x.getDay())) x = addDays(x, 1);
  return x;
}
function previousRun(d: Date) {
  let x = addDays(d, -1);
  while (!RUN_DAYS.has(x.getDay())) x = addDays(x, -1);
  return x;
}

/**
 * Payout runs every Monday, Wednesday and Friday (spec 13.9). Each run pays the
 * order lines delivered in its window, which closes `PAYOUT_HOLD_DAYS[tier]`
 * days before the run. Index 0 is the open run still collecting eligible
 * lines, 1 is the next scheduled run, 2 was sent yesterday and is still
 * reaching the bank, older runs are paid.
 */
export function settlementsForSeller(sellerId: string, cycles = 10): Settlement[] {
  const rand = seeded(sellerId.length * 97 + 13);
  const seller = sellers.find((s) => s.id === sellerId);
  const tier = seller?.tier ?? "Bronze";
  const hold = PAYOUT_HOLD_DAYS[tier];
  const lines = sellerOrderLines(sellerId);
  const dailyBase = (seller?.gmv30d ?? 800000) / 30;
  const sample = lines.slice(0, 12).map(({ item, order }) => feesForLine(item.productId, item.price, item.quantity, order.payment.method === "cod", tier));
  const sampleGross = lines.slice(0, 12).reduce((a, { item }) => a + item.price * item.quantity, 0) || 1;
  const feeMix = sumFees(sample);

  const runs: Date[] = [];
  let run = nextRunAfter(nextRunAfter(NOW));
  for (let c = 0; c < cycles; c++) {
    runs.push(run);
    run = previousRun(run);
  }
  return runs.map((runDate, c) => {
    const prev = previousRun(runDate);
    const periodEnd = addDays(runDate, -hold);
    const periodStart = addDays(prev, -hold + 1);
    const days = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400_000) + 1);
    const inSale = periodEnd >= new Date("2026-09-26T00:00:00+05:30");
    const status: SettlementStatus =
      c === 0 ? "open" : c === 1 ? "scheduled" : c === 2 ? (sellerId === "s-profit" ? "on_hold" : "processing") : c === 7 && rand() > 0.6 ? "failed" : "paid";
    const grossSales = Math.round(dailyBase * days * (0.8 + rand() * 0.4) * (inSale ? 1.6 : 1) * (c === 0 ? 0.55 : 1));
    const ordersCount = Math.max(1, Math.round(grossSales / between(rand, 1800, 3600)));
    const fees = feeMix.map((f) => ({ label: f.label, amount: Math.round((f.amount / sampleGross) * grossSales) }));
    const refundsAmt = -Math.round(grossSales * (0.02 + rand() * 0.03));
    const netPayout = grossSales + fees.reduce((a, f) => a + f.amount, 0) + refundsAmt;
    return {
      id: `ST-${sellerId.slice(2, 6).toUpperCase()}-${runDate.toISOString().slice(2, 10).replace(/-/g, "")}`,
      sellerId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      scheduledFor: runDate.toISOString(),
      orders: ordersCount,
      grossSales,
      fees,
      refunds: refundsAmt,
      netPayout,
      status,
      utr: status === "paid" || status === "processing" ? `UTR${between(rand, 100000000000, 999999999999)}` : undefined,
    };
  });
}

/** Latest few cycles for every active seller, used by the admin payouts screen. */
export const allSettlements: Settlement[] = sellers
  .filter((s) => s.status === "active" || s.status === "on_hold")
  .flatMap((s) => settlementsForSeller(s.id, 6))
  .sort((a, b) => +new Date(b.periodStart) - +new Date(a.periodStart));
