import Link from "next/link";
import { Check, CircleDashed, Minus, PackageOpen, ShieldCheck, Truck, Undo2, X } from "lucide-react";
import { REVERSE_STATUS, RTO_STATUS } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { formatDayTime, MetricTile, Mono, Note, one } from "@/components/logistics/ops-ui";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { associates, getHub, sellerName } from "@/lib/mock";
import { reversePickups, rtoShipments, type QcCheck } from "@/lib/mock/ops-extra";
import { NDR_REASON, type NdrReason } from "@/lib/status";
import { cn, formatINR, sum } from "@/lib/utils";

export const metadata = { title: "Reverse and RTO" };

const qcIcon: Record<QcCheck["result"], { icon: typeof Check; cls: string; word: string }> = {
  pass: { icon: Check, cls: "bg-success-50 text-success-700 ring-success-100", word: "passed" },
  fail: { icon: X, cls: "bg-danger-50 text-danger-700 ring-danger-100", word: "failed" },
  na: { icon: Minus, cls: "bg-ink-100 text-ink-500 ring-ink-200", word: "not applicable" },
  pending: { icon: CircleDashed, cls: "bg-white text-ink-400 ring-line-strong", word: "pending" },
};

function rtoReason(r: NdrReason | "damaged" | "cancelled_in_transit") {
  if (r === "damaged") return "Damaged in network";
  if (r === "cancelled_in_transit") return "Cancelled in transit";
  return NDR_REASON[r];
}

