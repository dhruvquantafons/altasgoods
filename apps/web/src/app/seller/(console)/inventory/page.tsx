import Link from "next/link";
import { CircleAlert, Warehouse } from "lucide-react";
import { BarList, StackedBar } from "@/components/charts/static";
import { ProductImage } from "@/components/commerce/product-image";
import { InboundWizard } from "@/components/seller/inventory/inbound-wizard";
import { Callout, ChannelBadge, MiniStat, Mono, StatStrip } from "@/components/seller/primitives";
import { ToastButton } from "@/components/seller/client-kit";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { getProduct } from "@/lib/mock";
import { FULFILMENT_CENTRES, INBOUND_STATUS, inboundShipments, inventoryRows, type InventoryRow } from "@/lib/mock/seller-extra";
import { LISTING_STATUS, type Tone } from "@/lib/status";
import { cn, formatDate, formatDateShort, formatDateTime, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Inventory" };

const TABS = [
  { key: "stock", label: "Stock" },
  { key: "health", label: "Fulfilled inventory health" },
  { key: "inbound", label: "Inbound shipments" },
  { key: "restock", label: "Restock" },
] as const;

function cover(days: number): { word: string; tone: Tone } {
  if (days <= 7) return { word: "Critical", tone: "danger" };
  if (days <= 21) return { word: "Low", tone: "warning" };
  if (days > 120) return { word: "Excess", tone: "info" };
  return { word: "Healthy", tone: "success" };
}

const toneText: Record<Tone, string> = {
  neutral: "text-ink-600",
  info: "text-info-700",
  brand: "text-brand-700",
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-danger-700",
  accent: "text-accent-700",
};

function ProductCellSmall({ r }: { r: InventoryRow }) {
  return (
    <div className="flex max-w-[15rem] items-center gap-3 2xl:max-w-[19rem]">
      <ProductImage src={r.image} alt="" size={40} rounded="md" />
      <div className="min-w-0">
        <Link href={`/seller/catalog/${r.listingId}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
          {r.title}
        </Link>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          <span className="font-mono">{r.sku}</span>
          {r.fc && (
            <>
              , <span className="font-mono">{r.fc}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default async function InventoryPage(props: PageProps<"/seller/inventory">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const lowOnly = one(sp.filter) === "low";
  const tab = TABS.find((t) => t.key === one(sp.tab))?.key ?? "stock";

  const sellable = inventoryRows.reduce((a, r) => a + r.sellerAvailable + r.fcAvailable, 0);
  const inbound = inventoryRows.reduce((a, r) => a + r.fcInbound, 0);
  const reserved = inventoryRows.reduce((a, r) => a + r.sellerReserved + r.fcReserved, 0);
  const unfulfillable = inventoryRows.reduce((a, r) => a + r.fcUnfulfillable, 0);
  const low = inventoryRows.filter((r) => r.daysOfCover <= 21 && r.status !== "inactive");
  const restock = inventoryRows.filter((r) => r.restockQty > 0).sort((a, b) => a.daysOfCover - b.daysOfCover);
  const stranded = inventoryRows.filter((r) => r.channel === "fulfilled" && r.status === "suppressed" && r.fcAvailable > 0);
  const rows = lowOnly ? low : inventoryRows;
  const openInbound = inboundShipments.filter((s) => !["closed", "cancelled", "received"].includes(s.status));

  const tabs = TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}`, count: t.key === "inbound" ? openInbound.length : t.key === "restock" ? restock.length : undefined }));

  const fcRows = inventoryRows.filter((r) => r.channel === "fulfilled");
  const ageing = fcRows.reduce((a, r) => [a[0]! + r.ageing[0], a[1]! + r.ageing[1], a[2]! + r.ageing[2]], [0, 0, 0]);
  const cubicFeet = fcRows.reduce((a, r) => a + (r.fcAvailable + r.fcReserved) * (["Laptops", "Monitors", "Kitchen Appliances"].includes(getProduct(r.listingId)?.subcategory ?? "") ? 0.62 : 0.17), 0);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock at your Andheri warehouse and in BluBuy fulfilment centres, with restock recommendations from your last 30 days of sales."
        actions={
          <InboundWizard
            centres={FULFILMENT_CENTRES}
            candidates={inventoryRows
              .filter((r) => r.channel === "fulfilled" && r.status !== "inactive")
              .sort((a, b) => b.restockQty - a.restockQty)
              .map((r) => ({ id: r.listingId, title: r.title, image: r.image, sku: r.sku, recommended: r.restockQty, daysOfCover: r.daysOfCover }))}
          />
        }
      />

      <StatStrip className="mb-6">
        <MiniStat label="Sellable units" value={formatNumber(sellable)} hint="Warehouse and fulfilment centres" />
        <MiniStat label="Inbound to fulfilment centres" value={formatNumber(inbound)} hint={`${openInbound.length} shipments open`} />
        <MiniStat label="Reserved for open orders" value={formatNumber(reserved)} hint="Released when shipped or cancelled" />
        <MiniStat label="Low or out of stock" value={low.length} hint={`${formatNumber(unfulfillable)} units unfulfillable`} tone={low.length ? "warning" : undefined} />
      </StatStrip>

      <TabLinks items={tabs} active={tab} className="mb-4" />

      {tab === "stock" && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <TabLinks
              variant="pill"
              active={lowOnly ? "low" : "all"}
              items={[
                { key: "all", label: "All listings", href: "?tab=stock", count: inventoryRows.length },
                { key: "low", label: "Low stock", href: "?tab=stock&filter=low", count: low.length },
              ]}
            />
            <ToastButton size="sm" icon="upload" message="Stock update template downloaded. Upload it from Bulk upload.">
              Bulk update stock
            </ToastButton>
          </div>
          <TableContainer>
            <Table className="min-w-[1040px]">
              <THead className="border-t-0">
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH>Channel</TH>
                  <TH align="right">Warehouse</TH>
                  <TH align="right">FC available</TH>
                  <TH align="right">Inbound</TH>
                  <TH align="right">Reserved</TH>
                  <TH align="right">Unfulfillable</TH>
                  <TH align="right">Per day</TH>
                  <TH>Cover</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const c = cover(r.daysOfCover);
                  return (
                    <TR key={r.listingId}>
                      <TD>
                        <ProductCellSmall r={r} />
                      </TD>
                      <TD>
                        <ChannelBadge channel={r.channel} />
                        {r.status !== "live" && (
                          <div className="mt-1">
                            <StatusBadge meta={LISTING_STATUS[r.status]} size="sm" />
                          </div>
                        )}
                      </TD>
                      <TD align="right">{formatNumber(r.sellerAvailable)}</TD>
                      <TD align="right" className={r.channel === "fulfilled" && r.fcAvailable === 0 ? "font-medium text-danger-700" : undefined}>
                        {r.channel === "fulfilled" ? formatNumber(r.fcAvailable) : <span className="text-ink-400">None</span>}
                      </TD>
                      <TD align="right">{r.fcInbound ? formatNumber(r.fcInbound) : <span className="text-ink-400">0</span>}</TD>
                      <TD align="right">{formatNumber(r.sellerReserved + r.fcReserved)}</TD>
                      <TD align="right" className={r.fcUnfulfillable ? "text-warning-700" : undefined}>
                        {formatNumber(r.fcUnfulfillable)}
                      </TD>
                      <TD align="right">{r.velocity.toFixed(1)}</TD>
                      <TD>
                        <p className={cn("text-[13px] font-medium tabular-nums", toneText[c.tone])}>{r.daysOfCover > 365 ? "365+ days" : `${r.daysOfCover} ${r.daysOfCover === 1 ? "day" : "days"}`}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{c.word}</p>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === "health" && (
        <div className="flex flex-col gap-6">
          {stranded.length > 0 && (
            <Callout
              tone="warning"
              icon={CircleAlert}
              title={`${formatNumber(stranded.reduce((a, r) => a + r.fcAvailable, 0))} units are stranded`}
              action={
                <Link href="/seller/catalog?tab=suppressed" className="text-[13px] font-medium text-brand-700 hover:underline">
                  Fix listings
                </Link>
              }
            >
              {stranded.map((r) => r.title.split(/[,(]/)[0]!.trim()).join(" and ")} sit in fulfilment centres while their listings are suppressed. They earn nothing and still pay storage.
            </Callout>
          )}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Inventory age" description="Units in fulfilment centres by days since receipt. Units over 180 days pay an aged surcharge." />
              <div className="px-5 pt-4 pb-5">
                <StackedBar
                  format="number"
                  segments={[
                    { label: "0 to 90 days", value: ageing[0]! },
                    { label: "91 to 180 days", value: ageing[1]! },
                    { label: "181 to 365 days (₹10 per unit a month)", value: ageing[2]! },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Storage this month" description="October is peak season" />
              <div className="px-5 pt-3 pb-5">
                <p className="text-[28px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(Math.round(cubicFeet * 50))}</p>
                <p className="mt-2 text-[13px] text-ink-600">
                  Estimated for {formatNumber(Math.round(cubicFeet))} cubic feet at ₹50 per cubic foot (October to December). January to September is ₹35.
                </p>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Fulfilment centre stock by product" description="Available units" />
              <div className="px-5 pt-4 pb-5">
                <BarList items={fcRows.sort((a, b) => b.fcAvailable - a.fcAvailable).slice(0, 7).map((r) => ({ label: r.title.split(/[,(]/)[0]!.trim(), value: r.fcAvailable, hint: r.fc }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Unfulfillable units" description="Graded at receipt or found damaged in storage" />
              <ul className="mt-2 divide-y divide-line">
                {fcRows
                  .filter((r) => r.fcUnfulfillable > 0)
                  .map((r, i) => (
                    <li key={r.listingId} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink-900">{r.title}</p>
                        <p className="text-xs text-ink-500">{["Customer damaged", "Carrier damaged", "Defective", "Warehouse damaged (reimbursed automatically)"][i % 4]}</p>
                      </div>
                      <span className="shrink-0 text-[13px] font-medium text-ink-900 tabular-nums">{r.fcUnfulfillable}</span>
                    </li>
                  ))}
              </ul>
              <div className="flex justify-end border-t border-line px-5 py-3">
                <ToastButton size="sm" message="Removal order created. Units ship back to your Andheri warehouse at ₹10 per unit plus shipping.">
                  Create removal order
                </ToastButton>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "inbound" && (
        <Card className="overflow-hidden">
          <TableContainer>
            <Table className="min-w-[1000px]">
              <THead className="border-t-0">
                <TR className="hover:bg-transparent">
                  <TH>Shipment</TH>
                  <TH>Destination</TH>
                  <TH>Status</TH>
                  <TH align="right">Boxes</TH>
                  <TH align="right">Units sent</TH>
                  <TH align="right">Received</TH>
                  <TH>Discrepancies</TH>
                  <TH>Appointment</TH>
                </TR>
              </THead>
              <TBody>
                {inboundShipments.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Mono className="font-medium text-ink-900">{s.id}</Mono>
                      <p className="mt-0.5 max-w-[15rem] truncate text-xs text-ink-500">{s.name}</p>
                    </TD>
                    <TD>
                      <p className="flex items-center gap-1.5 text-[13px] text-ink-800">
                        <Warehouse size={14} className="text-ink-400" aria-hidden="true" />
                        {s.fc.name}
                      </p>
                      <Mono className="text-[11px] text-ink-500">{s.fc.code}</Mono>
                    </TD>
                    <TD>
                      <StatusBadge meta={INBOUND_STATUS[s.status]} size="sm" />
                    </TD>
                    <TD align="right">{s.boxes}</TD>
                    <TD align="right">{formatNumber(s.unitsSent)}</TD>
                    <TD align="right">{s.unitsReceived ? formatNumber(s.unitsReceived) : <span className="text-ink-400">None yet</span>}</TD>
                    <TD>
                      {s.damaged || s.shortage ? (
                        <span className="text-[13px] text-warning-700">
                          {[s.damaged ? `${s.damaged} damaged` : "", s.shortage ? `${s.shortage} short` : ""].filter(Boolean).join(", ")}
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-500">None</span>
                      )}
                    </TD>
                    <TD className="text-[13px] text-ink-700">
                      {s.appointmentAt ? formatDateTime(s.appointmentAt) : s.status === "draft" ? <Badge size="sm">Not booked</Badge> : <span className="text-ink-400">Not applicable</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Shipments close 14 days after receipt. Discrepancies are investigated automatically; lost or damaged units inside a centre are reimbursed without a claim.</p>
        </Card>
      )}

      {tab === "restock" && (
        <Card className="overflow-hidden">
          <CardHeader title="Restock recommendations" description="Target: 45 days of cover, including a 7 day inbound lead time. Based on average units sold per day over the last 30 days." />
          <TableContainer className="mt-3">
            <Table className="min-w-[860px]">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH align="right">Available</TH>
                  <TH align="right">Inbound</TH>
                  <TH align="right">Sold per day</TH>
                  <TH>Days of cover</TH>
                  <TH align="right">Recommended</TH>
                  <TH>Send by</TH>
                </TR>
              </THead>
              <TBody>
                {restock.map((r) => {
                  const c = cover(r.daysOfCover);
                  return (
                    <TR key={r.listingId}>
                      <TD>
                        <ProductCellSmall r={r} />
                      </TD>
                      <TD align="right">{formatNumber(r.fcAvailable + r.sellerAvailable)}</TD>
                      <TD align="right">{formatNumber(r.fcInbound)}</TD>
                      <TD align="right">{r.velocity.toFixed(1)}</TD>
                      <TD>
                        <span className={cn("text-[13px] font-medium", toneText[c.tone])}>
                          {r.daysOfCover} {r.daysOfCover === 1 ? "day" : "days"}, {c.word.toLowerCase()}
                        </span>
                      </TD>
                      <TD align="right" className="font-semibold text-ink-900">
                        {formatNumber(r.restockQty)}
                      </TD>
                      <TD className="text-[13px] text-ink-700">{r.restockBy ? formatDate(r.restockBy) : "Now"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
            Diwali Dhamaka starts {formatDateShort("2026-10-28")}. Deals need at least 50 units in a fulfilment centre, so send stock for nominated products early.
          </p>
        </Card>
      )}
    </>
  );
}
