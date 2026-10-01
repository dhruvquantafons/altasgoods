import { FileSpreadsheet, Landmark, Package, ReceiptIndianRupee, ShoppingBag, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ToastButton } from "@/components/admin/action-button";
import { REPORT_RUN_STATUS } from "@/components/admin/admin-status";
import { Chip, Mono } from "@/components/admin/bits";
import { GenerateReport } from "@/components/admin/generate-report";
import { sp } from "@/components/admin/helpers";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { reportLibrary, reportRuns, scheduledExports, type ReportDef } from "@/lib/mock/admin-extra";
import type { Tone } from "@/lib/status";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/utils";

export const metadata = { title: "Reports" };

const GROUPS: { key: ReportDef["group"]; icon: LucideIcon; tone: Tone }[] = [
  { key: "Tax and compliance", icon: Landmark, tone: "brand" },
  { key: "Finance", icon: ReceiptIndianRupee, tone: "success" },
  { key: "Sales", icon: ShoppingBag, tone: "info" },
  { key: "Operations", icon: Package, tone: "warning" },
  { key: "Sellers", icon: FileSpreadsheet, tone: "neutral" },
  { key: "Customers", icon: Users, tone: "neutral" },
];

export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  const params = await props.searchParams;
  const preselect = reportLibrary.find((r) => r.id === sp(params, "generate"))?.id;
  const options = reportLibrary.map((r) => ({ id: r.id, name: r.name, formats: r.formats, group: r.group }));
  const name = (id: string) => reportLibrary.find((r) => r.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Statutory filings, finance reconciliation and operating reports. Exports mask personal data unless your role allows it, and every export is audited."
        actions={<GenerateReport reports={options} reportId={preselect} label="Generate report" variant="primary" defaultOpen={Boolean(preselect)} />}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-brand-100">
          <CardHeader title="Filing calendar, October 2026" description="Statutory deadlines for the marketplace as e-commerce operator" />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {[
              { date: "7 Oct", what: "Deposit TDS under section 194-O for September", report: "rpt-tds194o" },
              { date: "10 Oct", what: "File GSTR-8 with TCS collected in September", report: "rpt-gstr8" },
              { date: "31 Oct", what: "File Form 26Q for quarter 2 (Jul to Sep)", report: "rpt-tds194o" },
              { date: "15 Nov", what: "Issue Form 16A TDS certificates to sellers", report: "rpt-tds194o" },
            ].map((d) => (
              <li key={d.what} className="flex items-center gap-4 px-5 py-3">
                <span className="w-14 shrink-0 text-[13px] font-semibold text-ink-900 tabular-nums">{d.date}</span>
                <span className="min-w-0 flex-1 text-[13px] text-ink-700">{d.what}</span>
                <GenerateReport reports={options} reportId={d.report} label="Prepare" variant="ghost" size="xs" />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Scheduled exports" description="Recurring deliveries to team inboxes" />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {scheduledExports.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-900">{name(s.reportId)}</p>
                  <p className="truncate text-xs text-ink-500">
                    {s.cadence}, {s.format}, to {s.recipients}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge meta={s.active ? { label: "Active", tone: "success" } : { label: "Paused", tone: "neutral" }} size="sm" />
                  <ToastButton label={s.active ? "Pause" : "Resume"} size="xs" variant="ghost" toast={s.active ? "Schedule paused" : "Schedule resumed"} doneLabel={s.active ? "Paused" : "Active"} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-6 flex flex-col gap-6">
        {GROUPS.filter((g) => reportLibrary.some((r) => r.group === g.key)).map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <h2 id={`grp-${g.key}`} className="mb-3 text-[13px] font-semibold text-ink-500">
              {g.key}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reportLibrary
                .filter((r) => r.group === g.key)
                .map((r) => (
                  <Card key={r.id} className="flex flex-col p-5">
                    <div className="flex items-start gap-3">
                      <IconTile icon={g.icon} tone={g.tone} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{r.name}</p>
                        <p className="text-xs text-ink-500">
                          {r.cadence}, {r.owner}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-600">{r.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {r.formats.map((f) => (
                          <Chip key={f}>{f}</Chip>
                        ))}
                        <span className="text-xs text-ink-500">Last run {timeAgo(r.lastRunAt)}</span>
                      </div>
                      <GenerateReport reports={options} reportId={r.id} size="xs" />
                    </div>
                  </Card>
                ))}
            </div>
          </section>
        ))}
      </div>

      <Card>
        <CardHeader title="Recent exports" description="Download links expire after 7 days" />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Export</TH>
                <TH className="hidden md:table-cell">Period</TH>
                <TH className="hidden lg:table-cell">Requested by</TH>
                <TH align="right" className="hidden sm:table-cell">
                  Rows
                </TH>
                <TH>Status</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {reportRuns.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <p className="text-[13px] font-medium text-ink-900">{name(r.reportId)}</p>
                    <p className="text-xs text-ink-500">
                      <Mono className="text-xs text-ink-500">{r.id}</Mono>, {formatDateTime(r.at)}
                    </p>
                  </TD>
                  <TD className="hidden text-[13px] md:table-cell">{r.period}</TD>
                  <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{r.requestedBy}</TD>
                  <TD align="right" className="hidden sm:table-cell">
                    {r.rows ? formatNumber(r.rows) : "None"}
                    {r.size && <p className="text-xs text-ink-500">{r.size}</p>}
                  </TD>
                  <TD>
                    <StatusBadge meta={REPORT_RUN_STATUS[r.status]} size="sm" />
                  </TD>
                  <TD align="right">
                    {r.status === "ready" && <ToastButton label="Download" icon="download" size="xs" toast="Download started. Logged to the audit trail." />}
                    {r.status === "failed" && <ToastButton label="Retry" icon="retry" size="xs" toast="Export queued again" doneLabel="Queued" />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}
