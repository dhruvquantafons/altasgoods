import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Boxes,
  CalendarClock,
  CircleAlert,
  Download,
  Eye,
  IndianRupee,
  Package,
  PackageCheck,
  Plus,
  ShoppingCart,
  Truck,
  Undo2,
} from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { BarList } from "@/components/charts/static";
import { ProductImage } from "@/components/commerce/product-image";
import { NewSellerHome } from "@/components/seller/new-seller-home";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { IconTile, Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  CURRENT_SELLER_ID,
  getSeller,
  products,
  productsBySeller,
  returns,
  SALE_EVENT,
  sellerDaily,
  settlementsForSeller,
} from "@/lib/mock";
import { loadSellerLines } from "@/lib/api/seller-orders";
import { currentUser } from "@/lib/api/server";
import { ORDER_STATUS } from "@/lib/status";
import { formatCompact, formatDate, formatDateShort, formatINR, formatNumber, formatWeekday, istHour, NOW, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function pctChange(a: number, b: number) {
  return b ? ((a - b) / b) * 100 : 0;
}

export default async function SellerDashboard() {
  const [{ lines, counts }, user] = await Promise.all([loadSellerLines(), currentUser()]);
  const toConfirm = counts.NEW ?? 0;
  const toPack = counts.ACCEPTED ?? 0;
  const awaitingPickup = (counts.PACKED ?? 0) + (counts.READY_TO_SHIP ?? 0);
  const membership = user?.sellers[0];
  // sellers who joined through onboarding have no sales history in the sample analytics
  if (membership && !getSeller(membership.id)) {
    return <NewSellerHome firstName={(user?.name ?? "there").split(" ")[0]!} store={membership.displayName} counts={{ toConfirm, toPack, awaitingPickup }} />;
  }
  const seller = getSeller(CURRENT_SELLER_ID)!;
  const myReturns = returns.filter((r) => r.sellerId === CURRENT_SELLER_ID && ["requested", "received"].includes(r.status)).length;
  const myProducts = productsBySeller(CURRENT_SELLER_ID);
  const suppressed = myProducts.filter((p) => p.listingStatus === "suppressed").length;
  const lowStock = myProducts.filter((p) => (p.offers.find((o) => o.sellerId === CURRENT_SELLER_ID)?.stock ?? 0) < 20).length;

  const today = sellerDaily.at(-1)!;
  const yesterday = sellerDaily.at(-2)!;
  const last7 = sellerDaily.slice(-7);
  const prev7 = sellerDaily.slice(-14, -7);
  const sum = (arr: typeof sellerDaily, k: "sales" | "orders" | "units" | "pageViews") => arr.reduce((a, d) => a + d[k], 0);

  // completed days only, so today's partial numbers do not read as a drop
  const chart = sellerDaily.slice(-15, -1).map((d, i) => ({
    label: formatDateShort(d.date),
    current: d.sales,
    previous: sellerDaily.slice(-29, -15)[i]?.sales ?? 0,
  }));

  const payout = settlementsForSeller(CURRENT_SELLER_ID)[1]!;
  const h = seller.health;

  const topProducts = myProducts
    .slice()
    .sort((a, b) => b.soldLast30d - a.soldLast30d)
    .slice(0, 6)
    .map((p) => ({ label: p.title.split(/[,(]/)[0]!.trim(), value: p.soldLast30d, href: `/seller/catalog/${p.id}` }));

  const recent = lines.toSorted((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, 6);
  const firstName = (user?.name ?? seller.ownerName).split(" ")[0];
  const hour = istHour(NOW);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const todo = [
    { label: "Orders to confirm", value: toConfirm, hint: "Confirm by 2:00 PM to ship today", href: "/seller/orders?tab=new", icon: ShoppingCart, tone: "brand" as const },
    { label: "Ready to pack", value: toPack, hint: "Print labels and invoices", href: "/seller/orders?tab=to_pack", icon: Package, tone: "info" as const },
    { label: "Awaiting pickup", value: awaitingPickup, hint: "Pickup slot 4:00 to 6:00 PM", href: "/seller/orders?tab=ready", icon: Truck, tone: "accent" as const },
    { label: "Returns to review", value: myReturns, hint: "Inspect received items", href: "/seller/returns", icon: Undo2, tone: "warning" as const },
    { label: "Listings with issues", value: suppressed, hint: "Hidden from search", href: "/seller/catalog?status=suppressed", icon: CircleAlert, tone: "danger" as const },
    { label: "Low stock SKUs", value: lowStock, hint: "Under 20 units left", href: "/seller/inventory?filter=low", icon: Boxes, tone: "neutral" as const },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`Here is what needs your attention today, ${formatWeekday(NOW)}.`}
        actions={
          <>
            <ButtonLink href="/seller/analytics" variant="secondary" icon={Download}>
              Reports
            </ButtonLink>
            <ButtonLink href="/seller/catalog/new" icon={Plus}>
              Add a product
            </ButtonLink>
          </>
        }
      />

      {/* Sale event banner */}
      <div className="relative mb-6 overflow-hidden rounded-[var(--radius-card)] bg-brand-950 px-6 py-5 text-white">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-accent-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <BadgePercent size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[17px] font-semibold">{SALE_EVENT.name} is live</p>
                <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-semibold text-ink-950">Ends {formatDateShort(SALE_EVENT.endsAt)}</span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-brand-100">
                Traffic to your listings is up {Math.round(pctChange(sum(last7, "pageViews"), sum(prev7, "pageViews")))}% this week. Add more products to deals to win the
                featured offer during peak hours.
              </p>
            </div>
          </div>
          <ButtonLink href="/seller/promotions" variant="accent" iconRight={ArrowRight} className="self-start md:self-auto">
            Nominate deals
          </ButtonLink>
        </div>
      </div>

      {/* Action items */}
      <section aria-labelledby="todo" className="mb-6">
        <h2 id="todo" className="sr-only">
          Action items
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {todo.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="group rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-px hover:shadow-raised"
            >
              <div className="flex items-center justify-between">
                <IconTile icon={t.icon} tone={t.tone} size="sm" />
                <ArrowRight size={15} className="text-ink-300 transition-colors group-hover:text-ink-600" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{t.value}</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-700">{t.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">{t.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales, last 7 days"
          value={formatCompact(sum(last7, "sales"), true)}
          delta={pctChange(sum(last7, "sales"), sum(prev7, "sales"))}
          deltaLabel="vs previous 7 days"
          icon={IndianRupee}
          trend={sellerDaily.slice(-13, -1).map((d) => d.sales)}
        />
        <StatCard
          label="Orders, last 7 days"
          value={formatNumber(sum(last7, "orders"))}
          delta={pctChange(sum(last7, "orders"), sum(prev7, "orders"))}
          deltaLabel="vs previous 7 days"
          icon={ShoppingCart}
          trend={sellerDaily.slice(-13, -1).map((d) => d.orders)}
        />
        <StatCard
          label="Page views today"
          value={formatCompact(today.pageViews)}
          delta={pctChange(today.pageViews, yesterday.pageViews * 0.45)}
          deltaLabel="vs same time yesterday"
          icon={Eye}
          trend={sellerDaily.slice(-13, -1).map((d) => d.pageViews)}
        />
        <StatCard
          label="Unit session percentage"
          value={`${today.conversion.toFixed(2)}%`}
          delta={pctChange(today.conversion, yesterday.conversion)}
          deltaLabel="vs yesterday"
          icon={PackageCheck}
          trend={sellerDaily.slice(-13, -1).map((d) => d.conversion)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Sales"
              description="Ordered product sales, last 14 days compared with the 14 days before"
              action={<Badge tone="success">{`+${Math.round(pctChange(chart.reduce((a, d) => a + d.current, 0), chart.reduce((a, d) => a + d.previous, 0)))}%`}</Badge>}
            />
            <div className="px-5 pt-3 pb-5">
              <AreaChart
                data={chart}
                series={[
                  { key: "current", label: "Last 14 days" },
                  { key: "previous", label: "Previous 14 days", slot: 1 },
                ]}
                format="inr"
                height={270}
                ariaLabel="Ordered product sales, last 14 days versus previous 14 days"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent orders"
              description="Latest orders containing your listings"
              action={
                <ButtonLink href="/seller/orders" variant="ghost" size="sm" iconRight={ArrowRight}>
                  View all
                </ButtonLink>
              }
            />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Product</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH align="right">Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {recent.map((l) => (
                    <TR key={l.lineId}>
                      <TD>
                        <Link href={`/seller/orders/${l.orderId}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {l.orderId}
                        </Link>
                        <p className="text-xs text-ink-500">{l.city}</p>
                      </TD>
                      <TD>
                        <div className="flex max-w-xs items-center gap-3">
                          <ProductImage src={l.image} alt="" size={36} rounded="md" />
                          <span className="truncate text-[13px] text-ink-800">{l.title}</span>
                        </div>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatINR(l.total)}
                      </TD>
                      <TD>
                        <StatusBadge meta={ORDER_STATUS[l.status]} size="sm" />
                      </TD>
                      <TD align="right" className="text-[13px] text-ink-500">
                        {timeAgo(l.placedAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Account health"
              description="Last 60 days"
              action={
                <Badge tone="success" dot>
                  Healthy
                </Badge>
              }
            />
            <div className="px-5 pt-3 pb-5">
              <div className="flex items-end gap-2">
                <p className="text-[40px] leading-none font-semibold tracking-tight text-ink-900">{h.score}</p>
                <p className="pb-1 text-sm text-ink-500">of 1000</p>
              </div>
              <Progress value={h.score} max={1000} tone="success" className="mt-3" label="Account health score" />
              <ul className="mt-5 flex flex-col gap-3.5">
                {[
                  { label: "Order defect rate", value: h.odr, target: 1, unit: "%", lowerIsBetter: true },
                  { label: "Pre-fulfilment cancel rate", value: h.cancellationRate, target: 2.5, unit: "%", lowerIsBetter: true },
                  { label: "Late dispatch rate", value: h.lateDispatchRate, target: 4, unit: "%", lowerIsBetter: true },
                  { label: "Valid tracking rate", value: h.validTrackingRate, target: 95, unit: "%", lowerIsBetter: false },
                ].map((m) => {
                  const ok = m.lowerIsBetter ? m.value < m.target : m.value > m.target;
                  return (
                    <li key={m.label} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-ink-600">{m.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-ink-900 tabular-nums">
                          {m.value.toFixed(2)}
                          {m.unit}
                        </span>
                        <span className="w-[4.5rem] text-right text-xs whitespace-nowrap text-ink-400">
                          {m.lowerIsBetter ? "under" : "over"} {m.target}%
                        </span>
                        <span className={ok ? "size-2 rounded-full bg-success-500" : "size-2 rounded-full bg-danger-500"} aria-label={ok ? "On target" : "Off target"} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ButtonLink href="/seller/performance" variant="secondary" size="sm" className="mt-5 w-full">
                View account health
              </ButtonLink>
            </div>
          </Card>

          <Card>
            <CardHeader title="Next payout" description={`Settlement cycle ${formatDateShort(payout.periodStart)} to ${formatDateShort(payout.periodEnd)}`} />
            <div className="px-5 pt-3 pb-5">
              <p className="text-[32px] leading-none font-semibold tracking-tight text-ink-900">{formatINR(payout.netPayout)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-500">
                <CalendarClock size={15} aria-hidden="true" />
                Scheduled for {formatDate(payout.scheduledFor)} to HDFC Bank ending 4821
              </p>
              <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Gross sales</dt>
                  <dd className="font-medium text-ink-900 tabular-nums">{formatINR(payout.grossSales)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">BluBuy fees and taxes</dt>
                  <dd className="font-medium text-ink-900 tabular-nums">{formatINR(payout.fees.reduce((a, f) => a + f.amount, 0))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Refunds</dt>
                  <dd className="font-medium text-ink-900 tabular-nums">{formatINR(payout.refunds)}</dd>
                </div>
              </dl>
              <ButtonLink href="/seller/payments" variant="secondary" size="sm" className="mt-5 w-full">
                View statement
              </ButtonLink>
            </div>
          </Card>

          <Card>
            <CardHeader title="Top sellers" description="Units sold, last 30 days" />
            <div className="px-5 pt-4 pb-5">
              <BarList items={topProducts} />
            </div>
          </Card>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-ink-400">
        Data refreshed {timeAgo(new Date(NOW.getTime() - 4 * 60_000))}. {products.length} catalog products indexed.
      </p>
    </>
  );
}
