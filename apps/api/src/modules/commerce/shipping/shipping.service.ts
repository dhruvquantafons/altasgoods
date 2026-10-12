import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { Db } from "../../../db/client.js";
import { offers, orderItems, orders, products, users, type OrderItemStatus } from "../../../db/schema.js";
import { conflict, notFound } from "../../../common/errors.js";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, LOGISTICS_PROVIDER, REDIS } from "../../../common/tokens.js";
import { assertTransition, ITEM_TRANSITIONS } from "../state.js";
import { OrderWorkflow } from "../workflow.service.js";
import type { Booking, CourierStatus, LogisticsProvider, TrackingUpdate } from "./provider.js";

/** Lines the courier still has in hand, so their tracking can change. */
const IN_TRANSIT: OrderItemStatus[] = ["READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "RTO_IN_TRANSIT"];

/**
 * The statuses a line passes through to reach a courier status, shortest
 * first. Couriers skip scans (a parcel can go from picked up straight to
 * delivered), so the line still walks every step and keeps its history whole.
 * Empty when there is no way there, such as an old scan arriving late.
 */
export function courierPath(from: OrderItemStatus, to: CourierStatus): OrderItemStatus[] {
  if (from === to) return [];
  const prev = new Map<OrderItemStatus, OrderItemStatus>();
  const queue: OrderItemStatus[] = [from];
  while (queue.length) {
    const at = queue.shift()!;
    for (const rule of ITEM_TRANSITIONS[at] ?? []) {
      if (!rule.actors.includes("LOGISTICS") || prev.has(rule.to) || rule.to === from) continue;
      prev.set(rule.to, at);
      if (rule.to === to) {
        const path: OrderItemStatus[] = [to];
        for (let s = at; s !== from; s = prev.get(s)!) path.unshift(s);
        return path;
      }
      queue.push(rule.to);
    }
  }
  return [];
}

/** Hands parcels to the courier and keeps each line in step with the courier's scans. */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger("Shipping");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGISTICS_PROVIDER) private readonly provider: LogisticsProvider,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  trackingUrl(awb: string | null, provider: string | null) {
    return awb && provider === this.provider.name ? this.provider.trackingUrl(awb) : null;
  }

  /**
   * Books a packed line with the courier and saves its AWB, before the line
   * is marked ready to ship. Safe to retry: it resumes from the last step saved.
   */
  async book(itemId: string) {
    const [row] = await this.db
      .select({ item: orderItems, order: orders, sku: products.sku, weightGrams: offers.weightGrams, email: users.email })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(offers, eq(offers.id, orderItems.offerId))
      .leftJoin(users, eq(users.id, orders.userId))
      .where(eq(orderItems.id, itemId));
    if (!row) throw notFound("Order item");
    const { item, order } = row;
    assertTransition(item.status, "READY_TO_SHIP", "STAFF");
    if (item.awb && item.shippingProvider === this.provider.name) return;

    // one booking at a time per line, so a double click never books two parcels
    const lock = `ship:book:${itemId}`;
    if ((await this.redis.set(lock, "1", "PX", 120_000, "NX")) !== "OK") throw conflict("BOOKING_IN_PROGRESS", "This item is already being booked with the courier");
    try {
      const siblings = await this.db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), ne(orderItems.id, itemId), isNotNull(orderItems.awb)));
      const line = item.unitPricePaise * item.qty;
      const couponShare = order.subtotalPaise ? Math.round((order.couponDiscountPaise * line) / order.subtotalPaise) : 0;
      // the delivery fee travels with the order's first parcel
      const amountPaise = line - couponShare + (siblings.length ? 0 : order.deliveryFeePaise);

      const save = async (step: Booking) => {
        await this.db.update(orderItems).set({ ...step, shippingProvider: this.provider.name }).where(eq(orderItems.id, itemId));
      };
      const booked = await this.provider.book(
        {
          reference: `${order.id}-${itemId.slice(0, 8)}`,
          placedAt: order.placedAt,
          customer: { name: order.address.name, phone: order.address.phone, email: row.email },
          address: order.address,
          item: { name: item.variant ? `${item.title} (${item.variant})` : item.title, sku: row.sku, units: item.qty, unitPricePaise: item.unitPricePaise },
          amountPaise,
          cod: order.paymentMethod === "COD",
          weightGrams: row.weightGrams * item.qty,
        },
        // a line booked with another courier (before a switch) starts over
        item.shippingProvider === this.provider.name
          ? { carrierOrderRef: item.carrierOrderRef ?? undefined, shipmentRef: item.shipmentRef ?? undefined, awb: item.awb ?? undefined, courier: item.courier ?? undefined, labelUrl: item.labelUrl ?? undefined }
          : {},
        save,
      );
      await save(booked);
    } finally {
      await this.redis.del(lock);
    }
  }

  /** Moves a line to where the courier says it is. Unknown AWBs and stale scans are ignored. */
  async apply(update: TrackingUpdate) {
    const [item] = await this.db
      .select({ id: orderItems.id, orderId: orderItems.orderId })
      .from(orderItems)
      .where(and(eq(orderItems.awb, update.awb), eq(orderItems.shippingProvider, this.provider.name)));
    if (!item) return { changed: false };
    return this.db.transaction(async (tx) => {
      const { items } = await this.workflow.lockOrder(tx, item.orderId);
      const line = items.find((i) => i.id === item.id)!;
      const path = update.status ? courierPath(line.status, update.status) : [];
      for (const to of path) {
        await this.workflow.transition(tx, { orderId: item.orderId, itemIds: [item.id], to, actor: "LOGISTICS", note: `${line.courier ?? "Courier"}: ${update.raw}` });
      }
      await tx.update(orderItems).set({ trackingStatus: update.raw, trackedAt: this.clock.now() }).where(eq(orderItems.id, item.id));
      return { changed: path.length > 0 };
    });
  }

  receiveWebhook(body: unknown, headers: Record<string, string | string[] | undefined>) {
    const update = this.provider.parseWebhook(body, headers);
    return update ? this.apply(update) : { changed: false };
  }

  /** Staff ask the courier for a line's latest scan now, instead of waiting for the next poll. */
  async refresh(itemId: string) {
    const [item] = await this.db.select().from(orderItems).where(eq(orderItems.id, itemId));
    if (!item) throw notFound("Order item");
    if (!item.awb || item.shippingProvider !== this.provider.name || this.provider.name === "SIMULATED") throw conflict("NOT_TRACKABLE", "This item has no courier tracking");
    const update = await this.provider.track(item.awb);
    if (update) await this.apply(update);
    const [after] = await this.db.select({ status: orderItems.status, trackingStatus: orderItems.trackingStatus }).from(orderItems).where(eq(orderItems.id, itemId));
    return { id: itemId, status: after!.status, trackingStatus: after!.trackingStatus };
  }

  /** Asks the courier about every parcel still on the move. Returns how many lines moved. */
  async pollTracking() {
    if (this.provider.name === "SIMULATED") return 0;
    const open = await this.db
      .select({ awb: orderItems.awb })
      .from(orderItems)
      .where(and(eq(orderItems.shippingProvider, this.provider.name), isNotNull(orderItems.awb), inArray(orderItems.status, IN_TRANSIT)));
    let moved = 0;
    for (const { awb } of open) {
      try {
        const update = await this.provider.track(awb!);
        if (update && (await this.apply(update)).changed) moved++;
      } catch (e) {
        this.logger.error(`Could not track ${awb}: ${(e as Error).message}`);
      }
    }
    return moved;
  }

  /** Can the line still be moved by hand (development simulator)? Only when no real courier carries it. */
  simulated(item: { shippingProvider: string | null }) {
    return item.shippingProvider !== "SHIPROCKET";
  }
}
