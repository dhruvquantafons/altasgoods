import { Lock, ScrollText } from "lucide-react";
import { ToastButton } from "@/components/admin/action-button";
import { Mono } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { paginate, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { auditEntries } from "@/lib/mock/admin-extra";
import { formatDateTime, NOW } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const RANGES: Record<string, number> = { "24h": 1, "7d": 7 };

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const params = await props.searchParams;
  const q = sp(params, "q")?.trim() ?? "";
  const actor = sp(params, "actor") ?? "all";
  const entity = sp(params, "entity") ?? "all";
  const action = sp(params, "action") ?? "all";
  const range = sp(params, "range") ?? "all";
  const page = Number(sp(params, "page") ?? 1) || 1;
  const current = { q: q || undefined, actor: actor === "all" ? undefined : actor, entity: entity === "all" ? undefined : entity, action: action === "all" ? undefined : action, range: range === "all" ? undefined : range };

  const actors = [...new Set(auditEntries.map((e) => e.actor))].sort();
  const entities = [...new Set(auditEntries.map((e) => e.entity))].sort();
  const actions = [...new Set(auditEntries.map((e) => e.action))].sort();
  const needle = q.toLowerCase();
  const rows = auditEntries.filter((e) => {
    if (needle && !`${e.target} ${e.summary} ${e.ip} ${e.reason ?? ""}`.toLowerCase().includes(needle)) return false;
    if (actor !== "all" && e.actor !== actor) return false;
    if (entity !== "all" && e.entity !== entity) return false;
    if (action !== "all" && e.action !== action) return false;
    if (range !== "all" && NOW.getTime() - new Date(e.at).getTime() > (RANGES[range] ?? 0) * 86_400_000) return false;
    return true;
  });
  const { rows: pageRows, ...pg } = paginate(rows, page, 25);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every write in AltasGoods Control, Care Desk, Hub and FC consoles, with actor, role, reason, IP address and device. PII reveals and exports are logged too."
        meta={
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-500">
            <Lock size={13} aria-hidden="true" />
            Append-only and tamper evident. Retained for 8 years.
          </span>
        }
        actions={<ToastButton label="Export" icon="download" toast="Export queued. Auditors receive masked PII." />}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/audit"
            q={q}
            placeholder="Target ID, summary, reason or IP"
            selects={[
              { name: "actor", label: "Actor", value: actor, options: [{ value: "all", label: "All actors" }, ...actors.map((a) => ({ value: a, label: a }))] },
              { name: "entity", label: "Entity", value: entity, className: "sm:w-36", options: [{ value: "all", label: "All entities" }, ...entities.map((a) => ({ value: a, label: a }))] },
              { name: "action", label: "Action", value: action, options: [{ value: "all", label: "All actions" }, ...actions.map((a) => ({ value: a, label: a }))] },
              { name: "range", label: "Time", value: range, className: "sm:w-36", options: [{ value: "all", label: "Any time" }, { value: "24h", label: "Last 24 hours" }, { value: "7d", label: "Last 7 days" }] },
            ]}
          />
        </div>
        {pageRows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No events match" description="Widen the time range or clear a filter." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH className="hidden md:table-cell">Event</TH>
                  <TH className="hidden xl:table-cell">Source</TH>
                </TR>
              </THead>
              <TBody>
                {pageRows.map((e) => (
                  <TR key={e.id}>
                    <TD className="align-top text-[13px] text-ink-600">
                      {formatDateTime(e.at)}
                      <p className="font-mono text-[11px] text-ink-400">{e.id}</p>
                    </TD>
                    <TD className="align-top">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.actor} size="xs" />
                        <div>
                          <p className="text-[13px] font-medium text-ink-900">{e.actor}</p>
                          <p className="text-xs text-ink-500">{e.actorRole}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="align-top">
                      <Mono className="text-[12.5px] text-ink-900">{e.action}</Mono>
                      <p className="text-xs text-ink-500">
                        {e.entity} <span className="font-mono">{e.target}</span>
                      </p>
                    </TD>
                    <TD className="hidden max-w-[420px] align-top whitespace-normal md:table-cell">
                      <p className="text-[13px] text-ink-800">{e.summary}</p>
                      {e.reason && <p className="text-xs text-ink-500">Reason: {e.reason}</p>}
                    </TD>
                    <TD className="hidden align-top xl:table-cell">
                      <Mono className="text-xs text-ink-700">{e.ip}</Mono>
                      <p className="text-xs text-ink-500">{e.device}</p>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/audit" params={current} label="events" {...pg} />
      </Card>
    </>
  );
}
