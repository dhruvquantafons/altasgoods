import Link from "next/link";

import {
  Banknote,
  ChevronRight,
  CircleAlert,
  Coins,
  CreditCard,
  Headset,
  LifeBuoy,
  MessageSquareText,
  PackageX,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Truck,
  Undo2,
} from "lucide-react";
import { CANCELLED_STATUSES, cancelMode, dateLabel, dayLabel, deliveredAt, itemCountLabel, itemState, needsSecureDelivery, paymentLabel, returnInfo, sellerName, shortDate } from "@/components/account/lib";
import { cancelProps, invoiceAvailable } from "@/components/account/order-card";
import { BuyAgainButton, CancelOrderButton, InvoiceButton } from "@/components/account/order-actions";
import { AssociateRow, SecureDeliveryBanner, TrackingHistory, TrackingStepper } from "@/components/account/tracking";
import { KeyValue, Notice, Panel } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getProduct, getSeller } from "@/lib/mock";
import { addressExtras, BLUCOINS, DELIVERY_ASSOCIATES, myReviews, returnPolicyFor, SECURE_DELIVERY } from "@/lib/mock/account-extra";
import { loadMyOrder, toUiOrder } from "@/lib/api/account-orders";
import { PAYMENT_STATUS } from "@/lib/status";
import type { Order, OrderItem } from "@/lib/types";
import { formatINR, NOW } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/account/orders/[id]">) {
  const { id } = await props.params;
  return { title: `Order ${id}` };
}

const reviewed = new Set(myReviews.map((r) => r.slug));

/** Real AWB once the seller hands the package over; null before that. */
function awbFor(awbs: Map<string, string>, sellerId: string) {
  return awbs.get(sellerId) ?? null;
}

