import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql, sum, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Clock } from "../../common/infra.module.js";
import { istAt } from "../../common/time.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { HOUSE_SELLER_ID } from "../../common/house.js";
import { offers, orderItems, orders, payments, products, refunds, returns, users } from "../../db/schema.js";
import type { adminPaymentsQuery, adminRefundsQuery } from "./commerce.schemas.js";

/** Orders that count as sales: paid or cash on delivery, and not cancelled. */
const SOLD = sql`${orders.status} not in ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'ABANDONED', 'CANCELLED')`;
const DAY = 86_400_000;

/** The numbers behind AltasGoods Control's overview and payments pages. Read only. */
@Injectable()
export class AdminInsightsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async sales(from: Date) {
    const [r] = await this.db.select({ n: count(), total: sum(orders.totalPaise) }).from(orders).where(and(SOLD, gte(orders.placedAt, from)));
    return { orders: r?.n ?? 0, revenuePaise: Number(r?.total ?? 0) };
  }

  async overview() {
    const now = this.clock.now();
    // days start at midnight in India
    const today = istAt(now, 0, 0);
    const [day, week, month] = await Promise.all([this.sales(today), this.sales(new Date(today.getTime() - 6 * DAY)), this.sales(new Date(today.getTime() - 29 * DAY))]);

    const since = new Date(today.getTime() - 13 * DAY);
    const istDay = sql<string>`to_char(${orders.placedAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
    const [seriesRows, work, returnsWaiting, refundsPending, top, latest, lowStock] = await Promise.all([
      this.db
        .select({ day: istDay, n: count(), total: sum(orders.totalPaise) })
        .from(orders)
        .where(and(SOLD, gte(orders.placedAt, since)))
        .groupBy(istDay),
      this.db
        .select({ status: orderItems.status, n: count() })
        .from(orderItems)
        .where(inArray(orderItems.status, ["NEW", "ACCEPTED", "PACKED", "READY_TO_SHIP"]))
        .groupBy(orderItems.status),
      this.db.select({ n: count() }).from(returns).where(inArray(returns.status, ["PENDING_REVIEW", "RECEIVED", "QC_FAILED"])),
      this.db.select({ n: count(), total: sum(refunds.amountPaise) }).from(refunds).where(inArray(refunds.status, ["PENDING", "PROCESSING"])),
      this.db
        .select({ productId: orderItems.productId, title: orderItems.title, image: orderItems.image, units: sum(orderItems.qty), revenue: sql<string>`sum(${orderItems.qty} * ${orderItems.unitPricePaise})` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(SOLD, gte(orders.placedAt, new Date(today.getTime() - 29 * DAY)), sql`${orderItems.status} not in ('CANCELLED', 'PENDING')`))
        .groupBy(orderItems.productId, orderItems.title, orderItems.image)
        .orderBy(desc(sum(orderItems.qty)))
        .limit(5),
      this.db
        .select({ id: orders.id, placedAt: orders.placedAt, status: orders.status, totalPaise: orders.totalPaise, paymentMethod: orders.paymentMethod, name: users.name, email: users.email })
        .from(orders)
        .innerJoin(users, eq(users.id, orders.userId))
        .where(sql`${orders.status} not in ('ABANDONED')`)
        .orderBy(desc(orders.placedAt))
        .limit(8),
      this.db
        .select({ productId: offers.productId, title: products.title, images: products.images, stock: offers.stock })
        .from(offers)
        .innerJoin(products, eq(products.id, offers.productId))
        .where(and(eq(offers.sellerId, HOUSE_SELLER_ID), eq(offers.status, "ACTIVE"), lte(offers.stock, 5), eq(products.listingStatus, "LIVE")))
        .orderBy(offers.stock)
        .limit(8),
    ]);

    const byDay = new Map(seriesRows.map((r) => [r.day, r]));
    const series = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since.getTime() + i * DAY);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
      const r = byDay.get(key);
      return { date: key, orders: r?.n ?? 0, revenuePaise: Number(r?.total ?? 0) };
    });
    const workBy = new Map(work.map((w) => [w.status, w.n]));

    return {
      today: day,
      last7Days: week,
      last30Days: month,
      averageOrderPaise: month.orders ? Math.round(month.revenuePaise / month.orders) : 0,
      work: {
        toAccept: workBy.get("NEW") ?? 0,
        toPack: workBy.get("ACCEPTED") ?? 0,
        toHandOver: (workBy.get("PACKED") ?? 0) + (workBy.get("READY_TO_SHIP") ?? 0),
        returnsWaiting: returnsWaiting[0]?.n ?? 0,
        refundsPending: refundsPending[0]?.n ?? 0,
        refundsPendingPaise: Number(refundsPending[0]?.total ?? 0),
      },
      series,
      topProducts: top.map((t) => ({ productId: t.productId, title: t.title, image: t.image, units: Number(t.units ?? 0), revenuePaise: Number(t.revenue ?? 0) })),
      latestOrders: latest.map((o) => ({ id: o.id, placedAt: o.placedAt.toISOString(), status: o.status, totalPaise: o.totalPaise, paymentMethod: o.paymentMethod, customerName: o.name ?? o.email })),
      lowStock: lowStock.map((o) => ({ productId: o.productId, title: o.title, image: o.images[0] ?? null, stock: o.stock })),
    };
  }

  async payments(q: z.infer<typeof adminPaymentsQuery>) {
    const filters: SQL[] = [];
    if (q.status) filters.push(eq(payments.status, q.status));
    if (q.method) filters.push(eq(payments.method, q.method));
    if (q.provider) filters.push(eq(payments.provider, q.provider));
    if (q.q) filters.push(or(ilike(payments.orderId, `%${q.q}%`), ilike(payments.providerRef, `%${q.q}%`), ilike(users.email, `%${q.q}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const now = this.clock.now();
    const today = istAt(now, 0, 0);
    const [rows, [total], [captured], [failed], [pending]] = await Promise.all([
      this.db
        .select({ p: payments, name: users.name, email: users.email, userId: users.id })
        .from(payments)
        .innerJoin(orders, eq(orders.id, payments.orderId))
        .innerJoin(users, eq(users.id, orders.userId))
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).innerJoin(users, eq(users.id, orders.userId)).where(where),
      this.db.select({ n: count(), total: sum(payments.amountPaise) }).from(payments).where(and(gte(payments.capturedAt, today), inArray(payments.status, ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"]))),
      this.db.select({ n: count() }).from(payments).where(and(gte(payments.createdAt, new Date(now.getTime() - DAY)), eq(payments.status, "FAILED"))),
      this.db.select({ n: count(), total: sum(refunds.amountPaise) }).from(refunds).where(inArray(refunds.status, ["PENDING", "PROCESSING"])),
    ]);
    return {
      items: rows.map(({ p, name, email, userId }) => ({
        id: p.id,
        orderId: p.orderId,
        provider: p.provider,
        method: p.method,
        amountPaise: p.amountPaise,
        status: p.status,
        providerRef: p.providerRef,
        failureReason: p.failureReason,
        capturedAt: p.capturedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        customer: { id: userId, name, email },
      })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      summary: {
        capturedTodayCount: captured?.n ?? 0,
        capturedTodayPaise: Number(captured?.total ?? 0),
        failedLast24h: failed?.n ?? 0,
        refundsPendingCount: pending?.n ?? 0,
        refundsPendingPaise: Number(pending?.total ?? 0),
      },
    };
  }

  async refunds(q: z.infer<typeof adminRefundsQuery>) {
    const filters: SQL[] = [];
    if (q.status) filters.push(eq(refunds.status, q.status));
    if (q.q) filters.push(or(ilike(refunds.orderId, `%${q.q}%`), ilike(users.email, `%${q.q}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const base = this.db
      .select({ r: refunds, method: payments.method, provider: payments.provider, providerRef: payments.providerRef, name: users.name, email: users.email, userId: users.id })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .where(where);
    const [rows, [total]] = await Promise.all([
      base.orderBy(desc(refunds.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).innerJoin(users, eq(users.id, orders.userId)).where(where),
    ]);
    return {
      items: rows.map(({ r, method, provider, providerRef, name, email, userId }) => ({
        id: r.id,
        orderId: r.orderId,
        amountPaise: r.amountPaise,
        status: r.status,
        reason: r.reason,
        method,
        provider,
        providerRef,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        customer: { id: userId, name, email },
      })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
}
