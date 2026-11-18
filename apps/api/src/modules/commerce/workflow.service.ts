import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { notFound } from "../../common/errors.js";
import { CLOCK, LOGISTICS_PROVIDER } from "../../common/tokens.js";
import type { Tx } from "../../db/client.js";
import { offers, orderEvents, orderItems, orders, payments, type Actor, type OrderItemStatus, type OrderStatus } from "../../db/schema.js";
import { RefundsService } from "./payments/refunds.service.js";
import type { LogisticsProvider } from "./shipping/provider.js";
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
    @Inject(LOGISTICS_PROVIDER) private readonly courier: LogisticsProvider,
    @Inject(RefundsService) private readonly refunds: RefundsService,
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
        // a parcel booked but not yet collected: call the courier off first, so a cancelled item is never picked up
        // (bounded by the courier client's timeout; a failure rolls the cancellation back)
        if (item.carrierOrderRef && item.shippingProvider === this.courier.name) await this.courier.cancel({ carrierOrderRef: item.carrierOrderRef, awb: item.awb });
        patch.cancelledAt = now;
        patch.cancelReason = args.note ?? null;
        await tx.update(offers).set({ stock: sql`${offers.stock} + ${item.qty}` }).where(eq(offers.id, item.offerId));
      }
      if (args.to === "NEW") patch.dispatchBy = dispatchByDate(now, handling.get(item.id) ?? 1);
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
   * included) is refunded too. The refund is queued in this transaction and
   * sent by the refund job after commit; refunds still on their way count as
   * refunded, so nothing is refunded twice.
   */
  private async refundCancelled(tx: Tx, order: OrderRow, all: OrderItemRow[], cancelled: OrderItemRow[], reason: string) {
    if (order.paymentStatus !== "CAPTURED" && order.paymentStatus !== "PARTIALLY_REFUNDED") return;
    const payment = await this.refunds.paidPayment(tx, order.id);
    if (!payment || (payment.status !== "CAPTURED" && payment.status !== "PARTIALLY_REFUNDED")) return;
    const refunded = await this.refunds.committed(tx, payment.id);
    const nothingLeft = all.every((i) => INACTIVE.includes(i.status));

    let amount: number;
    if (nothingLeft) amount = order.totalPaise - refunded;
    else {
      amount = cancelled.reduce((a, i) => {
        const line = i.unitPricePaise * i.qty;
        const couponShare = order.subtotalPaise ? Math.round((order.couponDiscountPaise * line) / order.subtotalPaise) : 0;
        return a + line - couponShare;
      }, 0);
    }
    // never more than is left, even if earlier line refunds rounded up
    amount = Math.min(amount, order.totalPaise - refunded);
    if (amount <= 0) return;

    await this.refunds.queue(tx, {
      paymentId: payment.id,
      orderId: order.id,
      orderItemId: cancelled.length === 1 ? cancelled[0]!.id : null,
      amountPaise: amount,
      reason,
    });
  }

  private async markCodCollected(tx: Tx, order: OrderRow, all: OrderItemRow[]) {
    if (order.paymentMethod !== "COD" || order.paymentStatus !== "COD_PENDING") return;
    const active = all.filter((i) => !INACTIVE.includes(i.status));
    if (!active.length || !active.every((i) => i.status === "DELIVERED")) return;
    await tx.update(payments).set({ status: "COD_COLLECTED", capturedAt: this.clock.now() }).where(and(eq(payments.orderId, order.id), eq(payments.status, "COD_PENDING")));
    await tx.update(orders).set({ paymentStatus: "COD_COLLECTED" }).where(eq(orders.id, order.id));
  }
}
