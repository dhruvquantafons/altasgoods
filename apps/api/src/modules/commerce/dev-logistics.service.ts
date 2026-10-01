import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { orderItems, orders, type OrderItemStatus } from "../../db/schema.js";
import { notFound } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { AuthUser } from "../auth/auth.guard.js";
import { OrderWorkflow } from "./workflow.service.js";

/** Simulated courier scans so an order can be taken all the way to delivered. */
@Injectable()
export class DevLogisticsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  async advance(user: AuthUser, orderItemId: string, to: OrderItemStatus, deliveredDaysAgo?: number) {
    const [row] = await this.db
      .select({ orderId: orderItems.orderId, sellerId: orderItems.sellerId, customerId: orders.userId })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orderItems.id, orderItemId));
    // the item's seller or its customer may drive the simulation
    if (!row || (row.customerId !== user.id && !user.sellers.includes(row.sellerId))) throw notFound("Order item");
    const [item] = await this.db.transaction(async (tx) => {
      const moved = await this.workflow.transition(tx, { orderId: row.orderId, itemIds: [orderItemId], to, actor: "LOGISTICS", note: "Simulated courier scan" });
      if (to === "DELIVERED" && deliveredDaysAgo) await tx.update(orderItems).set({ deliveredAt: new Date(Date.now() - deliveredDaysAgo * 86_400_000) }).where(eq(orderItems.id, orderItemId));
      return moved;
    });
    return { id: item!.id, status: item!.status };
  }
}
