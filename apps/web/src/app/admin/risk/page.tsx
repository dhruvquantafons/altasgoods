import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { riskTone } from "@/components/admin/admin-status";
import { Mono, ScoreMeter } from "@/components/admin/bits";
import { ageLabel } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { RuleToggle } from "@/components/admin/rule-toggle";
import { Sparkline } from "@/components/charts/static";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { customers } from "@/lib/mock";
import { blocklist, codRiskPincodes, customerProfile, heldOrders, opsSnapshot, returnAbuseSignals, riskRules } from "@/lib/mock/admin-extra";
import { PAYMENT_METHOD } from "@/lib/status";
import { cn, formatDate, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Risk and fraud" };

export default function RiskPage() {
  const risky = customers
    .filter((c) => c.riskScore >= 55)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Risk and fraud"
        description="Rules, held orders and blocklists. Rules can hold an order, disable COD, require OTP or open box, or send to manual review (spec 10.14)."
        actions={
          <ActionButton
            label="Add to blocklist"
            icon="lock"
            variant="primary"
            title="Add a blocklist entry"
            description="Blocks apply at checkout, sign-up and payment. Entries without an expiry are reviewed every 90 days."
            fields={[
              { name: "type", label: "Type", type: "select", options: ["Device", "Phone", "Pincode", "UPI ID", "Address", "Card BIN", "Email domain"] },
              { name: "value", label: "Value", placeholder: "For example 845401" },
              { name: "expiry", label: "Expires", type: "select", options: ["30 days", "90 days", "180 days", "No expiry"] },
            ]}
            reasons={["COD abuse", "Return abuse", "Payment fraud", "Coupon abuse", "Seller fake orders", "Law enforcement request"]}
            note="required"
            confirmLabel="Add entry"
            toast="Blocklist entry added"
          />
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Orders on hold", value: heldOrders.length, hint: "awaiting analyst decision" },
          { label: "Open risk cases", value: formatNumber(opsSnapshot.openRiskCases), hint: "all queues" },
          { label: "COD disabled pincodes", value: codRiskPincodes.filter((p) => p.status === "COD disabled").length, hint: "RTO over 25%, 30 days" },
          { label: "Blocklist entries", value: blocklist.length, hint: `${blocklist.reduce((a, b) => a + b.hits30d, 0).toLocaleString("en-IN")} hits, 30 days` },
          { label: "Loss prevented, 30 days", value: "₹1.8Cr", hint: "held, voided or blocked" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader title="Risk rules" description="Hits over the last 7 days. Precision is the share of hits confirmed by analysts. Simulating rules log hits without acting." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Rule</TH>
                <TH className="hidden xl:table-cell">Action</TH>
                <TH align="right">Hits, 7 days</TH>
                <TH className="hidden md:table-cell">
                  <span className="sr-only">Trend</span>
                </TH>
                <TH align="right" className="hidden sm:table-cell">
                  Precision
                </TH>
                <TH className="hidden lg:table-cell">Last hit</TH>
                <TH align="right">Status</TH>
              </TR>
            </THead>
            <TBody>
              {riskRules.map((r) => (
                <TR key={r.id}>
                  <TD className="max-w-[360px] whitespace-normal">
                    <p className="text-[13px] font-medium text-ink-900">
                      {r.name} <span className="font-mono text-xs font-normal text-ink-400">{r.id}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {r.scope}: {r.trigger}
                    </p>
                  </TD>
                  <TD className="hidden max-w-[260px] text-[13px] whitespace-normal text-ink-700 xl:table-cell">{r.action}</TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {formatNumber(r.hits7d)}
                  </TD>
                  <TD className="hidden md:table-cell">{r.hits7d > 0 && <Sparkline values={r.trend} width={64} height={22} />}</TD>
                  <TD align="right" className={cn("hidden sm:table-cell", r.precision && r.precision < 80 ? "text-warning-700" : "")}>
                    {r.precision ? `${r.precision}%` : "None yet"}
                  </TD>
                  <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{r.status === "disabled" ? formatDate(r.lastHitAt) : `${ageLabel(r.lastHitAt)} ago`}</TD>
                  <TD align="right">
                    <RuleToggle name={r.name} status={r.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Orders on hold" description="Payment captured or COD accepted; not sent to sellers until cleared. Release confirms the order, reject cancels and refunds." />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH className="hidden md:table-cell">Signals</TH>
                  <TH align="right">Amount</TH>
                  <TH>Score</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {heldOrders.map((h) => (
                  <TR key={h.orderId}>
                    <TD>
                      <Link href={`/admin/orders/${h.orderId}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {h.orderId}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {h.customerName}, held {ageLabel(h.heldAt)}
                      </p>
                    </TD>
                    <TD className="hidden max-w-[280px] text-[13px] whitespace-normal text-ink-700 md:table-cell">{h.reasons.join("; ")}</TD>
                    <TD align="right">
                      <span className="font-medium text-ink-900">{formatINR(h.amount)}</span>
                      <p className="text-xs text-ink-500">{PAYMENT_METHOD[h.method as keyof typeof PAYMENT_METHOD]}</p>
                    </TD>
                    <TD>
                      <ScoreMeter value={h.score} tone={riskTone(h.score)} label="Order risk score" />
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1.5">
                        <ActionButton label="Release" icon="check" size="xs" title={`Release ${h.orderId}`} description="The order is confirmed and sent to the sellers." reasons={["Customer verified by call", "Signals explained", "False positive"]} note="optional" toast="Order released to sellers" doneLabel="Released" />
                        <ActionButton label="Reject" icon="ban" size="xs" variant="ghost" danger title={`Reject ${h.orderId}`} description="Cancels with reason RISK_REJECTED and refunds any prepaid amount." reasons={["Confirmed fraud", "Unreachable on verification call", "Linked to blocked entity"]} note="required" toast="Order cancelled as RISK_REJECTED" doneLabel="Rejected" />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="High risk customers" description="Risk score 55 or above" />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {risky.map((c) => {
              const p = customerProfile(c.id);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/customers/${c.id}`} className="text-[13px] font-medium text-ink-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {p.codRefusals90d} COD refusals, {p.returnRate}% returns, {p.linkedAccounts} linked
                    </p>
                  </div>
                  <ScoreMeter value={c.riskScore} tone={riskTone(c.riskScore)} label="Customer risk score" />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="COD abuse by pincode" description="COD is disabled automatically above a 25% RTO rate over 30 days" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Pincode</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    COD orders
                  </TH>
                  <TH align="right">RTO rate</TH>
                  <TH>COD</TH>
                </TR>
              </THead>
              <TBody>
                {codRiskPincodes.map((p) => (
                  <TR key={p.pincode}>
                    <TD>
                      <Mono className="font-medium">{p.pincode}</Mono>
                      <p className="text-xs text-ink-500">{p.city}</p>
                    </TD>
                    <TD align="right" className="hidden sm:table-cell">
                      {formatNumber(p.codOrders30d)}
                    </TD>
                    <TD align="right" className={p.rtoRate > 25 ? "font-semibold text-danger-700" : "text-ink-900"}>
                      {p.rtoRate}%
                    </TD>
                    <TD>
                      <StatusBadge meta={p.status === "COD disabled" ? { label: "Disabled", tone: "danger" } : { label: "Watching", tone: "warning" }} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Return abuse signals" description="Customer-fault returns only; seller and logistics faults are excluded" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH align="right">Returns, 90 days</TH>
                  <TH align="right">Return rate</TH>
                  <TH className="hidden md:table-cell">Signal</TH>
                </TR>
              </THead>
              <TBody>
                {returnAbuseSignals.map((r) => (
                  <TR key={r.customerId}>
                    <TD>
                      <Link href={`/admin/customers/${r.customerId}`} className="text-[13px] font-medium text-ink-900 hover:text-brand-700">
                        {r.name}
                      </Link>
                      <p className="text-xs text-ink-500">{r.city}</p>
                    </TD>
                    <TD align="right">{r.returns90d}</TD>
                    <TD align="right" className="font-semibold text-danger-700">
                      {r.returnRate}%
                    </TD>
                    <TD className="hidden text-[13px] text-ink-700 md:table-cell">{r.signal}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      </div>

      <Card>
        <CardHeader title="Blocklists" description="Devices, phones, pincodes, payment instruments and addresses. Values are masked where they are personal data." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Entry</TH>
                <TH className="hidden md:table-cell">Reason</TH>
                <TH className="hidden lg:table-cell">Added</TH>
                <TH className="hidden sm:table-cell">Expires</TH>
                <TH align="right">Hits, 30 days</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {blocklist.map((b) => (
                <TR key={b.id}>
                  <TD>
                    <p className="text-xs font-medium text-ink-500">{b.type}</p>
                    <Mono className="text-ink-900">{b.value}</Mono>
                  </TD>
                  <TD className="hidden max-w-[320px] text-[13px] whitespace-normal text-ink-700 md:table-cell">{b.reason}</TD>
                  <TD className="hidden text-[13px] text-ink-600 lg:table-cell">
                    {b.addedBy}, {formatDate(b.addedAt)}
                  </TD>
                  <TD className="hidden text-[13px] text-ink-600 sm:table-cell">{b.expiresAt ? formatDate(b.expiresAt) : "No expiry"}</TD>
                  <TD align="right">{formatNumber(b.hits30d)}</TD>
                  <TD align="right">
                    <ActionButton label="Remove" icon="unlock" size="xs" variant="ghost" title={`Remove ${b.type.toLowerCase()} from blocklist`} reasons={["Appeal accepted", "Entered in error", "Risk no longer present"]} note="required" toast="Blocklist entry removed" doneLabel="Removed" />
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
