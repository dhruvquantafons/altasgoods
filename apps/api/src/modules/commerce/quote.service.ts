import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK } from "../../common/tokens.js";
import type { Tx } from "../../db/client.js";
import { categories, coupons, offers, products, sellers, type PaymentMethod } from "../../db/schema.js";
import { COD_LIMIT_PAISE, couponDiscount, deliveryFee, promiseDate } from "./pricing.js";

export interface QuoteLineInput {
  offerId: string;
  variant: string;
  qty: number;
}

export interface QuoteInput {
  lines: QuoteLineInput[];
  isPlus: boolean;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  /** lock offer rows for update (order placement) */
  lock?: boolean;
}

export type Quote = Awaited<ReturnType<QuoteService["build"]>>;

/** Prices a set of lines exactly as an order would be priced. */
@Injectable()
export class QuoteService {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async build(tx: Tx, input: QuoteInput) {
    const now = this.clock.now();
    const ids = [...new Set(input.lines.map((l) => l.offerId))];
    const query = tx
      .select({ offer: offers, product: products, seller: sellers, commissionBps: categories.commissionBps })
      .from(offers)
      .innerJoin(products, eq(products.id, offers.productId))
      .innerJoin(sellers, eq(sellers.id, offers.sellerId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(inArray(offers.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]));
    const rows = input.lock ? await query.for("update", { of: offers }) : await query;
    const byId = new Map(rows.map((r) => [r.offer.id, r]));

    const issues: { offerId: string; code: string; message: string }[] = [];
    const requested = new Map<string, number>();
    for (const l of input.lines) requested.set(l.offerId, (requested.get(l.offerId) ?? 0) + l.qty);

    const priced = input.lines.flatMap((l) => {
      const r = byId.get(l.offerId);
      if (!r || r.offer.status !== "ACTIVE" || r.seller.status !== "ACTIVE" || r.product.listingStatus !== "LIVE") {
        issues.push({ offerId: l.offerId, code: "UNAVAILABLE", message: "This item is no longer available" });
        return [];
      }
      const want = requested.get(l.offerId)!;
      if (r.offer.stock < want) {
        issues.push({
          offerId: l.offerId,
          code: r.offer.stock === 0 ? "OUT_OF_STOCK" : "INSUFFICIENT_STOCK",
          message: r.offer.stock === 0 ? `${r.product.title} is out of stock` : `Only ${r.offer.stock} left of ${r.product.title}`,
        });
      }
      return [{ input: l, ...r }];
    });

    const bySeller = new Map<string, typeof priced>();
    for (const p of priced) bySeller.set(p.seller.id, [...(bySeller.get(p.seller.id) ?? []), p]);

    const shipments = [...bySeller.values()].map((group) => {
      const seller = group[0]!.seller;
      const subtotal = group.reduce((a, p) => a + p.offer.pricePaise * p.input.qty, 0);
      const promised = group.reduce((latest, p) => {
        const d = promiseDate(now, p.offer.deliveryDays);
        return d > latest ? d : latest;
      }, new Date(0));
      return {
        seller: { id: seller.id, slug: seller.slug, displayName: seller.displayName },
        fulfilledBy: group.every((p) => p.offer.fulfilledBy === "BLUBUY") ? ("BLUBUY" as const) : ("SELLER" as const),
        lines: group.map((p) => ({
          offerId: p.offer.id,
          productId: p.product.id,
          slug: p.product.slug,
          title: p.product.title,
          image: p.product.images[0] ?? "",
          variant: p.input.variant,
          qty: p.input.qty,
          unitPricePaise: p.offer.pricePaise,
          mrpPaise: p.offer.mrpPaise,
          lineTotalPaise: p.offer.pricePaise * p.input.qty,
        })),
        subtotalPaise: subtotal,
        deliveryFeePaise: deliveryFee(subtotal, input.isPlus),
        promisedBy: promised.toISOString(),
        // internal fields used by order placement
        _rows: group,
      };
    });

    const mrpTotal = priced.reduce((a, p) => a + p.offer.mrpPaise * p.input.qty, 0);
    const subtotal = shipments.reduce((a, s) => a + s.subtotalPaise, 0);
    const delivery = shipments.reduce((a, s) => a + s.deliveryFeePaise, 0);

    let coupon: { code: string; applied: boolean; message: string } | null = null;
    let couponDiscountPaise = 0;
    if (input.couponCode) {
      const [c] = await tx.select().from(coupons).where(eq(coupons.code, input.couponCode));
      if (!c) coupon = { code: input.couponCode, applied: false, message: "This coupon code is not valid" };
      else {
        const r = couponDiscount(c, subtotal, now);
        couponDiscountPaise = r.discountPaise;
        coupon = { code: c.code, applied: r.discountPaise > 0, message: r.message };
      }
    }

    const total = subtotal - couponDiscountPaise + delivery;
    const codBlocker = priced.find((p) => !p.offer.codAvailable);
    const cod = codBlocker
      ? { available: false, reason: `Pay on delivery is not available for ${codBlocker.product.title}` }
      : total > COD_LIMIT_PAISE
        ? { available: false, reason: "Pay on delivery is available for orders up to ₹50,000" }
        : { available: true, reason: null };
    if (input.paymentMethod === "COD" && !cod.available) issues.push({ offerId: priced[0]?.offer.id ?? ids[0] ?? "", code: "COD_UNAVAILABLE", message: cod.reason! });

    return {
      shipments,
      mrpTotalPaise: mrpTotal,
      subtotalPaise: subtotal,
      couponDiscountPaise,
      coupon,
      deliveryFeePaise: delivery,
      totalPaise: total,
      savingsPaise: mrpTotal - subtotal + couponDiscountPaise,
      cod,
      issues,
      canPlaceOrder: issues.length === 0 && priced.length > 0,
    };
  }
}

/** Strips internal fields before a quote leaves the API. */
export function publicQuote(q: Quote) {
  return { ...q, shipments: q.shipments.map(({ _rows: _unused, ...s }) => s) };
}
