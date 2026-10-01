import { Search } from "lucide-react";
import { OrdersTable, type OrderRow, type OrderStageKey } from "@/components/seller/orders/orders-table";
import { AutoSubmitSelect, ToastButton } from "@/components/seller/client-kit";
import { MiniStat, StatStrip } from "@/components/seller/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TableFooter } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { ORDER_STAGES, sellerLines, slaFor, istAt, type SellerLine } from "@/lib/mock/seller-extra";
import { PAYMENT_METHOD } from "@/lib/status";
import { formatDate, formatDateTime, formatWeekday, NOW, timeAgo } from "@/lib/utils";

export const metadata = { title: "Orders" };

const RANGES = [
  { key: "all", label: "Any time", days: Infinity },
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
];

function rowFor(l: SellerLine, stage: OrderStageKey): OrderRow {
  const pay = l.cod ? "COD" : `Prepaid, ${PAYMENT_METHOD[l.payment].replace("Credit / Debit card", "card").replace("Net banking", "net banking")}`;
  const base: OrderRow = {
    lineId: l.lineId,
    orderId: l.orderId,
    title: l.title,
    image: l.image,
    sku: l.sku,
    variant: l.variant,
    quantity: l.quantity,
    total: l.total,
    payment: pay,
    cod: l.cod,
    channel: l.channel,
    fc: l.fc,
    status: l.status,
    buyer: l.buyer,
    city: l.city,
    pincode: l.pincode,
    placed: timeAgo(l.placedAt),
    awb: l.awb,
  };
  if (stage === "new" && l.acceptBy) return { ...base, dueAt: l.acceptBy, dueLabel: formatDateTime(l.acceptBy) };
  if ((stage === "to_pack" || stage === "ready") && l.dispatchBy)
    return { ...base, dueAt: l.dispatchBy, dueLabel: l.channel === "fulfilled" ? `FC ships by ${formatDateTime(l.dispatchBy)}` : formatDateTime(l.dispatchBy) };
  if (stage === "shipped") return { ...base, dateText: formatWeekday(l.promisedBy), dateHint: l.awb ? `AWB ${l.awb}` : undefined };
  if (stage === "delivered")
    return { ...base, dateText: l.deliveredAt ? formatDate(l.deliveredAt) : "Delivered", dateHint: l.returnWindowEnds ? `Return window ends ${formatDate(l.returnWindowEnds)}` : undefined };
  if (stage === "cancelled") return { ...base, dateText: `By ${l.cancelledBy?.toLowerCase() ?? "customer"}`, dateHint: l.cancelReason };
  return { ...base, dateText: l.status === "return_requested" ? "Return requested" : "Returning to you", dateHint: "See Returns for pickup and QC" };
}

