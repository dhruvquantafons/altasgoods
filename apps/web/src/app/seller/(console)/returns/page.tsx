import Link from "next/link";
import { PackageOpen, Search } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { AutoSubmitSelect, ToastButton } from "@/components/seller/client-kit";
import { ReturnDecision } from "@/components/seller/returns/return-actions";
import { Amount, Callout, MiniStat, Mono, SlaText, StatStrip } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { loadSellerLines } from "@/lib/api/seller-orders";
import { loadSellerReturns, rtoRow, toSellerReturnRow, type ReturnTab } from "@/lib/api/seller-returns";
import { currentTime } from "@/lib/api/support";
import { CLAIM_STATUS, GRADES, safeClaims } from "@/lib/mock/seller-extra";
import { formatDate, formatDateShort, formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Returns" };

const TABS: { key: ReturnTab; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "progress", label: "In progress" },
  { key: "done", label: "Closed" },
  { key: "rto", label: "RTO" },
  { key: "claims", label: "SafeClaims" },
];

export default async function ReturnsPage(props: PageProps<"/seller/returns">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab: ReturnTab = TABS.find((t) => t.key === one(sp.tab) || (one(sp.tab) === "transit" && t.key === "progress"))?.key ?? "action";
  const q = one(sp.q).trim().toLowerCase();
  const fault = one(sp.fault);
  const now = currentTime();

  const [returns, { lines }] = await Promise.all([loadSellerReturns(), loadSellerLines()]);
  const all = [...returns.map(toSellerReturnRow), ...lines.filter((l) => l.status === "rto_in_transit" || l.status === "returned_to_seller").map(rtoRow)];
  const filtered = all.filter((r) => {
    if (fault === "seller" && !r.sellerFault) return false;
    if (fault === "customer" && r.sellerFault) return false;
    if (q && !`${r.id} ${r.orderId} ${r.title} ${r.buyer} ${r.reason} ${r.awb}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const rows = filtered.filter((r) => r.tab === tab);
  const openClaims = safeClaims.filter((c) => !["reimbursed", "rejected"].includes(c.status));
  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: `?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${fault ? `&fault=${fault}` : ""}`,
    count: t.key === "claims" ? safeClaims.length : filtered.filter((r) => r.tab === t.key).length,
  }));

  const toReview = returns.filter((r) => r.status === "PENDING_SELLER_REVIEW").length;
  const toGrade = returns.filter((r) => r.status === "RECEIVED").length + all.filter((r) => r.kind === "rto" && r.next.text === "Check the package").length;
  const arriving =
    returns.filter((r) => ["APPROVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKUP_FAILED", "PICKED_UP", "IN_TRANSIT"].includes(r.status)).length +
    all.filter((r) => r.kind === "rto" && r.next.text !== "Check the package").length;

  return (
    <>
      <PageHeader
        title="Returns and claims"
        description="Review out-of-policy requests within 48 hours, grade every return within 48 hours of receipt, and claim through AltasGoods SafeClaim within 14 days when an item comes back damaged, wrong or empty."
        actions={
          <ToastButton icon="download" message="Returns report for the last 90 days is being prepared.">
            Returns report
          </ToastButton>
        }
      />

      <StatStrip className="mb-6">
        <MiniStat label="Requests to review" value={toReview} hint="Out of policy, decide in 48 hours" tone={toReview ? "warning" : undefined} />
        <MiniStat label="Received, to grade" value={toGrade} hint="Grade within 48 hours of receipt" tone={toGrade ? "warning" : undefined} />
        <MiniStat label="Coming back" value={arriving} hint="Returns and RTO in transit" />
        <MiniStat label="Open SafeClaims" value={openClaims.length} hint={`Sample: ${formatINR(openClaims.reduce((a, c) => a + c.claimed, 0))} under review`} />
      </StatStrip>

      <TabLinks items={tabs} active={tab} className="mb-4" />

      {tab === "claims" ? (
        <>
          <Callout tone="info" className="mb-4" title="Sample claims">
            SafeClaim filing goes live with the claims service. These claims show how decisions and reimbursements will appear; failed quality checks on your real returns are reviewed by AltasGoods meanwhile.
          </Callout>
          <Card className="overflow-hidden">
            <TableContainer>
              <Table className="min-w-[920px]">
                <THead className="border-t-0">
                  <TR className="hover:bg-transparent">
                    <TH>Claim</TH>
                    <TH>Product</TH>
                    <TH>Reason</TH>
                    <TH align="right">Claimed</TH>
                    <TH align="right">Approved</TH>
                    <TH>Status</TH>
                    <TH>Note</TH>
                  </TR>
                </THead>
                <TBody>
                  {safeClaims.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Mono className="font-medium text-ink-900">{c.id}</Mono>
                        <p className="mt-0.5 text-xs text-ink-500">Filed {formatDate(c.filedAt)}</p>
                      </TD>
                      <TD>
                        <div className="flex max-w-[16rem] items-center gap-3">
                          <ProductImage src={c.image} alt="" size={36} rounded="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-ink-900">{c.title}</p>
                            <p className="truncate font-mono text-[11px] text-ink-500">{c.returnId}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-[13px]">{GRADES.find((g) => g.key === c.grade)?.label}</TD>
                      <TD align="right">{formatINR(c.claimed)}</TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {c.approved ? formatINR(c.approved) : <span className="font-normal text-ink-400">Pending</span>}
                      </TD>
                      <TD>
                        <StatusBadge meta={CLAIM_STATUS[c.status]} size="sm" />
                        {c.decisionBy && <p className="mt-1 text-xs text-ink-500">Decision by {formatDateShort(c.decisionBy)}</p>}
                      </TD>
                      <TD className="max-w-[18rem] text-xs whitespace-normal text-ink-600">{c.note}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter shown={safeClaims.length} total={safeClaims.length} label="claims" />
          </Card>
        </>
      ) : (
        <Card className="overflow-hidden">
          <form method="get" className="flex flex-col gap-2.5 border-b border-line px-5 py-3.5 md:flex-row md:items-center">
            <input type="hidden" name="tab" value={tab} />
            <Input name="q" defaultValue={one(sp.q)} icon={Search} inputSize="sm" placeholder="Search return, order, product or AWB" className="w-full md:max-w-sm" aria-label="Search returns" />
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <AutoSubmitSelect name="fault" defaultValue={fault} selectSize="sm" aria-label="Return reason type" className="w-52">
                <option value="">All reasons</option>
                <option value="seller">Seller-fault reasons</option>
                <option value="customer">Customer reasons</option>
              </AutoSubmitSelect>
              <Button type="submit" size="sm" variant="secondary">
                Apply
              </Button>
            </div>
          </form>
          {rows.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={tab === "action" ? "You are all caught up" : "Nothing here"}
              description={tab === "action" ? "No requests to review or items to grade." : tab === "rto" ? "No shipments are coming back undelivered." : "No returns match this view."}
            />
          ) : (
            <TableContainer>
              <Table className="min-w-[1000px]">
                <THead className="border-t-0">
                  <TR className="hover:bg-transparent">
                    <TH>Return</TH>
                    <TH>Product</TH>
                    <TH>Reason</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Next step</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <Link href={r.href} className="text-brand-700 hover:underline">
                          <Mono className="font-medium">{r.id}</Mono>
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">{r.kind === "rto" ? `RTO, ordered ${timeAgo(r.requestedAt, now)}` : `Requested ${timeAgo(r.requestedAt, now)}`}</p>
                      </TD>
                      <TD>
                        <div className="flex max-w-[15rem] items-center gap-3">
                          <ProductImage src={r.image} alt="" size={40} rounded="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink-900">{r.title}</p>
                            <p className="mt-0.5 truncate text-xs text-ink-500">
                              {r.buyer},{" "}
                              <Link href={`/seller/orders/${r.orderId}`} className="font-mono hover:text-brand-700 hover:underline">
                                {r.orderId}
                              </Link>
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="max-w-[11rem] truncate text-[13px] text-ink-800">{r.reason}</p>
                        <div className="mt-1 flex gap-1.5">
                          {r.resolution && (
                            <Badge size="sm" tone="neutral">
                              {r.resolution}
                            </Badge>
                          )}
                          {r.canDecide && (
                            <Badge size="sm" tone="warning">
                              Out of policy
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        <Amount value={r.amount} />
                      </TD>
                      <TD>
                        <StatusBadge meta={r.status} size="sm" />
                      </TD>
                      <TD>
                        {r.canDecide ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <ReturnDecision returnId={r.id} size="sm" />
                            {r.next.due && <SlaText dueAt={r.next.due} now={now} className="text-xs" />}
                          </div>
                        ) : (
                          <>
                            <p className="text-[13px] text-ink-800">{r.next.text}</p>
                            {r.next.due && <SlaText dueAt={r.next.due} now={now} className="text-xs" />}
                          </>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
          {rows.length > 0 && <TableFooter shown={rows.length} total={rows.length} label="returns" />}
        </Card>
      )}
    </>
  );
}
