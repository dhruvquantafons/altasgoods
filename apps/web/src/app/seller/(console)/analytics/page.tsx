import Link from "next/link";
import { Eye, IndianRupee, Package, Percent } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { BarList, Funnel } from "@/components/charts/static";
import { ProductImage } from "@/components/commerce/product-image";
import { ToastButton } from "@/components/seller/client-kit";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { completedDays, productReport } from "@/lib/mock/seller-extra";
import { sellerDaily } from "@/lib/mock";
import { formatCompact, formatDate, formatDateShort, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Business reports" };

const RANGES = [7, 14, 28] as const;
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

export default async function AnalyticsPage(props: PageProps<"/seller/analytics">) {
  const sp = await props.searchParams;
  const raw = Number(Array.isArray(sp.range) ? sp.range[0] : sp.range);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 14;

  const win = completedDays(days);
  const completed = sellerDaily.slice(0, -1);
  const prevWin = completed.length >= days * 2 ? completed.slice(-days * 2, -days) : undefined;
  const total = (arr: typeof win, k: "sales" | "units" | "pageViews" | "orders") => arr.reduce((a, d) => a + d[k], 0);
  const sales = total(win, "sales");
  const units = total(win, "units");
  const orders = total(win, "orders");
  const sessions = Math.round(total(win, "pageViews") * 0.74);
  const usp = (units / sessions) * 100;
  const prev = prevWin && {
    sales: total(prevWin, "sales"),
    units: total(prevWin, "units"),
    sessions: Math.round(total(prevWin, "pageViews") * 0.74),
    usp: (total(prevWin, "units") / Math.round(total(prevWin, "pageViews") * 0.74)) * 100,
  };
  const report = productReport(days);
  const featured = Math.round(report.rows.reduce((a, r) => a + r.featuredPct * r.sessions, 0) / (report.rows.reduce((a, r) => a + r.sessions, 0) || 1));

  const salesChart = win.map((d) => ({ label: formatDateShort(d.date), sales: d.sales }));
  const trafficChart = win.map((d) => ({ label: formatDateShort(d.date), sessions: Math.round(d.pageViews * 0.74) }));
  const productViews = Math.round(sessions * 0.81);
  const funnel = [
    { stage: "Sessions", value: sessions },
    { stage: "Viewed a product page", value: productViews },
    { stage: "Added to cart", value: Math.round(productViews * 0.14) },
    { stage: "Ordered", value: orders },
  ];
  const deltaLabel = `vs previous ${days} days`;

  return (
    <>
      <PageHeader
        title="Business reports"
        description="Sales and traffic for your listings. Completed days only, so today's partial numbers never read as a drop."
        actions={
          <ToastButton icon="download" message={`Business report for the last ${days} days exported as CSV, by date and by listing.`}>
            Export CSV
          </ToastButton>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabLinks variant="pill" active={String(days)} items={RANGES.map((r) => ({ key: String(r), label: `Last ${r} days`, href: `?range=${r}` }))} />
        <p className="text-[13px] text-ink-500">
          {formatDate(win[0]!.date)} to {formatDate(win.at(-1)!.date)}
          {prev ? `, compared with the ${days} days before` : ""}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ordered product sales" value={formatCompact(sales, true)} delta={prev ? pct(sales, prev.sales) : undefined} deltaLabel={deltaLabel} icon={IndianRupee} footer={`${formatNumber(orders)} orders, average ${formatINR(Math.round(sales / orders))}`} />
        <StatCard label="Units ordered" value={formatNumber(units)} delta={prev ? pct(units, prev.units) : undefined} deltaLabel={deltaLabel} icon={Package} footer={`${(units / orders).toFixed(2)} units per order`} />
        <StatCard label="Sessions" value={formatCompact(sessions)} delta={prev ? pct(sessions, prev.sessions) : undefined} deltaLabel={deltaLabel} icon={Eye} footer={`${formatCompact(total(win, "pageViews"))} page views`} />
        <StatCard label="Unit session percentage" value={`${usp.toFixed(2)}%`} delta={prev ? pct(usp, prev.usp) : undefined} deltaLabel={deltaLabel} icon={Percent} footer={`Featured offer shown on ${featured}% of views`} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Ordered product sales" description="Per day" />
          <div className="px-5 pt-4 pb-5">
            <AreaChart data={salesChart} series={[{ key: "sales", label: "Ordered product sales" }]} format="inr" height={240} ariaLabel={`Ordered product sales per day, last ${days} completed days`} />
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Sessions" description="Unique visits to your product pages per day" />
          <div className="px-5 pt-4 pb-5">
            <BarChart data={trafficChart} series={[{ key: "sessions", label: "Sessions" }]} format="compact" height={240} ariaLabel={`Sessions per day, last ${days} completed days`} />
          </div>
        </Card>
      </div>

        <Card className="mb-6 min-w-0 overflow-hidden">
          <CardHeader title="By listing" description="Sorted by ordered product sales" />
          <TableContainer className="mt-3">
            <Table className="min-w-[860px]">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Listing</TH>
                  <TH align="right">Sessions</TH>
                  <TH align="right">Page views</TH>
                  <TH align="right">Unit session %</TH>
                  <TH align="right">Units</TH>
                  <TH align="right">Sales</TH>
                  <TH align="right">Featured offer</TH>
                </TR>
              </THead>
              <TBody>
                {report.rows.map((r) => (
                  <TR key={r.listingId}>
                    <TD>
                      <div className="flex max-w-[16rem] items-center gap-3">
                        <ProductImage src={r.image} alt="" size={36} rounded="md" />
                        <div className="min-w-0">
                          <Link href={`/seller/catalog/${r.listingId}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
                            {r.title}
                          </Link>
                          <p className="truncate font-mono text-[11px] text-ink-500">
                            {r.bsin}, {r.sku}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD align="right">{formatNumber(r.sessions)}</TD>
                    <TD align="right">{formatNumber(r.pageViews)}</TD>
                    <TD align="right">{r.unitSessionPct.toFixed(2)}%</TD>
                    <TD align="right">{formatNumber(r.units)}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatCompact(r.sales, true)}
                    </TD>
                    <TD align="right">{r.featuredPct ? `${r.featuredPct}%` : "None"}</TD>
                  </TR>
                ))}
                <TR className="bg-ink-50/50">
                  <TD className="text-[13px] text-ink-600">All other listings ({formatNumber(report.other.count)})</TD>
                  <TD align="right">{formatNumber(report.other.sessions)}</TD>
                  <TD align="right">{formatNumber(report.other.pageViews)}</TD>
                  <TD align="right">{report.other.sessions ? ((report.other.units / report.other.sessions) * 100).toFixed(2) : "0.00"}%</TD>
                  <TD align="right">{formatNumber(report.other.units)}</TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {formatCompact(report.other.sales, true)}
                  </TD>
                  <TD align="right" className="text-ink-400">
                    Mixed
                  </TD>
                </TR>
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Conversion funnel" description={`Last ${days} days`} />
          <div className="px-5 pt-4 pb-5">
            <Funnel stages={funnel} />
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              {((orders / sessions) * 100).toFixed(1)}% of sessions ended in an order. Cart abandonment is the biggest drop; coupons and the featured offer help most there.
            </p>
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Sessions by listing" description={`Top listings, last ${days} days`} />
          <div className="px-5 pt-4 pb-5">
            <BarList items={report.rows.slice(0, 7).map((r) => ({ label: r.title.split(/[,(]/)[0]!.trim(), value: r.sessions, href: `/seller/catalog/${r.listingId}` }))} />
          </div>
        </Card>
      </div>
    </>
  );
}
