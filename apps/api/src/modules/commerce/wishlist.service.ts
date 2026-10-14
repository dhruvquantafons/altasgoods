import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { products, wishlistItems } from "../../db/schema.js";
import { DB } from "../../common/tokens.js";

@Injectable()
export class WishlistService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Newest first. */
  async get(userId: string) {
    const rows = await this.db
      .select({ productId: wishlistItems.productId })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
      .orderBy(desc(wishlistItems.createdAt));
    return { productIds: rows.map((r) => r.productId) };
  }

  /** Replaces the wishlist with these products, newest first; ids that are not products are dropped. */
  async replace(userId: string, productIds: string[]) {
    const ids = [...new Set(productIds)];
    const known = ids.length
      ? new Set((await this.db.select({ id: products.id }).from(products).where(inArray(products.id, ids))).map((p) => p.id))
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
