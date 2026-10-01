import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CreditCard,
  Download,
  FileText,
  PackageCheck,
  RotateCcw,
  ScrollText,
  Timer,
  TrendingUp,
} from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { BarList, Funnel } from "@/components/charts/static";
import { ShareBar } from "@/components/admin/share-bar";
import { GmvTrend } from "@/components/admin/gmv-trend";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ScoreMeter } from "@/components/admin/bits";
import { HEALTH_BAND, healthBand, TIER_TONE } from "@/components/admin/admin-status";
import { pctChange } from "@/components/admin/helpers";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { categoryMix, funnel, orders, paymentMix, platformDaily, regionMix, SALE_EVENT, sellers } from "@/lib/mock";
import { CATALOG_QUEUE_TOTAL, gatewayStats, hourlyOrdersYesterday, kycApplications, opsSnapshot, ordersPerMinute, saleEvents } from "@/lib/mock/admin-extra";
import { ORDER_STATUS, PAYMENT_METHOD, SELLER_STATUS, type Tone } from "@/lib/status";
import type { LucideIcon } from "lucide-react";
import { cn, formatCompact, formatDateShort, formatINR, formatNumber, formatTime, formatWeekday, NOW, timeAgo } from "@/lib/utils";

export const metadata = { title: "Overview" };

type Day = (typeof platformDaily)[number];
const sum = (arr: Day[], k: "gmv" | "orders" | "newCustomers" | "returns" | "visitors") => arr.reduce((a, d) => a + d[k], 0);

