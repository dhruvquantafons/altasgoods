import Link from "next/link";
import { ArrowRight, IndianRupee, PackageCheck, ReceiptIndianRupee, RotateCcw, ShoppingCart, TriangleAlert, Truck } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { loadOverview } from "@/lib/api/admin-system";
import { paise, uiOrderStatus, uiPaymentMethod } from "@/lib/api/format";
import { currentUser } from "@/lib/api/server";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { formatDateShort, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const [o, user] = await Promise.all([loadOverview(), currentUser()]);
  const chart = o.series.map((d) => ({ label: formatDateShort(d.date), orders: d.orders, revenue: Math.round(d.revenuePaise / 100) }));
  const work = [
    { label: "To accept", value: o.work.toAccept, href: "/admin/orders", icon: ShoppingCart },
    { label: "To pack", value: o.work.toPack, href: "/admin/orders?view=pack", icon: PackageCheck },
    { label: "To hand over", value: o.work.toHandOver, href: "/admin/orders?view=ship", icon: Truck },
    { label: "Returns waiting", value: o.work.returnsWaiting, href: "/admin/returns", icon: RotateCcw },
    { label: "Refunds pending", value: o.work.refundsPending, hint: o.work.refundsPending ? paise(o.work.refundsPendingPaise) : undefined, href: "/admin/payments?tab=refunds", icon: ReceiptIndianRupee },
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${(user?.name ?? "there").split(" ")[0]}`}
        description="How the store is doing, and what is waiting for you."
        actions={
          <ButtonLink href="/admin/orders" iconRight={ArrowRight}>
            Open orders
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
        <StatCard label="Sales today" value={paise(o.today.revenuePaise)} icon={IndianRupee} footer={`${formatNumber(o.today.orders)} order${o.today.orders === 1 ? "" : "s"} since midnight`} />
        <StatCard label="Last 7 days" value={paise(o.last7Days.revenuePaise)} icon={IndianRupee} footer={`${formatNumber(o.last7Days.orders)} orders`} />
        <StatCard label="Last 30 days" value={paise(o.last30Days.revenuePaise)} icon={IndianRupee} footer={`${formatNumber(o.last30Days.orders)} orders`} />
        <StatCard label="Average order" value={paise(o.averageOrderPaise)} icon={ShoppingCart} footer="Over the last 30 days" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Waiting for you" description="Order lines, returns and refunds that need someone from the store" />
        <ul className="grid grid-cols-2 gap-px overflow-hidden border-t border-line bg-line sm:grid-cols-3 xl:grid-cols-5">
          {work.map((w) => (
            <li key={w.label} className="bg-white">
              <Link href={w.href} className="flex h-full items-center gap-3 px-5 py-4 hover:bg-ink-50/70">
                <w.icon size={18} className={w.value ? "text-brand-600" : "text-ink-300"} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xl font-semibold text-ink-900 tabular-nums">{w.value}</span>
                  <span className="block text-xs text-ink-500">
                    {w.label}
                    {w.hint ? `, ${w.hint}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Orders, last 14 days" description="Orders that went through each day (India time), cancellations left out" />
            <div className="px-5 pt-3 pb-5">
              <AreaChart data={chart} series={[{ key: "orders", label: "Orders" }]} height={240} ariaLabel="Orders per day over the last 14 days" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Latest orders" action={<ButtonLink href="/admin/orders?view=all" variant="ghost" size="xs" iconRight={ArrowRight}>All orders</ButtonLink>} />
            {o.latestOrders.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders appear here as customers place them." />
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {o.latestOrders.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/orders/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/70">
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px] font-medium text-ink-900">{r.id}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {r.customerName}, {formatDateTime(r.placedAt)}, {PAYMENT_METHOD[uiPaymentMethod(r.paymentMethod)]}
                        </span>
                      </span>
                      <StatusBadge meta={ORDER_STATUS[uiOrderStatus(r.status)]} size="sm" />
                      <span className="w-24 text-right text-[13px] font-semibold text-ink-900 tabular-nums">{paise(r.totalPaise)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Best sellers" description="Units sold, last 30 days" />
            {o.topProducts.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No sales in the last 30 days.</p>
            ) : (
              <ol className="mt-2 divide-y divide-line">
                {o.topProducts.map((p) => (
                  <li key={p.productId}>
                    <Link href={`/admin/catalog/${p.productId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50/70">
                      <ProductImage src={p.image} alt="" size={36} rounded="md" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{p.title}</span>
                      <span className="text-right text-xs text-ink-500 tabular-nums">
                        <span className="block font-semibold text-ink-900">{p.units} sold</span>
                        {paise(p.revenuePaise)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title="Running low" description="Live products with 5 or fewer in stock" />
            {o.lowStock.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">Everything is well stocked.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {o.lowStock.map((p) => (
                  <li key={p.productId}>
                    <Link href={`/admin/catalog/${p.productId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50/70">
                      {p.image && <ProductImage src={p.image} alt="" size={36} rounded="md" />}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{p.title}</span>
                      <span className={p.stock === 0 ? "inline-flex items-center gap-1 text-xs font-semibold text-danger-700" : "text-xs font-semibold text-warning-700"}>
                        {p.stock === 0 && <TriangleAlert size={13} aria-hidden="true" />}
                        {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
