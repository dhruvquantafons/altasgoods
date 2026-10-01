import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { QcCapture, ReturnDecision, SafeClaimForm } from "@/components/seller/returns/return-actions";
import { AmountRows, Callout, ChannelBadge, InfoGrid, Mono, SlaText } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Timeline, type TimelineItem } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { feesForLine } from "@/lib/mock";
import { CLAIM_STATUS, getSellerReturn, GRADES, safeClaims, SELLER, sellerReturns, type SellerReturn } from "@/lib/mock/seller-extra";
import { ORDER_STATUS, RETURN_STATUS, type ReturnStatus } from "@/lib/status";
import { addDays, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export function generateStaticParams() {
  return sellerReturns.map((r) => ({ id: r.id }));
}

export async function generateMetadata(props: PageProps<"/seller/returns/[id]">) {
  const { id } = await props.params;
  return { title: `Return ${id}` };
}

const FLOW: { status: ReturnStatus; title: string }[] = [
  { status: "requested", title: "Return requested by the customer" },
  { status: "approved", title: "Return approved" },
  { status: "pickup_scheduled", title: "Pickup scheduled" },
  { status: "picked_up", title: "Picked up after doorstep QC" },
  { status: "received", title: "Received at your return address" },
  { status: "qc_passed", title: "Quality check recorded" },
  { status: "completed", title: "Refund completed" },
];

const ORDER_INDEX: Partial<Record<ReturnStatus, number>> = { requested: 0, approved: 1, pickup_scheduled: 2, picked_up: 3, received: 4, qc_passed: 5, qc_failed: 5, refund_initiated: 5, completed: 6, rejected: 0, cancelled: 0 };

function timelineFor(r: SellerReturn): TimelineItem[] {
  if (r.kind === "rto") {
    const items: TimelineItem[] = (r.ndr ?? []).map((n, i) => ({ title: `Delivery attempt ${i + 1} failed`, time: formatDateTime(n.at), description: n.reason, tone: "warning" as const }));
    items.push({ title: "Return to origin started", time: formatDateTime(new Date(new Date(r.requestedAt).getTime() + ((r.ndr?.length ?? 3) - 0.5) * 86400_000)), tone: "danger" });
    items.push(r.rtoStatus === "returned_to_seller" ? { title: "Received back at Andheri warehouse", time: r.receivedAt ? formatDateTime(r.receivedAt) : undefined, tone: "neutral" } : { title: "Arriving at your warehouse", time: `By ${formatDate(r.expectedBy!)}`, done: false });
    return items;
  }
  const at = ORDER_INDEX[r.status] ?? 0;
  const plusHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
  const times = [r.requestedAt, plusHours(r.requestedAt, 0.4), plusHours(r.requestedAt, 3.5), r.pickupOn ?? addDays(r.requestedAt, 1).toISOString(), r.receivedAt ?? addDays(r.requestedAt, 4).toISOString(), r.updatedAt, r.updatedAt];
  return FLOW.map((f, i) => {
    const done = i <= at;
    let title = f.title;
    if (i === 5 && r.grade) title = `Quality check: ${GRADES.find((g) => g.key === r.grade)?.label.toLowerCase()}`;
    if (i === 6 && r.status === "refund_initiated") title = "Refund initiated";
    return {
      title,
      time: done ? formatDateTime(times[i]!) : i === 3 && r.pickupOn ? `Planned ${formatDate(r.pickupOn)}` : i === 4 && r.expectedBy ? `Expected ${formatDate(r.expectedBy)}` : undefined,
      done,
      tone: done && i === 5 && r.status === "qc_failed" ? ("danger" as const) : done && i === 6 ? ("success" as const) : undefined,
    };
  });
}

export default async function ReturnDetailPage(props: PageProps<"/seller/returns/[id]">) {
  const { id } = await props.params;
  const r = getSellerReturn(decodeURIComponent(id));
  if (!r) notFound();
  const claim = r.claimId ? safeClaims.find((c) => c.id === r.claimId) : undefined;
  const grade = GRADES.find((g) => g.key === r.grade);
  const needsGrade = (r.status === "received" && !r.grade) || r.rtoStatus === "returned_to_seller";
  const canClaim = Boolean(grade?.claimable && !r.claimId && r.claimBy);
  const fees = r.productId ? feesForLine(r.productId, r.amount, 1, false, SELLER.tier) : [];
  const commission = Math.abs(fees.find((f) => f.label.startsWith("Commission"))?.amount ?? 0);
  const shipping = Math.abs(fees.find((f) => f.label.startsWith("Shipping"))?.amount ?? 0);
  const processingFee = Math.min(50, Math.round(commission * 0.2));
  const statusMeta = r.kind === "rto" && r.rtoStatus ? ORDER_STATUS[r.rtoStatus] : RETURN_STATUS[r.status];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Returns", href: r.kind === "rto" ? "/seller/returns?tab=rto" : "/seller/returns" },
          { label: r.id },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-x-2">
            {r.kind === "rto" ? "Return to origin" : "Return"} <span className="font-mono text-[20px] font-medium tracking-tight sm:text-[22px]">{r.id}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge meta={statusMeta} />
            <ChannelBadge channel={r.channel} size="md" />
            {r.kind === "return" && <Badge tone="neutral">{r.resolution}</Badge>}
            <span className="text-[13px] text-ink-500">Requested {formatDateTime(r.requestedAt)}</span>
          </>
        }
        actions={r.status === "requested" && r.outOfPolicy ? <ReturnDecision returnId={r.id} /> : undefined}
      />

      {r.status === "requested" && r.outOfPolicy && r.reviewBy && (
        <Callout tone="warning" icon={TriangleAlert} className="mb-6" title="This request is outside the return policy">
          Decide by {formatDateTime(r.reviewBy)} (<SlaText dueAt={r.reviewBy} className="text-[13px]" />
          ). If you do not respond, BluBuy decides on your behalf. Rejected customers can file a BluBuy Guarantee claim.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Item" />
            <div className="flex flex-col gap-4 px-5 pt-3 pb-5 sm:flex-row">
              <ProductImage src={r.image} alt={r.title} size={80} rounded="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{r.title}</p>
                <p className="mt-1 text-xs text-ink-500">
                  Order{" "}
                  <Link href={`/seller/orders/${r.orderId}`} className="font-mono text-brand-700 hover:underline">
                    {r.orderId}
                  </Link>
                  , {r.buyer}
                </p>
                <blockquote className="mt-3 rounded-lg border-l-2 border-line-strong bg-ink-50/70 px-3 py-2 text-[13px] text-ink-700">
                  <span className="text-xs text-ink-500">{r.kind === "rto" ? "Reason" : "Customer reason"}</span>
                  <br />
                  {r.reason}
                  {r.sellerFault && <span className="ml-2 text-xs text-warning-700">Counts toward your seller-fault return rate</span>}
                </blockquote>
              </div>
              <p className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(r.amount)}</p>
            </div>
          </Card>

          {needsGrade && <QcCapture grades={GRADES} amount={r.amount} claimDeadline={formatDate(r.claimBy ?? addDays(r.receivedAt ?? r.updatedAt, 14))} />}

          {canClaim && (
            <Card className="border-warning-100">
              <CardHeader title="File a BluBuy SafeClaim" description={`Graded ${grade?.label.toLowerCase()}. Claims close 14 days after receipt, on ${formatDate(r.claimBy!)}.`} />
              <div className="p-5">
                <SafeClaimForm amount={r.amount} gradeLabel={grade!.label} deadline={formatDate(r.claimBy!)} />
              </div>
            </Card>
          )}

          {claim && (
            <Card>
              <CardHeader title={`SafeClaim ${claim.id}`} description={`Filed ${formatDate(claim.filedAt)} for ${formatINR(claim.claimed)}`} action={<StatusBadge meta={CLAIM_STATUS[claim.status]} />} />
              <div className="px-5 pt-3 pb-5">
                <Callout tone={claim.status === "info_requested" ? "warning" : "neutral"} icon={ShieldCheck}>
                  {claim.note}
                </Callout>
                {claim.decisionBy && <p className="mt-3 text-[13px] text-ink-600">Decision due by {formatDate(claim.decisionBy)}.</p>}
              </div>
            </Card>
          )}

          {r.kind === "return" && r.doorstepQc.length > 0 && (
            <Card>
              <CardHeader title="Doorstep quality check" description="Recorded by the pickup associate before collecting the item" />
              <ul className="grid gap-x-6 gap-y-3 px-5 pt-3 pb-5 sm:grid-cols-2">
                {r.doorstepQc.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-[13px]">
                    {c.passed ? <CircleCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <CircleX size={16} className="mt-px shrink-0 text-danger-600" aria-hidden="true" />}
                    <span className={c.passed ? "text-ink-700" : "font-medium text-danger-700"}>
                      {c.label}
                      <span className="sr-only">{c.passed ? ", passed" : ", failed"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline" />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={timelineFor(r)} />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Details" />
            <div className="px-5 pt-3 pb-5">
              <InfoGrid
                columns={1}
                items={[
                  { label: "Reverse AWB", value: <Mono className="text-sm">{r.awb}</Mono> },
                  ...(r.pickupOn && r.kind === "return" ? [{ label: "Pickup", value: formatDate(r.pickupOn) }] : []),
                  { label: r.receivedAt ? "Received" : "Expected by", value: r.receivedAt ? formatDateTime(r.receivedAt) : formatDate(r.expectedBy!) },
                  ...(grade ? [{ label: "Grade", value: grade.label }] : []),
                  ...(r.claimBy ? [{ label: "SafeClaim window closes", value: formatDate(r.claimBy) }] : []),
                  { label: "Return address", value: "Andheri warehouse, returns desk" },
                ]}
              />
            </div>
          </Card>

          {r.kind === "return" && fees.length > 0 && (
            <Card>
              <CardHeader title="Settlement impact" description={r.sellerFault ? "Seller-fault return (defective, wrong, missing or not as described)" : "Customer-remorse return"} />
              <div className="px-5 pt-2 pb-5">
                <AmountRows
                  rows={[
                    { label: "Refund recovered from you", value: -r.amount },
                    { label: r.sellerFault ? "Commission refunded" : "Commission refunded, less processing fee", value: r.sellerFault ? commission : commission - processingFee },
                    { label: "Reverse shipping fee", value: r.sellerFault ? -shipping : -45 },
                    { label: "Fixed fee and forward shipping", value: 0, hint: "Not refunded", muted: true },
                  ]}
                />
                <p className="mt-3 text-xs leading-relaxed text-ink-500">Fee reversals carry 18% GST and TCS is reversed in the month of return. Lines net off in your next payout.</p>
              </div>
            </Card>
          )}

          {r.kind === "rto" && (
            <Callout tone="info" icon={Info} title="RTO charges">
              The customer did not accept delivery, so commission and the fixed fee are not charged. Forward shipping is charged. Grade the package when it arrives; damage in transit can be claimed.
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}
