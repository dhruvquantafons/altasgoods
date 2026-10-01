import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { cartItems, offers, products, sellers } from "../../db/schema.js";
import { notFound, unprocessable } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import { addCartItemBody, cartLineInput, patchCartItemBody } from "./commerce.schemas.js";

const MAX_QTY = 10;

@Injectable()
export class CartService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string) {
    const rows = await this.db
      .select({ item: cartItems, offer: offers, product: products, seller: sellers })
      .from(cartItems)
      .innerJoin(offers, eq(offers.id, cartItems.offerId))
      .innerJoin(products, eq(products.id, offers.productId))
      .innerJoin(sellers, eq(sellers.id, offers.sellerId))
      .where(eq(cartItems.userId, userId))
      .orderBy(asc(cartItems.createdAt));
    const lines = rows.map(({ item, offer, product, seller }) => {
      const available = offer.status === "ACTIVE" && seller.status === "ACTIVE" ? offer.stock : 0;
      return {
        id: item.id,
        offerId: offer.id,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        image: product.images[0] ?? "",
        variant: item.variant,
        qty: item.qty,
        savedForLater: item.savedForLater,
        seller: { id: seller.id, slug: seller.slug, displayName: seller.displayName },
        pricePaise: offer.pricePaise,
        mrpPaise: offer.mrpPaise,
        inStock: available >= item.qty,
        availableQty: Math.min(available, MAX_QTY),
        deliveryDays: offer.deliveryDays,
        codAvailable: offer.codAvailable,
      };
    });
    const active = lines.filter((l) => !l.savedForLater);
    const mrpTotal = active.reduce((a, l) => a + l.mrpPaise * l.qty, 0);
    const subtotal = active.reduce((a, l) => a + l.pricePaise * l.qty, 0);
    return { lines, summary: { itemCount: active.reduce((a, l) => a + l.qty, 0), mrpTotalPaise: mrpTotal, subtotalPaise: subtotal, savingsPaise: mrpTotal - subtotal } };
  }

  private async assertOffers(ids: string[]) {
    if (!ids.length) return;
    const found = await this.db.select({ id: offers.id }).from(offers).where(inArray(offers.id, ids));
    if (found.length !== new Set(ids).size) throw unprocessable("OFFER_NOT_FOUND", "One of these products is no longer available");
  }

  /** Replaces the whole cart, used by clients that keep a local cart. */
  async replace(userId: string, lines: z.infer<typeof cartLineInput>[]) {
    await this.assertOffers(lines.map((l) => l.offerId));
    const merged = new Map<string, z.infer<typeof cartLineInput>>();
    for (const l of lines) {
      const key = `${l.offerId}|${l.variant}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...l, qty: Math.min(MAX_QTY, prev.qty + l.qty) } : l);
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      if (merged.size) await tx.insert(cartItems).values([...merged.values()].map((l) => ({ ...l, userId })));
    });
    return this.get(userId);
  }

  /** Adds guest cart lines into the signed-in cart, keeping the higher quantity. */
  async merge(userId: string, lines: z.infer<typeof cartLineInput>[]) {
    await this.assertOffers(lines.map((l) => l.offerId));
    for (const l of lines) {
      await this.db
        .insert(cartItems)
        .values({ ...l, userId })
        .onConflictDoUpdate({ target: [cartItems.userId, cartItems.offerId, cartItems.variant], set: { qty: l.qty } });
    }
    return this.get(userId);
  }

  async add(userId: string, body: z.infer<typeof addCartItemBody>) {
    await this.assertOffers([body.offerId]);
    const [existing] = await this.db.select().from(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.offerId, body.offerId), eq(cartItems.variant, body.variant)));
    if (existing) await this.db.update(cartItems).set({ qty: Math.min(MAX_QTY, existing.qty + body.qty), savedForLater: false }).where(eq(cartItems.id, existing.id));
    else await this.db.insert(cartItems).values({ ...body, userId });
    return this.get(userId);
  }

  async update(userId: string, id: string, patch: z.infer<typeof patchCartItemBody>) {
    const [row] = await this.db.update(cartItems).set(patch).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId))).returning({ id: cartItems.id });
    if (!row) throw notFound("Cart item");
    return this.get(userId);
  }

  async remove(userId: string, id: string) {
    await this.db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
    return this.get(userId);
  }

  /** Lines that checkout should buy: everything not saved for later. */
  async checkoutLines(userId: string) {
    const rows = await this.db.select().from(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.savedForLater, false)));
    return rows.map((r) => ({ offerId: r.offerId, variant: r.variant, qty: r.qty }));
  }

  async removeOffers(userId: string, offerIds: string[]) {
    if (offerIds.length) await this.db.delete(cartItems).where(and(eq(cartItems.userId, userId), inArray(cartItems.offerId, offerIds), eq(cartItems.savedForLater, false)));
  }
}
