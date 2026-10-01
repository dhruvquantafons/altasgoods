import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, FileText, Landmark, Search } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { AutoSubmitSelect, ToastButton } from "@/components/seller/client-kit";
import { Amount, Callout, Mono } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { RATE_CARD_VERSION } from "@/lib/mock";
import { balances, BANK_ACCOUNT, LEDGER_STATUS, ledger, nextPayoutRun, SELLER, sellerStatements, taxDocuments, type LedgerType } from "@/lib/mock/seller-extra";
import { SETTLEMENT_STATUS } from "@/lib/status";
import { formatCompact, formatDate, formatDateShort, formatINR, formatNumber, NOW } from "@/lib/utils";

export const metadata = { title: "Payments" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "statements", label: "Statements" },
  { key: "transactions", label: "Transactions" },
  { key: "tax", label: "Tax documents" },
];

const TYPES: LedgerType[] = ["Order payment", "Refund", "SafeClaim reimbursement", "BluBuy Ads", "Penalty", "Fulfilled fees"];

const feeTotal = (fees: { amount: number }[]) => fees.reduce((a, f) => a + f.amount, 0);

export default async function PaymentsPage(props: PageProps<"/seller/payments">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = TABS.find((t) => t.key === one(sp.tab))?.key ?? "overview";
  const next = sellerStatements[1]!;
  const open = sellerStatements[0]!;
  const paid = sellerStatements.filter((s) => s.status === "paid");
  const last90 = sellerStatements.slice(1, 14);

  const tabs = TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}`, count: t.key === "statements" ? sellerStatements.length : t.key === "transactions" ? ledger.length : undefined }));

  return (
    <>
      <PageHeader
        title="Payments"
        description={`Settlements are paid to your bank on payout runs every Monday, Wednesday and Friday. ${SELLER.tier} sellers become eligible 2 days after delivery.`}
        actions={
          <ToastButton icon="download" message="Statement for September 2026 is being prepared as PDF and CSV. It will appear in Reports shortly.">
            Download statement
          </ToastButton>
        }
      />

      <TabLinks items={tabs} active={tab} className="mb-6" />

      {tab === "overview" && <Overview next={next} open={open} paid={paid} last90={last90} />}
      {tab === "statements" && <Statements />}
      {tab === "transactions" && <Transactions q={one(sp.q)} type={one(sp.type)} status={one(sp.status)} />}
      {tab === "tax" && <TaxDocs />}
    </>
  );
}

function Overview({ next, open, paid, last90 }: { next: (typeof sellerStatements)[number]; open: (typeof sellerStatements)[number]; paid: typeof sellerStatements; last90: typeof sellerStatements }) {
  const chart = sellerStatements
    .slice(1)
    .reverse()
    .map((s) => ({ label: formatDateShort(s.periodStart), net: s.netPayout }));
  const failed = sellerStatements.find((s) => s.status === "failed");
  const upcomingTotal = balances.upcoming.reduce((a, u) => a + u.amount, 0);
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Next payout hero */}
        <Card className="xl:col-span-2">
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-medium text-ink-500">Next payout</p>
                <StatusBadge meta={SETTLEMENT_STATUS[next.status]} size="sm" />
              </div>
              <p className="mt-2 text-[36px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(next.netPayout)}</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-600">
                <CalendarClock size={15} className="text-ink-400" aria-hidden="true" />
                Scheduled for {formatDate(next.scheduledFor)} to {BANK_ACCOUNT.bank} ending {BANK_ACCOUNT.last4}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Cycle {formatDateShort(next.periodStart)} to {formatDateShort(next.periodEnd)}, {formatNumber(next.orders)} orders
              </p>
              <Link href={`/seller/payments/${next.id}`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                View statement <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <dl className="grid min-w-60 content-start gap-2.5 rounded-xl bg-ink-50/70 p-4 text-[13px]">
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Gross sales</dt>
                <dd className="font-medium text-ink-900 tabular-nums">{formatINR(next.grossSales)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Fees and GST</dt>
                <dd className="text-ink-900 tabular-nums">
                  <Amount value={feeTotal(next.fees.filter((f) => !/^(TCS|TDS)/.test(f.label)))} />
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">TCS and TDS</dt>
                <dd className="text-ink-900 tabular-nums">
                  <Amount value={feeTotal(next.fees.filter((f) => /^(TCS|TDS)/.test(f.label)))} />
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Refunds</dt>
                <dd className="text-ink-900 tabular-nums">
                  <Amount value={next.refunds} />
                </dd>
              </div>
              <div className="mt-1 flex justify-between gap-6 border-t border-line pt-2.5">
                <dt className="font-medium text-ink-900">Net payout</dt>
                <dd className="font-semibold text-ink-900 tabular-nums">{formatINR(next.netPayout)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        {/* Bank */}
        <Card>
          <CardHeader title="Bank account" action={<Badge tone="success" icon={BadgeCheck}>Verified</Badge>} />
          <div className="px-5 pt-3 pb-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                <Landmark size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {BANK_ACCOUNT.bank} <Mono className="text-ink-600">XXXX {BANK_ACCOUNT.last4}</Mono>
                </p>
                <p className="text-xs text-ink-500">
                  {BANK_ACCOUNT.type}, <span className="font-mono">{BANK_ACCOUNT.ifsc}</span>
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              {BANK_ACCOUNT.holder}. {BANK_ACCOUNT.method} on {formatDate(BANK_ACCOUNT.verifiedOn)}. Changing the account needs the owner and holds payouts for 48 hours while it is re-verified.
            </p>
            <Link href="/seller/settings?tab=bank" className="mt-3 inline-flex text-[13px] font-medium text-brand-700 hover:underline">
              Manage bank account
            </Link>
          </div>
        </Card>
      </div>

      {failed && (
        <Callout tone="danger" className="mb-6" title={`Payout for ${formatDateShort(failed.periodStart)} to ${formatDateShort(failed.periodEnd)} failed and was retried`} action={<Link href={`/seller/payments/${failed.id}`} className="text-[13px] font-medium text-brand-700 hover:underline">View</Link>}>
          The bank returned the transfer. The lines were released and paid in the next run after your account was re-verified.
        </Callout>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current cycle so far" value={formatCompact(open.netPayout, true)} footer={`${formatDateShort(open.periodStart)} to today, paid ${formatDateShort(open.scheduledFor)}`} />
        <StatCard label="On hold" value={formatCompact(balances.onHold, true)} footer="Returns in progress and claim reviews" />
        <StatCard label="Upcoming deductions" value={formatCompact(upcomingTotal, true)} footer="Ads, storage and deal fees" />
        <StatCard
          label="Paid, last 90 days"
          value={formatCompact(last90.filter((s) => s.status === "paid").reduce((a, s) => a + s.netPayout, 0), true)}
          footer={`${paid.length} payouts, next run ${formatDateShort(nextPayoutRun(NOW))}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Net payout by cycle" description="Completed payout runs, oldest to newest" />
          <div className="px-5 pt-3 pb-5">
            <BarChart data={chart} series={[{ key: "net", label: "Net payout" }]} format="inr" height={240} emphasis={chart.length - 1} ariaLabel="Net payout by weekly cycle" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Upcoming deductions" description="Netted off in coming payouts" />
          <ul className="mt-2 divide-y divide-line">
            {balances.upcoming.map((u) => (
              <li key={u.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink-900">{u.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{u.on}</p>
                </div>
                <Amount value={u.amount} className="shrink-0 text-[13px] font-medium text-ink-900" />
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3.5 text-xs text-ink-500">Rate card {RATE_CARD_VERSION}. Every fee carries 18% GST, invoiced monthly.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent payouts"
          action={
            <Link href="?tab=statements" className="text-[13px] font-medium text-brand-700 hover:underline">
              All statements
            </Link>
          }
        />
        <StatementTable rows={sellerStatements.slice(1, 6)} />
      </Card>
    </>
  );
}

function StatementTable({ rows }: { rows: typeof sellerStatements }) {
  return (
    <TableContainer className="mt-3">
      <Table className="min-w-[900px]">
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Statement</TH>
            <TH>Cycle</TH>
            <TH align="right">Orders</TH>
            <TH align="right">Gross sales</TH>
            <TH align="right">Fees and taxes</TH>
            <TH align="right">Refunds</TH>
            <TH align="right">Net payout</TH>
            <TH>Status</TH>
            <TH>Paid on</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((s) => (
            <TR key={s.id}>
              <TD>
                <Link href={`/seller/payments/${s.id}`} className="text-brand-700 hover:underline">
                  <Mono className="font-medium">{s.id}</Mono>
                </Link>
              </TD>
              <TD className="text-[13px] text-ink-600">
                {formatDateShort(s.periodStart)} to {formatDateShort(s.periodEnd)}
              </TD>
              <TD align="right">{formatNumber(s.orders)}</TD>
              <TD align="right">{formatINR(s.grossSales)}</TD>
              <TD align="right">
                <Amount value={feeTotal(s.fees)} />
              </TD>
              <TD align="right">
                <Amount value={s.refunds} />
              </TD>
              <TD align="right" className="font-semibold text-ink-900">
                {formatINR(s.netPayout)}
              </TD>
              <TD>
                <StatusBadge meta={SETTLEMENT_STATUS[s.status]} size="sm" />
              </TD>
              <TD>
                <p className="text-[13px] text-ink-700">{s.status === "paid" ? formatDate(s.scheduledFor) : s.status === "open" ? "Cycle open" : s.status === "processing" ? `Sent ${formatDateShort(s.scheduledFor)}` : s.status === "failed" ? "Returned by bank" : `Due ${formatDateShort(s.scheduledFor)}`}</p>
                {s.utr && <Mono className="text-[11px] text-ink-500">{s.utr}</Mono>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function Statements() {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Settlement statements" description="Weekly cycles from Monday to Sunday. Each statement lists every sale, fee, tax and adjustment." />
      <StatementTable rows={sellerStatements} />
      <TableFooter shown={sellerStatements.length} total={sellerStatements.length} label="statements" />
    </Card>
  );
}

function Transactions({ q, type, status }: { q: string; type: string; status: string }) {
  const rows = ledger.filter((l) => {
    if (type && l.type !== type) return false;
    if (status && l.status !== status) return false;
    if (q && !`${l.id} ${l.orderId ?? ""} ${l.lineId ?? ""} ${l.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const net = rows.reduce((a, r) => a + r.net, 0);
  return (
    <Card className="overflow-hidden">
      <form method="get" className="flex flex-col gap-2.5 border-b border-line px-5 py-3.5 md:flex-row md:items-center">
        <input type="hidden" name="tab" value="transactions" />
        <Input name="q" defaultValue={q} icon={Search} inputSize="sm" placeholder="Search transaction, order or item" className="w-full md:max-w-xs" aria-label="Search transactions" />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <AutoSubmitSelect name="type" defaultValue={type} selectSize="sm" className="w-52" aria-label="Transaction type">
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="status" defaultValue={status} selectSize="sm" className="w-40" aria-label="Settlement status">
            <option value="">Any status</option>
            {Object.entries(LEDGER_STATUS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </AutoSubmitSelect>
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </div>
        <p className="text-[13px] text-ink-500 md:ml-auto">
          Net of shown: <span className="font-semibold text-ink-900 tabular-nums">{formatINR(net)}</span>
        </p>
      </form>
      <TableContainer>
        <Table className="min-w-[1100px]">
          <THead className="border-t-0">
            <TR className="hover:bg-transparent">
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Reference</TH>
              <TH align="right">Sale</TH>
              <TH align="right">Fees</TH>
              <TH align="right">GST on fees</TH>
              <TH align="right">TCS</TH>
              <TH align="right">TDS</TH>
              <TH align="right">Net</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((l) => (
              <TR key={l.id}>
                <TD className="text-[13px] text-ink-600">{formatDateShort(l.at)}</TD>
                <TD>
                  <p className="text-[13px] font-medium text-ink-900">{l.type}</p>
                  <Mono className="text-[11px] text-ink-500">{l.id}</Mono>
                </TD>
                <TD className="max-w-[16rem]">
                  {l.orderId ? (
                    <Link href={`/seller/orders/${l.orderId}`} className="text-brand-700 hover:underline">
                      <Mono className="text-[12px]">{l.lineId ?? l.orderId}</Mono>
                    </Link>
                  ) : null}
                  <p className="truncate text-xs text-ink-500">{l.description}</p>
                </TD>
                <TD align="right">{l.gross ? <Amount value={l.gross} /> : <span className="text-ink-400">None</span>}</TD>
                <TD align="right">
                  <Amount value={l.fees} plus />
                </TD>
                <TD align="right">
                  <Amount value={l.gstOnFees} plus />
                </TD>
                <TD align="right">
                  <Amount value={l.tcs} plus />
                </TD>
                <TD align="right">
                  <Amount value={l.tds} plus />
                </TD>
                <TD align="right" className="font-semibold text-ink-900">
                  <Amount value={l.net} />
                </TD>
                <TD>
                  <StatusBadge meta={LEDGER_STATUS[l.status]} size="sm" />
                  {l.payoutId && (
                    <Link href={`/seller/payments/${l.payoutId}`} className="mt-0.5 block font-mono text-[11px] text-ink-500 hover:text-brand-700">
                      {l.payoutId}
                    </Link>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-500">No transactions match these filters.</p>}
      <TableFooter shown={rows.length} total={rows.length} label="transactions" />
    </Card>
  );
}

const DOC_GROUPS = [
  { kind: "tcs", title: "TCS certificates", description: "0.5% TCS collected under section 52 of the CGST Act, reported in GSTR-8. Claim it in your electronic cash ledger after it reflects in GSTR-2X." },
  { kind: "tds", title: "TDS certificates, section 194-O", description: "0.1% TDS deducted on your taxable sales. Claim it against your income tax using Form 16A; it appears in Form 26AS." },
  { kind: "fee_invoice", title: "GST invoices for BluBuy fees", description: "Monthly tax invoices for commission, fixed, shipping and fulfilment fees. Claim the input tax credit on the GST." },
  { kind: "credit_note", title: "Credit notes", description: "Fee reversals on returns and cancellations." },
] as const;

function TaxDocs() {
  return (
    <div className="flex flex-col gap-6">
      {DOC_GROUPS.map((g) => {
        const docs = taxDocuments.filter((d) => d.kind === g.kind);
        return (
          <Card key={g.kind}>
            <CardHeader title={g.title} description={g.description} />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <FileText size={17} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">
                      {d.title}, {d.period}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <span className="font-mono">{d.number}</span>
                      {d.issuedOn ? `, issued ${formatDate(d.issuedOn)}` : ", available on the 10th of next month"}
                    </p>
                  </div>
                  <p className="text-[13px] font-medium text-ink-900 tabular-nums sm:w-32 sm:text-right">{d.amount ? formatINR(d.amount) : "Pending"}</p>
                  <div className="sm:w-36 sm:text-right">
                    {d.status === "available" ? (
                      <ToastButton size="sm" variant="secondary" icon="download" message={`${d.title} for ${d.period} downloaded as PDF.`}>
                        Download
                      </ToastButton>
                    ) : (
                      <Badge tone="info" size="sm">
                        Generating
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <p className="text-xs text-ink-500">GSTIN {SELLER.gstin}, PAN {SELLER.pan}. For GST sales reports by state, open Reports.</p>
    </div>
  );
}
