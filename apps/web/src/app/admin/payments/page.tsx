import { TriangleAlert } from "lucide-react";
import { ActionButton, ToastButton } from "@/components/admin/action-button";
import { COD_REMIT_STATUS, GATEWAY_STATUS, ORPHAN_STATUS, RECON_STATUS } from "@/components/admin/admin-status";
import { Mono, SlaText } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, paginate, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Pager } from "@/components/admin/pager";
import { AreaChart } from "@/components/charts/area-chart";
import { BarList } from "@/components/charts/static";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { platformDaily } from "@/lib/mock";
import { codRemittance, failureRateHourly, failureReasons, gatewayStats, orphanPayments, paymentTransactions, reconFiles } from "@/lib/mock/admin-extra";
import { PAYMENT_METHOD, PAYMENT_STATUS, type PaymentMethod, type PaymentStatus } from "@/lib/status";
import { cn, formatCompact, formatDateShort, formatDateTime, formatINR, formatNumber, timeAgo } from "@/lib/utils";

export const metadata = { title: "Payments" };

const TABS = [
  { key: "transactions", label: "Transactions" },
  { key: "failures", label: "Debited, no order" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "cod", label: "COD remittance" },
];

export default async function PaymentsPage(props: PageProps<"/admin/payments">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp(params, "tab"))?.key ?? "transactions";
  const q = sp(params, "q")?.trim() ?? "";
  const status = sp(params, "status") ?? "all";
  const method = sp(params, "method") ?? "all";
  const page = Number(sp(params, "page") ?? 1) || 1;
  const current = { tab: tab === "transactions" ? undefined : tab, q: q || undefined, status: status === "all" ? undefined : status, method: method === "all" ? undefined : method };

  const vol = gatewayStats.reduce((a, g) => a + g.volume24h, 0);
  const success15 = gatewayStats.reduce((a, g) => a + g.success15m * g.volume24h, 0) / vol;
  const failed24 = Math.round(gatewayStats.reduce((a, g) => a + g.volume24h * (1 - g.success24h / 100), 0));
  const today = platformDaily.at(-1)!;
  const mismatches = reconFiles.filter((r) => r.status === "mismatch").reduce((a, r) => a + r.mismatches, 0);
  const codPending = codRemittance.reduce((a, c) => a + (c.expected - c.reconciled), 0);
  const degraded = gatewayStats.filter((g) => g.status !== "operational");

  const needle = q.toLowerCase();
  const txns = paymentTransactions.filter(
    (t) =>
      (!needle || `${t.id} ${t.orderId} ${t.customer} ${t.gatewayRef}`.toLowerCase().includes(needle)) &&
      (status === "all" || t.status === status) &&
      (method === "all" || t.method === method),
  );
  const { rows, ...pg } = paginate(txns, page, 15);

  return (
    <>
      <PageHeader title="Payments" description="Gateway health, payment transactions and reconciliation. Customer money sits in the payment aggregator escrow; COD cash is reconciled before sellers become eligible." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Success rate, 15 min", value: `${success15.toFixed(1)}%`, hint: `${degraded.length} channel degraded` },
          { label: "Captured today", value: formatCompact(today.gmv * 0.79, true), hint: "prepaid, so far" },
          { label: "Failed attempts, 24 h", value: formatCompact(failed24), hint: `${((failed24 / vol) * 100).toFixed(1)}% of attempts` },
          { label: "Debited, no order", value: orphanPayments.length, hint: "auto refund by T+1", href: "/admin/payments?tab=failures" },
          { label: "Recon mismatches", value: mismatches, hint: "open across gateway files", href: "/admin/payments?tab=reconciliation" },
          { label: "COD to reconcile", value: formatCompact(codPending, true), hint: "delivered, not yet banked", href: "/admin/payments?tab=cod" },
        ]}
      />

      {degraded.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-warning-100 bg-warning-50 px-5 py-3.5 text-[13px] text-warning-700">
          <TriangleAlert size={17} className="mt-px shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">UPI collect requests are degraded at Kanakpay</span> ({degraded[0]!.success15m}% success in the last 15 minutes against {degraded[0]!.success24h}% over 24 hours). Checkout is steering customers to UPI intent and QR; collect stays available.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Gateway health" description="By method and channel. Latency is the median time to a final status." />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH className="hidden md:table-cell">Provider</TH>
                  <TH align="right">15 min</TH>
                  <TH align="right">24 h</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Volume, 24 h
                  </TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Latency
                  </TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {gatewayStats.map((g) => (
                  <TR key={g.key} className={cn(g.status !== "operational" && "bg-warning-50/50")}>
                    <TD>
                      <p className="text-[13px] font-medium text-ink-900">{g.method}</p>
                      <p className="text-xs text-ink-500">{g.channel}</p>
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 md:table-cell">{g.provider}</TD>
                    <TD align="right" className={cn("font-semibold", g.success15m < g.success24h - 2 ? "text-danger-700" : "text-ink-900")}>
                      {g.success15m.toFixed(1)}%
                    </TD>
                    <TD align="right">{g.success24h.toFixed(1)}%</TD>
                    <TD align="right" className="hidden sm:table-cell">
                      {formatNumber(g.volume24h)}
                    </TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {(g.latencyMs / 1000).toFixed(1)} s
                    </TD>
                    <TD>
                      <StatusBadge meta={GATEWAY_STATUS[g.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader title="Failure rate by method" description="Share of attempts that failed, last 24 completed hours" />
          <div className="px-5 pt-4 pb-5">
            <AreaChart
              data={failureRateHourly}
              series={[
                { key: "upi", label: "UPI" },
                { key: "cards", label: "Cards", slot: 1 },
                { key: "netbanking", label: "Net banking", slot: 2 },
              ]}
              format="percent"
              area={false}
              height={260}
              ariaLabel="Payment failure rate by method, hourly"
            />
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Top failure reasons" description="Failed attempts, last 24 hours" />
          <div className="px-5 pt-4 pb-5">
            <BarList items={failureReasons.slice(0, 6)} format="compact" showShare />
          </div>
        </Card>
      </div>

      <TabLinks className="mb-5" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: hrefWith("/admin/payments", { tab: t.key === "transactions" ? undefined : t.key }) }))} />

      {tab === "transactions" && (
        <Card>
          <div className="border-b border-line px-5 py-3.5">
            <FilterBar
              path="/admin/payments"
              q={q}
              placeholder="Payment ID, order ID, customer or gateway ref"
              selects={[
                { name: "status", label: "Status", value: status, options: [{ value: "all", label: "All statuses" }, ...(Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS[s].label }))] },
                { name: "method", label: "Method", value: method, options: [{ value: "all", label: "All methods" }, ...(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))] },
              ]}
            />
          </div>
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Payment</TH>
                  <TH className="hidden md:table-cell">Order</TH>
                  <TH className="hidden lg:table-cell">Customer</TH>
                  <TH className="hidden sm:table-cell">Method</TH>
                  <TH className="hidden xl:table-cell">Gateway reference</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <Mono className="font-medium">{t.id}</Mono>
                      <p className="text-xs text-ink-500">{formatDateTime(t.at)}</p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <span className="font-mono text-[13px] text-brand-700">
                        {t.orderId}
                      </span>
                    </TD>
                    <TD className="hidden text-[13px] lg:table-cell">{t.customer}</TD>
                    <TD className="hidden sm:table-cell">
                      <p className="text-[13px] text-ink-800">{PAYMENT_METHOD[t.method]}</p>
                      <p className="text-xs text-ink-500">{t.provider}</p>
                    </TD>
                    <TD className="hidden xl:table-cell">{t.gatewayRef ? <Mono className="text-ink-600">{t.gatewayRef}</Mono> : <span className="text-xs text-ink-400">Collected at door</span>}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(t.amount)}
                    </TD>
                    <TD>
                      <StatusBadge meta={PAYMENT_STATUS[t.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pager path="/admin/payments" params={current} label="payments" {...pg} />
        </Card>
      )}

      {tab === "failures" && (
        <div>
          <Card className="min-w-0">
            <CardHeader title="Debited but no order created" description="Detected by reconciliation within minutes; auto-refunded within T+1 under the RBI harmonised timeline (compensation of ₹100 a day after that)." />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Payment</TH>
                    <TH className="hidden sm:table-cell">Customer</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH className="hidden md:table-cell">T+1 deadline</TH>
                  </TR>
                </THead>
                <TBody>
                  {orphanPayments.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        <Mono className="font-medium">{p.id}</Mono>
                        <p className="text-xs text-ink-500">
                          {p.method}, debited {timeAgo(p.debitedAt)}
                        </p>
                      </TD>
                      <TD className="hidden text-[13px] sm:table-cell">{p.customer}</TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatINR(p.amount)}
                      </TD>
                      <TD>
                        <StatusBadge meta={ORPHAN_STATUS[p.status]} size="sm" />
                      </TD>
                      <TD className="hidden md:table-cell">{p.status === "auto_refund_initiated" ? <SlaText dueAt={p.tatDue} /> : <span className="text-[13px] text-ink-500">Closed</span>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          </Card>
        </div>
      )}

      {tab === "reconciliation" && (
        <Card>
          <CardHeader title="Gateway settlement files" description="Captured payments and refunds against each provider's daily settlement file" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Provider</TH>
                  <TH align="right" className="hidden md:table-cell">
                    Payments
                  </TH>
                  <TH align="right">Captured</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Settled
                  </TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Refunds
                  </TH>
                  <TH align="right">Mismatches</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {reconFiles.map((r) => (
                  <TR key={`${r.date}-${r.provider}`}>
                    <TD className="text-[13px]">{formatDateShort(r.date)}</TD>
                    <TD className="text-[13px]">{r.provider}</TD>
                    <TD align="right" className="hidden md:table-cell">
                      {formatNumber(r.captured)}
                    </TD>
                    <TD align="right">{formatCompact(r.capturedAmount, true)}</TD>
                    <TD align="right" className="hidden sm:table-cell">
                      {r.settledAmount ? formatCompact(r.settledAmount, true) : "Awaiting"}
                    </TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {formatCompact(r.refundsAmount, true)}
                    </TD>
                    <TD align="right" className={r.mismatches && r.status === "mismatch" ? "font-semibold text-danger-700" : ""}>
                      {r.mismatches}
                    </TD>
                    <TD>
                      <StatusBadge meta={RECON_STATUS[r.status]} size="sm" />
                    </TD>
                    <TD align="right">
                      {r.status === "mismatch" ? (
                        <ActionButton label="Resolve" size="xs" title="Resolve mismatch" description={`${r.mismatches} transaction mismatch between ${r.provider} and AltasGoods for ${formatDateShort(r.date)}.`} reasons={["Late success, auto refunded", "Refund settled next day", "Gateway file corrected", "Manual ledger adjustment (maker-checker)"]} note="required" toast="Mismatch resolved" doneLabel="Resolved" />
                      ) : r.status === "pending" ? (
                        <ToastButton label="Fetch file" icon="download" size="xs" toast={`Requested ${r.provider} settlement file`} doneLabel="Requested" />
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === "cod" && (
        <Card>
          <CardHeader title="COD remittance from AltasGoods Logistics" description="Delivered COD against associate collections, hub deposits and bank credits. Sellers become eligible only after reconciliation." />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Hub</TH>
                  <TH align="right">Expected</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Collected
                  </TH>
                  <TH align="right" className="hidden md:table-cell">
                    Banked
                  </TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Reconciled
                  </TH>
                  <TH align="right">Short</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {codRemittance.map((c) => (
                  <TR key={c.hubId}>
                    <TD>
                      <p className="text-[13px] font-medium text-ink-900">{c.hubName}</p>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{c.hubCode}</span>, last deposit {timeAgo(c.lastDepositAt)}
                      </p>
                    </TD>
                    <TD align="right">{formatINR(c.expected)}</TD>
                    <TD align="right" className="hidden sm:table-cell">
                      {formatINR(c.collected)}
                    </TD>
                    <TD align="right" className="hidden md:table-cell">
                      {c.banked ? formatINR(c.banked) : "Pending"}
                    </TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {c.reconciled ? formatINR(c.reconciled) : "Pending"}
                    </TD>
                    <TD align="right" className={c.short ? "font-semibold text-danger-700" : "text-ink-500"}>
                      {c.short ? formatINR(c.short) : "None"}
                    </TD>
                    <TD>
                      <StatusBadge meta={COD_REMIT_STATUS[c.status]} size="sm" />
                    </TD>
                    <TD align="right">
                      {c.short > 0 && <ActionButton label="Raise recovery" size="xs" title="Raise associate recovery" description={`${formatINR(c.short)} short at ${c.hubName}. The associate is blocked from COD stops until the hub manager reviews.`} reasons={["Cash shortage on deposit", "Counterfeit note found", "UPI QR payment not credited"]} note="required" toast="Recovery case opened with the hub manager" doneLabel="Raised" />}
                    </TD>
                  </TR>
                ))}
                <TR className="bg-ink-50/60 font-medium hover:bg-ink-50/60">
                  <TD className="text-[13px] text-ink-900">All delivery hubs</TD>
                  <TD align="right" className="text-ink-900">
                    {formatINR(codRemittance.reduce((a, c) => a + c.expected, 0))}
                  </TD>
                  <TD align="right" className="hidden text-ink-900 sm:table-cell">
                    {formatINR(codRemittance.reduce((a, c) => a + c.collected, 0))}
                  </TD>
                  <TD align="right" className="hidden text-ink-900 md:table-cell">
                    {formatINR(codRemittance.reduce((a, c) => a + c.banked, 0))}
                  </TD>
                  <TD align="right" className="hidden text-ink-900 lg:table-cell">
                    {formatINR(codRemittance.reduce((a, c) => a + c.reconciled, 0))}
                  </TD>
                  <TD align="right" className="text-danger-700">
                    {formatINR(codRemittance.reduce((a, c) => a + c.short, 0))}
                  </TD>
                  <TD />
                  <TD />
                </TR>
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}
