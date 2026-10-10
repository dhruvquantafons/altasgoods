import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { orderEvents, orderItems, orders, type OrderItemStatus } from "../../db/schema.js";
import { ApiError, notFound } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import { fulfilmentItemsQuery, transitionBody } from "./commerce.schemas.js";
import { ITEM_TRANSITIONS } from "./state.js";
import { OrderWorkflow } from "./workflow.service.js";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const pick = (a: { name: string; phone: string; line1: string; city: string; state: string; pincode: string }) => ({ name: a.name, phone: a.phone, line1: a.line1, city: a.city, state: a.state, pincode: a.pincode });

/** What store staff may do next with a line. */
const allowedActions = (status: OrderItemStatus) => (ITEM_TRANSITIONS[status] ?? []).filter((r) => r.actors.includes("STAFF")).map((r) => r.to);

/** The store's fulfilment queue: staff accept, pack and hand over every order line. */
@Injectable()
export class FulfilmentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  async list(query: z.infer<typeof fulfilmentItemsQuery>) {
    // lines still waiting for the customer's payment are not ready to fulfil
    const base: SQL[] = [ne(orderItems.status, "PENDING")];
    if (query.q) base.push(or(sql`${orderItems.orderId} ilike ${"%" + query.q + "%"}`, sql`${orderItems.title} ilike ${"%" + query.q + "%"}`)!);
    const where = and(...base, ...(query.status.length ? [inArray(orderItems.status, query.status)] : []));

    const [rows, [total], counts] = await Promise.all([
      this.db
        .select({ item: orderItems, order: { placedAt: orders.placedAt, paymentMethod: orders.paymentMethod, address: orders.address } })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(where)
        .orderBy(asc(orderItems.dispatchBy), desc(orders.placedAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(where),
      this.db
        .select({ status: orderItems.status, n: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(and(...base))
        .groupBy(orderItems.status),
    ]);

    return {
      items: rows.map(({ item, order }) => ({
        id: item.id,
        orderId: item.orderId,
        placedAt: order.placedAt.toISOString(),
        productId: item.productId,
        title: item.title,
        image: item.image,
        variant: item.variant,
        qty: item.qty,
        unitPricePaise: item.unitPricePaise,
        status: item.status,
        paymentMethod: order.paymentMethod,
        shipTo: { name: order.address.name, city: order.address.city, pincode: order.address.pincode },
        dispatchBy: iso(item.dispatchBy),
        promisedBy: item.promisedBy.toISOString(),
        awb: item.awb,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total?.n ?? 0),
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    };
  }

  async order(orderId: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    const items = order ? await this.db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, "PENDING"))) : [];
    if (!order || !items.length) throw notFound("Order");
    const ids = items.map((i) => i.id);
    const events = await this.db.select().from(orderEvents).where(and(eq(orderEvents.orderId, orderId), inArray(orderEvents.orderItemId, ids))).orderBy(asc(orderEvents.id));
    return {
      id: order.id,
      placedAt: order.placedAt.toISOString(),
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalPaise: order.totalPaise,
      shipTo: { name: order.address.name, city: order.address.city, state: order.address.state, pincode: order.address.pincode },
      address: { ...pick(order.address), line2: order.address.line2 ?? null, landmark: order.address.landmark ?? null },
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        title: i.title,
        image: i.image,
        variant: i.variant,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        status: i.status,
        dispatchBy: iso(i.dispatchBy),
        promisedBy: i.promisedBy.toISOString(),
        awb: i.awb,
        allowedActions: allowedActions(i.status),
      })),
      events: events.map((e) => ({ orderItemId: e.orderItemId, fromStatus: e.fromStatus, toStatus: e.toStatus, actor: e.actor, note: e.note, at: e.createdAt.toISOString() })),
    };
  }

  /** Bulk transition; each line succeeds or fails on its own and reports why. */
  async transition(userId: string, body: z.infer<typeof transitionBody>) {
    if (body.to === "CANCELLED" && !body.reason) throw new ApiError(422, "REASON_REQUIRED", "Give a reason when cancelling an order");
    const owned = await this.db.select({ id: orderItems.id, orderId: orderItems.orderId }).from(orderItems).where(inArray(orderItems.id, body.ids));
    const byId = new Map(owned.map((o) => [o.id, o.orderId]));

    const results: { id: string; ok: boolean; status: OrderItemStatus | null; error: string | null }[] = [];
    for (const id of body.ids) {
      const orderId = byId.get(id);
      if (!orderId) {
        results.push({ id, ok: false, status: null, error: "Order item not found" });
        continue;
      }
      try {
        const [row] = await this.db.transaction((tx) =>
          this.workflow.transition(tx, { orderId, itemIds: [id], to: body.to, actor: "STAFF", actorId: userId, note: body.reason }),
        );
        results.push({ id, ok: true, status: row!.status, error: null });
      } catch (e) {
        results.push({ id, ok: false, status: null, error: e instanceof Error ? e.message : "Failed" });
      }
    }
    return { results };
  }
}
