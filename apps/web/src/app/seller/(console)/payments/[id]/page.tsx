import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, Info } from "lucide-react";
import { StackedBar } from "@/components/charts/static";
import { ToastButton } from "@/components/seller/client-kit";
import { Amount, AmountRows, Callout, InfoGrid, Mono } from "@/components/seller/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Timeline, type TimelineItem } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RATE_CARD_VERSION } from "@/lib/mock";
import { BANK_ACCOUNT, SELLER, sellerStatements, statementTransactions } from "@/lib/mock/seller-extra";
import { SETTLEMENT_STATUS } from "@/lib/status";
import { addDays, formatDate, formatDateShort, formatDateTime, formatINR, formatNumber } from "@/lib/utils";

export function generateStaticParams() {
  return sellerStatements.map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/seller/payments/[id]">) {
  const { id } = await props.params;
  return { title: `Statement ${id}` };
}

export default async function StatementPage(props: PageProps<"/seller/payments/[id]">) {
  const { id } = await props.params;
  const s = sellerStatements.find((x) => x.id === id);
  if (!s) notFound();

  const amt = (prefix: string) => s.fees.filter((f) => f.label.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
  const commission = amt("Commission");
  const fixed = amt("Fixed");
  const shipping = amt("Shipping");
  const gst = amt("GST");
  const tcs = amt("TCS");
  const tds = amt("TDS");
  const fees = commission + fixed + shipping;
  const tx = statementTransactions(s, 10);
  const taxable = Math.round(s.grossSales / 1.18);

  const steps: TimelineItem[] = [
    { title: "Cycle closed", time: formatDateTime(addDays(s.periodEnd, 1)), done: s.status !== "open" },
    { title: "Payout calculated and approved", time: formatDateTime(addDays(s.periodEnd, 3)), done: !["open", "scheduled"].includes(s.status) },
    { title: s.status === "failed" ? "Transfer returned by the bank" : "Sent to your bank", time: formatDateTime(addDays(s.scheduledFor, -1)), done: ["processing", "paid", "failed"].includes(s.status), tone: s.status === "failed" ? "danger" : undefined },
    { title: "Credited", time: s.status === "paid" ? formatDateTime(s.scheduledFor) : `Expected ${formatDate(s.scheduledFor)}`, done: s.status === "paid", tone: s.status === "paid" ? "success" : undefined, description: s.utr ? `UTR ${s.utr}` : undefined },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Payments", href: "/seller/payments" },
          { label: "Statements", href: "/seller/payments?tab=statements" },
          { label: s.id },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-x-2">
            Statement <span className="font-mono text-[20px] font-medium tracking-tight sm:text-[22px]">{s.id}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge meta={SETTLEMENT_STATUS[s.status]} />
            <span className="text-[13px] text-ink-500">
              Cycle {formatDateShort(s.periodStart)} to {formatDate(s.periodEnd)}, {formatNumber(s.orders)} orders
            </span>
          </>
        }
        actions={
          <>
            <ToastButton icon="download" message={`${s.id} downloaded as CSV with every transaction line.`}>
              CSV
            </ToastButton>
            <ToastButton variant="primary" icon="file" message={`${s.id} downloaded as PDF.`}>
              Download PDF
            </ToastButton>
          </>
        }
      />

      {s.status === "failed" && (
        <Callout tone="danger" icon={CircleAlert} className="mb-6" title="This payout failed">
          The bank rejected the transfer to {BANK_ACCOUNT.bank} ending {BANK_ACCOUNT.last4}. The lines went back to eligible and were paid in the next run after the account was re-verified.
        </Callout>
      )}
      {s.status === "open" && (
        <Callout tone="info" icon={Info} className="mb-6" title="This cycle is still open">
          Figures update as orders are delivered and pass the {SELLER.tier} hold period. The statement is final when the cycle closes on {formatDate(s.periodEnd)}.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Summary" description={`Rate card ${RATE_CARD_VERSION}. Deductions are shown with a minus sign.`} />
            <div className="grid gap-8 px-5 pt-3 pb-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-ink-500">Sales</p>
                <AmountRows
                  className="mt-1"
                  rows={[
                    { label: "Gross sales", value: s.grossSales, hint: `${formatNumber(s.orders)} orders` },
                    { label: "Refunds to customers", value: s.refunds },
                  ]}
                />
                <p className="mt-5 text-xs font-medium text-ink-500">AltasGoods fees</p>
                <AmountRows
                  className="mt-1"
                  rows={[
                    { label: "Commission", value: commission },
                    { label: "Fixed fee", value: fixed },
                    { label: "Shipping fee", value: shipping },
                    { label: "GST on fees (18%)", value: gst },
                  ]}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-ink-500">Taxes withheld for the government</p>
                <AmountRows
                  className="mt-1"
                  rows={[
                    { label: "TCS (0.5%)", value: tcs, hint: "GSTR-8" },
                    { label: "TDS u/s 194-O (0.1%)", value: tds, hint: "Form 16A" },
                  ]}
                />
                <AmountRows
                  className="mt-5"
                  rows={[
                    { label: "Total fees and GST", value: fees + gst, muted: true },
                    { label: "Total taxes withheld", value: tcs + tds, muted: true },
                  ]}
                  total={{ label: s.status === "paid" ? "Net payout" : "Net payout due", value: s.netPayout, hint: `${Math.round((s.netPayout / s.grossSales) * 1000) / 10}% of gross sales` }}
                />
              </div>
            </div>
            <div className="border-t border-line px-5 py-4">
              <p className="mb-3 text-xs font-medium text-ink-500">Where gross sales went</p>
              <StackedBar
                segments={[
                  { label: "Your net payout", value: s.netPayout },
                  { label: "Fees and GST", value: Math.abs(fees + gst) },
                  { label: "Refunds", value: Math.abs(s.refunds) },
                  { label: "TCS and TDS", value: Math.abs(tcs + tds) },
                ]}
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Transactions in this statement" description={`Showing 10 of ${formatNumber(s.orders)}. Download the CSV for every line.`} />
            <TableContainer className="mt-3">
              <Table className="min-w-[640px]">
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Order item</TH>
                    <TH>Delivered</TH>
                    <TH align="right">Sale</TH>
                    <TH align="right">Fees and GST</TH>
                    <TH align="right">TCS and TDS</TH>
                    <TH align="right">Net</TH>
                  </TR>
                </THead>
                <TBody>
                  {tx.map((t) => (
                    <TR key={t.id}>
                      <TD>
                        {/* sample settlement: order ids are not real orders, so they are shown, not linked */}
                        <Mono className="text-[12px] font-medium text-ink-800">{t.lineId}</Mono>
                        <p className="max-w-[13rem] truncate text-xs text-ink-500">{t.description}</p>
                      </TD>
                      <TD className="text-[13px] text-ink-600">{formatDateShort(t.at)}</TD>
                      <TD align="right">{formatINR(t.gross)}</TD>
                      <TD align="right">
                        <Amount value={t.fees + t.gstOnFees} />
                      </TD>
                      <TD align="right">
                        <Amount value={t.tcs + t.tds} />
                      </TD>
                      <TD align="right" className="font-semibold text-ink-900">
                        {formatINR(t.net)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Payout" />
            <div className="px-5 pt-3 pb-5">
              <InfoGrid
                columns={1}
                items={[
                  { label: "Bank account", value: `${BANK_ACCOUNT.bank}, XXXX ${BANK_ACCOUNT.last4}` },
                  { label: s.status === "paid" ? "Paid on" : "Scheduled for", value: formatDate(s.scheduledFor) },
                  { label: "UTR", value: s.utr ? <Mono className="text-sm">{s.utr}</Mono> : <span className="text-ink-500">Issued when the bank confirms the transfer</span> },
                ]}
              />
              <div className="mt-5 border-t border-line pt-5">
                <Timeline items={steps} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tax on this statement" />
            <div className="px-5 pt-3 pb-5 text-[13px] leading-relaxed text-ink-600">
              <p>
                Taxable value {formatINR(taxable)} (gross sales excluding 18% GST). TCS of {formatINR(Math.abs(tcs))} is deposited against GSTIN <Mono>{SELLER.gstin}</Mono> and shows in GSTR-2X; TDS
                of {formatINR(Math.abs(tds))} is deposited against PAN <Mono>{SELLER.pan}</Mono> and shows in Form 26AS.
              </p>
              <Link href="/seller/payments?tab=tax" className="mt-3 inline-flex font-medium text-brand-700 hover:underline">
                Tax documents
              </Link>
            </div>
          </Card>

          <Card>
            <div className="p-5">
              <p className="text-sm font-semibold text-ink-900">Something does not add up?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-600">Raise a discrepancy within 15 days of the payout. Include the order item and the fee line you are disputing.</p>
              <Link href="/seller/support" className="mt-3 inline-flex text-[13px] font-medium text-brand-700 hover:underline">
                Open a payments case
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
