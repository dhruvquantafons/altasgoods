import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { notFound } from "../../common/errors.js";
import { CLOCK, LOGISTICS_PROVIDER } from "../../common/tokens.js";
import type { Tx } from "../../db/client.js";
import { offers, orderEvents, orderItems, orders, payments, type Actor, type OrderItemStatus, type OrderStatus } from "../../db/schema.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import type { EmailItem } from "./notifications/emails.js";
import { lineNetPaise, RefundsService } from "./payments/refunds.service.js";
import type { LogisticsProvider } from "./shipping/provider.js";
import { dispatchByDate } from "./pricing.js";
import { assertTransition, deriveOrderStatus } from "./state.js";

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;

const INACTIVE: OrderItemStatus[] = ["CANCELLED", "RTO_IN_TRANSIT", "RTO_RECEIVED", "LOST"];

/** A line that moved in a transition: as it is now, where it came from and its order event. */
type Moved = { item: OrderItemRow; from: OrderItemStatus; eventId: number };
const emailItem = (i: OrderItemRow): EmailItem => ({ title: i.title, variant: i.variant, qty: i.qty });

/**
 * The only place order items change status. Each transition is validated
 * against the state machine, applies its side effects (stock, fees, refunds,
 * AWB), is recorded in order_events, and re-derives the order header.
 *
 * A parcel that comes back to the store (RTO_RECEIVED) goes back into stock;
 * a lost one (LOST) does not. Either way a prepaid line is refunded (its
 * amount less its coupon share, never more than is left of the payment).
 * Cash on delivery was never collected for them, so nothing is refunded.
 *
 * It also queues the customer's email for the change (see announce), in the
 * same transaction, unless the caller passes `notify: false`.
 */
