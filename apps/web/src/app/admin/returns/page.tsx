import Link from "next/link";
import { Inbox, Zap } from "lucide-react";
import { ActionButton, ToastButton } from "@/components/admin/action-button";
import { HOLD_STATUS } from "@/components/admin/admin-status";
import { Mono, SlaText } from "@/components/admin/bits";
import { ageLabel, hrefWith, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { returns, sellers } from "@/lib/mock";
import { adminRefunds, opsSnapshot, returnFault, type AdminRefund } from "@/lib/mock/admin-extra";
import { PAYMENT_METHOD, REFUND_STATUS, RETURN_STATUS, type ReturnStatus } from "@/lib/status";
import type { ReturnRequest } from "@/lib/types";
import { formatCompact, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Returns and refunds" };

const RETURN_VIEWS: { key: string; label: string; statuses: ReturnStatus[] }[] = [
  { key: "decision", label: "Needs decision", statuses: ["requested"] },
  { key: "qc", label: "QC and receipt", statuses: ["received", "qc_failed"] },
  { key: "pickup", label: "In pickup", statuses: ["approved", "pickup_scheduled", "picked_up"] },
  { key: "closed", label: "Resolved", statuses: ["qc_passed", "refund_initiated", "replacement_shipped", "completed", "rejected", "cancelled"] },
  { key: "all", label: "All", statuses: [] },
];

const REFUND_VIEWS: { key: string; label: string; match: (r: AdminRefund) => boolean }[] = [
  { key: "failed", label: "Failed", match: (r) => r.status === "failed" },
  { key: "on_hold", label: "On hold", match: (r) => r.status === "on_hold" },
  { key: "processing", label: "In progress", match: (r) => r.status === "initiated" || r.status === "processing" },
  { key: "completed", label: "Completed", match: (r) => r.status === "completed" },
];

const faultTone = { Seller: "warning", Customer: "neutral", Logistics: "info" } as const;
const sellerName = (id: string) => sellers.find((s) => s.id === id)?.displayName ?? id;
const destination = (m: AdminRefund["method"]) => (m === "bluwallet" ? "AltasGoods Credits" : PAYMENT_METHOD[m]);

function ReturnActions({ r }: { r: ReturnRequest }) {
  const summary = [
    { label: "Return", value: r.id },
    { label: "Amount", value: formatINR(r.amount) },
    { label: "Reason", value: r.reason },
    { label: "Fault", value: returnFault(r.reason) },
  ];
  if (r.status === "requested")
    return (
      <div className="flex justify-end gap-1.5">
        <ActionButton label="Approve" icon="check" size="xs" title={`Approve ${r.id}`} description="Creates a reverse pickup within 5 days (up to 3 attempts)." summary={summary} fields={[{ name: "res", label: "Resolution", type: "select", options: r.type === "replacement" ? ["Replacement", "Refund"] : ["Refund", "Replacement"] }]} note="optional" toast="Return approved, reverse pickup scheduled" doneLabel="Approved" />
        <ActionButton label="Reject" icon="x" size="xs" variant="ghost" danger title={`Reject ${r.id}`} description="The customer may file an AltasGoods Guarantee claim." summary={summary} reasons={["Return window expired", "Non-returnable item without a damage claim", "Item condition not eligible", "Duplicate request"]} note="required" toast="Return rejected, customer notified with the reason" doneLabel="Rejected" />
      </div>
    );
  if (r.status === "qc_failed")
    return (
      <div className="flex justify-end gap-1.5">
        <ActionButton label="Honour refund" icon="refund" size="xs" title="Honour the refund anyway" description="Return moves to Completed; the seller can file a SafeClaim (spec 11.3)." summary={summary} note="required" toast="Refund honoured, seller notified about SafeClaim" doneLabel="Honoured" />
        <ActionButton label="Uphold QC" icon="shield" size="xs" variant="ghost" title="Uphold the QC failure" description="Return is rejected and the item is re-shipped to the customer." summary={summary} reasons={["Item damaged by customer", "Wrong item returned", "Missing parts or accessories", "Used or washed item"]} note="required" toast="QC failure upheld, re-shipment created" doneLabel="Upheld" />
      </div>
    );
  return (
    <div className="flex justify-end">
      <Link href={`/admin/orders/${r.orderId}`} className="text-[13px] font-medium text-brand-700 hover:underline">
        Order
      </Link>
    </div>
  );
}

function RefundActions({ r }: { r: AdminRefund }) {
  const summary = [
    { label: "Refund", value: r.id },
    { label: "Amount", value: formatINR(r.amount) },
    { label: "Destination", value: destination(r.method) },
    { label: "Order", value: r.orderId },
  ];
  if (r.status === "failed")
    return (
      <div className="flex justify-end gap-1.5">
        <ToastButton label="Retry" icon="retry" size="xs" toast={`Retry submitted for ${r.id}`} doneLabel="Retrying" />
        <ActionButton label="Reroute" icon="wallet" size="xs" variant="ghost" title="Reroute the failed refund" description="Moves the refund back to Approved with a new destination. The customer is informed." summary={summary} fields={[{ name: "dest", label: "New destination", type: "select", options: ["AltasGoods Credits (under 2 hours)", "Bank account via IMPS (penny drop verified)", "UPI ID (verified)"] }]} note="optional" toast="Refund rerouted and resubmitted" doneLabel="Rerouted" />
      </div>
    );
  if (r.status === "on_hold")
    return (
      <div className="flex justify-end gap-1.5">
        <ActionButton label="Approve" icon="check" size="xs" title="Approve held refund" description="You are the checker for this refund. The creator cannot approve it." summary={summary} note="optional" toast="Refund approved and sent to the payment aggregator" doneLabel="Approved" />
        <ActionButton label="Deny" icon="x" size="xs" variant="ghost" danger title="Deny held refund" summary={summary} reasons={["Duplicate of a completed refund", "Return not received", "Risk investigation upheld"]} note="required" toast="Refund cancelled" doneLabel="Denied" />
      </div>
    );
  return null;
}

export default async function ReturnsPage(props: PageProps<"/admin/returns">) {
  const params = await props.searchParams;
  const view = RETURN_VIEWS.find((v) => v.key === sp(params, "view"))?.key ?? "decision";
  const refundView = REFUND_VIEWS.find((v) => v.key === sp(params, "refund"))?.key ?? "failed";
  const current = { view: sp(params, "view"), refund: sp(params, "refund") };

  const statuses = RETURN_VIEWS.find((v) => v.key === view)!.statuses;
  const rows = returns.filter((r) => !statuses.length || statuses.includes(r.status)).sort((a, b) => +new Date(a.requestedAt) - +new Date(b.requestedAt));
  const refundRows = adminRefunds.filter(REFUND_VIEWS.find((v) => v.key === refundView)!.match);

  const open = returns.filter((r) => ["requested", "approved", "pickup_scheduled", "picked_up", "received"].includes(r.status));
  const qcFailed = returns.filter((r) => r.status === "qc_failed");
  const inProgress = adminRefunds.filter((r) => r.status === "initiated" || r.status === "processing");
  const credits = adminRefunds.filter((r) => r.method === "bluwallet" && r.status === "completed" && r.creditedInMins !== undefined);
  const medianCredit = [...credits.map((c) => c.creditedInMins!)].sort((a, b) => a - b)[Math.floor(credits.length / 2)] ?? 0;
  const held = adminRefunds.filter((r) => r.status === "on_hold");

  return (
    <>
      <PageHeader title="Returns and refunds" description="Returns that need a platform decision, QC disputes and the refund pipeline from instruction to bank credit (spec 11.3 and 11.4)." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Open returns", value: open.length, hint: `${returns.filter((r) => r.status === "requested").length} need a decision` },
          { label: "QC failures", value: qcFailed.length, hint: "seller graded not acceptable" },
          { label: "Refunds in progress", value: formatCompact(inProgress.reduce((a, r) => a + r.amount, 0), true), hint: `${inProgress.length} instructions` },
          { label: "Failed refunds", value: opsSnapshot.refundsFailed, hint: "retry or reroute by T+1", href: "/admin/returns?refund=failed#refunds" },
          { label: "Held for approval", value: held.length, hint: "above limit or risk hold", href: "/admin/returns?refund=on_hold#refunds" },
          { label: "Credits refund time", value: `${medianCredit} min`, hint: "median, target under 2 h" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Returns queue" description="Oldest first. In-policy requests auto-approve; these need a person." />
          <TabLinks
            className="mt-2 px-5"
            active={view}
            items={RETURN_VIEWS.map((v) => ({ key: v.key, label: v.label, count: returns.filter((r) => !v.statuses.length || v.statuses.includes(r.status)).length, href: hrefWith("/admin/returns", current, { view: v.key }) }))}
          />
          {rows.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing waiting here" description="Returns in this state will appear as they arrive." />
          ) : (
            <TableContainer>
              <Table>
                <THead className="border-t-0">
                  <TR>
                    <TH>Return</TH>
                    <TH className="hidden md:table-cell">Reason</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH className="hidden lg:table-cell">Age</TH>
                    <TH align="right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => {
                    const fault = returnFault(r.reason);
                    return (
                      <TR key={r.id}>
                        <TD>
                          <div className="flex max-w-[280px] items-center gap-3">
                            <ProductImage src={r.image} alt="" size={38} rounded="md" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2">
                                <Mono className="font-medium">{r.id}</Mono>
                                <span className="text-xs text-ink-500">{r.type === "refund" ? "Refund" : "Replacement"}</span>
                              </p>
                              <p className="truncate text-xs text-ink-500">
                                {r.customerName}, sold by {sellerName(r.sellerId)}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD className="hidden md:table-cell">
                          <p className="text-[13px] text-ink-800">{r.reason}</p>
                          <Badge tone={faultTone[fault]} size="sm" className="mt-1">{`${fault} fault`}</Badge>
                        </TD>
                        <TD align="right" className="font-medium text-ink-900">
                          {formatINR(r.amount)}
                        </TD>
                        <TD>
                          <StatusBadge meta={RETURN_STATUS[r.status]} size="sm" />
                        </TD>
                        <TD className="hidden lg:table-cell">
                          {r.status === "requested" ? <SlaText dueAt={new Date(new Date(r.requestedAt).getTime() + 48 * 3600_000).toISOString()} /> : <span className="text-[13px] text-ink-600">{ageLabel(r.requestedAt)}</span>}
                        </TD>
                        <TD align="right">
                          <ReturnActions r={r} />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        <Card className="min-w-0 xl:col-span-3" id="refunds">
          <CardHeader title="Refunds" description="Failed refunds must be retried or rerouted; failed debits auto-reverse by T+1 under the RBI harmonised timeline." />
          <TabLinks
            className="mt-2 px-5"
            active={refundView}
            items={REFUND_VIEWS.map((v) => ({ key: v.key, label: v.label, count: adminRefunds.filter(v.match).length, href: `${hrefWith("/admin/returns", current, { refund: v.key })}#refunds` }))}
          />
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Refund</TH>
                  <TH className="hidden sm:table-cell">Order</TH>
                  <TH className="hidden md:table-cell">Customer</TH>
                  <TH>Destination</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">{refundView === "failed" ? "Failure" : refundView === "on_hold" ? "Hold reason" : "Initiated"}</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {refundRows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Mono className="font-medium">{r.id}</Mono>
                      {r.attempts > 1 && <p className="text-xs text-ink-500">{r.attempts} attempts</p>}
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-[13px] text-brand-700 hover:underline">
                        {r.orderId}
                      </Link>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">{r.customerName}</TD>
                    <TD className="text-[13px]">{destination(r.method)}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(r.amount)}
                    </TD>
                    <TD>
                      <StatusBadge meta={r.status === "on_hold" ? HOLD_STATUS : REFUND_STATUS[r.status]} size="sm" />
                    </TD>
                    <TD className="hidden max-w-[260px] text-[13px] whitespace-normal text-ink-600 lg:table-cell">
                      {r.note ?? formatDateTime(r.initiatedAt)}
                      {r.status === "failed" && <SlaText className="mt-0.5 flex" dueAt={new Date(new Date(r.initiatedAt).getTime() + 24 * 3600_000).toISOString()} />}
                    </TD>
                    <TD align="right">
                      <RefundActions r={r} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
            {refundView === "failed" ? `Showing the latest ${refundRows.length} of ${opsSnapshot.refundsFailed} failed refunds.` : `${refundRows.length} refunds.`} Refunds reverse in the opposite order of tender: external method first, then Credits, then AltasCoins.
          </p>
        </Card>
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 xl:col-span-3">
          <Card>
            <CardHeader title="Instant refunds to AltasGoods Credits" description="Refund at pickup and Credits refunds, last 24 hours" action={<Zap size={17} className="text-ink-400" aria-hidden="true" />} />
            <div className="px-5 pt-3 pb-2">
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(credits.reduce((a, c) => a + c.amount, 0))}</p>
                  <p className="mt-1.5 text-xs text-ink-500">{credits.length} refunds credited</p>
                </div>
                <div>
                  <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{medianCredit} min</p>
                  <p className="mt-1.5 text-xs text-ink-500">median time to credit</p>
                </div>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {credits.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate text-ink-800">{c.customerName}</span>
                    <Mono className="text-xs text-ink-500">{c.id}</Mono>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums">{formatINR(c.amount)}</span>
                    <span className="text-xs text-ink-500">in {c.creditedInMins} min</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Refund timelines" description="AltasGoods targets after refund processing starts" />
            <dl className="mt-3 divide-y divide-line border-t border-line text-[13px]">
              {[
                ["AltasGoods Credits", "Under 2 hours", "99.6%"],
                ["UPI", "1 to 2 business days", "97.8%"],
                ["Cards and EMI", "3 to 5 business days", "95.1%"],
                ["Net banking", "3 to 5 business days", "96.4%"],
                ["COD to bank or UPI", "1 to 2 business days", "93.2%"],
              ].map(([dest, target, onTime]) => (
                <div key={dest} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <dt>
                    <span className="block text-ink-800">{dest}</span>
                    <span className="text-xs text-ink-500">{target}</span>
                  </dt>
                  <dd className="text-right">
                    <span className="block font-semibold text-ink-900 tabular-nums">{onTime}</span>
                    <span className="text-xs text-ink-500">on time, 30 days</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

      </div>
    </>
  );
}
