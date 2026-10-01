import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, CircleCheck, Info, PackageCheck, ShieldCheck, Tag, Warehouse } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { ToastButton, CopyId } from "@/components/seller/client-kit";
import { OrderActions } from "@/components/seller/orders/order-actions";
import { ShippingLabel, TaxInvoice } from "@/components/seller/orders/shipping-documents";
import { AmountRows, Callout, ChannelBadge, InfoGrid, Mono, SlaText } from "@/components/seller/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/interactive";
import { Timeline, type TimelineItem } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RATE_CARD_VERSION } from "@/lib/mock";
import { getListing, ORDER_STAGES, SELLER, settlementEstimate, type SellerLine } from "@/lib/mock/seller-extra";
import { CourierSimulator } from "@/components/seller/orders/courier-simulator";
import { uiItemStatus } from "@/lib/api/format";
import { daysSince, deliveredAtOf, loadSellerOrder, toSellerLine } from "@/lib/api/seller-orders";
import { loadSellerReturns } from "@/lib/api/seller-returns";
import type { ApiOrderItemStatus } from "@/lib/api/types";
import type { FeeLine, Order } from "@/lib/types";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/status";
import { currentTime } from "@/lib/api/support";
import { formatDate, formatDateTime, formatINR, formatWeekday } from "@/lib/utils";

const feeOf = (fees: FeeLine[], prefix: string) => fees.filter((f) => f.label.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);

const FEE_ROWS: { label: string; get: (l: SellerLine, fees: FeeLine[]) => number }[] = [
  { label: "Item price", get: (l) => l.total },
  { label: "Commission", get: (_, f) => feeOf(f, "Commission") },
  { label: "Fixed fee", get: (_, f) => feeOf(f, "Fixed fee") },
  { label: "Shipping fee", get: (_, f) => feeOf(f, "Shipping") },
  { label: "GST on fees (18%)", get: (_, f) => feeOf(f, "GST") },
  { label: "TCS (0.5%)", get: (_, f) => feeOf(f, "TCS") },
  { label: "TDS u/s 194-O (0.1%)", get: (_, f) => feeOf(f, "TDS") },
];

export async function generateMetadata(props: PageProps<"/seller/orders/[id]">) {
  const { id } = await props.params;
  return { title: `Order ${id}` };
}

const SELLER_EVENT: Record<string, string> = {
  placed: "Order placed by the customer",
  confirmed: "Order confirmed",
  packed: "Invoice and label generated, package packed",
  ready_to_ship: "Marked ready to ship and added to the manifest",
  shipped: "Picked up by BluBuy Logistics",
  in_transit: "In transit, reached the sort centre",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered, OTP verified at the door",
  undelivered: "Delivery attempt failed: customer not available",
  rto_in_transit: "Returning to you after failed attempts",
  returned_to_seller: "Returned to you",
  return_requested: "Customer requested a return",
  returned: "Return completed, refund issued",
};

function timelineFor(order: Order, line: SellerLine): TimelineItem[] {
  const items: TimelineItem[] = order.timeline
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      title: e.status === "confirmed" && line.channel === "fulfilled" ? "Accepted by the fulfilment centre" : (SELLER_EVENT[e.status] ?? e.label),
      time: formatDateTime(e.at),
      description: e.status === "packed" && line.awb ? `AWB ${line.awb}` : e.status === "ready_to_ship" && line.manifestId ? `Manifest ${line.manifestId}` : e.location,
      tone: e.status === "delivered" ? ("success" as const) : e.status === "undelivered" ? ("warning" as const) : undefined,
    }));
  if (line.status === "cancelled") {
    const at = order.timeline.at(-1)!.at;
    items.push({ title: `Cancelled by ${line.cancelledBy?.toLowerCase() ?? "the customer"}`, time: formatDateTime(at), description: line.cancelReason, tone: "neutral" });
  }
  const future: TimelineItem[] = [];
  if (line.channel === "ship") {
    if (line.status === "placed" && line.acceptBy) future.push({ title: "Confirm the order", time: `By ${formatDateTime(line.acceptBy)}`, done: false });
    if (["placed", "confirmed"].includes(line.status)) future.push({ title: "Generate the label and invoice, then pack", done: false });
    if (["placed", "confirmed", "packed"].includes(line.status) && line.dispatchBy)
      future.push({ title: "Mark ready to ship and hand over at pickup", time: `By ${formatDateTime(line.dispatchBy)}`, done: false });
  }
  if (["placed", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "undelivered"].includes(line.status))
    future.push({ title: "Delivery promised to the customer", time: formatWeekday(line.promisedBy), done: false });
  return [...items, ...future];
}

