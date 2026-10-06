import Link from "next/link";
import { CircleCheck, CircleX, Repeat, ShieldCheck, TriangleAlert } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { PickupSimulator, QcCapture, ReturnDecision } from "@/components/seller/returns/return-actions";
import { AmountRows, Callout, InfoGrid, Mono, SlaText } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Timeline, type TimelineItem } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { arrivesByOf, enteredAt, gradeDueOf, loadSellerReturn, reviewDueOf, toSellerReturnRow, valueOf } from "@/lib/api/seller-returns";
import { currentUser } from "@/lib/api/server";
import { currentTime } from "@/lib/api/support";
import type { ApiReturnStatus, ReturnRequest } from "@/lib/api/types";
import { feesForLine } from "@/lib/mock";
import { GRADES, maskName } from "@/lib/mock/seller-extra";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/seller/returns/[id]">) {
  const { id } = await props.params;
  return { title: `Return ${decodeURIComponent(id)}` };
}

const STEP: Partial<Record<ApiReturnStatus, string>> = {
  REQUESTED: "Return requested by the customer",
  PENDING_SELLER_REVIEW: "Outside the return window, sent to you for review",
  APPROVED: "Return approved",
  REJECTED: "Return rejected",
  PICKUP_SCHEDULED: "Pickup scheduled",
  OUT_FOR_PICKUP: "Out for pickup",
  PICKUP_FAILED: "Pickup attempt failed",
  PICKED_UP: "Picked up from the customer",
  IN_TRANSIT: "On the way to you",
  RECEIVED: "Received at your return address",
  QC_PASSED: "Quality check passed",
  QC_FAILED: "Quality check failed",
  COMPLETED: "Return completed",
  CANCELLED: "Cancelled by the customer",
  LOST: "Lost in transit",
};

const ACTOR: Record<string, string> = { CUSTOMER: "Customer", SELLER: "You", SYSTEM: "AltasGoods", LOGISTICS: "AltasGoods Logistics", SUPPORT: "AltasGoods Care", ADMIN: "AltasGoods" };

/** What happened, then the steps still ahead for an open return. */
function timelineFor(r: ReturnRequest): TimelineItem[] {
  const done: TimelineItem[] = r.events.map((e) => ({
    title: STEP[e.toStatus] ?? e.toStatus,
    time: `${formatDateTime(e.at)}, ${ACTOR[e.actor] ?? e.actor}`,
    // the step title already says why a request went to review
    description: e.toStatus === "PENDING_SELLER_REVIEW" ? undefined : (e.note ?? undefined),
    done: true,
    tone: e.toStatus === "QC_FAILED" || e.toStatus === "REJECTED" || e.toStatus === "PICKUP_FAILED" || e.toStatus === "LOST" ? ("danger" as const) : e.toStatus === "COMPLETED" ? ("success" as const) : undefined,
  }));
  const ahead: ApiReturnStatus[] = ["PICKUP_SCHEDULED", "PICKED_UP", "RECEIVED", "QC_PASSED", "COMPLETED"];
  const closed = ["REJECTED", "CANCELLED", "LOST", "COMPLETED", "QC_FAILED"].includes(r.status);
  if (closed) return done;
  const from = ahead.findIndex((s) => !r.events.some((e) => e.toStatus === s || (s === "QC_PASSED" && e.toStatus === "QC_FAILED")));
  const by = arrivesByOf(r);
  return [
    ...done,
    ...(from < 0 ? [] : ahead.slice(from)).map((s) => ({
      title: s === "QC_PASSED" ? "Quality check" : s === "COMPLETED" ? (r.resolution === "REFUND" ? "Refund completed" : "Replacement sent") : STEP[s]!,
      time: s === "PICKED_UP" && r.pickupDate ? `Planned ${formatDate(`${r.pickupDate}T12:00:00+05:30`)}` : s === "RECEIVED" && by ? `Expected ${formatDate(by)}` : undefined,
      done: false,
    })),
  ];
}

