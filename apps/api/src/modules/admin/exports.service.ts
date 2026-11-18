import { Inject, Injectable } from "@nestjs/common";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { Response } from "express";
import { unprocessable } from "../../common/errors.js";
import { istDateTime, istDayStart } from "../../common/time.js";
import { CLOCK, DB, EXPORT_ROW_CAP } from "../../common/tokens.js";
import type { Clock } from "../../common/infra.module.js";
import type { Db } from "../../db/client.js";
import { auditEvents, orderItems, orders, payments, products, refunds, users } from "../../db/schema.js";
import { csvRow, type CsvValue } from "../catalog/csv.js";
import { paymentFilters, refundFilters } from "../commerce/admin-insights.service.js";
import { itemFilters } from "../commerce/fulfilment.service.js";
import { customerFilters, PLACED, SPENT } from "../support/support-lookup.service.js";
import { auditFilters, type AuditActor } from "./audit.service.js";
import { AuditService } from "./audit.service.js";
import { EXPORT_QUERIES, type ExportKind } from "./exports.schemas.js";
import { dateCsv, rupeesCsv } from "./exports.format.js";

/** How many rows are read from the database (and written to the client) at a time. */
const BATCH = 1000;
/** The most rows one export holds. */
export const DEFAULT_EXPORT_ROW_CAP = 50_000;
const DAY = 86_400_000;

/**
 * One CSV column: its header and how to read it from a row. To add a column
 * to an export, add an entry to that export's list below (and select the
 * extra data in its query when it is not already there).
 */
export type Column<R> = { header: string; value: (row: R) => CsvValue };

/** An export ready to run: its columns, how many rows match, and a page of them. */
interface Dataset {
  headers: string[];
  count: () => Promise<number>;
  rows: (offset: number, limit: number) => Promise<CsvValue[][]>;
}

function dataset<R>(columns: Column<R>[], count: () => Promise<number>, page: (offset: number, limit: number) => Promise<R[]>): Dataset {
  return {
    headers: columns.map((c) => c.header),
    count,
    rows: async (offset, limit) => (await page(offset, limit)).map((r) => columns.map((c) => c.value(r))),
  };
}

/** The filter for a from/to range on a timestamp column: IST days, `to` inclusive. */
function within(col: Parameters<typeof gte>[0], q: { from?: string; to?: string }): SQL[] {
  const out: SQL[] = [];
  if (q.from) out.push(gte(col, istDayStart(q.from)));
  if (q.to) out.push(lt(col, new Date(istDayStart(q.to).getTime() + DAY)));
  return out;
}

/* ------------------------------- columns -------------------------------- */