export default async function ReversePage(props: PageProps<"/logistics/reverse">) {
  const sp = await props.searchParams;
  const tab = one(sp.tab) === "rto" ? "rto" : "pickups";

  const picked = reversePickups.filter((p) => p.status === "picked_up");
  const out = reversePickups.filter((p) => p.status === "out_for_pickup");
  const failed = reversePickups.filter((p) => p.status === "qc_failed" || p.status === "customer_unavailable");
  const atPickup = picked.filter((p) => p.refundAtPickup);

  return (
    <>
      <PageHeader
        title="Reverse and RTO"
        description="Customer return pickups with doorstep quality check, and shipments returning to sellers and fulfilment centres."
        actions={
          tab === "pickups" ? (
            <ToastButton label="Assign pickups" icon="user" variant="primary" message="4 scheduled pickups added to wave 2 runsheets by beat" size="md" />
          ) : (
            <ToastButton label="Close RTO bags" icon="check" variant="primary" message="2 RTO bags sealed and manifested on the return lanes" size="md" />
          )
        }
      />

      <TabLinks
        className="mb-6"
        active={tab}
        items={[
          { key: "pickups", label: "Return pickups", href: "/logistics/reverse", count: reversePickups.length },
          { key: "rto", label: "RTO to sellers", href: "/logistics/reverse?tab=rto", count: rtoShipments.filter((r) => r.status !== "rto_delivered").length },
        ]}
      />

      {tab === "pickups" ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricTile label="Pickups today" value={reversePickups.length} hint={`${reversePickups.filter((p) => p.status === "scheduled").length} not yet on a runsheet`} icon={PackageOpen} />
            <MetricTile label="Picked up" value={picked.length} tone="success" hint={`${out.length} associates on the way`} icon={Truck} />
            <MetricTile label="Refunded at pickup" value={formatINR(sum(atPickup, (p) => p.value))} hint={`${atPickup.length} return${atPickup.length === 1 ? "" : "s"} under ₹5,000 with QC passed`} icon={ShieldCheck} />
            <MetricTile label="Failed pickups" value={failed.length} tone={failed.length ? "warning" : "neutral"} hint="QC failed or customer unavailable" icon={Undo2} />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="min-w-0">
              <CardHeader title="Return pickups" description="Doorstep QC runs in BluBuy Rider before the item is accepted" />
              <TableContainer className="mt-3">
                <Table>
                  <THead>
                    <TR>
                      <TH>Return</TH>
                      <TH>Product and reason</TH>
                      <TH>Customer</TH>
                      <TH>Doorstep QC</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {reversePickups.map((p) => {
                      const passed = p.checks.filter((c) => c.result === "pass").length;
                      const applicable = p.checks.filter((c) => c.result !== "na").length;
                      return (
                        <TR key={p.id}>
                          <TD>
                            <Mono className="font-medium text-ink-900">{p.id}</Mono>
                            <p className="font-mono text-[11px] text-ink-500">{p.returnId}</p>
                          </TD>
                          <TD>
                            <div className="flex max-w-64 items-center gap-3">
                              <ProductImage src={p.image} alt="" size={40} rounded="md" />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-ink-900">{p.productTitle}</p>
                                <p className="truncate text-xs text-ink-500">
                                  {p.reason}, {formatINR(p.value)}
                                </p>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <p className="text-[13px] text-ink-900">{p.customer}</p>
                            <p className="text-xs text-ink-500">
                              {p.beat.locality}, {p.slot}
                            </p>
                          </TD>
                          <TD>
                            <div className="flex items-center gap-1" role="img" aria-label={p.checks.map((c) => `${c.label} ${qcIcon[c.result].word}`).join(", ")}>
                              {p.checks.map((c) => {
                                const q = qcIcon[c.result];
                                const Icon = q.icon;
                                return (
                                  <span key={c.key} title={`${c.label}: ${q.word}`} className={cn("flex size-5 items-center justify-center rounded-full ring-1 ring-inset", q.cls)}>
                                    <Icon size={11} strokeWidth={2.6} aria-hidden="true" />
                                  </span>
                                );
                              })}
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              {p.status === "picked_up" ? `${passed} of ${applicable} passed` : p.status === "qc_failed" ? "Failed at doorstep" : "Runs at pickup"}
                            </p>
                          </TD>
                          <TD>
                            <StatusBadge meta={REVERSE_STATUS[p.status]} size="sm" />
                            <p className="mt-1 text-xs text-ink-500">{associates.find((a) => a.id === p.associateId)?.name ?? "Not assigned"}</p>
                            <p className="text-xs text-ink-500">Refund {p.refundAtPickup ? "at pickup" : "after FC QC"}</p>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableContainer>
            </Card>

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="md:row-span-3">
                <CardHeader title="Doorstep QC checklist" description="Every item must pass before the associate accepts it" />
                <ol className="flex flex-col gap-3 px-5 pt-4 pb-5 text-[13px] text-ink-700">
                  {reversePickups[0]!.checks.map((c, i) => (
                    <li key={c.key} className="flex gap-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">{i + 1}</span>
                      {c.label}
                    </li>
                  ))}
                </ol>
                <div className="border-t border-line px-5 py-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-600">
                    {(Object.keys(qcIcon) as QcCheck["result"][]).map((k) => {
                      const Icon = qcIcon[k].icon;
                      return (
                        <span key={k} className="inline-flex items-center gap-1.5">
                          <span className={cn("flex size-4 items-center justify-center rounded-full ring-1 ring-inset", qcIcon[k].cls)}>
                            <Icon size={9} strokeWidth={2.8} aria-hidden="true" />
                          </span>
                          {qcIcon[k].word[0]!.toUpperCase() + qcIcon[k].word.slice(1)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </Card>
              <Note tone="info">
                Refund at pickup applies when QC passes, the item is worth up to ₹5,000, the customer risk score is low and the category is not mobiles, laptops or jewellery.
              </Note>
              {failed.map((p) => (
                <Note key={p.id} tone="warning">
                  <span className="font-mono font-medium">{p.id}</span>: {p.note}
                </Note>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricTile label="Waiting to bag" value={rtoShipments.filter((r) => r.status === "rto_initiated").length} tone="warning" hint="Bag before the 6:00 pm return lanes" icon={PackageOpen} />
            <MetricTile label="Bagged" value={rtoShipments.filter((r) => r.status === "bagged").length} hint="Sealed on return manifests" icon={ShieldCheck} />
            <MetricTile label="In transit to origin" value={rtoShipments.filter((r) => r.status === "rto_in_transit").length} hint="On line haul back to FC or seller" icon={Truck} />
            <MetricTile label="Returned, last 7 days" value={rtoShipments.filter((r) => r.status === "rto_delivered").length} hint={`${formatINR(sum(rtoShipments, (r) => r.value))} value in the RTO flow`} icon={Undo2} />
          </div>
          <Card>
            <CardHeader title="Return to origin" description="Shipments closed for delivery and moving back to the seller pickup address or fulfilment centre" />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>AWB</TH>
                    <TH>Seller</TH>
                    <TH>Reason</TH>
                    <TH align="right">Attempts</TH>
                    <TH>Return lane</TH>
                    <TH>Bag</TH>
                    <TH align="right">Value</TH>
                    <TH>Status</TH>
                    <TH align="right">Initiated</TH>
                  </TR>
                </THead>
                <TBody>
                  {[...rtoShipments]
                    .sort((a, b) => +new Date(b.initiatedAt) - +new Date(a.initiatedAt))
                    .map((r) => (
                      <TR key={r.awb}>
                        <TD>
                          {r.linked ? (
                            <Link href={`/logistics/shipments/${r.awb}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                              {r.awb}
                            </Link>
                          ) : (
                            <Mono className="font-medium text-ink-900">{r.awb}</Mono>
                          )}
                          <p className="text-xs text-ink-500">{r.cod ? "COD, not collected" : "Prepaid"}</p>
                        </TD>
                        <TD>
                          <p className="text-[13px] text-ink-900">{sellerName(r.sellerId)}</p>
                          <p className="text-xs text-ink-500">{getHub(r.originHubId)?.type === "fulfillment_center" ? "BluBuy Fulfilled" : "BluBuy Ship"}</p>
                        </TD>
                        <TD className="text-[13px]">{rtoReason(r.reason)}</TD>
                        <TD align="right">{r.attempts}</TD>
                        <TD>
                          <Mono className="text-xs text-ink-700">{r.lane}</Mono>
                        </TD>
                        <TD>{r.bagId ? <Mono className="text-xs text-ink-700">{r.bagId}</Mono> : <span className="text-xs text-warning-700">Not bagged</span>}</TD>
                        <TD align="right" className="text-[13px]">
                          {formatINR(r.value)}
                        </TD>
                        <TD>
                          <StatusBadge meta={RTO_STATUS[r.status]} size="sm" />
                        </TD>
                        <TD align="right" className="text-[13px] text-ink-500">
                          {formatDayTime(r.initiatedAt)}
                        </TD>
                      </TR>
                    ))}
                </TBody>
              </Table>
            </TableContainer>
            <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-500">
              Customer-caused RTO charges the seller forward shipping only, with no commission, fixed or reverse fee. Damaged and lost shipments in the BluBuy network raise a SafeClaim automatically.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