export default function AdminOverview() {
  const today = platformDaily.at(-1)!;
  const yesterday = platformDaily.at(-2)!;
  const completed = platformDaily.slice(0, -1);
  const last7 = completed.slice(-7);
  const prev7 = completed.slice(-14, -7);
  const spark = completed.slice(-14);

  const gmv7 = sum(last7, "gmv");
  const orders7 = sum(last7, "orders");
  const aov7 = gmv7 / orders7;
  const aovPrev = sum(prev7, "gmv") / sum(prev7, "orders");
  const conv7 = (orders7 / sum(last7, "visitors")) * 100;
  const convPrev = (sum(prev7, "orders") / sum(prev7, "visitors")) * 100;
  const ret7 = (sum(last7, "returns") / orders7) * 100;
  const retPrev = (sum(prev7, "returns") / sum(prev7, "orders")) * 100;

  // Today is still in progress: compare with the same share of yesterday.
  const elapsedShare = 0.45;
  const todayDelta = pctChange(today.gmv, yesterday.gmv * elapsedShare);

  const sale = saleEvents.find((e) => e.status === "live")!;
  const saleDay = Math.floor((NOW.getTime() - new Date(SALE_EVENT.startsAt).getTime()) / 86_400_000) + 1;
  const saleDays = Math.round((new Date(SALE_EVENT.endsAt).getTime() - new Date(SALE_EVENT.startsAt).getTime()) / 86_400_000);

  const success15 = gatewayStats.reduce((a, g) => a + g.success15m * g.volume24h, 0) / gatewayStats.reduce((a, g) => a + g.volume24h, 0);
  const upi = gatewayStats.filter((g) => g.method === "UPI");
  const upi15 = upi.reduce((a, g) => a + g.success15m * g.volume24h, 0) / upi.reduce((a, g) => a + g.volume24h, 0);

  const byMethod = (["UPI", "Cards", "Net banking", "Wallets", "EMI"] as const).map((m) => {
    const rows = gatewayStats.filter((g) => g.method === m);
    const vol = rows.reduce((a, g) => a + g.volume24h, 0);
    return { method: m, rate: rows.reduce((a, g) => a + g.success24h * g.volume24h, 0) / vol, degraded: rows.some((g) => g.status !== "operational") };
  });

  const openKyc = kycApplications.filter((k) => ["submitted", "under_review", "action_required"].includes(k.status));
  const oldestKycDays = Math.max(...openKyc.filter((k) => k.status !== "action_required").map((k) => Math.floor((NOW.getTime() - new Date(k.submittedAt).getTime()) / 86_400_000)));

  const alerts: { icon: LucideIcon; tone: Tone; title: string; detail: string; href: string; cta: string }[] = [
    { icon: CreditCard, tone: "danger", title: `UPI success ${upi15.toFixed(1)}%, last 15 min`, detail: "Collect requests degraded at Kanakpay", href: "/admin/payments", cta: "Gateway health" },
    { icon: Timer, tone: "warning", title: `${formatNumber(opsSnapshot.slaBreaches)} items past dispatch-by`, detail: `${formatNumber(opsSnapshot.dispatchAtRisk)} more at risk before 6 pm`, href: "/admin/orders?view=attention", cta: "Review orders" },
    { icon: RotateCcw, tone: "danger", title: `${opsSnapshot.refundsFailed} refunds failed at the bank`, detail: "Retry or reroute to BluBuy Credits", href: "/admin/returns?refund=failed", cta: "Fix refunds" },
    { icon: PackageCheck, tone: "warning", title: `${CATALOG_QUEUE_TOTAL} listings awaiting QC`, detail: `Oldest ${opsSnapshot.oldestQcHours} h against a 48 h target`, href: "/admin/catalog", cta: "Open queue" },
    { icon: Building2, tone: "info", title: `${openKyc.length} seller applications open`, detail: `Oldest awaiting review: ${oldestKycDays} days`, href: "/admin/sellers/approvals", cta: "Review KYC" },
    { icon: ScrollText, tone: "info", title: `${opsSnapshot.claimsDueToday} Guarantee claims due today`, detail: "7 day decision clock", href: "/admin/disputes", cta: "Open claims" },
  ];

  const trend = completed.map((d) => ({ label: formatDateShort(d.date), gmv: Math.round(d.gmv), orders: d.orders }));
  const peak = hourlyOrdersYesterday.reduce((m, h, i, arr) => (h.orders > arr[m]!.orders ? i : m), 0);

  const topSellers = sellers
    .filter((s) => s.gmv30d > 0)
    .sort((a, b) => b.gmv30d - a.gmv30d)
    .slice(0, 7);

  const feed = orders.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Marketplace overview"
        description={`${formatWeekday(NOW)}, live as of ${formatTime(NOW)}. Charts show completed days only.`}
        actions={
          <>
            <ButtonLink href="/admin/reports" variant="secondary" size="sm" icon={FileText}>
              Reports
            </ButtonLink>
            <ButtonLink href="/admin/reports?generate=rpt-sales" variant="secondary" size="sm" icon={Download}>
              Export
            </ButtonLink>
          </>
        }
      />

      {/* Hero: today so far, with the live sale */}
      <section aria-labelledby="today" className="relative mb-6 overflow-hidden rounded-[var(--radius-card)] bg-brand-950 text-white">
        <div className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-brand-600/35 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.25fr_1fr] lg:gap-10 lg:p-7">
          <div>
            <h2 id="today" className="flex items-center gap-2 text-[13px] font-medium text-brand-200">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success-500" />
              </span>
              GMV today so far
            </h2>
            <p className="mt-2 font-display text-[44px] leading-none font-semibold tracking-tight tabular-nums sm:text-[52px]">{formatCompact(today.gmv, true)}</p>
            <p className="mt-2.5 text-sm text-brand-100">
              <span className={cn("font-semibold tabular-nums", todayDelta >= 0 ? "text-success-100" : "text-danger-100")}>
                {todayDelta >= 0 ? "+" : ""}
                {todayDelta.toFixed(1)}%
              </span>{" "}
              vs the same time yesterday ({formatCompact(yesterday.gmv * elapsedShare, true)})
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
              {[
                { label: "Orders today", value: formatNumber(today.orders) },
                { label: "Orders per minute", value: formatNumber(ordersPerMinute) },
                { label: "Payment success", value: `${success15.toFixed(1)}%`, hint: "last 15 min" },
              ].map((m) => (
                <div key={m.label} className="min-w-0">
                  <dt className="truncate text-xs text-brand-200">{m.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-400 text-ink-950">
                  <BadgePercent size={20} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-[15px] font-semibold">{SALE_EVENT.name}</p>
                  <p className="text-xs text-brand-200">
                    Day {saleDay} of {saleDays}, ends {formatDateShort(SALE_EVENT.endsAt)} at 11:59 pm
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-semibold text-ink-950">Live</span>
            </div>
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-brand-100">Sale GMV to date</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-white">{formatCompact(sale.gmv ?? 0, true)}</span>
                  <span className="text-brand-200"> of {formatCompact(sale.targetGmv, true)} target</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Sale GMV against target" aria-valuenow={Math.round(((sale.gmv ?? 0) / sale.targetGmv) * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-accent-400" style={{ width: `${Math.min(100, ((sale.gmv ?? 0) / sale.targetGmv) * 100)}%` }} />
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div>
                <dt className="text-brand-200">Deals live</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(sale.dealsApproved)}</dd>
              </div>
              <div>
                <dt className="text-brand-200">Deals awaiting approval</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(sale.dealsPending)}</dd>
              </div>
            </dl>
            <Link href="/admin/promotions" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-white hover:underline">
              Sale calendar and deal approvals
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <KpiStrip
        className="mb-6"
        items={[
          { label: "GMV, 7 days", value: formatCompact(gmv7, true), delta: pctChange(gmv7, sum(prev7, "gmv")), deltaLabel: "vs prior 7 days", trend: spark.map((d) => d.gmv), href: "/admin/reports" },
          { label: "Orders, 7 days", value: formatCompact(orders7), delta: pctChange(orders7, sum(prev7, "orders")), deltaLabel: "vs prior 7 days", trend: spark.map((d) => d.orders), href: "/admin/orders" },
          { label: "Average order value", value: formatINR(aov7), delta: pctChange(aov7, aovPrev), deltaLabel: "vs prior 7 days", trend: spark.map((d) => d.aov) },
          { label: "Conversion", value: `${conv7.toFixed(2)}%`, delta: pctChange(conv7, convPrev), deltaLabel: "vs prior 7 days", trend: spark.map((d) => d.conversion) },
          { label: "New customers", value: formatCompact(sum(last7, "newCustomers")), delta: pctChange(sum(last7, "newCustomers"), sum(prev7, "newCustomers")), deltaLabel: "vs prior 7 days", trend: spark.map((d) => d.newCustomers), href: "/admin/customers" },
          { label: "Returns rate", value: `${ret7.toFixed(1)}%`, delta: pctChange(ret7, retPrev), deltaLabel: "vs prior 7 days", upIsGood: false, trend: spark.map((d) => (d.returns / d.orders) * 100), href: "/admin/returns" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Marketplace GMV" description="Completed days, all categories and channels" />
          <GmvTrend points={trend} />
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Needs attention" description="Live alerts, most urgent first" action={<Badge tone="danger">{alerts.filter((x) => x.tone === "danger").length} critical</Badge>} />
          <ul className="mt-2 flex-1 divide-y divide-line">
            {alerts.map((al) => (
              <li key={al.title}>
                <Link href={al.href} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ink-50/70">
                  <IconTile icon={al.icon} tone={al.tone} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{al.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">{al.detail}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-ink-300 transition-colors group-hover:text-ink-600" aria-label={al.cta} />
                </Link>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line">
            {[
              { label: "Cancellation", value: `${opsSnapshot.cancellationRate}%`, hint: "7 days" },
              { label: "NDR rate", value: `${opsSnapshot.ndrRate}%`, hint: "7 days" },
              { label: "RTO rate", value: `${opsSnapshot.rtoRate}%`, hint: "30 days" },
              { label: "Risk cases", value: formatNumber(opsSnapshot.openRiskCases), hint: "open" },
            ].map((m) => (
              <div key={m.label} className="bg-surface px-5 py-3">
                <dt className="truncate text-xs text-ink-500">
                  {m.label}, {m.hint}
                </dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{m.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Orders by hour, yesterday"
            description={`${formatWeekday(yesterday.date)}: ${formatNumber(yesterday.orders)} orders, peak at ${hourlyOrdersYesterday[peak]!.label}`}
            action={
              <Badge tone="neutral" icon={TrendingUp}>
                {`Peak ${formatNumber(hourlyOrdersYesterday[peak]!.orders)}`}
              </Badge>
            }
          />
          <div className="px-5 pt-4 pb-5">
            <BarChart
              data={hourlyOrdersYesterday.map((h) => ({ label: h.label, orders: h.orders }))}
              series={[{ key: "orders", label: "Orders" }]}
              format="compact"
              emphasis={peak}
              height={240}
              ariaLabel="Orders placed per hour yesterday"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Payments" description="Method share of orders, last 30 days" action={<ButtonLink href="/admin/payments" variant="ghost" size="xs" iconRight={ArrowRight}>Gateway</ButtonLink>} />
          <div className="px-5 pt-4 pb-5">
            <ShareBar segments={paymentMix.map((p) => ({ label: p.method, value: p.share }))} />
            <p className="mt-6 mb-2.5 text-xs font-medium text-ink-500">Success rate by method, last 24 hours</p>
            <ul className="flex flex-col gap-2.5">
              {byMethod.map((m) => (
                <li key={m.method} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink-700">{m.method}</span>
                  <span className="flex items-center gap-2">
                    {m.degraded && <StatusBadge meta={{ label: "Degraded", tone: "warning" }} size="sm" />}
                    <span className="w-14 text-right font-semibold text-ink-900 tabular-nums">{m.rate.toFixed(1)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 xl:col-span-3">
          <Card>
            <CardHeader title="Category mix" description="GMV share, last 30 days" />
            <div className="px-5 pt-4 pb-5">
              <BarList items={categoryMix.map((c) => ({ label: c.category, value: c.gmv }))} format="inrCompact" showShare />
            </div>
          </Card>
          <Card>
            <CardHeader title="Top regions" description="Orders by state, last 30 days" />
            <div className="px-5 pt-4 pb-5">
              <BarList items={regionMix.slice(0, 7).map((r) => ({ label: r.region, value: r.orders }))} format="compact" showShare />
            </div>
          </Card>
          <Card>
            <CardHeader title="Checkout funnel" description="Last 7 days, all channels" />
            <div className="px-5 pt-4 pb-5">
              <Funnel stages={funnel} />
              <p className="mt-5 border-t border-line pt-3 text-xs text-ink-500">
                Session to order conversion{" "}
                <span className="font-semibold text-ink-900 tabular-nums">{((funnel.at(-1)!.value / funnel[0]!.value) * 100).toFixed(2)}%</span>
              </p>
            </div>
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Top sellers"
            description="By GMV, last 30 days"
            action={
              <ButtonLink href="/admin/sellers" variant="ghost" size="sm" iconRight={ArrowRight}>
                All sellers
              </ButtonLink>
            }
          />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Seller</TH>
                  <TH>Tier</TH>
                  <TH>Seller Health</TH>
                  <TH align="right">GMV</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Orders
                  </TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {topSellers.map((s) => {
                  const band = healthBand(s.health.score);
                  return (
                    <TR key={s.id}>
                      <TD>
                        <Link href={`/admin/sellers/${s.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {s.displayName}
                        </Link>
                        <p className="text-xs text-ink-500">{s.city}</p>
                      </TD>
                      <TD>
                        <Badge tone={TIER_TONE[s.tier]} size="sm">
                          {s.tier}
                        </Badge>
                      </TD>
                      <TD>
                        <ScoreMeter value={s.health.score} max={1000} tone={HEALTH_BAND[band].tone} label={`Seller Health ${HEALTH_BAND[band].label}`} />
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatCompact(s.gmv30d, true)}
                      </TD>
                      <TD align="right" className="hidden sm:table-cell">
                        {formatNumber(s.orders30d)}
                      </TD>
                      <TD>
                        <StatusBadge meta={SELLER_STATUS[s.status]} size="sm" />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader
            title="Live order feed"
            description="Latest orders across the marketplace"
            action={
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
                <span className="size-1.5 animate-pulse rounded-full bg-success-500" aria-hidden="true" />
                Live
              </span>
            }
          />
          <ul className="mt-2 divide-y divide-line">
            {feed.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ink-50/70">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-medium text-brand-700">{o.id}</span>
                      <span className="text-[11px] text-ink-400">{timeAgo(o.placedAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">
                      {o.address.city}, {PAYMENT_METHOD[o.payment.method]}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(o.total)}</span>
                    <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <ButtonLink href="/admin/orders" variant="link" size="sm" iconRight={ArrowRight}>
              All orders
            </ButtonLink>
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-ink-400">
        Figures are marketplace-wide. Today&apos;s numbers are partial until midnight IST; charts and comparisons use completed days.
      </p>
    </>
  );
}
