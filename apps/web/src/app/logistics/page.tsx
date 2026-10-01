import Link from "next/link";
import {
  Banknote,
  CircleAlert,
  ClipboardList,
  Gauge,
  IndianRupee,
  MapPin,
  Package,
  PackageCheck,
  PackageX,
  Plane,
  Route,
  ShieldAlert,
  Timer,
  Truck,
  Undo2,
} from "lucide-react";
import { ProgressChart, type ProgressPoint } from "@/components/logistics/progress-chart";
import { LINEHAUL_STATUS } from "@/components/logistics/meta";
import { CardLink, Dot, durationLabel, formatTime, Mono, SegmentBar, minsUntil } from "@/components/logistics/ops-ui";
import { ToastButton } from "@/components/logistics/ops-client";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { associates, CURRENT_HUB_ID, getHub, hourlyDeliveries, shipments } from "@/lib/mock";
import {
  cashDepositsYesterday,
  completedHours,
  currentHourDelivered,
  HUB_DAY,
  inboundDiscrepancies,
  lineHauls,
  ndrCases,
  pincodeStats,
  reversePickups,
  rtoShipments,
  runsheets,
  yesterdayHourly,
} from "@/lib/mock/ops-extra";
import type { Tone } from "@/lib/status";
import { cn, formatCompact, formatINR, formatNumber, formatWeekday, NOW, sum, timeAgo } from "@/lib/utils";

export const metadata = { title: "Hub overview" };

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function hourLabel(h: number) {
  return `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`;
}