@Injectable()
export class OrderWorkflow {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGISTICS_PROVIDER) private readonly courier: LogisticsProvider,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async lockOrder(tx: Tx, orderId: string) {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).for("update");
    return { order, items };
  }

  async transition(
    tx: Tx,
    args: {
      orderId: string;
      itemIds?: string[];
      to: OrderItemStatus;
      actor: Actor;
      actorId?: string;
      note?: string;
      headerOverride?: OrderStatus;
      /** false: no customer email for this step (a courier scan that skips ahead emails only for where the parcel ends up) */
      notify?: boolean;
    },
  ) {
    const now = this.clock.now();
    const { order, items } = await this.lockOrder(tx, args.orderId);
    const targets = args.itemIds ? items.filter((i) => args.itemIds!.includes(i.id)) : items;
    if (args.itemIds && targets.length !== new Set(args.itemIds).size) throw notFound("Order item");

    const handling = args.to === "NEW" ? await this.handlingDays(tx, targets) : new Map<string, number>();
    const updated = new Map<string, OrderItemRow>();
    const moved: Moved[] = [];

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
      if (args.to === "RTO_RECEIVED") await tx.update(offers).set({ stock: sql`${offers.stock} + ${item.qty}` }).where(eq(offers.id, item.offerId));
      if (args.to === "NEW") patch.dispatchBy = dispatchByDate(now, handling.get(item.id) ?? 1);
      if (args.to === "SHIPPED" && !item.shippedAt) patch.shippedAt = now;
      // a line back from a withdrawn return keeps its original delivery date
      if (args.to === "DELIVERED" && !item.deliveredAt) patch.deliveredAt = now;

      const [row] = await tx.update(orderItems).set(patch).where(eq(orderItems.id, item.id)).returning();
      updated.set(item.id, row!);
      const [event] = await tx
        .insert(orderEvents)
        .values({ orderId: order.id, orderItemId: item.id, fromStatus: item.status, toStatus: args.to, actor: args.actor, actorId: args.actorId, note: args.note })
        .returning({ id: orderEvents.id });
      moved.push({ item: row!, from: item.status, eventId: event!.id });
    }

    const all = items.map((i) => updated.get(i.id) ?? i);
    // the customer's email for the change says the refund is on its way, so the refund sends no email of its own
    let refundPaise: number | null = null;
    if (args.to === "CANCELLED") refundPaise = await this.refundCancelled(tx, order, all, [...updated.values()], args.note ?? "Item cancelled");
    if (args.to === "LOST" || args.to === "RTO_RECEIVED") {
      // the staff note stays on the order event; the refund says what happened
      refundPaise = await this.refundLines(tx, order, [...updated.values()], args.to === "LOST" ? "Parcel lost in transit" : "Parcel returned to the store", args.actorId);
    }
    if (args.to === "DELIVERED") await this.markCodCollected(tx, order, all);
    const header = await this.recomputeHeader(tx, order, all, args.actor, args.headerOverride);
    if (args.notify !== false) await this.announce(tx, order, all, moved, args, header, refundPaise);
    return [...updated.values()];
  }

  /**
   * The customer's email for a transition: order confirmed (NEW), cancelled
   * (or, for an unpaid order that expired, abandoned), shipped, out for
   * delivery, delivered, lost, or returned to the store. Lines moved together
   * share one email per parcel (AWB), and repeats of the same change (a
   * courier sending a scan twice) share its dedupe key, so each goes out once.
   * A parcel back out after a failed attempt, or a line back to delivered
   * after a withdrawn return, sends nothing.
   */
  private async announce(tx: Tx, order: OrderRow, all: OrderItemRow[], moved: Moved[], args: { to: OrderItemStatus; actor: Actor }, header: OrderStatus, refundPaise: number | null) {
    if (!moved.length) return;
    const base = { userId: order.userId, orderId: order.id };
    const paidOnline = order.paymentMethod !== "COD" && (order.paymentStatus === "CAPTURED" || order.paymentStatus === "PARTIALLY_REFUNDED");
    /** one email per parcel: lines with the same AWB together, a line without one on its own */
    const parcels = (lines: Moved[]) => {
      const groups = new Map<string, Moved[]>();
      for (const m of lines) {
        const key = m.item.awb ?? `${order.id}:${m.eventId}`;
        groups.set(key, [...(groups.get(key) ?? []), m]);
      }
      return [...groups.entries()].map(([key, ms]) => ({ key, items: ms.map((m) => m.item) }));
    };
    const tracking = (i: OrderItemRow) => (i.awb && i.shippingProvider === this.courier.name ? this.courier.trackingUrl(i.awb) : null);

    switch (args.to) {
      case "NEW":
        await this.notifications.notify(tx, "ORDER_PLACED", { ...base, key: order.id, data: { orderId: order.id, totalPaise: order.totalPaise, paymentMethod: order.paymentMethod, items: all.map(emailItem) } });
        return;
      case "CANCELLED":
        if (header === "ABANDONED") {
          await this.notifications.notify(tx, "ORDER_ABANDONED", { ...base, key: order.id, data: { orderId: order.id, items: moved.map((m) => emailItem(m.item)) } });
          return;
        }
        await this.notifications.notify(tx, "ORDER_CANCELLED", {
          ...base,
          key: `${order.id}:${moved[0]!.eventId}`,
          data: {
            orderId: order.id,
            items: moved.map((m) => emailItem(m.item)),
            // fixed wording only: a staff note is internal and never goes to the customer
            byCustomer: args.actor === "CUSTOMER",
            whole: all.every((i) => i.status === "CANCELLED"),
            refundPaise,
            paidOnline,
          },
        });
        return;
      case "SHIPPED":
        // back out after a failed delivery attempt: the customer already knows it shipped
        for (const p of parcels(moved.filter((m) => m.from !== "OUT_FOR_DELIVERY"))) {
          const first = p.items[0]!;
          await this.notifications.notify(tx, "SHIPPED", { ...base, key: p.key, data: { orderId: order.id, items: p.items.map(emailItem), courier: first.courier, awb: first.awb, trackingUrl: tracking(first) } });
        }
        return;
      case "OUT_FOR_DELIVERY":
        for (const p of parcels(moved)) {
          await this.notifications.notify(tx, "OUT_FOR_DELIVERY", { ...base, key: p.key, data: { orderId: order.id, items: p.items.map(emailItem), trackingUrl: tracking(p.items[0]!), cod: order.paymentMethod === "COD" } });
        }
        return;
      case "DELIVERED":
        // only a parcel arriving; a line back from a withdrawn or rejected return is not news
        for (const p of parcels(moved.filter((m) => m.from === "SHIPPED" || m.from === "OUT_FOR_DELIVERY"))) {
          await this.notifications.notify(tx, "DELIVERED", { ...base, key: p.key, data: { orderId: order.id, items: p.items.map(emailItem) } });
        }
        return;
      case "LOST":
      case "RTO_RECEIVED":
        for (const p of parcels(moved)) {
          await this.notifications.notify(tx, args.to === "LOST" ? "PARCEL_LOST" : "PARCEL_RETURNED", { ...base, key: p.key, data: { orderId: order.id, items: p.items.map(emailItem), refundPaise, paidOnline } });
        }
        return;
    }
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
    const nothingLeft = all.every((i) => INACTIVE.includes(i.status));
    return this.refundLines(tx, order, cancelled, reason, undefined, nothingLeft);
  }

  /**
   * Queues the refund for lines of a paid order that will not be delivered:
   * each line's amount less its coupon share, or everything that is left
   * (delivery fee included) when `everything`. Never more than is left of
   * the payment, even if earlier line refunds rounded up. Unpaid and cash on
   * delivery orders get nothing back. Returns the amount queued, or null.
   * The refund sends no "refund started" email: the transition's own email
   * (cancelled, lost, returned to the store) carries the amount.
   */
  private async refundLines(tx: Tx, order: OrderRow, lines: OrderItemRow[], reason: string, createdBy?: string, everything = false): Promise<number | null> {
    if (order.paymentStatus !== "CAPTURED" && order.paymentStatus !== "PARTIALLY_REFUNDED") return null;
    const limit = await this.refunds.limit(tx, order);
    if (!limit?.online) return null;
    const amount = Math.min(everything ? limit.leftPaise : lines.reduce((a, i) => a + lineNetPaise(order, i), 0), limit.leftPaise);
    if (amount <= 0) return null;
    await this.refunds.queue(
      tx,
      {
        paymentId: limit.payment.id,
        orderId: order.id,
        orderItemId: lines.length === 1 ? lines[0]!.id : null,
        amountPaise: amount,
        reason,
        createdBy: createdBy ?? null,
      },
      { notify: false },
    );
    return amount;
  }

  private async markCodCollected(tx: Tx, order: OrderRow, all: OrderItemRow[]) {
    if (order.paymentMethod !== "COD" || order.paymentStatus !== "COD_PENDING") return;
    const active = all.filter((i) => !INACTIVE.includes(i.status));
    if (!active.length || !active.every((i) => i.status === "DELIVERED")) return;
    await tx.update(payments).set({ status: "COD_COLLECTED", capturedAt: this.clock.now() }).where(and(eq(payments.orderId, order.id), eq(payments.status, "COD_PENDING")));
    await tx.update(orders).set({ paymentStatus: "COD_COLLECTED" }).where(eq(orders.id, order.id));
  }
}