type OrderRow = { o: typeof orders.$inferSelect; name: string | null; email: string; phone: string | null; items: number; refunded: number };
export const ORDER_COLUMNS: Column<OrderRow>[] = [
  { header: "Order ID", value: (r) => r.o.id },
  { header: "Placed at", value: (r) => dateCsv(r.o.placedAt) },
  { header: "Customer name", value: (r) => r.name ?? r.o.address.name },
  { header: "Customer email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone ?? r.o.address.phone },
  { header: "Status", value: (r) => r.o.status },
  { header: "Payment method", value: (r) => r.o.paymentMethod },
  { header: "Payment status", value: (r) => r.o.paymentStatus },
  { header: "Items", value: (r) => r.items },
  { header: "Subtotal", value: (r) => rupeesCsv(r.o.subtotalPaise) },
  { header: "Discount", value: (r) => rupeesCsv(r.o.couponDiscountPaise) },
  { header: "Delivery fee", value: (r) => rupeesCsv(r.o.deliveryFeePaise) },
  { header: "Total", value: (r) => rupeesCsv(r.o.totalPaise) },
  { header: "Refunded", value: (r) => rupeesCsv(r.refunded) },
  { header: "Pincode", value: (r) => r.o.address.pincode },
  { header: "City", value: (r) => r.o.address.city },
  { header: "State", value: (r) => r.o.address.state },
  { header: "Coupon code", value: (r) => r.o.couponCode },
];

type ItemRow = { item: typeof orderItems.$inferSelect; sku: string };
export const ORDER_ITEM_COLUMNS: Column<ItemRow>[] = [
  { header: "Order ID", value: (r) => r.item.orderId },
  { header: "Item ID", value: (r) => r.item.id },
  { header: "Product", value: (r) => r.item.title },
  { header: "SKU", value: (r) => r.sku },
  { header: "Variant", value: (r) => r.item.variant },
  { header: "Qty", value: (r) => r.item.qty },
  { header: "Unit price", value: (r) => rupeesCsv(r.item.unitPricePaise) },
  { header: "Line total", value: (r) => rupeesCsv(r.item.unitPricePaise * r.item.qty) },
  { header: "Status", value: (r) => r.item.status },
  { header: "AWB", value: (r) => r.item.awb },
  { header: "Courier", value: (r) => r.item.courier },
  { header: "Delivered at", value: (r) => dateCsv(r.item.deliveredAt) },
];

type PaymentRow = { p: typeof payments.$inferSelect };
export const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  { header: "Payment ID", value: (r) => r.p.id },
  { header: "Order ID", value: (r) => r.p.orderId },
  { header: "Created at", value: (r) => dateCsv(r.p.createdAt) },
  { header: "Method", value: (r) => r.p.method },
  { header: "Provider", value: (r) => r.p.provider },
  { header: "Provider ref", value: (r) => r.p.providerRef },
  { header: "Status", value: (r) => r.p.status },
  { header: "Amount", value: (r) => rupeesCsv(r.p.amountPaise) },
];

type RefundRow = { r: typeof refunds.$inferSelect; by: string | null };
export const REFUND_COLUMNS: Column<RefundRow>[] = [
  { header: "Refund ID", value: (x) => x.r.id },
  { header: "Order ID", value: (x) => x.r.orderId },
  { header: "Payment ID", value: (x) => x.r.paymentId },
  { header: "Created at", value: (x) => dateCsv(x.r.createdAt) },
  { header: "Completed at", value: (x) => dateCsv(x.r.completedAt) },
  { header: "Amount", value: (x) => rupeesCsv(x.r.amountPaise) },
  { header: "Status", value: (x) => x.r.status },
  { header: "Method", value: (x) => x.r.method },
  { header: "Reference", value: (x) => x.r.reference },
  { header: "Reason", value: (x) => x.r.reason },
  { header: "Created by", value: (x) => x.by ?? "System" },
];

type CustomerRow = { u: Pick<typeof users.$inferSelect, "id" | "name" | "email" | "phone" | "status" | "createdAt">; orders: number; spent: number };
export const CUSTOMER_COLUMNS: Column<CustomerRow>[] = [
  { header: "ID", value: (r) => r.u.id },
  { header: "Name", value: (r) => r.u.name },
  { header: "Email", value: (r) => r.u.email },
  { header: "Phone", value: (r) => r.u.phone },
  { header: "Status", value: (r) => r.u.status },
  { header: "Joined at", value: (r) => dateCsv(r.u.createdAt) },
  { header: "Orders", value: (r) => r.orders },
  { header: "Total spent", value: (r) => rupeesCsv(r.spent) },
];

type AuditRow = typeof auditEvents.$inferSelect;
export const AUDIT_COLUMNS: Column<AuditRow>[] = [
  { header: "Time", value: (r) => dateCsv(r.createdAt) },
  { header: "Actor", value: (r) => r.actorName },
  { header: "Action", value: (r) => r.action },
  { header: "Entity type", value: (r) => r.entityType },
  { header: "Entity ID", value: (r) => r.entityId },
  { header: "Summary", value: (r) => r.summary },
  { header: "Changes", value: (r) => (r.changes ? JSON.stringify(r.changes) : "") },
];

/* -------------------------------- service -------------------------------- */

