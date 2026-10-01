import Link from "next/link";
import { PackageOpen, Search } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { AutoSubmitSelect, ToastButton } from "@/components/seller/client-kit";
import { ReturnDecision } from "@/components/seller/returns/return-actions";
import { Amount, MiniStat, Mono, SlaText, StatStrip } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { CLAIM_STATUS, GRADES, safeClaims, sellerReturns, type SellerReturn } from "@/lib/mock/seller-extra";
import { ORDER_STATUS, RETURN_STATUS } from "@/lib/status";
import { addDays, formatDate, formatDateShort, formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Returns" };

const TABS = [
  { key: "action", label: "Needs action" },
  { key: "transit", label: "Coming back" },
  { key: "done", label: "Closed" },
  { key: "rto", label: "RTO" },
  { key: "claims", label: "SafeClaims" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabOf(r: SellerReturn): TabKey {
  if (r.kind === "rto") return "rto";
  if ((r.status === "requested" && r.outOfPolicy) || (r.status === "received" && !r.grade)) return "action";
  if (r.status === "qc_failed" && r.claimBy && !r.claimId) return "action";
  if (["requested", "approved", "pickup_scheduled", "picked_up"].includes(r.status)) return "transit";
  return "done";
}

function nextStep(r: SellerReturn) {
  if (r.kind === "rto") return r.rtoStatus === "returned_to_seller" ? { text: "Check and grade the package", due: r.receivedAt ? addDays(r.receivedAt, 2).toISOString() : undefined } : { text: `Arrives by ${formatDateShort(r.expectedBy!)}` };
  if (r.status === "requested" && r.outOfPolicy) return { text: "Approve or reject", due: r.reviewBy };
  if (r.status === "requested") return { text: "Auto-approved, within policy" };
  if (r.status === "received" && !r.grade) return { text: "Grade the item", due: r.receivedAt ? addDays(r.receivedAt, 2).toISOString() : undefined };
  if (r.status === "qc_failed" && !r.claimId && r.claimBy) return { text: "File a SafeClaim", due: r.claimBy };
  if (r.claimId) return { text: `SafeClaim ${r.claimId}` };
  if (["approved", "pickup_scheduled"].includes(r.status)) return { text: `Pickup ${formatDateShort(r.pickupOn!)}` };
  if (r.status === "picked_up") return { text: `Arrives by ${formatDateShort(r.expectedBy!)}` };
  return { text: "No action needed" };
}

export default async function ReturnsPage(props: PageProps<"/seller/returns">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab: TabKey = TABS.find((t) => t.key === one(sp.tab))?.key ?? "action";
  const q = one(sp.q).trim().toLowerCase();
  const fault = one(sp.fault);

  const filtered = sellerReturns.filter((r) => {
    if (fault === "seller" && !r.sellerFault) return false;
    if (fault === "customer" && r.sellerFault) return false;
    if (q && !`${r.id} ${r.orderId} ${r.title} ${r.buyer} ${r.reason} ${r.awb}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const rows = filtered.filter((r) => tabOf(r) === tab);
  const openClaims = safeClaims.filter((c) => !["reimbursed", "rejected"].includes(c.status));
  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: `?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${fault ? `&fault=${fault}` : ""}`,
    count: t.key === "claims" ? safeClaims.length : filtered.filter((r) => tabOf(r) === t.key).length,
  }));

  const toReview = sellerReturns.filter((r) => r.status === "requested" && r.outOfPolicy).length;
  const toGrade = sellerReturns.filter((r) => (r.status === "received" && !r.grade) || r.rtoStatus === "returned_to_seller").length;
  const arriving = sellerReturns.filter((r) => ["pickup_scheduled", "picked_up", "approved"].includes(r.status) || r.rtoStatus === "rto_in_transit").length;

  return (
    <>
      <PageHeader
        title="Returns and claims"
        description="Review out-of-policy requests within 48 hours, grade every return within 48 hours of receipt, and claim through BluBuy SafeClaim within 14 days when an item comes back damaged, wrong or empty."
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
        <MiniStat label="Open SafeClaims" value={openClaims.length} hint={`${formatINR(openClaims.reduce((a, c) => a + c.claimed, 0))} under review`} />
      </StatStrip>

      <TabLinks items={tabs} active={tab} className="mb-4" />

      {tab === "claims" ? (
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
            <EmptyState icon={PackageOpen} title={tab === "action" ? "You are all caught up" : "Nothing here"} description={tab === "action" ? "No requests to review, items to grade or claims to file." : "No returns match this view."} />
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
                  {rows.map((r) => {
                    const ns = nextStep(r);
                    return (
                      <TR key={r.id}>
                        <TD>
                          <Link href={`/seller/returns/${r.id}`} className="text-brand-700 hover:underline">
                            <Mono className="font-medium">{r.id}</Mono>
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-500">{r.kind === "rto" ? `RTO, ${timeAgo(r.requestedAt)}` : `Requested ${timeAgo(r.requestedAt)}`}</p>
                        </TD>
                        <TD>
                          <div className="flex max-w-[17rem] items-center gap-3">
                            <ProductImage src={r.image} alt="" size={40} rounded="md" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-ink-900">{r.title}</p>
                              <p className="mt-0.5 truncate text-xs text-ink-500">
                                {r.buyer}, <span className="font-mono">{r.orderId}</span>
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <p className="max-w-[13rem] truncate text-[13px] text-ink-800">{r.reason}</p>
                          <div className="mt-1 flex gap-1.5">
                            {r.kind === "return" && (
                              <Badge size="sm" tone="neutral">
                                {r.resolution}
                              </Badge>
                            )}
                            {r.outOfPolicy && r.status === "requested" && (
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
                          {r.kind === "rto" && r.rtoStatus ? <StatusBadge meta={ORDER_STATUS[r.rtoStatus]} size="sm" /> : <StatusBadge meta={RETURN_STATUS[r.status]} size="sm" />}
                          {r.grade && <p className="mt-1 text-xs text-ink-500">{GRADES.find((g) => g.key === r.grade)?.label}</p>}
                        </TD>
                        <TD>
                          {r.status === "requested" && r.outOfPolicy ? (
                            <div className="flex flex-col items-start gap-1.5">
                              <ReturnDecision returnId={r.id} size="sm" />
                              {ns.due && <SlaText dueAt={ns.due} className="text-xs" />}
                            </div>
                          ) : (
                            <>
                              <p className="text-[13px] text-ink-800">{ns.text}</p>
                              {ns.due && <SlaText dueAt={ns.due} className="text-xs" />}
                            </>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
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