export default function HubOverviewPage() {
  const hub = getHub(CURRENT_HUB_ID)!;

  /* --------------------------- KPI numbers --------------------------- */
  const onRoad = runsheets.filter((r) => r.status === "dispatched");
  const outForDelivery = sum(onRoad, (r) => r.deliveries - r.delivered - r.failed);
  const codCollected = sum(runsheets, (r) => r.codCollected);
  const codToCollect = sum(runsheets, (r) => r.codToCollect) - codCollected;
  const openNdr = ndrCases.filter((n) => n.status !== "rto_approved" && n.status !== "resolved_delivered");
  const ndrDueSoon = openNdr.filter((n) => n.status !== "reattempt_scheduled" && n.status !== "reattempt_in_progress" && minsUntil(n.actionDueAt) < 120);
  const planDelta = ((HUB_DAY.deliveredCompletedHours - HUB_DAY.plannedSoFar) / Math.max(1, HUB_DAY.plannedSoFar)) * 100;
  const fadrDelta = ((HUB_DAY.firstAttemptRate - HUB_DAY.firstAttemptRateYesterday) / HUB_DAY.firstAttemptRateYesterday) * 100;

  /* --------------------- Cumulative progress chart -------------------- */
  let planCum = 0;
  let yCum = 0;
  let tCum = 0;
  const chart: ProgressPoint[] = [{ label: hourLabel(8), today: 0, yesterday: 0, plan: 0 }];
  hourlyDeliveries.forEach((h, i) => {
    planCum += h.planned;
    yCum += yesterdayHourly[i]!.delivered;
    const done = i < completedHours.length;
    if (done) tCum += h.delivered;
    chart.push({ label: hourLabel(9 + i), today: done ? tCum : null, yesterday: yCum, plan: planCum });
  });

  /* ---------------------------- Exceptions ---------------------------- */
  const delayed = lineHauls.filter((l) => l.status === "delayed");
  const disputed = ndrCases.filter((n) => n.fakeAttemptFlag);
  const damaged = inboundDiscrepancies.filter((d) => d.kind === "damaged" && d.status !== "resolved");
  const shorts = inboundDiscrepancies.filter((d) => d.kind === "short" && d.status !== "resolved");
  const atHubDueToday = shipments.filter((s) => s.destinationHubId === CURRENT_HUB_ID && s.status === "at_destination_hub" && minsUntil(s.promisedBy) < 24 * 60);
  const notDeclared = cashDepositsYesterday.filter((d) => d.status === "not_declared");

  const exceptions: { icon: typeof Truck; tone: Tone; title: string; detail: string; meta: string; href: string }[] = [
    ...delayed.map((l) => ({
      icon: Truck,
      tone: "warning" as Tone,
      title: `${getHub(l.originHubId)?.name.replace(" Fulfilment Centre", " FC")} line haul ${l.delayMins} min late`,
      detail: `${l.vehicle}, ${l.bags} bags, ${formatNumber(l.shipments)} shipments`,
      meta: `ETA ${formatTime(l.etaAt)}`,
      href: "/logistics/inbound",
    })),
    {
      icon: Timer,
      tone: "warning",
      title: `${plural(atHubDueToday.length, "shipment")} due today not on a run`,
      detail: "Sorted at hub. Add to the 1:00 pm wave to hold the promise.",
      meta: "SLA at risk",
      href: "/logistics/shipments?status=at_hub",
    },
    {
      icon: ClipboardList,
      tone: ndrDueSoon.length ? "warning" : "neutral",
      title: `${plural(ndrDueSoon.length, "NDR case")} due within 2 hours`,
      detail: `${openNdr.length} open, ${openNdr.filter((n) => n.response.kind !== "none").length} with a customer response`,
      meta: "NDR",
      href: "/logistics/ndr",
    },
    ...disputed.map((n) => ({
      icon: ShieldAlert,
      tone: "danger" as Tone,
      title: "Fake attempt reported",
      detail: `${n.awb}: geo-tag ${n.geoDistanceM} m from address. DA review opened.`,
      meta: "Disputed",
      href: "/logistics/ndr",
    })),
    ...damaged.map((d) => ({
      icon: PackageX,
      tone: "danger" as Tone,
      title: "Damaged shipment at inbound",
      detail: `${d.awb}: ${d.note.split(".")[0]!.toLowerCase()}.`,
      meta: formatTime(d.raisedAt),
      href: "/logistics/inbound",
    })),
    {
      icon: Package,
      tone: "warning",
      title: `${plural(shorts.length, "shipment")} short against manifests`,
      detail: "Raised with origin hubs, investigation closes in 48 hours.",
      meta: "Inbound",
      href: "/logistics/inbound",
    },
    {
      icon: Banknote,
      tone: "warning",
      title: `Yesterday's cash not declared by ${plural(notDeclared.length, "associate")}`,
      detail: formatINR(sum(notDeclared, (d) => d.expected)) + " expected at the cashier desk",
      meta: "COD",
      href: "/logistics/cod",
    },
  ];

  /* -------------------------- Live associates ------------------------- */
  const live = onRoad
    .map((r) => ({ r, a: associates.find((a) => a.id === r.associateId)! }))
    .sort((x, y) => (x.r.delivered + x.r.failed) / x.r.deliveries - (y.r.delivered + y.r.failed) / y.r.deliveries);

  const inbound = [...lineHauls].sort((a, b) => +new Date(a.etaAt) - +new Date(b.etaAt));
  const maxVol = Math.max(...pincodeStats.map((p) => p.volume));

  const pickupsDone = reversePickups.filter((p) => p.status === "picked_up").length;
  const qcFailed = reversePickups.filter((p) => p.status === "qc_failed").length;
  const rtoToBag = rtoShipments.filter((r) => r.status === "rto_initiated").length;

  return (
    <>
      <PageHeader
        title={hub.name}
        description={`${HUB_DAY.shift}. ${formatWeekday(NOW)}, live as of ${formatTime(NOW)}.`}
        meta={
          <>
            <Badge tone="neutral">
              <Mono className="text-xs">{hub.code}</Mono>
            </Badge>
            <Badge tone="success" dot>
              Wave 1 on road
            </Badge>
            <Badge tone="info">Wave 2 dispatch at {formatTime(HUB_DAY.wave2At)}</Badge>
          </>
        }
        actions={
          <>
            <ToastButton label="Shift report" icon="download" message="Shift report for 1 Oct exported as CSV" size="md" />
            <ButtonLink href="/logistics/runs" icon={Route}>
              Plan wave 2
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        <StatCard label="To deliver today" value={formatNumber(HUB_DAY.planned)} icon={Package} footer={`${formatNumber(sum(runsheets, (r) => r.deliveries))} on runsheets`} href="/logistics/shipments" />
        <StatCard label="Out for delivery" value={formatNumber(outForDelivery)} icon={Truck} footer={`${onRoad.length} associates on road`} href="/logistics/runs" />
        <StatCard
          label="Delivered"
          value={formatNumber(HUB_DAY.deliveredSoFar)}
          icon={PackageCheck}
          delta={planDelta}
          deltaLabel="vs plan"
          href="/logistics/shipments?status=delivered"
        />
        <StatCard label="First attempt" value={`${HUB_DAY.firstAttemptRate}%`} icon={Gauge} delta={fadrDelta} deltaLabel="vs yesterday" />
        <StatCard label="Open NDR" value={openNdr.length} icon={ClipboardList} footer={`${ndrDueSoon.length} due within 2 h`} href="/logistics/ndr" />
        <StatCard label="COD to collect" value={formatCompact(codToCollect, true)} icon={IndianRupee} footer={`${formatCompact(codCollected, true)} collected so far`} href="/logistics/cod" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Delivery progress against plan"
              description={`Cumulative deliveries, completed hours only. The ${hourLabel(Math.floor(((NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440) / 60))} hour is still running.`}
              action={
                <Badge tone={planDelta >= -3 ? "success" : "warning"} dot>
                  {planDelta >= -3 ? "On plan" : "Behind plan"}
                </Badge>
              }
            />
            <div className="px-5 pt-4 pb-2">
              <ProgressChart data={chart} height={250} ariaLabel="Cumulative deliveries today by hour compared with yesterday and the plan" />
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
              {[
                { label: "Completed hours", value: `${formatNumber(HUB_DAY.deliveredCompletedHours)} of ${formatNumber(HUB_DAY.plannedSoFar)}`, hint: "delivered vs plan" },
                { label: "Running hour", value: formatNumber(currentHourDelivered), hint: `delivered since ${hourLabel(Math.floor(((NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440) / 60))}` },
                { label: "Plan for the day", value: formatNumber(HUB_DAY.planned), hint: "8 AM to 10 PM" },
                { label: "Yesterday", value: formatNumber(HUB_DAY.yesterdayDelivered), hint: "delivered, full day" },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-5 py-3.5">
                  <dt className="text-xs text-ink-500">{s.label}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{s.value}</dd>
                  <dd className="text-xs text-ink-500">{s.hint}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Associates on route" description="Wave 1 runsheets, slowest progress first" action={<CardLink href="/logistics/runs">All runsheets</CardLink>} />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Associate</TH>
                    <TH>Beat</TH>
                    <TH className="min-w-44">Progress</TH>
                    <TH align="right">COD collected</TH>
                    <TH align="right">Last scan</TH>
                  </TR>
                </THead>
                <TBody>
                  {live.slice(0, 8).map(({ r, a }) => {
                    const done = r.delivered + r.failed;
                    return (
                      <TR key={r.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar name={a.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ink-900">{a.name}</p>
                              <p className="text-xs text-ink-500">{r.onBreak ? "On break" : `${r.distanceKm} km route`}</p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <p className="text-[13px] text-ink-800">{r.beat.name}</p>
                          <Mono className="text-xs text-ink-500">{r.beat.code}</Mono>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-3">
                            <SegmentBar
                              className="w-28"
                              total={r.deliveries}
                              segments={[
                                { value: r.delivered, tone: "success", label: "Delivered" },
                                { value: r.failed, tone: "warning", label: "Failed" },
                              ]}
                            />
                            <span className="text-xs text-ink-600 tabular-nums">
                              {done}/{r.deliveries}
                              {r.failed > 0 && <span className="text-warning-700"> ({r.failed} NDR)</span>}
                            </span>
                          </div>
                        </TD>
                        <TD align="right">
                          <span className="text-[13px] font-medium text-ink-900">{formatINR(r.codCollected)}</span>
                          <p className="text-xs text-ink-500">of {formatINR(r.codToCollect)}</p>
                        </TD>
                        <TD align="right" className="text-[13px] text-ink-500">
                          {r.lastScanAt ? timeAgo(r.lastScanAt) : "No scans"}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
          </Card>

          <Card>
            <CardHeader title="Pincode heat" description="Today's volume by pincode, with 30-day NDR rate and COD share" action={<CardLink href="/logistics/network">Serviceability</CardLink>} />
            <ol className="mt-3 flex flex-col px-5 pb-5">
              <li className="grid grid-cols-[1fr_auto] gap-3 border-b border-line pb-2 text-xs font-medium text-ink-500 sm:grid-cols-[minmax(0,13rem)_1fr_4.5rem_4.5rem]">
                <span>Pincode</span>
                <span className="hidden sm:block">Shipments today</span>
                <span className="text-right">NDR rate</span>
                <span className="hidden text-right sm:block">COD share</span>
              </li>
              {pincodeStats.map((p, i) => (
                <li key={p.pincode} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line py-2.5 last:border-0 sm:grid-cols-[minmax(0,13rem)_1fr_4.5rem_4.5rem]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-4 text-xs text-ink-400 tabular-nums">{i + 1}</span>
                    <Mono className="font-medium text-ink-900">{p.pincode}</Mono>
                    <span className="truncate text-[13px] text-ink-600">{p.locality}</span>
                  </span>
                  <span className="hidden items-center gap-3 sm:flex">
                    <span className="h-1.5 flex-1 rounded-full bg-ink-100">
                      <span className="block h-full rounded-full bg-[var(--color-chart-1)]" style={{ width: `${(p.volume / maxVol) * 100}%` }} />
                    </span>
                    <span className="w-9 text-right text-[13px] font-medium text-ink-900 tabular-nums">{p.volume}</span>
                  </span>
                  <span className={cn("text-right text-[13px] font-medium tabular-nums", p.ndrRate >= 10 ? "text-danger-700" : p.ndrRate >= 8 ? "text-warning-700" : "text-ink-700")}>
                    {p.ndrRate.toFixed(1)}%
                  </span>
                  <span className="hidden text-right text-[13px] text-ink-600 tabular-nums sm:block">{p.codShare}%</span>
                </li>
              ))}
            </ol>
          </Card>

        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Exceptions" description="Act on these first" action={<Badge tone="warning">{exceptions.length}</Badge>} />
            <ul className="mt-2 divide-y divide-line">
              {exceptions.slice(0, 7).map((e) => (
                <li key={e.title}>
                  <Link href={e.href} className="flex gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                    <IconTile icon={e.icon} tone={e.tone} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[13px] leading-snug font-medium text-ink-900">{e.title}</span>
                        <span className={cn("shrink-0 text-[11px] font-medium whitespace-nowrap", e.tone === "danger" ? "text-danger-700" : e.tone === "warning" ? "text-warning-700" : "text-ink-500")}>{e.meta}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{e.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Inbound line haul" description="Arrivals and ETAs today" action={<CardLink href="/logistics/inbound">Inbound</CardLink>} />
            <ul className="mt-2 divide-y divide-line">
              {inbound.map((l) => {
                const origin = getHub(l.originHubId)!;
                const late = l.status === "delayed";
                const done = l.status === "received" || l.status === "arrived" || l.status === "unloading";
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", late ? "bg-warning-50 text-warning-700" : done ? "bg-ink-100 text-ink-500" : "bg-brand-50 text-brand-600")}>
                      {l.mode === "air" ? <Plane size={15} aria-hidden="true" /> : <Truck size={15} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{origin.name.replace(" Fulfilment Centre", " FC").replace(" Sort Centre", " SC")}</p>
                      <p className="truncate text-xs text-ink-500">
                        <Mono className="text-xs">{origin.code}</Mono>, {l.bags} bags
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-[13px] font-semibold tabular-nums", late ? "text-warning-700" : "text-ink-900")}>{formatTime(l.arrivedAt ?? l.etaAt)}</p>
                      <StatusBadge meta={LINEHAUL_STATUS[l.status]} size="sm" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Cash and returns" description="Money and reverse flow for this shift" />
            <ul className="mt-2 divide-y divide-line">
              {[
                { icon: IndianRupee, label: "COD collected today", value: formatINR(codCollected), hint: `${formatINR(codToCollect)} still on road`, href: "/logistics/cod", tone: "success" as Tone },
                { icon: CircleAlert, label: "Yesterday's cash pending", value: `${notDeclared.length} associates`, hint: "Declare before 12:00 pm bank run", href: "/logistics/cod", tone: "warning" as Tone },
                { icon: Undo2, label: "Return pickups", value: `${pickupsDone} of ${reversePickups.length}`, hint: `${qcFailed} failed doorstep QC`, href: "/logistics/reverse", tone: "info" as Tone },
                { icon: MapPin, label: "RTO waiting to bag", value: formatNumber(rtoToBag), hint: "Return lanes close at 6:00 pm", href: "/logistics/reverse?tab=rto", tone: "neutral" as Tone },
              ].map((row) => (
                <li key={row.label}>
                  <Link href={row.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/70">
                    <Dot tone={row.tone} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink-600">{row.label}</span>
                      <span className="block text-xs text-ink-500">{row.hint}</span>
                    </span>
                    <span className="text-sm font-semibold text-ink-900 tabular-nums">{row.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
              Average on-road time so far {durationLabel(sum(onRoad, (r) => (NOW.getTime() - new Date(r.dispatchedAt!).getTime()) / 60_000) / Math.max(1, onRoad.length))}.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
