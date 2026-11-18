import type { AdminArea } from "./staff";

/** The CSV exports the API offers (`GET /v1/admin/exports/:kind`). */
export type ExportKind = "orders" | "order-items" | "payments" | "refunds" | "customers" | "audit";

/** The admin page each export belongs to: who can see that page can download its export. */
const EXPORT_AREA: Record<ExportKind, AdminArea> = {
  orders: "orders",
  "order-items": "orders",
  payments: "payments",
  refunds: "payments",
  customers: "customers",
  audit: "audit",
};

export const exportAreaFor = (kind: string): AdminArea | null => (Object.hasOwn(EXPORT_AREA, kind) ? EXPORT_AREA[kind as ExportKind] : null);

/** The filters an export reads. Page numbers and anything else are dropped. */
const FILTERS = ["q", "status", "method", "provider", "action", "entityType", "entityId", "actorId", "from", "to"] as const;

type FilterValue = string | readonly string[] | undefined;

/** The link for an export, from the filters currently applied on the page. Empty and "all" filters are left out. */
export function exportHref(kind: ExportKind, filters: Partial<Record<(typeof FILTERS)[number], FilterValue>>) {
  const p = new URLSearchParams();
  for (const key of FILTERS) {
    const raw = filters[key];
    const v = Array.isArray(raw) ? raw.join(",") : (raw as string | undefined);
    if (v !== undefined && v !== "" && v !== "all") p.set(key, v);
  }
  const s = p.toString();
  return `/admin/exports/${kind}${s ? `?${s}` : ""}`;
}

/** The query string to forward to the API: only the filters an export reads. */
export function exportSearch(params: URLSearchParams) {
  const p = new URLSearchParams();
  for (const key of FILTERS) {
    const v = params.get(key);
    if (v) p.set(key, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