function packagingTips(subcategory: string) {
  if (["Laptops", "Monitors", "Cameras", "Tablets", "Smartphones"].includes(subcategory))
    return ["Double-wall carton with at least 5 cm of cushioning on every side", "Keep the brand box sealed; wrap it, do not tape the brand box itself", "Seal with BluBuy tamper-evident tape (Secure Delivery applies above ₹25,000)"];
  if (subcategory === "Kitchen Appliances")
    return ["Single-wall carton is fine if the brand box has moulded inserts", "Fill gaps so the product cannot move when shaken", "Mark the box \"This side up\" for glass doors and jars"];
  if (subcategory === "Cookware")
    return ["Wrap the handle and rim so they cannot scratch through the carton", "Single-wall carton with paper fill on all sides", "Put the invoice in the document pouch on the outside"];
  return ["Use a padded mailer or a snug single-wall carton", "Put the invoice in the document pouch on the outside", "Paste the label flat on the largest face, away from seams"];
}

export default async function OrderDetailPage(props: PageProps<"/seller/orders/[id]">) {
  const { id } = await props.params;
  const now = currentTime();
  const api = await loadSellerOrder(decodeURIComponent(id));
  const lines = api.items.map((it) => ({
    ...toSellerLine(
      { ...it, orderId: api.id, placedAt: api.placedAt, paymentMethod: api.paymentMethod, shipTo: { name: api.shipTo.name, city: api.shipTo.city, pincode: api.shipTo.pincode } },
      deliveredAtOf(api.events, it.id),
    ),
    state: api.shipTo.state,
  }));
  if (!lines.length) notFound();
  const firstItem = api.items[0]!.id;
  const order: Order = {
    id: api.id,
    customerId: "",
    customerName: api.shipTo.name,
    placedAt: api.placedAt,
    items: lines.map((l) => ({ id: l.lineId, productId: l.productId, title: l.title, image: l.image, variant: l.variant, sellerId: SELLER.id, quantity: l.quantity, price: l.price, mrp: l.mrp, status: l.status })),
    status: lines[0]!.status,
    payment: { method: lines[0]!.payment, status: api.paymentMethod === "COD" ? "cod_pending" : "captured", txnId: "" },
    address: { id: "ship-to", name: api.shipTo.name, phone: "", line1: "", city: api.shipTo.city, state: api.shipTo.state, pincode: api.shipTo.pincode, type: "home" },
    subtotal: lines.reduce((a, l) => a + l.total, 0),
    discount: 0,
    shippingFee: 0,
    platformFee: 0,
    total: lines.reduce((a, l) => a + l.total, 0),
    promisedBy: lines[0]!.promisedBy,
    timeline: api.events
      .filter((e) => e.orderItemId === firstItem && e.toStatus !== "NEW")
      .map((e) => ({ status: uiItemStatus(e.toStatus as ApiOrderItemStatus), label: e.toStatus, at: e.at, note: e.note ?? undefined })),
    channel: "web",
  };
  // placed time first, then the seller's journey
  order.timeline.unshift({ status: "placed", label: "Order placed", at: api.placedAt });
  const apiItems = new Map(api.items.map((i) => [i.id, i]));
  const shipLines = lines.filter((l) => l.channel !== "fulfilled");
  const primary = shipLines[0] ?? lines[0]!;
  const listing = getListing(primary.productId);
  const stage = ORDER_STAGES.find((s) => s.key === primary.stage)!;
  const otherItems = order.items.length - lines.length;
  const ret = (await loadSellerReturns().catch(() => [])).find((r) => r.orderId === order.id && r.status !== "CANCELLED");
  const daysSinceDelivery = primary.deliveredAt ? daysSince(primary.deliveredAt) : undefined;
  const preShip = ["placed", "confirmed", "packed", "ready_to_ship"].includes(primary.status);
  // real fee lines from the API once the order is confirmed; dates still estimated from the payout rules
  const estimates = lines.map((l) => {
    const base = settlementEstimate(l);
    const it = apiItems.get(l.itemId);
    if (!it?.fees) return { line: l, est: base };
    const fees = it.fees.map((f) => ({ label: f.label, amount: f.amountPaise / 100 }));
    return { line: l, est: { ...base, fees, deductions: fees.reduce((a, f) => a + f.amount, 0), net: (it.netSettlementPaise ?? 0) / 100 } };
  });
  const cancelled = primary.status === "cancelled";
  const yourTotal = lines.reduce((a, l) => a + l.total, 0);

  const est = estimates[0]!.est;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Orders", href: `/seller/orders?tab=${stage.key}` },
          { label: order.id },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-x-2">
            Order <span className="font-mono text-[20px] font-medium tracking-tight sm:text-[22px]">{order.id}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge meta={ORDER_STATUS[primary.status]} />
            {[...new Set(lines.map((l) => l.channel))].map((c) => (
              <ChannelBadge key={c} channel={c} size="md" />
            ))}
            <span className="text-[13px] text-ink-500">Placed {formatDateTime(order.placedAt)}</span>
          </>
        }
        actions={
          <OrderActions
            status={primary.status}
            sellerPacked={primary.channel !== "fulfilled"}
            orderId={order.id}
            returnId={ret?.id}
            daysSinceDelivery={daysSinceDelivery}
            weightKg={listing?.weightKg ?? 1}
            dims={listing?.dims ?? [24, 20, 10]}
            itemIds={lines.filter((l) => l.status === primary.status).map((l) => l.itemId)}
          />
        }
      />

      {process.env.NODE_ENV !== "production" && <CourierSimulator items={api.items.map((i) => ({ id: i.id, title: i.title, status: i.status }))} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader
              title="Your items"
              description={otherItems > 0 ? `${lines.length} of ${order.items.length} items in this order are yours. Other sellers ship the rest separately.` : "Every item in this order is fulfilled by you."}
            />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {lines.map((l) => (
                <li key={l.itemId} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start">
                  <ProductImage src={l.image} alt={l.title} size={72} rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/seller/catalog/${l.productId}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
                      {l.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        Item <Mono className="text-[12px] text-ink-700">{l.lineId}</Mono>
                        <CopyId value={l.lineId} />
                      </span>
                      <span>
                        SKU <Mono className="text-[12px] text-ink-700">{l.sku}</Mono>
                      </span>
                      <span>
                        BSIN <Mono className="text-[12px] text-ink-700">{l.bsin}</Mono>
                      </span>
                      {l.variant && <span>{l.variant}</span>}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge meta={ORDER_STATUS[l.status]} size="sm" />
                      <ChannelBadge channel={l.channel} />
                      {l.fc && <span className="font-mono text-[11px] text-ink-500">{l.fc}</span>}
                      {l.dispatchBy && l.channel === "ship" && (
                        <span className="text-xs text-ink-500">
                          Dispatch by {formatDateTime(l.dispatchBy)}, <SlaText dueAt={l.dispatchBy} now={now} className="text-xs" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold text-ink-900 tabular-nums">{formatINR(l.total)}</p>
                    <p className="mt-0.5 text-xs text-ink-500 tabular-nums">
                      {l.quantity} x {formatINR(l.price)}
                    </p>
                    {l.mrp > l.price && <p className="mt-0.5 text-xs text-ink-400 line-through tabular-nums">M.R.P. {formatINR(l.mrp)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Fees and settlement */}
          <Card>
            <CardHeader
              title="Fees and settlement estimate"
              description={`Rate card ${RATE_CARD_VERSION}, ${SELLER.tier} tier. Fees carry 18% GST; TCS and TDS are withheld for the government.`}
            />
            {cancelled ? (
              <div className="px-5 pt-3 pb-5">
                <Callout tone="neutral" icon={Info} title="No fees on this order">
                  Orders cancelled before shipment are not charged commission, fixed fee or shipping. Seller-attributable cancellations carry a separate penalty line.
                </Callout>
              </div>
            ) : lines.length === 1 ? (
              <div className="grid gap-6 px-5 pt-3 pb-5 md:grid-cols-[1fr_15rem]">
                <AmountRows
                  rows={[
                    { label: "Item price", value: primary.total, hint: primary.quantity > 1 ? `${primary.quantity} units` : undefined },
                    ...est.fees.map((f) => ({ label: f.label, value: f.amount, muted: f.label.startsWith("TCS") || f.label.startsWith("TDS") })),
                  ]}
                  total={{ label: est.estimated ? "Estimated settlement" : "Settlement", value: est.net, hint: `${Math.round((est.net / primary.total) * 1000) / 10}% of the item price` }}
                />
                <SettlementBox estimated={est.estimated} eligibleOn={est.eligibleOn} payoutOn={est.payoutOn} holdDays={est.holdDays} cod={primary.cod} now={now} />
              </div>
            ) : (
              <>
                <TableContainer className="mt-3">
                  <Table className="min-w-[36rem]">
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Line</TH>
                        {estimates.map(({ line }) => (
                          <TH key={line.itemId} align="right">
                            <Mono className="text-[12px]">-{line.lineId.split("-").at(-1)}</Mono>
                          </TH>
                        ))}
                        <TH align="right">Total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {FEE_ROWS.map((row) => {
                        const vals = estimates.map(({ line, est: e }) => row.get(line, e.fees));
                        return (
                          <TR key={row.label}>
                            <TD className="text-ink-600">{row.label}</TD>
                            {vals.map((v, i) => (
                              <TD key={i} align="right">
                                {v < 0 ? "-" : ""}
                                {formatINR(Math.abs(v))}
                              </TD>
                            ))}
                            <TD align="right" className="font-medium text-ink-900">
                              {vals.reduce((a, v) => a + v, 0) < 0 ? "-" : ""}
                              {formatINR(Math.abs(vals.reduce((a, v) => a + v, 0)))}
                            </TD>
                          </TR>
                        );
                      })}
                      <TR className="bg-ink-50/50">
                        <TD className="font-medium text-ink-900">{estimates[0]!.est.estimated ? "Estimated settlement" : "Settlement"}</TD>
                        {estimates.map(({ line, est: e }) => (
                          <TD key={line.itemId} align="right" className="font-medium text-ink-900">
                            {formatINR(e.net)}
                          </TD>
                        ))}
                        <TD align="right" className="text-[15px] font-semibold text-ink-900">
                          {formatINR(estimates.reduce((a, x) => a + x.est.net, 0))}
                        </TD>
                      </TR>
                    </TBody>
                  </Table>
                </TableContainer>
                <div className="px-5 py-4">
                  <SettlementBox estimated={est.estimated} eligibleOn={est.eligibleOn} payoutOn={est.payoutOn} holdDays={est.holdDays} cod={primary.cod} now={now} inline />
                </div>
              </>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" description="Every status change on your items, with what is still to come." />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={timelineFor(order, primary)} />
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader
              title="Shipping label and invoice"
              description={primary.channel === "fulfilled" ? "Printed by the fulfilment centre. Shown here for your records." : primary.awb ? "Print both and keep the invoice inside the package." : "Preview. The label and invoice are generated when you pack the order."}
              action={
                primary.channel !== "fulfilled" && (
                  <ToastButton size="sm" icon="printer" message="Label (4 x 6 in) and invoice downloaded as a PDF.">
                    Print
                  </ToastButton>
                )
              }
            />
            <div className="px-5 pb-5">
              <Tabs
                tabs={[
                  {
                    key: "label",
                    label: "Shipping label",
                    content: (
                      <div className="rounded-xl bg-ink-50 p-4 sm:p-6">
                        <ShippingLabel
                          d={{
                            awb: primary.awb,
                            orderId: order.id,
                            lineId: primary.lineId,
                            cod: primary.cod,
                            amount: order.total,
                            buyer: primary.buyer,
                            addressLine: primary.addressLine,
                            city: primary.city,
                            state: primary.state,
                            pincode: primary.pincode,
                            weightKg: listing?.weightKg ?? 1,
                            dims: listing?.dims ?? [24, 20, 10],
                            dispatchBy: primary.dispatchBy,
                            sku: primary.sku,
                            qty: primary.quantity,
                          }}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "invoice",
                    label: "Tax invoice",
                    content: (
                      <div className="rounded-xl bg-ink-50 p-3 sm:p-6">
                        <TaxInvoice
                          number={`APX/26-27/${order.id.slice(-5)}`}
                          date={new Date(new Date(order.placedAt).getTime() + 6 * 3600_000).toISOString()}
                          seller={{ legalName: SELLER.legalName, gstin: SELLER.gstin, address: "Unit 14, Marol Industrial Estate, Andheri East, Mumbai 400072" }}
                          buyer={{ name: primary.buyer, city: primary.city, state: primary.state, pincode: primary.pincode }}
                          intraState={primary.state === SELLER.state}
                          lines={lines.map((l) => {
                            const li = getListing(l.productId);
                            return { title: l.title, hsn: li?.hsn ?? "8543", qty: l.quantity, total: l.total, gst: li?.gst ?? 18 };
                          })}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-6">
          <NextStep line={primary} returnId={ret?.id} now={now} />

          <Card>
            <CardHeader title="Customer" description="Contact details are masked. Use Messages to reach the buyer." />
            <div className="px-5 pt-3 pb-5">
              <InfoGrid
                columns={1}
                items={[
                  { label: "Name", value: primary.buyer },
                  { label: "Phone", value: primary.buyerPhone ? <Mono className="text-sm">{primary.buyerPhone}</Mono> : <span className="text-ink-500">Masked</span> },
                  {
                    label: "Ship to",
                    value: (
                      <>
                        {primary.addressLine && (
                          <>
                            {primary.addressLine}
                            <br />
                          </>
                        )}
                        {primary.city}, {primary.state} <Mono className="text-sm font-medium">{primary.pincode}</Mono>
                      </>
                    ),
                  },
                  { label: "Promised delivery", value: formatWeekday(primary.promisedBy) },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="px-5 pt-3 pb-5">
              <InfoGrid
                columns={1}
                items={[
                  { label: "Method", value: PAYMENT_METHOD[order.payment.method] },
                  { label: "Status", value: <StatusBadge meta={PAYMENT_STATUS[order.payment.status]} size="sm" /> },
                  { label: "Your items", value: <span className="font-medium tabular-nums">{formatINR(yourTotal)}</span> },
                  ...(order.payment.txnId ? [{ label: "Transaction", value: <Mono className="text-sm">{order.payment.txnId}</Mono> }] : []),
                ]}
              />
              {primary.cod && (
                <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
                  BluBuy collects {formatINR(order.total)} in cash at delivery and remits it to your settlement once the hub deposits it.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Shipment" />
            <div className="px-5 pt-3 pb-5">
              <InfoGrid
                columns={1}
                items={[
                  { label: "Carrier", value: "BluBuy Logistics" },
                  { label: "AWB", value: primary.awb ? <Mono className="text-sm">{primary.awb}</Mono> : <span className="text-ink-500">Assigned when the label is generated</span> },
                  ...(primary.manifestId ? [{ label: "Manifest", value: <Mono className="text-sm">{primary.manifestId}</Mono> }] : []),
                  ...(primary.pickupSlot && preShip ? [{ label: "Pickup slot", value: `${formatWeekday(primary.pickupSlot)}, 4:00 to 6:00 PM` }] : []),
                  ...(primary.fc ? [{ label: "Fulfilment centre", value: <Mono className="text-sm">{primary.fc}</Mono> }] : []),
                  ...(primary.deliveredAt ? [{ label: "Delivered", value: formatDateTime(primary.deliveredAt) }] : []),
                  ...(primary.returnWindowEnds ? [{ label: "Return window ends", value: formatDate(primary.returnWindowEnds) }] : []),
                ]}
              />
            </div>
          </Card>

          {preShip && primary.channel === "ship" && (
            <Card>
              <CardHeader title="Packaging guidance" description={`For ${listing?.subcategory.toLowerCase() ?? "this item"}, ${listing?.weightKg ?? 1} kg`} />
              <ul className="flex flex-col gap-3 px-5 pt-3 pb-5">
                {packagingTips(listing?.subcategory ?? "").map((t) => (
                  <li key={t} className="flex gap-2.5 text-[13px] text-ink-700">
                    <Box size={15} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {t}
                  </li>
                ))}
                <li className="flex gap-2.5 text-[13px] text-ink-700">
                  <Tag size={15} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                  Declared box {listing?.dims.join(" x ")} cm. Volumetric weight {(((listing?.dims[0] ?? 24) * (listing?.dims[1] ?? 20) * (listing?.dims[2] ?? 10)) / 5000).toFixed(2)} kg.
                </li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function SettlementBox({
  estimated,
  eligibleOn,
  payoutOn,
  holdDays,
  cod,
  inline,
  now,
}: {
  estimated: boolean;
  eligibleOn: string;
  payoutOn: string;
  holdDays: number;
  cod: boolean;
  inline?: boolean;
  now: number;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-ink-500">{estimated ? "Expected payout" : now > Date.parse(payoutOn) ? "Paid in the payout run of" : "Payout run"}</p>
      <p className="mt-1 text-[15px] font-semibold text-ink-900">{formatWeekday(payoutOn)}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        {estimated ? "Estimate based on the promised delivery date. " : ""}
        Eligible {holdDays} days after delivery ({formatDate(eligibleOn)}). Payouts run Monday, Wednesday and Friday{cod ? ", after the COD cash is remitted" : ""}.
      </p>
    </>
  );
  if (inline) return <div className="rounded-xl border border-line bg-ink-50/60 px-4 py-3">{body}</div>;
  return <div className="h-fit rounded-xl border border-line bg-ink-50/60 p-4">{body}</div>;
}

function NextStep({ line, returnId, now }: { line: SellerLine; returnId?: string; now: number }) {
  if (line.channel === "fulfilled") {
    return (
      <Card className="border-brand-100 bg-brand-50/40">
        <div className="flex gap-3 p-5">
          <Warehouse size={19} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink-900">Handled by BluBuy Fulfilled</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              {line.fc} picks, packs and ships this item. You do not need to confirm, pack or hand it over. Stock is reserved from your fulfilment centre inventory.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  const steps: Record<string, { title: string; body: string; due?: string }> = {
    placed: { title: "Confirm this order", body: "Confirming starts the dispatch clock. Unconfirmed orders auto-cancel at the confirm by time and count as seller cancellations.", due: line.acceptBy },
    confirmed: { title: "Generate the label and invoice", body: "Print both, pack the item, and paste the label on the largest face of the box.", due: line.dispatchBy },
    packed: { title: "Mark ready to ship", body: "Confirm the packed weight and size. Never mark ready before the label and invoice are on the package.", due: line.dispatchBy },
    ready_to_ship: { title: "Hand over at pickup", body: "The associate scans every package on the manifest. Pickups after the dispatch by time count as late dispatch.", due: line.dispatchBy },
  };
  const s = steps[line.status];
  if (s) {
    return (
      <Card className="border-brand-100">
        <div className="p-5">
          <p className="text-xs font-medium text-brand-700">Next step</p>
          <p className="mt-1 text-[15px] font-semibold text-ink-900">{s.title}</p>
          {s.due && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-600">
              Due {formatDateTime(s.due)} <SlaText dueAt={s.due} now={now} />
            </p>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-ink-600">{s.body}</p>
        </div>
      </Card>
    );
  }
  const done: Record<string, { icon: typeof CircleCheck; title: string; body: string }> = {
    delivered: { icon: CircleCheck, title: "Delivered", body: "Nothing to do. The return window is open; settlement follows the tier hold period." },
    shipped: { icon: PackageCheck, title: "With BluBuy Logistics", body: "Handed over on time. Tracking updates appear in the timeline." },
    in_transit: { icon: PackageCheck, title: "With BluBuy Logistics", body: "Handed over on time. Tracking updates appear in the timeline." },
    out_for_delivery: { icon: PackageCheck, title: "Out for delivery", body: "The delivery associate will verify the OTP at the door." },
    cancelled: { icon: ShieldCheck, title: "Cancelled", body: "No action needed. The customer has been refunded and stock released." },
  };
  const d = done[line.status];
  if (!d) {
    return (
      <Callout tone="warning" icon={Info} title="Return in progress" action={returnId ? <Link href={`/seller/returns/${returnId}`} className="text-[13px] font-medium text-brand-700 hover:underline">Open</Link> : undefined}>
        Grade the item within 48 hours of receipt to keep your SafeClaim rights.
      </Callout>
    );
  }
  const Icon = d.icon;
  return (
    <Card>
      <div className="flex gap-3 p-5">
        <Icon size={19} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-ink-900">{d.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{d.body}</p>
        </div>
      </div>
    </Card>
  );
}