export default async function OrdersPage(props: PageProps<"/seller/orders">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const stage = (ORDER_STAGES.some((s) => s.key === one(sp.tab)) ? one(sp.tab) : "new") as OrderStageKey;
  const q = one(sp.q).trim().toLowerCase();
  const channel = ["fulfilled", "ship"].includes(one(sp.channel)) ? one(sp.channel) : "all";
  const range = RANGES.find((r) => r.key === one(sp.range)) ?? RANGES[0]!;

  const startOfToday = istAt(NOW, 0, 0).getTime();
  const filtered = sellerLines.filter((l) => {
    if (channel !== "all" && l.channel !== channel) return false;
    if (range.days !== Infinity) {
      const t = new Date(l.placedAt).getTime();
      const from = range.days === 0 ? startOfToday : NOW.getTime() - range.days * 86400_000;
      if (t < from) return false;
    }
    if (q) {
      const hay = `${l.lineId} ${l.orderId} ${l.title} ${l.sku} ${l.bsin} ${l.buyer} ${l.city} ${l.pincode} ${l.awb ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const def = ORDER_STAGES.find((s) => s.key === stage)!;
  const rows = filtered.filter((l) => l.stage === stage).map((l) => rowFor(l, stage));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { tab: stage, q: one(sp.q), channel, range: range.key, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "channel" && v === "all") && !(k === "range" && v === "all")) p.set(k, v);
    return `?${p.toString()}`;
  };

  const tabs = ORDER_STAGES.map((s) => ({ key: s.key, label: s.label, href: qs({ tab: s.key }), count: filtered.filter((l) => l.stage === s.key).length }));

  // summary strip: seller-packed work due today
  const preShip = sellerLines.filter((l) => ["new", "to_pack", "ready"].includes(l.stage));
  const shipLines = preShip.filter((l) => l.channel === "ship");
  const dueToday = shipLines.filter((l) => l.dispatchBy && new Date(l.dispatchBy).getTime() < istAt(NOW, 23, 59).getTime());
  const overdue = shipLines.filter((l) => l.dispatchBy && slaFor(l.dispatchBy).overdue);
  const cutoff = istAt(NOW, 14, 0);
  const awaitingPickup = shipLines.filter((l) => l.status === "packed" || l.status === "ready_to_ship");

  const filtersActive = Boolean(q) || channel !== "all" || range.key !== "all";

  const toolbar = (
    <form method="get" className="flex flex-col gap-2.5 px-5 py-3.5 md:flex-row md:items-center">
      <input type="hidden" name="tab" value={stage} />
      <Input name="q" defaultValue={one(sp.q)} icon={Search} inputSize="sm" placeholder="Search order ID, SKU, product, buyer or pincode" className="w-full md:max-w-sm" aria-label="Search orders" />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AutoSubmitSelect name="range" defaultValue={range.key} selectSize="sm" aria-label="Order date" className="min-w-0 flex-1 sm:w-36 sm:flex-none">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="channel" defaultValue={channel} selectSize="sm" aria-label="Fulfilment channel" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
          <option value="all">All channels</option>
          <option value="ship">BluBuy Ship</option>
          <option value="fulfilled">BluBuy Fulfilled</option>
        </AutoSubmitSelect>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {filtersActive && (
          <a href={`?tab=${stage}`} className="px-1 text-[13px] font-medium text-brand-700 hover:underline">
            Clear filters
          </a>
        )}
      </div>
    </form>
  );

  return (
    <>
      <PageHeader
        title="Orders"
        description="Confirm, pack and hand over seller-packed orders. BluBuy Fulfilled orders are processed by the fulfilment centre and shown here for tracking."
        actions={
          <ToastButton icon="download" message="Orders report for the last 30 days is being prepared. It will appear in Reports in about a minute.">
            Download report
          </ToastButton>
        }
      />

      <StatStrip className="mb-6">
        <MiniStat label="Dispatch today" value={dueToday.length} hint="BluBuy Ship orders due by 6:00 PM" tone={dueToday.length ? "warning" : undefined} />
        <MiniStat label="Overdue" value={overdue.length} hint={overdue.length ? "Past the dispatch by date" : "Nothing late, keep it up"} />
        <MiniStat label="Awaiting pickup" value={awaitingPickup.length} hint="Slot today, 4:00 to 6:00 PM" />
        <MiniStat
          label="Same-day cutoff"
          value={NOW < cutoff ? slaFor(cutoff.toISOString()).label.replace(" left", "") : "Passed"}
          hint="Confirm by 2:00 PM to ship today"
        />
      </StatStrip>

      <TabLinks items={tabs} active={stage} className="mb-4" />

      <Card className="overflow-hidden">
        <OrdersTable
          rows={rows}
          stage={stage}
          toolbar={toolbar}
          emptyHint={filtersActive ? "No orders match these filters. Clear filters to see every order in this stage." : `Nothing in ${def.label.toLowerCase()} right now. ${def.hint}`}
        />
        {rows.length > 0 && <TableFooter shown={rows.length} total={rows.length} label={rows.length === 1 ? "order" : "orders"} />}
      </Card>
    </>
  );
}
