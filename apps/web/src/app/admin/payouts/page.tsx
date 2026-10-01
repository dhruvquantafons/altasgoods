import Link from "next/link";
import { ArrowRight, CalendarClock, FileText } from "lucide-react";
import { ActionButton, ToastButton } from "@/components/admin/action-button";
import { PAYOUT_RUN_STATUS } from "@/components/admin/admin-status";
import { Mono, SummaryRow } from "@/components/admin/bits";
import { hrefWith, paginate, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Stepper } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { sellers, TCS_PERCENT, TDS_PERCENT } from "@/lib/mock";
import { adminSettlements, payoutHolds, payoutRun } from "@/lib/mock/admin-extra";
import { SETTLEMENT_STATUS, type SettlementStatus } from "@/lib/status";
import { formatCompact, formatDate, formatDateShort, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Seller payouts" };

const STATUSES: (SettlementStatus | "all")[] = ["all", "scheduled", "processing", "on_hold", "failed", "paid", "open"];
const sellerOf = (id: string) => sellers.find((s) => s.id === id);

export default async function PayoutsPage(props: PageProps<"/admin/payouts">) {
  const params = await props.searchParams;
  const status = STATUSES.find((s) => s === sp(params, "status")) ?? "all";
  const page = Number(sp(params, "page") ?? 1) || 1;
  const { rows, ...pg } = paginate(adminSettlements.filter((s) => status === "all" || s.status === status), page, 12);
  const sum = (st: SettlementStatus) => adminSettlements.filter((s) => s.status === st).reduce((a, s) => a + s.netPayout, 0);

  // September 2026 liability: cycles that started in September
  const sept = adminSettlements.filter((s) => new Date(s.periodStart).getMonth() === 8);
  const tcs = sept.reduce((a, s) => a + s.tcs, 0);
  const tds = sept.reduce((a, s) => a + s.tds, 0);
  const byState = new Map<string, { tcs: number; sellers: Set<string> }>();
  for (const s of sept) {
    const st = sellerOf(s.sellerId)?.state ?? "Other";
    const e = byState.get(st) ?? { tcs: 0, sellers: new Set<string>() };
    e.tcs += s.tcs;
    e.sellers.add(s.sellerId);
    byState.set(st, e);
  }
  const states = [...byState.entries()].sort((a, b) => b[1].tcs - a[1].tcs);
  const held = payoutHolds.reduce((a, h) => a + h.amountHeld, 0);
  const runStep = ["draft", "pending_approval", "approved", "processing", "paid"].indexOf(payoutRun.status);

  return (
    <>
      <PageHeader
        title="Seller payouts"
        description="Settlement cycles, payout runs and holds. Payout runs go out Monday, Wednesday and Friday; a Finance Executive prepares each run and a Finance Manager approves it."
        actions={
          <ButtonLink href="/admin/reports" variant="secondary" size="sm" icon={FileText}>
            Settlement report
          </ButtonLink>
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Next run", value: formatCompact(payoutRun.amount, true), hint: `${formatDateShort(payoutRun.scheduledFor)}, ${payoutRun.sellers} sellers` },
          { label: "Processing", value: formatCompact(sum("processing"), true), hint: "sent to bank" },
          { label: "Paid, September", value: formatCompact(sum("paid"), true), hint: "with UTR" },
          { label: "On hold", value: formatCompact(held, true), hint: `${payoutHolds.length} sellers`, href: "#holds" },
          { label: "Failed payouts", value: adminSettlements.filter((s) => s.status === "failed").length, hint: "bank rejected, retry", href: "/admin/payouts?status=failed" },
        ]}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Payout run <Mono className="text-[14px]">{payoutRun.id}</Mono>
              </span>
            }
            description={`Scheduled ${formatDateTime(payoutRun.scheduledFor)}. Prepared by ${payoutRun.preparedBy} ${formatDateTime(payoutRun.preparedAt)}.`}
            action={<StatusBadge meta={PAYOUT_RUN_STATUS[payoutRun.status]} />}
          />
          <div className="px-5 pt-5 pb-5">
            <Stepper
              current={runStep}
              steps={[
                { label: "Draft", description: "Eligible lines" },
                { label: "Approval", description: "Finance Manager" },
                { label: "Approved" },
                { label: "Processing", description: "Bank payout API" },
                { label: "Paid", description: "UTR received" },
              ]}
            />
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
              {[
                { label: "Net amount", value: formatINR(payoutRun.amount) },
                { label: "Sellers", value: payoutRun.sellers },
                { label: "Settlement lines", value: payoutRun.lines.toLocaleString("en-IN") },
                { label: "Exceptions", value: `${payoutRun.exceptions} held back` },
              ].map((m) => (
                <div key={m.label}>
                  <dt className="text-xs text-ink-500">{m.label}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <ActionButton
                label="Approve run"
                icon="check"
                variant="primary"
                title={`Approve ${payoutRun.id}`}
                description="Approving releases the run to the bank payout API at the scheduled time."
                summary={[
                  { label: "Net amount", value: formatINR(payoutRun.amount) },
                  { label: "Sellers", value: String(payoutRun.sellers) },
                  { label: "Prepared by", value: payoutRun.preparedBy },
                  { label: "Exceptions", value: `${payoutRun.exceptions} held back` },
                ]}
                warning="Maker-checker: the person who prepared a run cannot approve it. Your approval is recorded in the audit log."
                note="optional"
                confirmLabel="Approve and release"
                toast="Payout run approved by Finance Manager"
                doneLabel="Approved"
              />
              <ActionButton label="Send back" icon="x" variant="ghost" title="Send the run back to the maker" reasons={["Amount differs from the reconciliation report", "Exception list incomplete", "Bank file format error"]} note="required" toast="Run returned to the Finance Executive" />
            </div>
          </div>
          <div className="border-t border-line">
            <p className="px-5 pt-4 pb-2 text-xs font-medium text-ink-500">Held back from this run</p>
            <ul className="divide-y divide-line">
              {[
                { seller: "ProFit Sports", why: "Payout hold: account health", amount: payoutHolds[0]!.amountHeld },
                { seller: "PageTurn Books", why: "Bank account re-verification after IFSC change", amount: payoutHolds[3]!.amountHeld },
              ].map((x) => (
                <li key={x.seller} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block text-ink-800">{x.seller}</span>
                    <span className="block text-xs text-ink-500">{x.why}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatINR(x.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 pt-4 pb-2 text-xs font-medium text-ink-500">Recent runs</p>
            <ul className="divide-y divide-line">
              {[
                { id: "RUN-260930", at: "2026-09-30T10:00:00+05:30", sellers: 11, amount: sum("processing"), status: "processing" as const },
                { id: "RUN-260928", at: "2026-09-28T10:00:00+05:30", sellers: 12, amount: Math.round(sum("paid") * 0.52), status: "paid" as const },
                { id: "RUN-260925", at: "2026-09-25T10:00:00+05:30", sellers: 12, amount: Math.round(sum("paid") * 0.48), status: "paid" as const },
              ].map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                  <span className="flex items-center gap-3">
                    <Mono>{r.id}</Mono>
                    <span className="hidden text-xs text-ink-500 sm:inline">
                      {formatDateShort(r.at)}, {r.sellers} sellers
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatINR(r.amount)}</span>
                    <StatusBadge meta={PAYOUT_RUN_STATUS[r.status]} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card id="holds" className="min-w-0">
          <CardHeader title="Payout holds" description={`${formatINR(held)} held across ${payoutHolds.length} sellers`} />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {payoutHolds.map((h) => (
              <li key={h.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/sellers/${h.sellerId}`} className="text-[13px] font-medium text-ink-900 hover:text-brand-700">
                      {sellerOf(h.sellerId)?.displayName}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {h.category}, since {formatDateShort(h.since)}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(h.amountHeld)}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-ink-700">{h.reason}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-500">Release: {h.releaseWhen}</p>
                  <ActionButton label="Release" icon="unlock" size="xs" variant="ghost" title={`Release hold on ${sellerOf(h.sellerId)?.displayName}`} description="Held lines move to Eligible for the next run." reasons={["Condition met", "Appeal accepted", "Hold placed in error"]} note="required" toast="Hold released" doneLabel="Released" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Settlement cycles" description="Weekly cycles per seller. Lines become eligible after delivery plus the tier hold (Platinum 2 days to Bronze 7 days), and COD after remittance." />
        <TabLinks
          className="mt-2 px-5"
          active={status}
          items={STATUSES.map((s) => ({ key: s, label: s === "all" ? "All" : SETTLEMENT_STATUS[s].label, count: adminSettlements.filter((x) => s === "all" || x.status === s).length, href: hrefWith("/admin/payouts", {}, { status: s === "all" ? undefined : s }) }))}
        />
        <TableContainer>
          <Table>
            <THead className="border-t-0">
              <TR>
                <TH>Settlement</TH>
                <TH>Seller</TH>
                <TH align="right" className="hidden md:table-cell">
                  Gross sales
                </TH>
                <TH align="right" className="hidden xl:table-cell">
                  Fees, GST and taxes
                </TH>
                <TH align="right" className="hidden 2xl:table-cell">
                  TCS
                </TH>
                <TH align="right" className="hidden 2xl:table-cell">
                  TDS
                </TH>
                <TH align="right" className="hidden 2xl:table-cell">
                  Refunds
                </TH>
                <TH align="right">Net payout</TH>
                <TH>Status</TH>
                <TH className="hidden md:table-cell">UTR or reason</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Mono className="font-medium">{s.id}</Mono>
                    <p className="text-xs text-ink-500">
                      {formatDateShort(s.periodStart)} to {formatDateShort(s.periodEnd)}, pays {formatDateShort(s.scheduledFor)}
                    </p>
                  </TD>
                  <TD>
                    <Link href={`/admin/sellers/${s.sellerId}`} className="text-[13px] text-ink-800 hover:text-brand-700">
                      {sellerOf(s.sellerId)?.displayName}
                    </Link>
                    <p className="text-xs text-ink-500">{s.orders.toLocaleString("en-IN")} orders</p>
                  </TD>
                  <TD align="right" className="hidden md:table-cell">
                    {formatINR(s.grossSales)}
                  </TD>
                  <TD align="right" className="hidden xl:table-cell">
                    -{formatINR(s.feesTotal + s.tcs + s.tds)}
                  </TD>
                  <TD align="right" className="hidden 2xl:table-cell">
                    -{formatINR(s.tcs)}
                  </TD>
                  <TD align="right" className="hidden 2xl:table-cell">
                    -{formatINR(s.tds)}
                  </TD>
                  <TD align="right" className="hidden 2xl:table-cell">
                    -{formatINR(s.refunds)}
                  </TD>
                  <TD align="right" className="font-semibold text-ink-900">
                    {formatINR(s.netPayout)}
                  </TD>
                  <TD>
                    <StatusBadge meta={SETTLEMENT_STATUS[s.status]} size="sm" />
                  </TD>
                  <TD className="hidden md:table-cell">
                    {s.utr ? (
                      <Mono className="text-xs text-ink-600">{s.utr}</Mono>
                    ) : s.failure ? (
                      <div className="flex items-center gap-2">
                        <span className="max-w-[180px] text-xs whitespace-normal text-danger-700">{s.failure}</span>
                        <ToastButton label="Retry" icon="retry" size="xs" toast="Payout queued in the next run after bank details are re-verified" doneLabel="Queued" />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">{s.status === "on_hold" ? "Held, see holds" : "Not paid yet"}</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
        <Pager path="/admin/payouts" params={{ status: status === "all" ? undefined : status }} label="settlements" {...pg} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="TCS liability, September 2026" description={`Section 52 CGST Act, ${TCS_PERCENT}% of net taxable supplies. GSTR-8 is due by 10 Oct.`} action={<CalendarClock size={17} className="text-ink-400" aria-hidden="true" />} />
          <div className="px-5 pt-3">
            <p className="text-[28px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(tcs)}</p>
            <p className="mt-1.5 text-xs text-ink-500">0.25% CGST + 0.25% SGST for intra-state supplies, 0.5% IGST inter-state</p>
          </div>
          <dl className="mt-4 divide-y divide-line border-t border-line">
            {states.map(([state, v]) => (
              <div key={state} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <dt className="text-ink-700">
                  {state} <span className="text-xs text-ink-400">{v.sellers.size} {v.sellers.size === 1 ? "seller" : "sellers"}</span>
                </dt>
                <dd className="font-medium text-ink-900 tabular-nums">{formatINR(v.tcs)}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="TDS liability, September 2026" description={`Section 194-O Income Tax Act, ${TDS_PERCENT}% of gross sales (taxable value, assumption D7).`} />
          <div className="px-5 pt-3 pb-5">
            <p className="text-[28px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(tds)}</p>
            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
              <SummaryRow label="Sellers with deductions" value={new Set(sept.map((s) => s.sellerId)).size} />
              <SummaryRow label="Exempt sellers (under ₹5 lakh, PAN furnished)" value="0" />
              <SummaryRow label="Deposit to government" value="by 7 Oct 2026" />
              <SummaryRow label="Form 26Q, quarter 2" value="by 31 Oct 2026" />
              <SummaryRow label="Form 16A certificates" value="by 15 Nov 2026" />
            </dl>
            <ButtonLink href="/admin/reports" variant="secondary" size="sm" iconRight={ArrowRight} className="mt-5">
              Generate GSTR-8 and 194-O reports
            </ButtonLink>
            <p className="mt-3 text-xs text-ink-500">Liability computed from settlement cycles that started in September ({formatDate("2026-09-01")} onward).</p>
          </div>
        </Card>
      </div>
    </>
  );
}