export default async function OrderDetailPage(props: PageProps<"/account/orders/[id]">) {
  const { id } = await props.params;
  const apiOrder = await loadMyOrder(id);
  const order = toUiOrder(apiOrder);
  const awbs = new Map(apiOrder.items.filter((i) => i.awb).map((i) => [i.seller.id, i.awb!]));
  const cancellable = new Set(apiOrder.items.filter((i) => i.canCancel).map((i) => i.id));
  const unpaid = apiOrder.status === "PAYMENT_PENDING" || apiOrder.status === "PAYMENT_FAILED";
  const openPayment = apiOrder.payments.find((p) => p.status === "CREATED" || p.status === "PENDING" || p.status === "FAILED");

  const sellerIds = [...new Set(order.items.map((it) => it.sellerId))];
  const packages = sellerIds.map((sid) => ({ sellerId: sid, items: order.items.filter((it) => it.sellerId === sid) }));
  const mode = cancellable.size ? cancelMode(order.status) ?? "cancel" : null;
  const cancelInput = { ...cancelProps(order), items: cancelProps(order).items.filter((it) => cancellable.has(it.id)) };
  const secure = needsSecureDelivery(order);
  const associate = DELIVERY_ASSOCIATES[order.id];
  const cancelled = CANCELLED_STATUSES.includes(order.status);
  const mrpTotal = order.items.reduce((a, it) => a + it.mrp * it.quantity, 0);
  const mrpSaving = mrpTotal - order.subtotal;
  const saved = mrpSaving + order.discount;
  const coins = Math.min(BLUCOINS.cap, Math.floor(order.total / 100) * BLUCOINS.earnRate);
  const delivered = deliveredAt(order);
  const windowDays = Math.max(...order.items.map((it) => Math.max(7, returnPolicyFor(getProduct(it.productId)).days)));
  const coinsOn = delivered ? new Date(new Date(delivered).getTime() + windowDays * 86400_000) : undefined;
  const extras = addressExtras[order.address.id];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Your account", href: "/account" },
          { label: "Your orders", href: "/account/orders" },
          { label: order.id },
        ]}
        title="Order details"
        meta={
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-500">
            <span>Placed on {dateLabel(order.placedAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[13px] text-ink-700">{order.id}</span>
            <span aria-hidden="true">·</span>
            <span>{itemCountLabel(order.items.reduce((a, it) => a + it.quantity, 0))}</span>
          </p>
        }
        actions={
          <>
            {invoiceAvailable(order) && <InvoiceButton orderId={order.id} size="md" label="Download invoice" />}
            {mode && <CancelOrderButton mode="cancel" size="md" {...cancelInput} />}
            <ButtonLink href={`/account/support?order=${order.id}`} variant="ghost" icon={LifeBuoy}>
              Need help
            </ButtonLink>
          </>
        }
      />

      {unpaid && openPayment && (
        <Notice tone="warning" icon={CircleAlert} title="Payment pending" className="mb-6">
          Complete the payment to confirm this order. Unpaid orders are released 30 minutes after they are placed.{" "}
          <Link href={`/checkout/pay/${openPayment.id}`} className="font-semibold text-brand-700 hover:underline">
            Complete payment
          </Link>
        </Notice>
      )}

      {order.status === "out_for_delivery" && secure && <SecureDeliveryBanner otp={SECURE_DELIVERY.otp} promisedBy={order.promisedBy} className="mb-6" />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {packages.map((pkg, i) => {
            const st = itemState(order, pkg.items[0]!);
            return (
              <Panel key={pkg.sellerId} bodyClassName="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-500">
                      {packages.length > 1 ? `Package ${i + 1} of ${packages.length} · ` : ""}Sold by {sellerName(pkg.sellerId)}
                    </p>
                    <p className="mt-1 font-display text-[19px] leading-snug font-semibold text-ink-900">{st.headline}</p>
                    {st.detail && <p className="mt-0.5 text-[13px] text-ink-500">{st.detail}</p>}
                  </div>
                  <StatusBadge meta={st.meta} />
                </div>

                {!cancelled && (
                  <div className="mt-6 mb-2 px-0 sm:px-2">
                    <TrackingStepper order={order} />
                  </div>
                )}

                {order.status === "out_for_delivery" && associate && (
                  <div className="mt-5">
                    <AssociateRow {...associate} />
                  </div>
                )}

                {order.status === "undelivered" && (
                  <Notice tone="warning" icon={CircleAlert} title="We could not deliver your package" className="mt-5">
                    The associate could not reach you. We will try again tomorrow. You can pick a different date or add delivery instructions.
                  </Notice>
                )}
                {order.status === "shipped" || order.status === "in_transit" ? (
                  <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
                    <Truck size={15} aria-hidden="true" />
                    With BluBuy Logistics. You will get the delivery associate&apos;s details on the day of delivery.
                  </p>
                ) : null}
                {order.status === "cancelled" && (
                  <Notice tone="neutral" icon={PackageX} title="This order was cancelled" className="mt-5">
                    {order.payment.method === "cod" ? "It was a pay on delivery order, so nothing was charged." : `${formatINR(order.total)} was refunded to ${paymentLabel(order.payment.method)}.`}
                  </Notice>
                )}

                <ul className="mt-6 divide-y divide-line border-t border-line">
                  {pkg.items.map((item) => (
                    <ItemRow key={item.id} order={order} item={item} />
                  ))}
                </ul>

                <div className="mt-2">
                  <TrackingHistory order={order} awb={awbFor(awbs, pkg.sellerId) ?? "Assigned at pickup"} />
                </div>
              </Panel>
            );
          })}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <Panel title="Delivery address">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">{order.address.name}</p>
              <Badge size="sm">{order.address.type === "home" ? "Home" : order.address.type === "work" ? "Work" : "Other"}</Badge>
            </div>
            <address className="mt-1.5 text-[13px] leading-relaxed text-ink-600 not-italic">
              {order.address.line1}
              {order.address.line2 && (
                <>
                  <br />
                  {order.address.line2}
                </>
              )}
              {order.address.landmark && (
                <>
                  <br />
                  {order.address.landmark}
                </>
              )}
              <br />
              {order.address.city}, {order.address.state} {order.address.pincode}
              <br />
              {order.address.phone}
            </address>
            {extras?.instructions && <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{extras.instructions}</p>}
          </Panel>

          <Panel title="Payment" action={<StatusBadge meta={PAYMENT_STATUS[order.payment.status]} size="sm" />}>
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 text-ink-400">{order.payment.method === "cod" ? <Banknote size={17} aria-hidden="true" /> : <CreditCard size={17} aria-hidden="true" />}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink-900">{paymentLabel(order.payment.method)}</p>
                <p className="mt-0.5 font-mono text-[12px] text-ink-500">{order.payment.txnId}</p>
              </div>
            </div>
            {order.payment.status === "cod_pending" && (
              <p className="mt-3 text-[13px] text-ink-600">
                Pay <span className="font-semibold text-ink-900">{formatINR(order.total)}</span> at delivery by cash or UPI. No extra charge.
              </p>
            )}
          </Panel>

          <Panel title="Order summary">
            <dl className="flex flex-col gap-2.5">
              <KeyValue label={`Items (${order.items.reduce((a, it) => a + it.quantity, 0)}), M.R.P.`} value={formatINR(mrpTotal)} />
              {mrpSaving > 0 && <KeyValue label="Discount on M.R.P." value={`-${formatINR(mrpSaving)}`} tone="success" />}
              {order.discount > 0 && <KeyValue label={`Coupon ${order.couponCode ?? ""}`.trim()} value={`-${formatINR(order.discount)}`} tone="success" />}
              <KeyValue label="Delivery" value={order.shippingFee ? formatINR(order.shippingFee) : <span className="text-success-700">Free with Plus</span>} />
              <KeyValue label="Platform fee" value={formatINR(order.platformFee)} />
              <div className="my-1 h-px bg-line" />
              <KeyValue label="Order total" value={formatINR(order.total)} strong />
              <p className="text-xs text-ink-500">Inclusive of all taxes</p>
            </dl>
            {saved > 0 && !cancelled && (
              <p className="mt-4 rounded-lg bg-success-50 px-3 py-2 text-[13px] font-medium text-success-700">You saved {formatINR(saved)} on this order</p>
            )}
            {!cancelled && (
              <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
                <Coins size={14} className="mt-px shrink-0 text-accent-600" aria-hidden="true" />
                {coinsOn && coinsOn.getTime() < NOW.getTime()
                  ? `${coins} BluCoins earned on this order.`
                  : `${coins} BluCoins will be added ${coinsOn ? `on ${shortDate(coinsOn)}` : "after delivery"}, once the return window closes.`}
              </p>
            )}
          </Panel>

          <Panel title={sellerIds.length > 1 ? "Sellers" : "Seller"}>
            <ul className="flex flex-col gap-4">
              {sellerIds.map((sid) => {
                const s = getSeller(sid);
                const item = order.items.find((it) => it.sellerId === sid)!;
                const offer = getProduct(item.productId)?.offers.find((o) => o.sellerId === sid);
                return (
                  <li key={sid} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                      <Store size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink-900">{s?.displayName ?? "BluBuy seller"}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                        {s && (
                          <span className="inline-flex items-center gap-1">
                            <Star size={11} className="text-accent-500" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                            {s.rating.toFixed(1)}
                          </span>
                        )}
                        {s && <span>{s.city}</span>}
                        {offer?.fulfilledBy === "blubuy" && <span className="text-brand-700">Fulfilled by BluBuy</span>}
                      </p>
                      <Link href={`/account/support?order=${order.id}&topic=seller`} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                        <MessageSquareText size={14} aria-hidden="true" />
                        Contact seller
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>


        </aside>

        <Panel title="Need help with this order?" description="Most questions are answered in under a minute." className="min-w-0 self-start xl:col-start-1 xl:row-start-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Where is my package?", hint: "Live tracking and delivery attempts", href: `/account/support?order=${order.id}&topic=delivery`, icon: Truck },
              mode
                ? { label: "Cancel an item", hint: "Free before it ships", href: `/account/support?order=${order.id}&topic=cancel`, icon: PackageX }
                : { label: "Return or replace an item", hint: "Doorstep pickup and quick refunds", href: `/account/support?order=${order.id}`, icon: RotateCcw },
              { label: "Payment or refund question", hint: "Charges, EMI and refund status", href: `/account/support?order=${order.id}&topic=payment`, icon: CreditCard },
              { label: "File a BluBuy Guarantee claim", hint: "If the seller has not resolved it", href: `/account/support?order=${order.id}&topic=guarantee`, icon: ShieldCheck },
            ].map((h) => (
              <Link key={h.label} href={h.href} className="group flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-ink-50/60">
                <h.icon size={18} strokeWidth={1.8} className="shrink-0 text-ink-400 group-hover:text-brand-600" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink-900">{h.label}</span>
                  <span className="block truncate text-xs text-ink-500">{h.hint}</span>
                </span>
                <ChevronRight size={15} className="text-ink-300 group-hover:text-ink-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[13px] text-ink-500">Prefer to talk it through? Our team is available around the clock.</p>
            <ButtonLink href={`/account/support?order=${order.id}&chat=1`} variant="secondary" size="sm" icon={Headset}>
              Chat with us
            </ButtonLink>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ItemRow({ order, item }: { order: Order; item: OrderItem }) {
  const product = getProduct(item.productId);
  const ri = returnInfo(order, item);
  const st = itemState(order, item);
  const isDelivered = item.status === "delivered" || item.status === "return_requested";
  return (
    <li className="flex flex-col gap-4 py-5 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        <ProductImage src={item.image} alt={item.title} size={76} />
        <div className="min-w-0 flex-1">
          <Link href={product ? `/p/${product.slug}` : "#"} className="line-clamp-2 text-[14px] leading-snug font-medium text-ink-900 hover:text-brand-700">
            {item.title}
          </Link>
          <p className="mt-1 text-xs text-ink-500">
            {item.variant ? `${item.variant} · ` : ""}Qty {item.quantity}
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink-900 tabular-nums">{formatINR(item.price * item.quantity)}</span>
            {item.mrp > item.price && <span className="text-xs text-ink-400 line-through tabular-nums">{formatINR(item.mrp * item.quantity)}</span>}
          </p>
          {st.ret ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[12.5px]">
              <Undo2 size={14} className="text-ink-500" aria-hidden="true" />
              <span className="text-ink-700">
                {st.ret.resolution === "refund" ? "Return" : "Replacement"} <span className="font-mono">{st.ret.id}</span>: {st.meta.label.toLowerCase()}
              </span>
              <Link href={`/account/returns#${st.ret.id}`} className="font-medium text-brand-700 hover:underline">
                Track
              </Link>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
              <ShieldCheck size={13} aria-hidden="true" />
              {ri.eligible && ri.windowEndsAt
                ? `${ri.policy.summary}. Window closes on ${dayLabel(ri.windowEndsAt)}`
                : isDelivered && ri.reason
                  ? ri.reason
                  : ri.policy.summary}
            </p>
          )}
        </div>
      </div>
      {isDelivered && (
        <div className="flex flex-wrap gap-2 sm:w-44 sm:shrink-0 sm:flex-col [&>a]:flex-1 [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none">
          {ri.eligible && (
            <ButtonLink href={`/account/support?order=${order.id}&item=${item.id}`} size="sm" variant="secondary" icon={RotateCcw} className="sm:w-full">
              Return or replace
            </ButtonLink>
          )}
          {product && !reviewed.has(product.slug) && (
            <ButtonLink href={`/account/reviews?write=${product.slug}`} size="sm" variant="secondary" icon={Star} className="sm:w-full">
              Write a review
            </ButtonLink>
          )}
          <BuyAgainButton title={item.title.split(/[,(]/)[0]!.trim()} className="sm:w-full" />
        </div>
      )}
    </li>
  );
}
