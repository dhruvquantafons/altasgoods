import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { Db, Tx } from "../../db/client.js";
import { coupons, offers, orderEvents, orderItems, orders, payments, refunds, users, type OrderStatus } from "../../db/schema.js";
import { HOUSE_SELLER_ID } from "../../common/house.js";
import { ApiError, conflict, notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { istStamp } from "../../common/time.js";
import { CLOCK, DB } from "../../common/tokens.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import { cancelBody, orderListQuery, placeOrderBody, quoteBody } from "./commerce.schemas.js";
import { PaymentsService } from "./payments/payments.service.js";
import { PAYMENT_WINDOW_MS } from "./pricing.js";
import { publicQuote, QuoteService } from "./quote.service.js";
import { CUSTOMER_CANCELLABLE } from "./state.js";
import { OrderWorkflow } from "./workflow.service.js";

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const STATUS_GROUPS: Record<string, OrderStatus[]> = {
  open: ["PAYMENT_PENDING", "PAYMENT_FAILED", "CONFIRMED", "IN_PROGRESS", "PARTIALLY_SHIPPED", "SHIPPED", "PARTIALLY_DELIVERED"],
  delivered: ["DELIVERED", "CLOSED"],
  cancelled: ["CANCELLED", "ABANDONED"],
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QuoteService) private readonly quotes: QuoteService,
    @Inject(CartService) private readonly cart: CartService,
    @Inject(AddressesService) private readonly addresses: AddressesService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  private async isPlus(userId: string) {
    const [u] = await this.db.select({ isPlus: users.isPlus }).from(users).where(eq(users.id, userId));
    return !!u?.isPlus;
  }

  async quote(userId: string, body: z.infer<typeof quoteBody>) {
    await this.addresses.get(userId, body.addressId);
    const lines = body.lines ?? (await this.cart.checkoutLines(userId));
    const q = await this.quotes.build(this.db, { lines, isPlus: await this.isPlus(userId), couponCode: body.couponCode, paymentMethod: body.paymentMethod });
    return publicQuote(q);
  }

  /**
   * Places an order atomically: re-prices with the offer rows locked, reserves
   * stock, records the order, and opens a payment (or confirms COD at once).
   * The Idempotency-Key makes retries safe: the same key returns the same order.
   */
  async place(userId: string, body: z.infer<typeof placeOrderBody>, idempotencyKey: string | undefined, channel: "WEB" | "ANDROID" | "IOS" = "WEB") {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) throw unprocessable("IDEMPOTENCY_KEY_REQUIRED", "Send a unique Idempotency-Key header with every order");
    const existing = await this.db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, userId), eq(orders.idempotencyKey, idempotencyKey)));
    if (existing[0]) return this.placedResponse(userId, existing[0].id);

    const address = await this.addresses.get(userId, body.addressId);
    const fromCart = !body.lines;
    const lines = body.lines ?? (await this.cart.checkoutLines(userId));
    if (!lines.length) throw unprocessable("CART_EMPTY", "Your cart is empty");
    const isPlus = await this.isPlus(userId);
    const now = this.clock.now();

    const orderId = await this.db.transaction(async (tx) => {
      const q = await this.quotes.build(tx, { lines, isPlus, couponCode: body.couponCode, paymentMethod: body.paymentMethod, lock: true });
      if (!q.canPlaceOrder) throw new ApiError(409, q.issues[0]?.code ?? "CANNOT_PLACE_ORDER", q.issues.map((i) => i.message).join(". ") || "This order cannot be placed");

      for (const l of q.lines) {
        const updated = await tx
          .update(offers)
          .set({ stock: sql`${offers.stock} - ${l.qty}` })
          .where(and(eq(offers.id, l.offerId), sql`${offers.stock} >= ${l.qty}`))
          .returning({ id: offers.id });
        if (!updated.length) throw conflict("INSUFFICIENT_STOCK", `${l.title} just sold out`);
      }

      const [{ n }] = (await tx.execute<{ n: number }>(sql`select nextval('order_number_seq')::int as n`)).rows as [{ n: number }];
      const id = `BB-${istStamp(now)}-${String(n).padStart(5, "0")}`;
      const cod = body.paymentMethod === "COD";
      const couponApplied = q.coupon?.applied ? q.coupon.code : null;

      const [order] = await tx
        .insert(orders)
        .values({
          id,
          userId,
          status: cod ? "CONFIRMED" : "PAYMENT_PENDING",
          paymentMethod: body.paymentMethod,
          paymentStatus: cod ? "COD_PENDING" : "CREATED",
          address: { name: address.name, phone: address.phone, line1: address.line1, line2: address.line2, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode, type: address.type },
          mrpTotalPaise: q.mrpTotalPaise,
          subtotalPaise: q.subtotalPaise,
          couponDiscountPaise: q.couponDiscountPaise,
          deliveryFeePaise: q.deliveryFeePaise,
          totalPaise: q.totalPaise,
          couponCode: couponApplied,
          idempotencyKey,
          channel,
          paymentDueBy: cod ? null : new Date(now.getTime() + PAYMENT_WINDOW_MS),
          placedAt: now,
        })
        .returning();

      await tx.insert(orderItems).values(
        q.lines.map((l) => ({
          orderId: id,
          productId: l.productId,
          offerId: l.offerId,
          sellerId: HOUSE_SELLER_ID,
          title: l.title,
          image: l.image,
          variant: l.variant,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          mrpPaise: l.mrpPaise,
          status: "PENDING" as const,
          promisedBy: new Date(q.promisedBy),
        })),
      );
      await tx.insert(orderEvents).values({ orderId: id, toStatus: order!.status, actor: "CUSTOMER", actorId: userId, note: cod ? "Order placed, pay on delivery" : "Order placed, awaiting payment" });
      if (couponApplied) await tx.update(coupons).set({ usageCount: sql`${coupons.usageCount} + 1` }).where(eq(coupons.code, couponApplied));

      if (cod) {
        await tx.insert(payments).values({ orderId: id, provider: "COD", method: "COD", amountPaise: q.totalPaise, status: "COD_PENDING" });
        await this.workflow.transition(tx, { orderId: id, to: "NEW", actor: "SYSTEM", note: "Cash on delivery order confirmed" });
      } else await this.payments.startAttempt(tx, order!);
      return id;
    });

    if (fromCart) await this.cart.removeOffers(userId, lines.map((l) => l.offerId));
    return this.placedResponse(userId, orderId);
  }

  private async placedResponse(userId: string, orderId: string) {
    const order = await this.detail(userId, orderId);
    const latest = order.payments[0]!;
    const open = latest.status === "CREATED" || latest.status === "PENDING";
    const [row] = await this.db.select({ providerRef: payments.providerRef }).from(payments).where(eq(payments.id, latest.id));
    return {
      order,
      payment: { ...latest, nextAction: open && row?.providerRef ? { type: "REDIRECT" as const, url: `${env().WEB_ORIGIN}/checkout/pay/${latest.id}` } : null },
    };
  }

  async list(userId: string, query: z.infer<typeof orderListQuery>) {
    const where = query.status === "all" ? eq(orders.userId, userId) : and(eq(orders.userId, userId), inArray(orders.status, STATUS_GROUPS[query.status]!));
    const [rows, [total]] = await Promise.all([
      this.db.select().from(orders).where(where).orderBy(desc(orders.placedAt)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
      this.db.select({ n: count() }).from(orders).where(where),
    ]);
    const items = rows.length ? await this.db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id))).orderBy(asc(orderItems.createdAt)) : [];
    return {
      items: rows.map((o) => {
        const its = items.filter((i) => i.orderId === o.id);
        return {
          id: o.id,
          status: o.status,
          placedAt: o.placedAt.toISOString(),
          totalPaise: o.totalPaise,
          paymentMethod: o.paymentMethod,
          itemCount: its.reduce((a, i) => a + i.qty, 0),
          items: its.map((i) => ({ id: i.id, productId: i.productId, title: i.title, image: i.image, status: i.status, qty: i.qty, promisedBy: i.promisedBy.toISOString(), deliveredAt: iso(i.deliveredAt) })),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total?.n ?? 0),
    };
  }

  async detail(userId: string, orderId: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!order || order.userId !== userId) throw notFound("Order");
    return this.serialize(order);
  }

  async serialize(order: typeof orders.$inferSelect) {
    const [items, pays, refundRows, events] = await Promise.all([
      this.db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.createdAt)),
      this.db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
      this.db.select().from(refunds).where(eq(refunds.orderId, order.id)).orderBy(desc(refunds.createdAt)),
      this.db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.id)),
    ]);
    const unpaid = order.status === "PAYMENT_PENDING" || order.status === "PAYMENT_FAILED";
    return {
      id: order.id,
      status: order.status,
      placedAt: order.placedAt.toISOString(),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentDueBy: iso(order.paymentDueBy),
      address: order.address,
      mrpTotalPaise: order.mrpTotalPaise,
      subtotalPaise: order.subtotalPaise,
      couponCode: order.couponCode,
      couponDiscountPaise: order.couponDiscountPaise,
      deliveryFeePaise: order.deliveryFeePaise,
      totalPaise: order.totalPaise,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        image: item.image,
        variant: item.variant,
        qty: item.qty,
        unitPricePaise: item.unitPricePaise,
        mrpPaise: item.mrpPaise,
        status: item.status,
        promisedBy: item.promisedBy.toISOString(),
        shippedAt: iso(item.shippedAt),
        deliveredAt: iso(item.deliveredAt),
        cancelledAt: iso(item.cancelledAt),
        cancelReason: item.cancelReason,
        awb: item.awb,
        canCancel: CUSTOMER_CANCELLABLE.includes(item.status) || (unpaid && item.status === "PENDING"),
      })),
      payments: pays.map((p) => ({ id: p.id, method: p.method, status: p.status, amountPaise: p.amountPaise })),
      refunds: refundRows.map((r) => ({ id: r.id, amountPaise: r.amountPaise, status: r.status, reason: r.reason, createdAt: r.createdAt.toISOString() })),
      events: events.map((e) => ({ orderItemId: e.orderItemId, fromStatus: e.fromStatus, toStatus: e.toStatus, actor: e.actor, note: e.note, at: e.createdAt.toISOString() })),
    };
  }

  /** Customer cancellation: any item before it ships; an unpaid order as a whole. */
  async cancel(userId: string, orderId: string, body: z.infer<typeof cancelBody>) {
    await this.db.transaction(async (tx: Tx) => {
      const { order, items } = await this.workflow.lockOrder(tx, orderId);
      if (order.userId !== userId) throw notFound("Order");
      const unpaid = order.status === "PAYMENT_PENDING" || order.status === "PAYMENT_FAILED";
      const eligible = items.filter((i) => CUSTOMER_CANCELLABLE.includes(i.status) || (unpaid && i.status === "PENDING"));
      const ids = body.itemIds ?? eligible.map((i) => i.id);
      if (!ids.length || ids.some((id) => !eligible.find((i) => i.id === id))) {
        throw conflict("NOT_CANCELLABLE", "These items can no longer be cancelled. You can refuse the delivery or return them after delivery.");
      }
      const everything = items.every((i) => ids.includes(i.id) || i.status === "CANCELLED");
      await this.workflow.transition(tx, {
        orderId,
        itemIds: ids,
        to: "CANCELLED",
        actor: "CUSTOMER",
        actorId: userId,
        note: body.reason,
        headerOverride: unpaid && everything ? "CANCELLED" : undefined,
      });
      if (unpaid && everything) {
        await tx.update(payments).set({ status: "CANCELLED" }).where(and(eq(payments.orderId, orderId), inArray(payments.status, ["CREATED", "PENDING", "FAILED"])));
        await tx.update(orders).set({ paymentStatus: "CANCELLED" }).where(eq(orders.id, orderId));
      }
    });
    return this.detail(userId, orderId);
  }
}
