import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Truck } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { RISK_LEVEL, riskTone } from "@/components/admin/admin-status";
import { Chip, Mono, ScoreMeter, SummaryRow } from "@/components/admin/bits";
import { MaskedValue } from "@/components/admin/masked-value";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { customers, getHub, getOrder, getProduct, orders, refunds, returns, sellers } from "@/lib/mock";
import { auditEntries, maskEmail, maskPhone, orderRisk, orderShipments } from "@/lib/mock/admin-extra";
import { NDR_REASON, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, REFUND_STATUS, RETURN_STATUS, SHIPMENT_STATUS, type OrderStatus } from "@/lib/status";
import { cn, formatCompact, formatDate, formatDateTime, formatINR, formatWeekday, NOW } from "@/lib/utils";

export function generateStaticParams() {
  return orders.slice(0, 50).map((o) => ({ id: o.id }));
}

export async function generateMetadata(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  return { title: `Order ${id}` };
}

const PRE_DELIVERY: OrderStatus[] = ["pending_payment", "placed", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "undelivered"];
const PRE_SHIP: OrderStatus[] = ["placed", "confirmed", "packed", "ready_to_ship"];

export default async function OrderDetail(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const o = getOrder(id);
  if (!o) notFound();

  const customer = customers.find((c) => c.id === o.customerId);
  const shipments = orderShipments(o);
  const risk = orderRisk(o);
  const orderRefunds = refunds.filter((r) => r.orderId === o.id);
  const orderReturns = returns.filter((r) => r.orderId === o.id);
  const audit = auditEntries.filter((a) => a.target === o.id);
  const groups = shipments.map((s) => ({ shipment: s, seller: sellers.find((x) => x.id === s.sellerId), items: o.items.filter((it) => it.sellerId === s.sellerId) }));
  const late = PRE_DELIVERY.includes(o.status) && new Date(o.promisedBy) < NOW;
  const canCancel = PRE_DELIVERY.includes(o.status);
  const canReassign = PRE_SHIP.includes(o.status);
  const refunded = orderRefunds.reduce((a, r) => a + r.amount, 0);
  const providerName = o.payment.method === "cod" ? "Cash on delivery" : o.payment.method === "upi" || o.payment.method === "wallet" ? "Kanakpay" : "Veloce Payments";

  const altSellers = [...new Set(o.items.flatMap((it) => getProduct(it.productId)?.offers.map((of) => of.sellerId) ?? []))]
    .filter((sid) => !o.items.some((it) => it.sellerId === sid))
    .map((sid) => sellers.find((s) => s.id === sid)?.displayName ?? sid);

  const itemOptions = ["All items", ...o.items.map((it, i) => `Item ${String(i + 1).padStart(2, "0")}: ${it.title.split(/[,(]/)[0]!.trim()}`)];
  const summary = [
    { label: "Order", value: o.id },
    { label: "Total paid", value: formatINR(o.total) },
    { label: "Payment", value: PAYMENT_METHOD[o.payment.method] },
    { label: "Status", value: ORDER_STATUS[o.status].label },
  ];

  const timeline = [
    ...o.timeline.map((e) => ({ title: e.label, time: formatDateTime(e.at), description: e.location, tone: e.status === "cancelled" || e.status === "rto_in_transit" ? ("danger" as const) : e.status === "undelivered" ? ("warning" as const) : e.status === "delivered" ? ("success" as const) : undefined })),
    ...(PRE_DELIVERY.includes(o.status) && o.status !== "pending_payment" ? [{ title: o.status === "out_for_delivery" ? "Delivery today" : `Promised by ${formatWeekday(o.promisedBy)}`, done: false }] : []),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: o.id }]}
        title={<span className="font-mono text-[22px] tracking-tight sm:text-2xl">{o.id}</span>}
        meta={
          <>
            <StatusBadge meta={ORDER_STATUS[o.status]} />
            <Badge tone={PAYMENT_STATUS[o.payment.status].tone} size="md">{`Payment: ${PAYMENT_STATUS[o.payment.status].label}`}</Badge>
            <span className="text-[13px] text-ink-500">
              Placed {formatDateTime(o.placedAt)} on {o.channel === "ios" ? "the iOS app" : o.channel === "android" ? "the Android app" : "the web"}
            </span>
          </>
        }
        actions={
          <>
            <ActionButton
              label="Add note"
              icon="note"
              title="Add an internal note"
              description="Visible to AltasGoods staff only, never to the customer or seller."
              note="required"
              notePlaceholder="What happened and what you did"
              confirmLabel="Save note"
              toast="Note added to the order timeline"
            />
            <ActionButton
              label="Refund"
              icon="refund"
              title={`Refund on ${o.id}`}
              description="Creates a refund instruction (spec 11.4). Amounts above your limit go on hold for approval."
              summary={summary}
              reasons={["Item not delivered", "Damaged or defective item", "Wrong item delivered", "Price adjustment", "Duplicate charge", "Goodwill gesture"]}
              fields={[
                { name: "amount", label: "Amount (₹)", type: "number", defaultValue: String(o.total - refunded) },
                { name: "dest", label: "Refund to", type: "select", options: o.payment.method === "cod" ? ["AltasGoods Credits (under 2 hours)", "Bank account or UPI ID (verified by penny drop)"] : [`Original ${PAYMENT_METHOD[o.payment.method]}`, "AltasGoods Credits (under 2 hours)"] },
              ]}
              warning={o.total > 25000 ? "Refunds above ₹25,000 need a Finance Manager to approve (maker-checker)." : undefined}
              note="required"
              confirmLabel="Create refund"
              toast="Refund instruction created and sent for processing"
            />
            {canReassign && (
              <ActionButton
                label="Reassign"
                icon="user"
                title="Reassign to another seller"
                description="Moves unshipped items to another seller with a live offer on the same BSIN. The customer keeps the price paid."
                fields={[{ name: "seller", label: "New seller", type: "select", options: altSellers.length ? altSellers : ["No other live offers"] }]}
                reasons={["Seller out of stock", "Seller dispatch SLA breach", "Seller suspended or on holiday", "Unserviceable from seller pincode"]}
                note="optional"
                confirmLabel="Reassign items"
                toast="Items reassigned, both sellers notified"
                disabled={!altSellers.length}
              />
            )}
            {canCancel && (
            <ActionButton
              label="Cancel"
              icon="ban"
              variant="danger"
              danger
              title={`Cancel ${o.id}`}
              description="Admin cancellation is allowed in any pre-delivery state and needs a reason code (spec 10.4)."
              summary={summary}
              fields={[{ name: "items", label: "Items to cancel", type: "select", options: itemOptions }]}
              reasons={["Customer requested via support (CUSTOMER_REQUESTED_VIA_SUPPORT)", "Operations intervention (OPS_INTERVENTION)", "Risk rejected (RISK_REJECTED)", "Listing blocked (LISTING_BLOCKED)", "Unserviceable pincode (UNSERVICEABLE)"]}
              warning={o.payment.method === "cod" ? "Nothing to refund for cash on delivery. AltasCoins and Credits used are restored immediately." : "A prepaid refund starts within 1 hour. AltasCoins and Credits used are restored immediately."}
              note="required"
              confirmLabel="Cancel items"
              toast="Cancellation recorded, seller asked to pull the package from the manifest"
              doneLabel="Cancelled"
            />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {/* Items by seller */}
          <Card>
            <CardHeader title="Items" description={`${o.items.length} ${o.items.length === 1 ? "item" : "items"} from ${groups.length} ${groups.length === 1 ? "seller" : "sellers"}, one shipment per seller`} />
            <div className="mt-3 flex flex-col">
              {groups.map(({ shipment, seller, items }) => (
                <section key={shipment.sellerId} className="border-t border-line">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ink-50/60 px-5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2 text-[13px]">
                      <span className="text-ink-500">Sold by</span>
                      <Link href={`/admin/sellers/${shipment.sellerId}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {seller?.displayName ?? shipment.sellerId}
                      </Link>
                      {seller && <Chip>{seller.tier}</Chip>}
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      <Truck size={14} className="text-ink-400" aria-hidden="true" />
                      {shipment.awb ? <Mono>{shipment.awb}</Mono> : <span className="text-ink-500">AWB is created at packing</span>}
                      {shipment.status && <StatusBadge meta={SHIPMENT_STATUS[shipment.status]} size="sm" />}
                    </div>
                  </div>
                  <ul className="divide-y divide-line">
                    {items.map((it) => {
                      const idx = o.items.indexOf(it) + 1;
                      return (
                        <li key={it.id} className="flex gap-4 px-5 py-4">
                          <ProductImage src={it.image} alt={it.title} size={56} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-900">{it.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                              <span className="font-mono">
                                {o.id}-{String(idx).padStart(2, "0")}
                              </span>
                              {it.variant && <span>{it.variant}</span>}
                              <span>
                                Qty {it.quantity} x {formatINR(it.price)}
                              </span>
                              {it.mrp > it.price && <span className="line-through">{formatINR(it.mrp)}</span>}
                            </p>
                            <div className="mt-2">
                              <StatusBadge meta={ORDER_STATUS[it.status]} size="sm" />
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-ink-900 tabular-nums">{formatINR(it.price * it.quantity)}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </Card>

          {/* Payment and refunds */}
          <Card>
            <CardHeader title="Payment and refunds" description={`${PAYMENT_METHOD[o.payment.method]} via ${providerName}`} action={<StatusBadge meta={PAYMENT_STATUS[o.payment.status]} />} />
            <div className="grid gap-6 px-5 pt-4 pb-5 md:grid-cols-2">
              <dl className="flex flex-col gap-2.5">
                <SummaryRow label="Item subtotal" value={formatINR(o.subtotal)} />
                <SummaryRow label={o.couponCode ? `Coupon ${o.couponCode}` : "Discounts"} value={o.discount ? `-${formatINR(o.discount)}` : formatINR(0)} />
                <SummaryRow label="Delivery fee" value={o.shippingFee ? formatINR(o.shippingFee) : "Free"} />
                {o.platformFee > 0 && <SummaryRow label="Platform fee" value={formatINR(o.platformFee)} />}
                <div className="border-t border-line pt-2.5">
                  <SummaryRow label="Total charged" value={formatINR(o.total)} strong />
                </div>
                {refunded > 0 && <SummaryRow label="Refunded" value={`-${formatINR(refunded)}`} />}
              </dl>
              <dl className="flex flex-col gap-2.5 md:border-l md:border-line md:pl-6">
                <SummaryRow label="Method" value={PAYMENT_METHOD[o.payment.method]} />
                <SummaryRow label="Provider" value={providerName} />
                <SummaryRow label={o.payment.method === "cod" ? "Collection" : "Gateway reference"} value={o.payment.method === "cod" ? "Collected by delivery associate" : <Mono>{o.payment.txnId}</Mono>} />
                <SummaryRow label="Captured" value={o.payment.status === "pending" ? "Not yet" : formatDateTime(o.placedAt)} />
                <SummaryRow label="Money held in" value={o.payment.method === "cod" ? "COD collection account" : "Payment aggregator escrow"} />
              </dl>
            </div>
            {(orderRefunds.length > 0 || orderReturns.length > 0) && (
              <ul className="divide-y divide-line border-t border-line">
                {orderReturns.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px]">
                    <span className="flex items-center gap-2">
                      <Mono>{r.id}</Mono>
                      <span className="text-ink-600">Return: {r.reason.toLowerCase()}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{formatINR(r.amount)}</span>
                      <StatusBadge meta={RETURN_STATUS[r.status]} size="sm" />
                    </span>
                  </li>
                ))}
                {orderRefunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px]">
                    <span className="flex items-center gap-2">
                      <Mono>{r.id}</Mono>
                      <span className="text-ink-600">Refund to {r.method === "bluwallet" ? "AltasGoods Credits" : PAYMENT_METHOD[r.method]}, {formatDateTime(r.initiatedAt)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{formatINR(r.amount)}</span>
                      <StatusBadge meta={REFUND_STATUS[r.status]} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Shipments */}
          <Card>
            <CardHeader title="Shipments" description="AltasGoods Logistics, forward and reverse" />
            <div className="mt-3 divide-y divide-line border-t border-line">
              {shipments.map((s) => {
                const seller = sellers.find((x) => x.id === s.sellerId);
                return (
                  <div key={s.sellerId} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.awb ? <Mono className="font-medium">{s.awb}</Mono> : <span className="text-[13px] text-ink-500">Not created yet</span>}
                        {s.status && <StatusBadge meta={SHIPMENT_STATUS[s.status]} size="sm" />}
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-600">
                        <span>{getHub(s.originHubId)?.name ?? "Seller warehouse"}</span>
                        <ArrowRight size={13} className="text-ink-400" aria-hidden="true" />
                        <span>{getHub(s.destinationHubId)?.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        From {seller?.displayName}, {s.weightKg} kg, {s.attempts} delivery {s.attempts === 1 ? "attempt" : "attempts"}
                        {s.ndrReason ? `, last NDR: ${NDR_REASON[s.ndrReason].toLowerCase()}` : ""}
                      </p>
                    </div>
                    <dl className="flex gap-6 text-[13px] sm:flex-col sm:gap-1.5 sm:text-right">
                      <div>
                        <dt className="text-xs text-ink-500">COD to collect</dt>
                        <dd className="font-medium tabular-nums">{s.codAmount ? formatINR(s.codAmount) : "Prepaid"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-500">Last update</dt>
                        <dd className="font-medium">{formatDateTime(s.lastUpdate)}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" description="Status history from the order and shipment state machines" />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={timeline} />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Customer" action={customer && <ButtonLink href={`/admin/customers/${customer.id}`} variant="ghost" size="xs" iconRight={ArrowRight}>Profile</ButtonLink>} />
            <div className="px-5 pt-3 pb-5">
              <div className="flex items-center gap-3">
                <Avatar name={o.customerName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{o.customerName}</p>
                  <p className="text-xs text-ink-500">{customer ? `Customer since ${formatDate(customer.joinedAt)}` : "Guest checkout"}</p>
                </div>
                {customer?.plusMember && (
                  <Badge tone="brand" size="sm" className="ml-auto">
                    Plus
                  </Badge>
                )}
              </div>
              {customer && (
                <dl className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
                  <SummaryRow label="Email" value={<MaskedValue masked={maskEmail(customer.email)} full={customer.email} />} />
                  <SummaryRow label="Phone" value={<MaskedValue masked={maskPhone(customer.phone)} full={customer.phone} />} />
                  <SummaryRow label="Orders" value={customer.orders} />
                  <SummaryRow label="Lifetime value" value={formatCompact(customer.lifetimeValue, true)} />
                </dl>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery address" />
            <div className="flex gap-3 px-5 pt-3 pb-5 text-[13px]">
              <MapPin size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
              <div className="text-ink-700">
                <p className="font-medium text-ink-900">{o.address.name}</p>
                <p>{o.address.line1}</p>
                {o.address.line2 && <p>{o.address.line2}</p>}
                <p>
                  {o.address.city}, {o.address.state} {o.address.pincode}
                </p>
                <p className="mt-2 text-ink-500">
                  Promised by <span className={cn("font-medium", late ? "text-danger-700" : "text-ink-900")}>{formatWeekday(o.promisedBy)}</span>
                  {late && " (past promise)"}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Risk signals" description="Checkout risk engine, spec 10.14" action={<StatusBadge meta={RISK_LEVEL[risk.level]} size="sm" />} />
            <div className="px-5 pt-3 pb-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-600">Risk score</span>
                <ScoreMeter value={risk.score} tone={riskTone(risk.score)} label="Order risk score" />
              </div>
              <ul className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
                {risk.signals.map((s) => (
                  <li key={s.label} className="flex items-start gap-2.5 text-[13px] text-ink-700">
                    <span
                      className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", s.tone === "danger" ? "bg-danger-500" : s.tone === "warning" ? "bg-warning-500" : s.tone === "success" ? "bg-success-500" : "bg-ink-400")}
                      aria-hidden="true"
                    />
                    {s.label}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton label="Open risk case" icon="shield" size="xs" title="Open a risk case" description="Sends this order to the Risk and Fraud queue." reasons={["Suspected fake COD order", "Payment fraud", "Coupon abuse", "Return abuse", "Seller fake order"]} toast="Risk case opened and assigned to the queue" doneLabel="Case opened" />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes and audit" description="Every admin write is logged" />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3 text-[13px]">
                  <p className="text-ink-800">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {a.actor}, {formatDateTime(a.at)}
                  </p>
                </li>
              ))}
              <li className="px-5 py-3 text-[13px]">
                <p className="text-ink-800">Risk check {risk.level === "high" ? "flagged for review" : "passed"} at checkout (score {risk.score})</p>
                <p className="mt-0.5 text-xs text-ink-500">Rules engine, {formatDateTime(o.placedAt)}</p>
              </li>
              <li className="px-5 py-3 text-[13px]">
                <p className="text-ink-800">Order confirmation sent by SMS, email and push</p>
                <p className="mt-0.5 text-xs text-ink-500">Notifications service, {formatDateTime(o.placedAt)}</p>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
