import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { notFound } from "../../common/errors.js";
import { CLOCK, PAYMENT_PROVIDER } from "../../common/tokens.js";
import type { Tx } from "../../db/client.js";
import { offers, orderEvents, orderItems, orders, payments, refunds, type Actor, type OrderItemStatus, type OrderStatus } from "../../db/schema.js";
import type { PaymentProvider } from "./payments/provider.js";
import { dispatchByDate } from "./pricing.js";
import { assertTransition, deriveOrderStatus } from "./state.js";

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;

const INACTIVE: OrderItemStatus[] = ["CANCELLED", "RTO_IN_TRANSIT", "RTO_RECEIVED", "LOST"];

/**
 * The only place order items change status. Each transition is validated
 * against the state machine, applies its side effects (stock, fees, refunds,
 * AWB), is recorded in order_events, and re-derives the order header.
 */
@Injectable()
export class OrderWorkflow {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async lockOrder(tx: Tx, orderId: string) {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).for("update");
    return { order, items };
  }

  async transition(
    tx: Tx,
    args: { orderId: string; itemIds?: string[]; to: OrderItemStatus; actor: Actor; actorId?: string; note?: string; headerOverride?: OrderStatus },
  ) {
    const now = this.clock.now();
    const { order, items } = await this.lockOrder(tx, args.orderId);
    const targets = args.itemIds ? items.filter((i) => args.itemIds!.includes(i.id)) : items;
    if (args.itemIds && targets.length !== new Set(args.itemIds).size) throw notFound("Order item");

    const handling = args.to === "NEW" ? await this.handlingDays(tx, targets) : new Map<string, number>();
    const updated = new Map<string, OrderItemRow>();

    for (const item of targets) {
      assertTransition(item.status, args.to, args.actor);
      const patch: Partial<OrderItemRow> = { status: args.to };
      if (args.to === "CANCELLED") {
        patch.cancelledAt = now;
        patch.cancelReason = args.note ?? null;
        await tx.update(offers).set({ stock: sql`${offers.stock} + ${item.qty}` }).where(eq(offers.id, item.offerId));
      }
      if (args.to === "NEW") patch.dispatchBy = dispatchByDate(now, handling.get(item.id) ?? 1);
      if (args.to === "READY_TO_SHIP" && !item.awb) patch.awb = `BBL${randomInt(1_000_000_000, 9_999_999_999)}`;
      if (args.to === "SHIPPED" && !item.shippedAt) patch.shippedAt = now;
      // a line back from a withdrawn return keeps its original delivery date
      if (args.to === "DELIVERED" && !item.deliveredAt) patch.deliveredAt = now;

      const [row] = await tx.update(orderItems).set(patch).where(eq(orderItems.id, item.id)).returning();
      updated.set(item.id, row!);
      await tx.insert(orderEvents).values({ orderId: order.id, orderItemId: item.id, fromStatus: item.status, toStatus: args.to, actor: args.actor, actorId: args.actorId, note: args.note });
    }

    const all = items.map((i) => updated.get(i.id) ?? i);
    if (args.to === "CANCELLED") await this.refundCancelled(tx, order, all, [...updated.values()], args.note ?? "Item cancelled");
    if (args.to === "DELIVERED") await this.markCodCollected(tx, order, all);
    await this.recomputeHeader(tx, order, all, args.actor, args.headerOverride);
    return [...updated.values()];
  }

  async recomputeHeader(tx: Tx, order: OrderRow, items: { status: OrderItemStatus }[], actor: Actor, override?: OrderStatus) {
    const next = override ?? deriveOrderStatus(order.status, items);
    if (next === order.status) return order.status;
    await tx.update(orders).set({ status: next }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: next, actor });
    return next;
  }

  /** How many days the store takes to pack each line, from its offer. */
  private async handlingDays(tx: Tx, items: OrderItemRow[]) {
    if (!items.length) return new Map<string, number>();
    const rows = await tx
      .select({ itemId: orderItems.id, handlingDays: offers.handlingDays })
      .from(orderItems)
      .innerJoin(offers, eq(offers.id, orderItems.offerId))
      .where(inArray(orderItems.id, items.map((i) => i.id)));
    return new Map(rows.map((r) => [r.itemId, r.handlingDays]));
  }

  /**
   * Refunds cancelled lines of a paid order: the line amount less its share of
   * the coupon. When nothing is left active, the remainder (delivery fee
   * included) is refunded too.
   */
  private async refundCancelled(tx: Tx, order: OrderRow, all: OrderItemRow[], cancelled: OrderItemRow[], reason: string) {
    if (order.paymentStatus !== "CAPTURED" && order.paymentStatus !== "PARTIALLY_REFUNDED") return;
    const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, order.id), eq(payments.status, order.paymentStatus)));
    if (!payment) return;
    const [{ refunded }] = (await tx.select({ refunded: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::bigint` }).from(refunds).where(eq(refunds.paymentId, payment.id))) as [{ refunded: number }];
    const nothingLeft = all.every((i) => INACTIVE.includes(i.status));

    let amount: number;
    if (nothingLeft) amount = order.totalPaise - Number(refunded);
    else {
      amount = cancelled.reduce((a, i) => {
        const line = i.unitPricePaise * i.qty;
        const couponShare = order.subtotalPaise ? Math.round((order.couponDiscountPaise * line) / order.subtotalPaise) : 0;
        return a + line - couponShare;
      }, 0);
    }
    if (amount <= 0) return;

    const result = await this.provider.refund({ providerRef: payment.providerRef ?? "", amountPaise: amount });
    await tx.insert(refunds).values({
      paymentId: payment.id,
      orderId: order.id,
      orderItemId: cancelled.length === 1 ? cancelled[0]!.id : null,
      amountPaise: amount,
      status: result.status,
      reason,
      completedAt: result.status === "COMPLETED" ? this.clock.now() : null,
    });
    const status = Number(refunded) + amount >= order.totalPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.update(payments).set({ status }).where(eq(payments.id, payment.id));
    await tx.update(orders).set({ paymentStatus: status }).where(eq(orders.id, order.id));
    order.paymentStatus = status;
  }

  private async markCodCollected(tx: Tx, order: OrderRow, all: OrderItemRow[]) {
    if (order.paymentMethod !== "COD" || order.paymentStatus !== "COD_PENDING") return;
    const active = all.filter((i) => !INACTIVE.includes(i.status));
    if (!active.length || !active.every((i) => i.status === "DELIVERED")) return;
    await tx.update(payments).set({ status: "COD_COLLECTED", capturedAt: this.clock.now() }).where(and(eq(payments.orderId, order.id), eq(payments.status, "COD_PENDING")));
    await tx.update(orders).set({ paymentStatus: "COD_COLLECTED" }).where(eq(orders.id, order.id));
  }
}
