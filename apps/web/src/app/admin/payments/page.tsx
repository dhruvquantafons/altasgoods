import Link from "next/link";
import { CircleX, IndianRupee, ReceiptIndianRupee, Wallet } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { loadPayments, loadRefunds } from "@/lib/api/admin-system";
import { paise, uiPaymentMethod, uiPaymentStatus } from "@/lib/api/format";
import { PAYMENT_METHOD, PAYMENT_STATUS, type Tone } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Payments" };

const PAGE_SIZE = 25;
const PAYMENT_STATUSES = ["CAPTURED", "FAILED", "PENDING", "CREATED", "EXPIRED", "PARTIALLY_REFUNDED", "REFUNDED", "COD_PENDING", "COD_COLLECTED"] as const;
const METHODS = ["UPI", "CARD", "NETBANKING", "EMI", "PAY_LATER", "COD"] as const;
const REFUND_TONE: Record<string, Tone> = { PENDING: "warning", PROCESSING: "info", COMPLETED: "success", FAILED: "danger" };
const PROVIDER: Record<string, string> = { RAZORPAY: "Razorpay", SANDBOX: "Sandbox (test)", COD: "Cash on delivery" };
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export default async function PaymentsPage(props: PageProps<"/admin/payments">) {
  const params = await props.searchParams;
  const tab = sp(params, "tab") === "refunds" ? "refunds" : "payments";
  const q = sp(params, "q")?.trim() ?? "";
  const status = sp(params, "status") ?? "all";
  const method = sp(params, "method") ?? "all";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);
  const query = { q: q || undefined, page, pageSize: PAGE_SIZE };

  const [pays, refunds] = await Promise.all([
    loadPayments({ ...query, ...(tab === "payments" ? { status: status === "all" ? undefined : (status as never), method: method === "all" ? undefined : (method as never) } : { q: undefined, page: 1, pageSize: 1 }) }),
    tab === "refunds" ? loadRefunds({ ...query, status: status === "all" ? undefined : (status as never) }) : null,
  ]);
  const list = tab === "refunds" ? refunds! : pays;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const from = list.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const current = { tab: tab === "refunds" ? "refunds" : undefined, q: q || undefined, status: status === "all" ? undefined : status, method: method === "all" ? undefined : method };
  const s = pays.summary;

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt and refund, with the gateway's reference. Refunds go back to the way the customer paid." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:gap-4">
        <StatCard label="Captured today" value={paise(s.capturedTodayPaise)} icon={IndianRupee} footer={`${s.capturedTodayCount} payment${s.capturedTodayCount === 1 ? "" : "s"} since midnight`} />
        <StatCard label="Failed, last 24 hours" value={s.failedLast24h} icon={CircleX} footer="Customers can retry from their order" href="/admin/payments?status=FAILED" />
        <StatCard label="Refunds in progress" value={paise(s.refundsPendingPaise)} icon={ReceiptIndianRupee} footer={`${s.refundsPendingCount} refund${s.refundsPendingCount === 1 ? "" : "s"}`} href="/admin/payments?tab=refunds&status=PENDING" className="col-span-2 md:col-span-1" />
      </div>

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "payments", label: "Payments", href: "/admin/payments" },
          { key: "refunds", label: "Refunds", href: "/admin/payments?tab=refunds" },
        ]}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/payments"
            q={q}
            placeholder={tab === "refunds" ? "Order ID or customer email" : "Order ID, gateway reference or customer email"}
            keep={{ tab: current.tab }}
            selects={
              tab === "refunds"
                ? [{ name: "status", label: "Status", value: status, className: "sm:w-44", options: [{ value: "all", label: "All statuses" }, ...["PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((v) => ({ value: v, label: words(v) }))] }]
                : [
                    { name: "status", label: "Status", value: status, className: "sm:w-48", options: [{ value: "all", label: "All statuses" }, ...PAYMENT_STATUSES.map((v) => ({ value: v, label: PAYMENT_STATUS[uiPaymentStatus(v)].label }))] },
                    { name: "method", label: "Method", value: method, className: "sm:w-40", options: [{ value: "all", label: "All methods" }, ...METHODS.map((v) => ({ value: v, label: PAYMENT_METHOD[uiPaymentMethod(v)] }))] },
                  ]
            }
          />
        </div>

        {tab === "payments" ? (
          pays.items.length === 0 ? (
            <EmptyState icon={Wallet} title={q || current.status || current.method ? "No payments match" : "No payments yet"} description="Payments appear here as customers check out." />
          ) : (
            <TableContainer>
              <Table>
                <THead className="border-t-0">
                  <TR>
                    <TH>When</TH>
                    <TH>Order and customer</TH>
                    <TH>Method</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH className="hidden xl:table-cell">Gateway reference</TH>
                  </TR>
                </THead>
                <TBody>
                  {pays.items.map((p) => (
                    <TR key={p.id}>
                      <TD className="text-[13px] whitespace-nowrap text-ink-600">{formatDateTime(p.createdAt)}</TD>
                      <TD>
                        <Link href={`/admin/orders/${p.orderId}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {p.orderId}
                        </Link>
                        <p className="truncate text-xs text-ink-500">{p.customer.name ?? p.customer.email}</p>
                      </TD>
                      <TD>
                        <p className="text-[13px] text-ink-800">{PAYMENT_METHOD[uiPaymentMethod(p.method)]}</p>
                        <p className="text-xs text-ink-500">{PROVIDER[p.provider] ?? p.provider}</p>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {paise(p.amountPaise)}
                      </TD>
                      <TD>
                        <StatusBadge meta={PAYMENT_STATUS[uiPaymentStatus(p.status)]} size="sm" />
                        {p.failureReason && <p className="mt-1 max-w-48 truncate text-xs text-danger-600" title={p.failureReason}>{p.failureReason}</p>}
                      </TD>
                      <TD className="hidden xl:table-cell">{p.providerRef ? <span className="font-mono text-xs text-ink-600">{p.providerRef}</span> : <span className="text-xs text-ink-400">-</span>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )
        ) : refunds!.items.length === 0 ? (
          <EmptyState icon={ReceiptIndianRupee} title={q || current.status ? "No refunds match" : "No refunds yet"} description="Refunds appear here when orders are cancelled, returns pass their check, or the Care Desk refunds a customer." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Started</TH>
                  <TH>Order and customer</TH>
                  <TH>Reason</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                  <TH className="hidden xl:table-cell">Back to</TH>
                </TR>
              </THead>
              <TBody>
                {refunds!.items.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-[13px] whitespace-nowrap text-ink-600">{formatDateTime(r.createdAt)}</TD>
                    <TD>
                      <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {r.orderId}
                      </Link>
                      <p className="truncate text-xs text-ink-500">{r.customer.name ?? r.customer.email}</p>
                    </TD>
                    <TD className="max-w-64 text-[13px] whitespace-normal text-ink-700">{r.reason}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {paise(r.amountPaise)}
                    </TD>
                    <TD>
                      <Badge tone={REFUND_TONE[r.status] ?? "neutral"} size="sm" dot>
                        {words(r.status)}
                      </Badge>
                      {r.completedAt && <p className="mt-1 text-xs text-ink-500">{formatDateTime(r.completedAt)}</p>}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-700 xl:table-cell">
                      {PAYMENT_METHOD[uiPaymentMethod(r.method)]}, {PROVIDER[r.provider] ?? r.provider}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/payments" params={current} label={tab === "refunds" ? "refunds" : "payments"} page={page} pages={pages} from={from} to={Math.min(page * PAGE_SIZE, list.total)} total={list.total} />
      </Card>
    </>
  );
}