export default async function ReturnDetailPage(props: PageProps<"/seller/returns/[id]">) {
  const { id } = await props.params;
  const [r, user] = await Promise.all([loadSellerReturn(decodeURIComponent(id)), currentUser()]);
  const now = currentTime();
  const row = toSellerReturnRow(r);
  const reviewBy = reviewDueOf(r);
  const gradeBy = gradeDueOf(r);
  const receivedAt = enteredAt(r, "RECEIVED");
  const arrivesBy = arrivesByOf(r);
  const tier = (user?.sellers.find((s) => s.id === r.sellerId)?.tier ?? "Bronze") as Parameters<typeof feesForLine>[4] & string;
  const amount = valueOf(r);
  const fees = feesForLine(r.item.productId, r.item.unitPricePaise / 100, r.qty, false, tier);
  const commission = Math.abs(fees.find((f) => f.label.startsWith("Commission"))?.amount ?? 0);
  const shipping = Math.abs(fees.find((f) => f.label.startsWith("Shipping"))?.amount ?? 0);
  const processingFee = Math.min(50, Math.round(commission * 0.2));
  const sellerFault = r.fault === "SELLER";
  const checked = r.events.findLast((e) => e.toStatus === "QC_PASSED" || e.toStatus === "QC_FAILED");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Returns", href: "/seller/returns" }, { label: r.id }]}
        title={
          <span className="flex flex-wrap items-center gap-x-2">
            Return <span className="font-mono text-[20px] font-medium tracking-tight sm:text-[22px]">{r.id}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge meta={row.status} />
            <Badge tone="neutral">{row.resolution}</Badge>
            {r.instantRefund && <Badge tone="info">Instant refund</Badge>}
            <span className="text-[13px] text-ink-500">Requested {formatDateTime(r.createdAt)}</span>
          </>
        }
        actions={row.canDecide ? <ReturnDecision returnId={r.id} /> : undefined}
      />

      {row.canDecide && reviewBy && (
        <Callout tone="warning" icon={TriangleAlert} className="mb-6" title="This request is outside the return policy">
          Decide by {formatDateTime(reviewBy)} (
          <SlaText dueAt={reviewBy} now={now} className="text-[13px]" />
          ). If you do not respond, AltasGoods decides on your behalf. Rejected customers can file an AltasGoods Guarantee claim.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {process.env.NODE_ENV !== "production" && <PickupSimulator returnId={r.id} status={r.status} />}

          <Card>
            <CardHeader title="Item" />
            <div className="flex flex-col gap-4 px-5 pt-3 pb-5 sm:flex-row">
              <ProductImage src={r.item.image} alt={r.item.title} size={80} rounded="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{r.item.title}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {[r.item.variant, `Qty ${r.qty}`].filter(Boolean).join(", ")}. Order{" "}
                  <Link href={`/seller/orders/${r.orderId}`} className="font-mono text-ink-700 hover:text-brand-700 hover:underline">
                    {r.orderId}
                  </Link>
                  , {maskName(r.customerName)}
                </p>
                <blockquote className="mt-3 rounded-lg border-l-2 border-line-strong bg-ink-50/70 px-3 py-2 text-[13px] text-ink-700">
                  <span className="text-xs text-ink-500">Customer reason</span>
                  <br />
                  {r.reasonLabel}
                  {r.comments && <span className="mt-1 block text-ink-600">&ldquo;{r.comments}&rdquo;</span>}
                  {sellerFault && <span className="mt-1 block text-xs text-warning-700">Counts toward your seller-fault return rate</span>}
                </blockquote>
                {r.photos.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-ink-500">Customer photos</p>
                    <ul className="flex flex-wrap gap-2">
                      {r.photos.map((p) => (
                        <li key={p.id}>
                          <a href={`/seller/returns/${r.id}/photos/${p.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-line hover:ring-brand-300">
                            {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the API behind the session */}
                            <img src={`/seller/returns/${r.id}/photos/${p.id}`} alt={p.name} className="size-20 object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(amount)}</p>
            </div>
          </Card>

          {r.status === "RECEIVED" && <QcCapture returnId={r.id} grades={GRADES} dueAt={gradeBy ? formatDateTime(gradeBy) : undefined} />}

          {checked && (
            <Card className={r.status === "QC_FAILED" ? "border-warning-100" : undefined}>
              <CardHeader
                title={checked.toStatus === "QC_PASSED" ? "Quality check passed" : "Quality check failed"}
                description={`Recorded ${formatDateTime(checked.at)}`}
                action={checked.toStatus === "QC_PASSED" ? <CircleCheck size={18} className="text-success-600" aria-label="Passed" /> : <CircleX size={18} className="text-danger-600" aria-label="Failed" />}
              />
              <div className="flex flex-col gap-3 px-5 pt-3 pb-5">
                {r.qcNote && <p className="text-[13px] text-ink-700">{r.qcNote}</p>}
                {r.status === "QC_FAILED" && (
                  <Callout tone="neutral" icon={ShieldCheck}>
                    AltasGoods reviews your check and notes before the customer is refunded. SafeClaim filing for damaged, wrong or empty returns goes live with the claims service.
                  </Callout>
                )}
              </div>
            </Card>
          )}

          {r.status === "REJECTED" && r.sellerNote && (
            <Callout tone="neutral" icon={CircleX} title="Rejected">
              {r.sellerNote}
            </Callout>
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
                  { label: "Reverse AWB", value: r.awb ? <Mono className="text-sm">{r.awb}</Mono> : "Assigned when the pickup is booked" },
                  ...(r.pickupDate ? [{ label: "Pickup", value: `${formatDate(`${r.pickupDate}T12:00:00+05:30`)}${r.pickupSlot ? `, ${r.pickupSlot}` : ""}` }] : []),
                  { label: "Pickup from", value: `${r.address.city} ${r.address.pincode}` },
                  ...(receivedAt ? [{ label: "Received", value: formatDateTime(receivedAt) }] : arrivesBy && !["REJECTED", "CANCELLED"].includes(r.status) ? [{ label: "Expected by", value: formatDate(arrivesBy) }] : []),
                  ...(r.resolution === "REFUND"
                    ? [{ label: "Refund to the customer", value: `${formatINR(amount)}${r.refundStatus ? `, ${r.refundStatus.toLowerCase()}` : r.instantRefund ? ", at pickup" : ", after your check"}` }]
                    : [{ label: "Resolution", value: r.resolution === "EXCHANGE" && r.exchangeSize ? `Exchange for size ${r.exchangeSize}` : row.resolution }]),
                  { label: "Return address", value: "Your registered pickup address" },
                ]}
              />
            </div>
          </Card>

          {r.resolution !== "REFUND" && (
            <Callout tone="info" icon={Repeat} title={r.resolution === "EXCHANGE" ? "Exchange" : "Replacement"}>
              No refund is recovered from you. When the item passes your check, the {r.exchangeSize ? `size ${r.exchangeSize} ` : ""}replacement is marked as dispatched to the customer. Replacement units start shipping through your order queue with the logistics integration.
            </Callout>
          )}

          {r.resolution === "REFUND" && fees.length > 0 && (
            <Card>
              <CardHeader title="Settlement impact" description={sellerFault ? "Seller-fault return (defective, wrong, missing or not as described)" : "Customer-remorse return"} />
              <div className="px-5 pt-2 pb-5">
                <AmountRows
                  rows={[
                    { label: "Refund recovered from you", value: -amount },
                    { label: sellerFault ? "Commission refunded" : "Commission refunded, less processing fee", value: sellerFault ? commission : commission - processingFee },
                    { label: "Reverse shipping fee", value: sellerFault ? -shipping : -45 },
                    { label: "Fixed fee and forward shipping", value: 0, hint: "Not refunded", muted: true },
                  ]}
                />
                <p className="mt-3 text-xs leading-relaxed text-ink-500">
                  An estimate from your {tier} rate card. Fee reversals carry 18% GST and TCS is reversed in the month of return. Lines net off in your next payout.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
