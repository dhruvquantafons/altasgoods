import Link from "next/link";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, paginate, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { orders } from "@/lib/mock";
import { orderShipments } from "@/lib/mock/admin-extra";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, type OrderStatus, type PaymentMethod } from "@/lib/status";
import type { Order } from "@/lib/types";
import { cn, formatDateShort, formatDateTime, formatINR, NOW } from "@/lib/utils";
import { PackageSearch } from "lucide-react";

export const metadata = { title: "Orders" };

const TERMINAL: OrderStatus[] = ["delivered", "cancelled", "returned", "returned_to_seller", "return_requested"];

function isLate(o: Order) {
  return !TERMINAL.includes(o.status) && new Date(o.promisedBy) < NOW;
}

const VIEWS: { key: string; label: string; match: (o: Order) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "attention", label: "Needs attention", match: (o) => ["pending_payment", "undelivered", "rto_in_transit"].includes(o.status) || isLate(o) },
  { key: "to_ship", label: "To ship", match: (o) => ["placed", "confirmed", "packed", "ready_to_ship"].includes(o.status) },
  { key: "in_transit", label: "In transit", match: (o) => ["shipped", "in_transit", "out_for_delivery"].includes(o.status) },
  { key: "delivered", label: "Delivered", match: (o) => o.status === "delivered" },
  { key: "returns", label: "Returns and RTO", match: (o) => ["return_requested", "returned", "returned_to_seller", "rto_in_transit"].includes(o.status) },
  { key: "cancelled", label: "Cancelled", match: (o) => o.status === "cancelled" },
];

const startOfToday = new Date(NOW);
startOfToday.setHours(0, 0, 0, 0);

const DATE_RANGES: Record<string, number> = { today: 0, "7d": 7, "30d": 30 };

export default async function OrdersPage(props: PageProps<"/admin/orders">) {
  const params = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp(params, "view"))?.key ?? "all";
  const q = sp(params, "q")?.trim() ?? "";
  const payment = sp(params, "payment") ?? "all";
  const channel = sp(params, "channel") ?? "all";
  const date = sp(params, "date") ?? "all";
  const city = sp(params, "city") ?? "all";
  const page = Number(sp(params, "page") ?? 1) || 1;

  const awbs = new Map(orders.map((o) => [o.id, orderShipments(o).map((s) => s.awb ?? "")]));
  const needle = q.toLowerCase();

  const base = orders.filter((o) => {
    if (needle && !(o.id.toLowerCase().includes(needle) || o.customerName.toLowerCase().includes(needle) || awbs.get(o.id)!.some((a) => a.toLowerCase().includes(needle)))) return false;
    if (payment !== "all" && o.payment.method !== payment) return false;
    if (channel !== "all" && o.channel !== channel) return false;
    if (city !== "all" && o.address.city !== city) return false;
    if (date !== "all") {
      const days = DATE_RANGES[date] ?? 0;
      const from = new Date(startOfToday.getTime() - days * 86_400_000);
      if (new Date(o.placedAt) < from) return false;
    }
    return true;
  });

  const current = { view: view === "all" ? undefined : view, q: q || undefined, payment: payment === "all" ? undefined : payment, channel: channel === "all" ? undefined : channel, date: date === "all" ? undefined : date, city: city === "all" ? undefined : city };
  const filtered = base.filter(VIEWS.find((v) => v.key === view)!.match);
  const { rows, ...pg } = paginate(filtered, page, 20);
  const cities = [...new Set(orders.map((o) => o.address.city))].sort();

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every marketplace order, across sellers, channels and payment methods. Search by order ID, customer or AWB."
        actions={
          <ButtonLink href="/admin/reports?generate=rpt-orders" variant="secondary" size="sm" icon={Download}>
            Export
          </ButtonLink>
        }
      />

      <TabLinks
        className="mb-5"
        active={view}
        items={VIEWS.map((v) => ({ key: v.key, label: v.label, count: base.filter(v.match).length, href: hrefWith("/admin/orders", { ...current, view: v.key === "all" ? undefined : v.key }) }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/orders"
            q={q}
            placeholder="Order ID, customer or AWB"
            keep={{ view: current.view }}
            selects={[
              { name: "payment", label: "Payment method", value: payment, options: [{ value: "all", label: "All payments" }, ...(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))] },
              { name: "channel", label: "Channel", value: channel, className: "sm:w-36", options: [{ value: "all", label: "All channels" }, { value: "android", label: "Android" }, { value: "ios", label: "iOS" }, { value: "web", label: "Web" }] },
              { name: "date", label: "Placed", value: date, className: "sm:w-36", options: [{ value: "all", label: "Any date" }, { value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }] },
              { name: "city", label: "City", value: city, className: "sm:w-40", options: [{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))] },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No orders match these filters" description="Try a different order ID, AWB or customer name, or clear the filters." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Order</TH>
                  <TH className="hidden sm:table-cell">Customer</TH>
                  <TH className="hidden md:table-cell">Items</TH>
                  <TH className="hidden xl:table-cell">Payment</TH>
                  <TH align="right">Total</TH>
                  <TH className="hidden sm:table-cell">Status</TH>
                  <TH className="hidden lg:table-cell">Promised</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((o) => {
                  const first = o.items[0]!;
                  const sellers = new Set(o.items.map((it) => it.sellerId)).size;
                  const late = isLate(o);
                  return (
                    <TR key={o.id}>
                      <TD>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {o.id}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(o.placedAt)}, {o.channel === "ios" ? "iOS" : o.channel === "android" ? "Android" : "Web"}
                        </p>
                        <div className="mt-1 sm:hidden">
                          <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" />
                        </div>
                      </TD>
                      <TD className="hidden sm:table-cell">
                        <p className="text-[13px] font-medium text-ink-900">{o.customerName}</p>
                        <p className="text-xs text-ink-500">
                          {o.address.city} {o.address.pincode}
                        </p>
                      </TD>
                      <TD className="hidden md:table-cell">
                        <div className="flex max-w-[240px] items-center gap-2.5">
                          <ProductImage src={first.image} alt="" size={34} rounded="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-ink-800">{first.title}</span>
                            <span className="block text-xs text-ink-500">
                              {o.items.length > 1 ? `+${o.items.length - 1} more, ` : ""}
                              {sellers} {sellers === 1 ? "seller" : "sellers"}
                            </span>
                          </span>
                        </div>
                      </TD>
                      <TD className="hidden xl:table-cell">
                        <p className="text-[13px] text-ink-800">{PAYMENT_METHOD[o.payment.method]}</p>
                        <p className="text-xs text-ink-500">{PAYMENT_STATUS[o.payment.status].label}</p>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatINR(o.total)}
                      </TD>
                      <TD className="hidden sm:table-cell">
                        <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" />
                      </TD>
                      <TD className={cn("hidden text-[13px] lg:table-cell", late ? "font-medium text-danger-700" : "text-ink-600")}>
                        {formatDateShort(o.promisedBy)}
                        {late && <span className="block text-xs font-normal">Past promise</span>}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/orders" params={current} label="orders" {...pg} />
      </Card>
    </>
  );
}
