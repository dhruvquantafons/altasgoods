import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, lte } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { sales } from "../../db/schema.js";
import { bestSale, salePrice, type LiveSale } from "./pricing.js";

/** Live sales, and what they do to a product's price. */
@Injectable()
export class SalesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Sales running right now (active, started, not yet ended). */
  async live(at: Date = this.clock.now(), tx: Db | Tx = this.db): Promise<LiveSale[]> {
    return tx
      .select({
        id: sales.id,
        name: sales.name,
        slug: sales.slug,
        discountPercent: sales.discountPercent,
        scope: sales.scope,
        categoryIds: sales.categoryIds,
        productIds: sales.productIds,
        endsAt: sales.endsAt,
      })
      .from(sales)
      .where(and(eq(sales.status, "ACTIVE"), lte(sales.startsAt, at), gt(sales.endsAt, at)));
  }

  /** A product's selling price under the given live sales, with the sale that set it. */
  priceFor(live: LiveSale[], product: { id: string; categoryId: string }, pricePaise: number) {
    const sale = bestSale(live, product);
    return { pricePaise: sale ? salePrice(pricePaise, sale.discountPercent) : pricePaise, sale };
  }
}
