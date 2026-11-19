import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { products, wishlistItems } from "../../db/schema.js";
import { DB } from "../../common/tokens.js";

@Injectable()
export class WishlistService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Newest first. */
  async get(userId: string) {
    // an archived product is gone from the store, so it drops out of the list
    const rows = await this.db
      .select({ productId: wishlistItems.productId })
      .from(wishlistItems)
      .innerJoin(products, eq(products.id, wishlistItems.productId))
      .where(and(eq(wishlistItems.userId, userId), ne(products.listingStatus, "ARCHIVED")))
      .orderBy(desc(wishlistItems.createdAt));
    return { productIds: rows.map((r) => r.productId) };
  }

  /** Replaces the wishlist with these products, newest first; ids that are not products are dropped. */
  async replace(userId: string, productIds: string[]) {
    const ids = [...new Set(productIds)];
    const known = ids.length
      ? new Set((await this.db.select({ id: products.id }).from(products).where(and(inArray(products.id, ids), ne(products.listingStatus, "ARCHIVED")))).map((p) => p.id))
      : new Set<string>();
    const keep = ids.filter((id) => known.has(id));
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx.delete(wishlistItems).where(eq(wishlistItems.userId, userId));
      // stamped a millisecond apart so the order survives the round trip
      if (keep.length) await tx.insert(wishlistItems).values(keep.map((productId, i) => ({ userId, productId, createdAt: new Date(now - i) })));
    });
    return { productIds: keep };
  }
}