/**
 * CSV exports for AltasGoods Control. Each export takes the filters of the
 * list page it mirrors plus a from/to range on IST days, is read from the
 * database a page at a time, written to the client as it goes, and stops at a
 * row cap. Every export is recorded in the audit log.
 */
@Injectable()
export class ExportsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EXPORT_ROW_CAP) private readonly cap: number,
  ) {}

  /** Runs one export: validates the filters, audits it, then streams the file. */
  async stream(actor: AuditActor, kind: ExportKind, rawQuery: Record<string, unknown>, res: Response) {
    const parsed = EXPORT_QUERIES[kind].safeParse(rawQuery);
    if (!parsed.success) throw unprocessable("INVALID_EXPORT_FILTER", parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join(".") || "query"}: ${i.message}`).join("; "));
    const query = parsed.data as Record<string, unknown>;
    const ds = this.dataset(kind, query);

    const total = await ds.count();
    const n = Math.min(total, this.cap);
    const truncated = total > this.cap;
    const filters = Object.entries(query)
      .filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : String(v)}`);
    await this.audit.log(
      actor,
      `export.${kind}`,
      { type: "export", id: kind },
      `Exported ${n} row${n === 1 ? "" : "s"} of ${kind}${filters.length ? ` (${filters.join(", ")})` : ""}${truncated ? `; truncated at ${this.cap} rows` : ""}`,
    );

    const day = istDateTime(this.clock.now()).slice(0, 10);
    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="altasgoods-${kind}-${day}.csv"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (truncated) res.setHeader("X-Export-Truncated", "true");

    const write = async (chunk: string) => {
      if (res.destroyed) throw new Error("The client went away");
      if (!res.write(chunk)) await new Promise<void>((resolve) => res.once("drain", resolve));
    };
    try {
      // the byte order mark makes Excel read the file as UTF-8 (₹ and Hindi names)
      await write(`﻿${csvRow(ds.headers)}`);
      for (let offset = 0; offset < n; offset += BATCH) {
        const page = await ds.rows(offset, Math.min(BATCH, n - offset));
        if (!page.length) break;
        await write(page.map(csvRow).join(""));
      }
      if (truncated) await write(csvRow([`# truncated at ${this.cap} rows; narrow the date range`]));
      res.end();
    } catch (e) {
      // headers are already on the wire, so the only honest signal left is a broken download
      console.error(`Export ${kind} failed: ${(e as Error).message}`);
      res.destroy();
    }
  }

  private dataset(kind: ExportKind, q: Record<string, any>): Dataset {
    switch (kind) {
      case "orders":
        return this.orders(q);
      case "order-items":
        return this.orderItems(q);
      case "payments":
        return this.payments(q);
      case "refunds":
        return this.refunds(q);
      case "customers":
        return this.customers(q);
      case "audit":
        return this.auditLog(q);
    }
    throw new Error(`Unknown export ${String(kind)}`);
  }

  private orders(q: Record<string, any>) {
    const filters: SQL[] = [...within(orders.placedAt, q)];
    if (q.status) filters.push(eq(orders.status, q.status));
    if (q.method) filters.push(eq(orders.paymentMethod, q.method));
    if (q.q) filters.push(or(ilike(orders.id, `%${q.q}%`), ilike(users.email, `%${q.q}%`), ilike(users.name, `%${q.q}%`))!);
    const where = and(...filters);
    const from = () => this.db.select({ n: sql<number>`count(*)::int` }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(where);
    return dataset<OrderRow>(
      ORDER_COLUMNS,
      async () => (await from())[0]?.n ?? 0,
      (offset, limit) =>
        this.db
          .select({
            o: orders,
            name: users.name,
            email: users.email,
            phone: users.phone,
            items: sql<number>`(select count(*) from order_items where order_items.order_id = orders.id)::int`,
            refunded: sql<number>`coalesce((select sum(refunds.amount_paise) from refunds where refunds.order_id = orders.id and refunds.status = 'COMPLETED'), 0)::bigint`.mapWith(Number),
          })
          .from(orders)
          .innerJoin(users, eq(users.id, orders.userId))
          .where(where)
          .orderBy(desc(orders.placedAt), desc(orders.id))
          .limit(limit)
          .offset(offset),
    );
  }

  private orderItems(q: Record<string, any>) {
    // the same lines as the fulfilment queue, dated by when their order was placed
    const where = and(itemFilters(q as Parameters<typeof itemFilters>[0]).where, ...within(orders.placedAt, q));
    return dataset<ItemRow>(
      ORDER_ITEM_COLUMNS,
      async () => (await this.db.select({ n: sql<number>`count(*)::int` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(where))[0]?.n ?? 0,
      (offset, limit) =>
        this.db
          .select({ item: orderItems, sku: products.sku })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(where)
          .orderBy(desc(orders.placedAt), desc(orderItems.orderId), desc(orderItems.id))
          .limit(limit)
          .offset(offset),
    );
  }

  private payments(q: Record<string, any>) {
    const where = and(...paymentFilters(q as Parameters<typeof paymentFilters>[0]), ...within(payments.createdAt, q));
    return dataset<PaymentRow>(
      PAYMENT_COLUMNS,
      async () => (await this.db.select({ n: sql<number>`count(*)::int` }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).innerJoin(users, eq(users.id, orders.userId)).where(where))[0]?.n ?? 0,
      (offset, limit) =>
        this.db
          .select({ p: payments })
          .from(payments)
          .innerJoin(orders, eq(orders.id, payments.orderId))
          .innerJoin(users, eq(users.id, orders.userId))
          .where(where)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(limit)
          .offset(offset),
    );
  }

  private refunds(q: Record<string, any>) {
    const where = and(...refundFilters(q as Parameters<typeof refundFilters>[0]), ...within(refunds.createdAt, q));
    const staff = alias(users, "refund_staff");
    return dataset<RefundRow>(
      REFUND_COLUMNS,
      async () => (await this.db.select({ n: sql<number>`count(*)::int` }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).innerJoin(users, eq(users.id, orders.userId)).where(where))[0]?.n ?? 0,
      (offset, limit) =>
        this.db
          .select({ r: refunds, by: sql<string | null>`coalesce(${staff.name}, ${staff.email})` })
          .from(refunds)
          .innerJoin(orders, eq(orders.id, refunds.orderId))
          .innerJoin(users, eq(users.id, orders.userId))
          .leftJoin(staff, eq(staff.id, refunds.createdBy))
          .where(where)
          .orderBy(desc(refunds.createdAt), desc(refunds.id))
          .limit(limit)
          .offset(offset),
    );
  }

  private customers(q: Record<string, any>) {
    const where = and(...customerFilters(q as Parameters<typeof customerFilters>[0]), ...within(users.createdAt, q));
    return dataset<CustomerRow>(
      CUSTOMER_COLUMNS,
      async () => (await this.db.select({ n: sql<number>`count(*)::int` }).from(users).where(where))[0]?.n ?? 0,
      (offset, limit) =>
        this.db
          .select({
            u: { id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, createdAt: users.createdAt },
            orders: sql<number>`(select count(*) from orders where orders.user_id = users.id and ${PLACED})::int`,
            spent: sql<number>`coalesce((select sum(orders.total_paise) from orders where orders.user_id = users.id and ${SPENT}), 0)::bigint`.mapWith(Number),
          })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(limit)
          .offset(offset),
    );
  }

  private auditLog(q: Record<string, any>) {
    const where = and(...auditFilters(q as Parameters<typeof auditFilters>[0]), ...within(auditEvents.createdAt, q));
    return dataset<AuditRow>(
      AUDIT_COLUMNS,
      async () => (await this.db.select({ n: sql<number>`count(*)::int` }).from(auditEvents).where(where))[0]?.n ?? 0,
      (offset, limit) => this.db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(limit).offset(offset),
    );
  }
}
