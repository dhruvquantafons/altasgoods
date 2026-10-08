/**
 * Pure cart and checkout maths shared by the cart page and checkout so the
 * same breakdown appears everywhere (no drip pricing). AltasGoods charges no
 * platform fee and no cash on delivery fee; delivery is free for Plus members
 * and for seller shipments of ₹499 or more.
 */
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "./delivery";
import type { BankOffer, CartCatalog, CartLine, CartOffer, CartProduct, CouponLite } from "./types";

/** Where checkout leaves the just-placed order for the confirmation page. */
export const LAST_ORDER_KEY = "blubuy.lastOrder.v1";

/** Cart line identity: an offer (product + seller) plus the chosen variant. */
export const lineKey = (productId: string, sellerId: string, variant?: string) => `${productId}|${sellerId}|${variant ?? ""}`;

export interface PricedLine {
  line: CartLine;
  product: CartProduct;
  offer: CartOffer;
  unitPrice: number;
  unitMrp: number;
  lineTotal: number;
  lineMrp: number;
}

export interface SellerGroup {
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  /** max delivery days across the group */
  deliveryDays: number;
  fulfilledBy: "blubuy" | "seller";
}

export interface Totals {
  lines: PricedLine[];
  groups: SellerGroup[];
  itemCount: number;
  mrpTotal: number;
  priceTotal: number;
  mrpDiscount: number;
  coupon: CouponLite | null;
  couponDiscount: number;
  couponNote: string | null;
  delivery: number;
  total: number;
  savings: number;
}

export function priceLines(lines: CartLine[], catalog: CartCatalog): PricedLine[] {
  return lines.flatMap((line) => {
    const product = catalog[line.productId];
    if (!product) return [];
    const offer = product.offers.find((o) => o.sellerId === line.sellerId) ?? product.offers[0];
    if (!offer) return [];
    return [{ line, product, offer, unitPrice: offer.price, unitMrp: offer.mrp, lineTotal: offer.price * line.qty, lineMrp: offer.mrp * line.qty }];
  });
}

/** Why a coupon cannot apply right now, or null when it can. */
export function couponBlocker(c: CouponLite, lines: PricedLine[], ctx: { plus: boolean; method?: string }) {
  const eligible = couponBase(c, lines);
  if (c.firstOrderOnly) return "Valid on your first AltasGoods order only";
  if (c.plusOnly && !ctx.plus) return "For AltasGoods Plus members";
  if (c.sellerId && eligible === 0) return "Applies to selected items from one seller";
  if (eligible < c.minOrder) return `Add items worth ₹${(c.minOrder - eligible).toLocaleString("en-IN")} more to use this`;
  if (c.upiOnly && ctx.method && ctx.method !== "upi") return "Applies only when you pay by UPI";
  return null;
}

function couponBase(c: CouponLite, lines: PricedLine[]) {
  return lines
    .filter((l) => (!c.sellerId || l.offer.sellerId === c.sellerId) && (!c.subcategories || c.subcategories.includes(l.product.subcategory)))
    .reduce((a, l) => a + l.lineTotal, 0);
}

export function couponValue(c: CouponLite, lines: PricedLine[]) {
  const base = couponBase(c, lines);
  const raw = c.type === "flat" ? c.value : Math.floor((base * c.value) / 100);
  return Math.min(raw, c.maxDiscount ?? Infinity, base);
}

export function computeTotals(
  lines: CartLine[],
  catalog: CartCatalog,
  opts: { couponCode: string | null; coupons: CouponLite[]; plus: boolean; method?: string },
): Totals {
  const priced = priceLines(lines, catalog);
  const groupsMap = new Map<string, SellerGroup>();
  for (const l of priced) {
    const g = groupsMap.get(l.offer.sellerId) ?? {
      sellerId: l.offer.sellerId,
      sellerName: l.offer.sellerName,
      sellerSlug: l.offer.sellerSlug,
      lines: [],
      subtotal: 0,
      deliveryFee: 0,
      deliveryDays: 0,
      fulfilledBy: l.offer.fulfilledBy,
    };
    g.lines.push(l);
    g.subtotal += l.lineTotal;
    g.deliveryDays = Math.max(g.deliveryDays, l.offer.deliveryDays);
    groupsMap.set(l.offer.sellerId, g);
  }
  const groups = [...groupsMap.values()].map((g) => ({ ...g, deliveryFee: opts.plus || g.subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE }));
  const mrpTotal = priced.reduce((a, l) => a + l.lineMrp, 0);
  const priceTotal = priced.reduce((a, l) => a + l.lineTotal, 0);
  const coupon = opts.couponCode ? (opts.coupons.find((c) => c.code === opts.couponCode) ?? null) : null;
  const blocker = coupon ? couponBlocker(coupon, priced, { plus: opts.plus, method: opts.method }) : null;
  const couponDiscount = coupon && !blocker ? couponValue(coupon, priced) : 0;
  const delivery = groups.reduce((a, g) => a + g.deliveryFee, 0);
  const total = priceTotal - couponDiscount + delivery;
  return {
    lines: priced,
    groups,
    itemCount: priced.reduce((a, l) => a + l.line.qty, 0),
    mrpTotal,
    priceTotal,
    mrpDiscount: mrpTotal - priceTotal,
    coupon,
    couponDiscount,
    couponNote: blocker,
    delivery,
    total,
    savings: mrpTotal - priceTotal + couponDiscount,
  };
}

/** Best single instant bank offer for a method (one bank offer per order, spec 10.16). */
export function bestBankOffer(offers: BankOffer[], amount: number, method: string, bank?: string) {
  const value = (o: BankOffer) => (o.flat ? o.flat : Math.min(Math.floor((amount * (o.percent ?? 0)) / 100), o.cap ?? Infinity));
  const eligible = offers.filter(
    (o) => o.method === method && amount >= o.minOrder && (o.flat || o.percent) && o.kind !== "Cashback" && o.kind !== "Partner offer" && (!o.bank || !bank || o.bank === bank),
  );
  const best = eligible.sort((a, b) => value(b) - value(a))[0];
  return best ? { offer: best, value: value(best) } : null;
}
