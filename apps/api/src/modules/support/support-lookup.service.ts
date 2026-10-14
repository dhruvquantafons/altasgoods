import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, or, sql, sum, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { notFound } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { orderItems, orders, supportTickets, users } from "../../db/schema.js";
import { TokensService } from "../auth/tokens.service.js";
import { FulfilmentService } from "../commerce/fulfilment.service.js";
import { ACTIVE_STATUSES } from "./support.rules.js";
import type { customerSearchQuery, orderSearchQuery } from "./support.schemas.js";

/** Orders that went through: what counts towards a customer's order count. */
const PLACED = sql`${orders.status} not in ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'ABANDONED')`;
/** What the customer actually spent: placed orders that were not cancelled. */
const SPENT = sql`${orders.status} not in ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'ABANDONED', 'CANCELLED')`;

/**
 * What the Care Desk needs to help a customer: find them, see their orders,
 * and open an order with its shipping and payment. Read only.
 */
@Injectable()
export class SupportLookupService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(FulfilmentService) private readonly fulfilment: FulfilmentService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  /** Shoppers by name, email or phone, newest first. Staff accounts are left out. */
  async customers(q: z.infer<typeof customerSearchQuery>) {
    const filters: SQL[] = [sql`cardinality(${users.staffRoles}) = 0`];
    if (q.q) {
      const like = `%${q.q}%`;
      filters.push(or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, `%${q.q.replace(/\D/g, "") || q.q}%`))!);
    }
    const where = and(...filters);
    const [rows, [total]] = await Promise.all([
      this.db
        .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, createdAt: users.createdAt })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(users).where(where),
    ]);
    const ids = rows.map((r) => r.id);
    const [orderCounts, ticketCounts] = ids.length
      ? await Promise.all([
          this.db.select({ userId: orders.userId, n: count() }).from(orders).where(and(inArray(orders.userId, ids), PLACED)).groupBy(orders.userId),
          this.db
            .select({ userId: supportTickets.userId, n: count() })
            .from(supportTickets)
            .where(and(inArray(supportTickets.userId, ids), inArray(supportTickets.status, ACTIVE_STATUSES)))
            .groupBy(supportTickets.userId),
        ])
      : [[], []];
    const ordersBy = new Map(orderCounts.map((r) => [r.userId, r.n]));
    const ticketsBy = new Map(ticketCounts.map((r) => [r.userId, r.n]));
    return {
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), orders: ordersBy.get(r.id) ?? 0, openTickets: ticketsBy.get(r.id) ?? 0 })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** A shopper with their spend and most recent orders. */
  async customer(id: string) {
    const [u] = await this.db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.id, id), sql`cardinality(${users.staffRoles}) = 0`));
    if (!u) throw notFound("Customer");
    const mine = eq(orders.userId, id);
    const [[placed], [spent], recent] = await Promise.all([
      this.db.select({ n: count() }).from(orders).where(and(mine, PLACED)),
      this.db.select({ total: sum(orders.totalPaise) }).from(orders).where(and(mine, SPENT)),
      // every order, failed payments included: those are often why the customer got in touch
      this.orderRows(mine, 20),
    ]);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      emailVerified: !!u.emailVerifiedAt,
      createdAt: u.createdAt.toISOString(),
      orderCount: placed?.n ?? 0,
      spentPaise: Number(spent?.total ?? 0),
      orders: recent,
    };
  }

  /** Blocks or unblocks a shopper. A block also ends every session, so it takes effect at once. */
  async setStatus(id: string, status: "ACTIVE" | "BLOCKED") {
    await this.customer(id);
    await this.db.update(users).set({ status }).where(eq(users.id, id));
    if (status === "BLOCKED") await this.tokens.revokeAll(id);
    return this.customer(id);
  }

  /** Orders by order id, AWB, or the customer's name or email. Without a search, the latest orders. */
  async orders(q: z.infer<typeof orderSearchQuery>) {
    const filters: SQL[] = [];
    if (q.q) {
      const like = `%${q.q}%`;
      const byAwb = this.db.select({ id: orderItems.orderId }).from(orderItems).where(ilike(orderItems.awb, like));
      filters.push(or(ilike(orders.id, like), ilike(users.email, like), ilike(users.name, like), inArray(orders.id, byAwb))!);
    }
    return this.orderRows(and(...filters), 25);
  }

  /** One order with its lines, shipping, payment and history, and who placed it. */
  async order(id: string) {
    const [row] = await this.db
      .select({ userId: orders.userId, name: users.name, email: users.email, phone: users.phone })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(orders.id, id));
    if (!row) throw notFound("Order");
    const detail = await this.fulfilment.order(id, { includeUnpaid: true });
    const { items, ...rest } = detail;
    return {
      ...rest,
      // staff fulfilment actions are not the Care Desk's to take
      items: items.map(({ allowedActions: _a, ...i }) => i),
      customer: { id: row.userId, name: row.name, email: row.email, phone: row.phone },
    };
  }

  private async orderRows(where: SQL | undefined, limit: number) {
    const rows = await this.db
      .select({
        id: orders.id,
        placedAt: orders.placedAt,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        totalPaise: orders.totalPaise,
        customerId: users.id,
        customerName: users.name,
        customerEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(limit);
    const ids = rows.map((r) => r.id);
    const lines = ids.length
      ? await this.db
          .select({ orderId: orderItems.orderId, title: orderItems.title, image: orderItems.image })
          .from(orderItems)
          .where(inArray(orderItems.orderId, ids))
      : [];
    return rows.map((r) => {
      const mine = lines.filter((l) => l.orderId === r.id);
      return {
        id: r.id,
        placedAt: r.placedAt.toISOString(),
        status: r.status,
        paymentMethod: r.paymentMethod,
        paymentStatus: r.paymentStatus,
        totalPaise: r.totalPaise,
        itemCount: mine.length,
        firstItem: mine[0] ? { title: mine[0].title, image: mine[0].image } : null,
        customer: { id: r.customerId, name: r.customerName, email: r.customerEmail },
      };
    });
  }
}
