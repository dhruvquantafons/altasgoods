import { z } from "zod";
import { istDayStart } from "../../common/time.js";
import { ORDER_STATUSES, PAYMENT_METHODS } from "../../db/schema.js";
import { adminPaymentsQuery, adminRefundsQuery, fulfilmentItemsQuery } from "../commerce/commerce.schemas.js";
import { customerSearchQuery } from "../support/support.schemas.js";
import { auditQuery } from "./admin.schemas.js";

export const EXPORT_KINDS = ["orders", "order-items", "payments", "refunds", "customers", "audit"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** The kind in the path, with or without a trailing ".csv". */
export const exportKindParam = z
  .string()
  .transform((v) => v.replace(/\.csv$/i, ""))
  .pipe(z.enum(EXPORT_KINDS));

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-03-31")
  .refine((v) => {
    try {
      istDayStart(v);
      return true;
    } catch {
      return false;
    }
  }, "That date does not exist");

/** The days an export covers, in India time: `from` starts at midnight, `to` runs to the end of that day. */
const range = {
  from: day.optional().describe("First day to include (IST), for example 2026-03-01"),
  to: day.optional().describe("Last day to include (IST), inclusive"),
};
const ordered = (v: { from?: string; to?: string }) => !v.from || !v.to || v.from <= v.to;
const backwards = { message: "from must not be after to", path: ["from"] };

/** The query exactly as it arrives; each kind then reads the filters it understands (see EXPORT_QUERIES). */
export const exportQuery = z.object({
  q: z.string().optional().describe("Search text, as on the matching list page"),
  status: z.string().optional().describe("Status filter, as on the matching list page (order lines take a comma separated list)"),
  method: z.string().optional().describe("Payment method (orders and payments)"),
  provider: z.string().optional().describe("Payment provider (payments)"),
  action: z.string().optional().describe("Audit action or prefix (audit)"),
  entityType: z.string().optional().describe("Audit entity type (audit)"),
  entityId: z.string().optional().describe("Audit entity id (audit)"),
  actorId: z.string().optional().describe("Audit actor (audit)"),
  from: z.string().optional().describe("First day to include (IST), for example 2026-03-01"),
  to: z.string().optional().describe("Last day to include (IST), inclusive"),
});

export const ordersExportQuery = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    q: z.string().trim().max(80).optional().describe("Order ID, customer name or email"),
    ...range,
  })
  .refine(ordered, backwards);
export const orderItemsExportQuery = z.object({ status: fulfilmentItemsQuery.shape.status, q: fulfilmentItemsQuery.shape.q, ...range }).refine(ordered, backwards);
export const paymentsExportQuery = adminPaymentsQuery.omit({ page: true, pageSize: true }).extend(range).refine(ordered, backwards);
export const refundsExportQuery = adminRefundsQuery.omit({ page: true, pageSize: true }).extend(range).refine(ordered, backwards);
export const customersExportQuery = customerSearchQuery.pick({ q: true }).extend(range).refine(ordered, backwards);
export const auditExportQuery = auditQuery.omit({ page: true, pageSize: true }).extend(range).refine(ordered, backwards);

export const EXPORT_QUERIES = {
  orders: ordersExportQuery,
  "order-items": orderItemsExportQuery,
  payments: paymentsExportQuery,
  refunds: refundsExportQuery,
  customers: customersExportQuery,
  audit: auditExportQuery,
} as const satisfies Record<ExportKind, z.ZodType>;
