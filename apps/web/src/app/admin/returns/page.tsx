import Link from "next/link";
import { Undo2 } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, paginate, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { loadAdminReturns, nextStep } from "@/lib/api/admin-fulfilment";
import { paise } from "@/lib/api/format";
import { UI_STATUS } from "@/lib/api/returns";
import type { ApiReturnStatus, ReturnRequest } from "@/lib/api/types";
import { RETURN_STATUS } from "@/lib/status";
import { formatDateShort } from "@/lib/utils";

export const metadata = { title: "Returns" };

const VIEWS: { key: string; label: string; statuses: ApiReturnStatus[] }[] = [
  { key: "action", label: "Needs action", statuses: ["PENDING_REVIEW", "RECEIVED", "QC_FAILED"] },
  { key: "progress", label: "In progress", statuses: ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKUP_FAILED", "PICKED_UP", "IN_TRANSIT", "QC_PASSED"] },
  { key: "done", label: "Closed", statuses: ["COMPLETED", "REJECTED", "CANCELLED", "LOST"] },
  { key: "all", label: "All", statuses: [] },
];

const RESOLUTION: Record<ReturnRequest["resolution"], string> = { REFUND: "Refund", REPLACEMENT: "Replacement", EXCHANGE: "Exchange" };

export default async function ReturnsPage(props: PageProps<"/admin/returns">) {
  const params = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp(params, "view")) ?? VIEWS[0]!;
  const q = sp(params, "q")?.trim().toLowerCase() ?? "";
  const page = Number(sp(params, "page") ?? 1) || 1;

  const all = (await loadAdminReturns()).filter(
    (r) => !q || r.id.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q) || r.item.title.toLowerCase().includes(q),
  );
  const inView = (v: (typeof VIEWS)[number]) => (v.statuses.length ? all.filter((r) => v.statuses.includes(r.status)) : all);
  const { rows, ...pg } = paginate(inView(view), page, 20);
  const current = { view: view.key === VIEWS[0]!.key ? undefined : view.key, q: q || undefined };

  return (
    <>
      <PageHeader title="Returns" description="Approve late claims, check items as they come back and release refunds or replacements." />
      <TabLinks
        className="mb-5"
        active={view.key}
        items={VIEWS.map((v) => ({ key: v.key, label: v.label, count: inView(v).length, href: hrefWith("/admin/returns", { ...current, view: v.key === VIEWS[0]!.key ? undefined : v.key }) }))}
      />
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar path="/admin/returns" q={q} placeholder="Return, order, customer or product" keep={{ view: current.view }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Undo2} title={q ? "No returns match this search" : "No returns here"} description={q ? "Try a different return ID, order ID or customer." : "Returns show up here as customers request them."} />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Return</TH>
                  <TH className="hidden md:table-cell">Item</TH>
                  <TH className="hidden lg:table-cell">Reason</TH>
                  <TH align="right">Value</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const next = nextStep(r);
                  return (
                    <TR key={r.id}>
                      <TD>
                        <Link href={`/admin/returns/${r.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {r.id}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {r.customerName}, {formatDateShort(r.createdAt)}
                        </p>
                      </TD>
                      <TD className="hidden md:table-cell">
                        <div className="flex max-w-[280px] items-center gap-2.5">
                          <ProductImage src={r.item.image} alt="" size={34} rounded="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-ink-800">{r.item.title}</span>
                            <span className="block font-mono text-xs text-ink-500">{r.orderId}</span>
                          </span>
                        </div>
                      </TD>
                      <TD className="hidden lg:table-cell">
                        <p className="text-[13px] text-ink-800">{r.reasonLabel}</p>
                        <p className="text-xs text-ink-500">{RESOLUTION[r.resolution]}</p>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {paise(r.resolution === "REFUND" ? r.refundAmountPaise : r.item.unitPricePaise * r.qty)}
                      </TD>
                      <TD>
                        <StatusBadge meta={RETURN_STATUS[UI_STATUS[r.status]]} size="sm" />
                        {next && <p className="mt-1 text-xs text-ink-500">{next}</p>}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/returns" params={current} label="returns" {...pg} />
      </Card>
    </>
  );
}
