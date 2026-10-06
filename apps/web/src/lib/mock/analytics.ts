import { addDays, NOW, seeded } from "../utils";

/** AltasGoods Big Days festive sale window used to shape the series. */
export const SALE_EVENT = {
  name: "AltasGoods Big Days",
  startsAt: "2026-09-26T00:00:00+05:30",
  endsAt: "2026-10-05T23:59:00+05:30",
};

function isSaleDay(d: Date) {
  return d >= new Date(SALE_EVENT.startsAt) && d <= new Date(SALE_EVENT.endsAt);
}

export interface PlatformDay {
  date: string;
  gmv: number;
  orders: number;
  visitors: number;
  newCustomers: number;
  conversion: number;
  aov: number;
  returns: number;
}

/** 90 days of marketplace-wide metrics, ending today. */
export const platformDaily: PlatformDay[] = Array.from({ length: 90 }, (_, i) => {
  const d = addDays(NOW, i - 89);
  const r = seeded(i + 7)();
  const weekday = d.getDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.12 : 1;
  const trend = 1 + i * 0.004;
  const sale = isSaleDay(d) ? 2.6 + r * 0.6 : 1;
  const visitors = Math.round(1_850_000 * trend * weekend * (isSaleDay(d) ? 2.1 : 1) * (0.94 + r * 0.12));
  const conversion = Math.round((2.4 + r * 0.5 + (isSaleDay(d) ? 1.1 : 0)) * 100) / 100;
  const orders = Math.round((visitors * conversion) / 100);
  const aov = Math.round(1900 + r * 380 + (isSaleDay(d) ? 650 : 0));
  return {
    date: d.toISOString(),
    gmv: orders * aov * (i === 89 ? 0.45 : 1) * (sale > 1 ? 1.04 : 1),
    orders: Math.round(orders * (i === 89 ? 0.45 : 1)),
    visitors: Math.round(visitors * (i === 89 ? 0.45 : 1)),
    newCustomers: Math.round(orders * (0.11 + r * 0.05)),
    conversion,
    aov,
    returns: Math.round(orders * (0.045 + r * 0.02)),
  };
});

export interface SellerDay {
  date: string;
  sales: number;
  orders: number;
  units: number;
  pageViews: number;
  conversion: number;
  adSpend: number;
}

/** 30 days of metrics for the current seller (Apex Retail). */
export const sellerDaily: SellerDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = addDays(NOW, i - 29);
  const r = seeded(i + 300)();
  const sale = isSaleDay(d) ? 2.3 + r * 0.5 : 1;
  const pageViews = Math.round(21000 * (0.9 + r * 0.25) * (isSaleDay(d) ? 1.9 : 1));
  const conversion = Math.round((3.1 + r * 0.8 + (isSaleDay(d) ? 0.9 : 0)) * 100) / 100;
  const orders = Math.round((pageViews * conversion) / 100 * (i === 29 ? 0.45 : 1));
  return {
    date: d.toISOString(),
    sales: Math.round(orders * (4200 + r * 900) * (sale > 1 ? 1.08 : 1)),
    orders,
    units: Math.round(orders * 1.18),
    pageViews: Math.round(pageViews * (i === 29 ? 0.45 : 1)),
    conversion,
    adSpend: Math.round(18000 * (0.8 + r * 0.4) * (isSaleDay(d) ? 1.8 : 1)),
  };
});

/** Share of GMV by top-level category over the last 30 days (percent). */
export const categoryMix = [
  { category: "Mobiles & Tablets", share: 31.4, gmv: 0 },
  { category: "Electronics", share: 22.8, gmv: 0 },
  { category: "Fashion", share: 16.2, gmv: 0 },
  { category: "Home & Furniture", share: 10.9, gmv: 0 },
  { category: "Appliances", share: 8.1, gmv: 0 },
  { category: "Beauty", share: 4.6, gmv: 0 },
  { category: "Other", share: 6.0, gmv: 0 },
].map((c) => ({ ...c, gmv: Math.round((platformDaily.slice(-30).reduce((a, d) => a + d.gmv, 0) * c.share) / 100) }));

/** Top states by orders, last 30 days. */
export const regionMix = [
  { region: "Maharashtra", orders: 412_300 },
  { region: "Karnataka", orders: 338_900 },
  { region: "Uttar Pradesh", orders: 301_200 },
  { region: "Delhi NCR", orders: 284_700 },
  { region: "Tamil Nadu", orders: 251_600 },
  { region: "Telangana", orders: 198_400 },
  { region: "West Bengal", orders: 176_800 },
  { region: "Gujarat", orders: 162_100 },
];

/** Checkout funnel for the last 7 days. */
export const funnel = [
  { stage: "Sessions", value: 41_200_000 },
  { stage: "Product views", value: 23_900_000 },
  { stage: "Added to cart", value: 5_870_000 },
  { stage: "Reached checkout", value: 2_640_000 },
  { stage: "Orders placed", value: 1_412_000 },
];

/** Payment method share of orders, last 30 days (percent). */
export const paymentMix = [
  { method: "UPI", share: 46.2 },
  { method: "Cash on delivery", share: 21.4 },
  { method: "Cards", share: 17.1 },
  { method: "EMI and Pay Later", share: 8.3 },
  { method: "Net banking and wallets", share: 7.0 },
];
