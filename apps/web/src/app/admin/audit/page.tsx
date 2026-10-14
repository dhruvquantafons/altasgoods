import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Mono } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAudit } from "@/lib/api/admin-system";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

const AREAS = [
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "brand", label: "Brands" },
  { value: "order", label: "Orders" },
  { value: "return", label: "Returns" },
  { value: "ticket", label: "Care Desk" },
  { value: "customer", label: "Customers" },
  { value: "sale", label: "Sales" },
  { value: "coupon", label: "Coupons" },
  { value: "banner", label: "Storefront CMS" },
  { value: "review", label: "Reviews" },
  { value: "settings", label: "Settings" },
];

/** Where an entry's subject lives in the console, when it has a page. */
function hrefFor(type: string, id: string | null) {
  if (type === "settings") return "/admin/settings";
  if (!id) return null;
  const map: Record<string, string> = {
    product: `/admin/catalog/${id}`,
    return: `/admin/returns/${id}`,
    ticket: `/support/tickets/${id}`,
    customer: `/admin/customers/${id}`,
    category: "/admin/categories",
    brand: "/admin/brands",
    sale: "/admin/promotions",
    coupon: "/admin/promotions?tab=coupons",
    banner: "/admin/cms",
    review: "/admin/reviews",
  };
  return map[type] ?? null;
}

const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "empty";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
};

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const params = await props.searchParams;
  const q = sp(params, "q")?.trim() ?? "";
  const actor = sp(params, "actor") ?? "all";
  const area = sp(params, "area") ?? "all";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);
  const current = { q: q || undefined, actor: actor === "all" ? undefined : actor, area: area === "all" ? undefined : area };

  const data = await loadAudit({ q: q || undefined, actorId: current.actor, action: current.area, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total ? (page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in AltasGoods Control and the Care Desk: who made it, when, and what changed." />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/audit"
            q={q}
            placeholder="Search what happened"
            selects={[
              { name: "area", label: "Area", value: area, className: "sm:w-44", options: [{ value: "all", label: "All areas" }, ...AREAS] },
              { name: "actor", label: "Who", value: actor, className: "sm:w-48", options: [{ value: "all", label: "Everyone" }, ...data.actors.map((a) => ({ value: a.id, label: a.name }))] },
            ]}
          />
        </div>
        {data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={q || current.actor || current.area ? "No changes match" : "Nothing recorded yet"}
            description={q || current.actor || current.area ? "Clear a filter or search for something else." : "Changes made in AltasGoods Control and the Care Desk appear here."}
          />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>When</TH>
                  <TH>Who</TH>
                  <TH>What happened</TH>
                  <TH className="hidden lg:table-cell">Changes</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((e) => {
                  const href = hrefFor(e.entityType, e.entityId);
                  const changes = Object.entries(e.changes ?? {});
                  return (
                    <TR key={e.id}>
                      <TD className="align-top text-[13px] whitespace-nowrap text-ink-600">{formatDateTime(e.createdAt)}</TD>
                      <TD className="align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={e.actorName} size="xs" />
                          <span className="text-[13px] font-medium text-ink-900">{e.actorName}</span>
                        </div>
                      </TD>
                      <TD className="max-w-[420px] align-top whitespace-normal">
                        <p className="text-[13px] text-ink-800">{href ? <Link href={href} className="hover:text-brand-700 hover:underline">{e.summary}</Link> : e.summary}</p>
                        <Mono className="text-[11px] text-ink-400">{e.action}</Mono>
                      </TD>
                      <TD className="hidden max-w-[380px] align-top whitespace-normal lg:table-cell">
                        {changes.length ? (
                          <ul className="flex flex-col gap-0.5 text-xs text-ink-600">
                            {changes.slice(0, 6).map(([field, [before, after]]) => (
                              <li key={field}>
                                <span className="font-medium text-ink-800">{field}</span>: {show(before)} <span className="text-ink-400">to</span> {show(after)}
                              </li>
                            ))}
                            {changes.length > 6 && <li className="text-ink-400">and {changes.length - 6} more</li>}
                          </ul>
                        ) : (
                          <span className="text-xs text-ink-400">-</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/audit" params={current} label="changes" page={page} pages={pages} from={from} to={Math.min(page * PAGE_SIZE, data.total)} total={data.total} />
      </Card>
    </>
  );
}
