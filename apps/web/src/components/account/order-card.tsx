import Link from "next/link";
import { MapPinned, RotateCcw, ShieldCheck, Star, Truck, Undo2 } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getProduct } from "@/lib/mock";
import { CANCEL_REASONS, myReviews, SECURE_DELIVERY } from "@/lib/mock/account-extra";
import type { Order, OrderItem } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";
import { BuyAgainButton, CancelOrderButton, InvoiceButton, type RefundOption } from "./order-actions";
import { cancelMode, dateLabel, isActive, itemState, needsSecureDelivery, paymentLabel, refundTiming, returnInfo, sellerName, shortDate, trackIndex } from "./lib";

const reviewed = new Set(myReviews.map((r) => r.slug));

export function refundOptionsFor(order: Order): RefundOption[] {
  const m = order.payment.method;
  if (m === "wallet" || m === "giftcard") return [{ key: "credits", label: "BluBuy Credits", detail: "Back in your balance in under 2 hours" }];
  return [
    { key: "original", label: paymentLabel(m), detail: `Usually ${refundTiming(m).toLowerCase()} after the refund starts` },
    { key: "credits", label: "BluBuy Credits", detail: "Instant, usually under 2 hours. Use it on any order" },
  ];
}

/** Plain props for the client cancel dialog. */
export function cancelProps(order: Order) {
  return {
    orderId: order.id,
    items: order.items.map((it) => ({ id: it.id, title: it.title, image: it.image, variant: it.variant, quantity: it.quantity, amount: it.price * it.quantity })),
    reasons: CANCEL_REASONS,
    refundOptions: refundOptionsFor(order),
    isCod: order.payment.method === "cod",
  };
}

export function invoiceAvailable(order: Order) {
  return trackIndex(order.status) >= 2 || ["returned", "return_requested", "rto_in_transit", "returned_to_seller"].includes(order.status);
}

function Meta({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-ink-900">{children}</dd>
    </div>
  );
}

/** One order on the orders list: summary strip plus a row per item with state-specific actions. */
export function OrderCard({ order }: { order: Order }) {
  const secure = order.status === "out_for_delivery" && needsSecureDelivery(order);
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <header className="flex flex-col gap-3 border-b border-line bg-ink-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-10">
          <Meta label="Order placed">{dateLabel(order.placedAt)}</Meta>
          <Meta label="Total">
            <span className="tabular-nums">{formatINR(order.total)}</span>
          </Meta>
          <Meta label="Ship to" className="hidden md:block">
            {order.address.name.split(" ")[0]}, {order.address.city}
          </Meta>
          <Meta label="Order number" className="col-span-2 sm:col-span-1">
            <span className="font-mono text-[13px]">{order.id}</span>
          </Meta>
        </dl>
        <div className="flex items-center gap-4">
          <Link href={`/account/orders/${order.id}`} className="text-[13px] font-medium text-brand-700 hover:text-brand-800 hover:underline">
            View order details
          </Link>
          {invoiceAvailable(order) && <InvoiceButton orderId={order.id} variant="link" size="sm" />}
        </div>
      </header>

      {secure && (
        <div className="flex items-start gap-2.5 border-b border-line bg-accent-50 px-5 py-2.5 text-[13px] text-ink-800 sm:items-center sm:px-6">
          <ShieldCheck size={16} strokeWidth={1.9} className="mt-px shrink-0 text-accent-700 sm:mt-0" aria-hidden="true" />
          <p>
            Secure Delivery: share OTP <span className="font-mono font-semibold tracking-[0.2em] text-ink-900">{SECURE_DELIVERY.otp}</span> only once the package is in your
            hands.
          </p>
        </div>
      )}

      <ul className="divide-y divide-line">
        {order.items.map((item, idx) => (
          <OrderItemRow key={item.id} order={order} item={item} first={idx === 0} />
        ))}
      </ul>
    </article>
  );
}

function OrderItemRow({ order, item, first }: { order: Order; item: OrderItem; first: boolean }) {
  const st = itemState(order, item);
  const ri = returnInfo(order, item);
  // live orders can be cancelled only until they ship; after that the customer refuses or returns them
  const mode = order.returns && ["shipped", "in_transit"].includes(order.status) ? null : cancelMode(order.status);
  const slug = getProduct(item.productId)?.slug;
  const active = isActive(order.status);
  const delivered = item.status === "delivered" || item.status === "return_requested" || item.status === "returned";
  const showReturnWindow = !st.ret && ri.eligible && ri.windowEndsAt;

  return (
    <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:gap-6 sm:px-6">
      <div className="flex min-w-0 flex-1 gap-4">
        <Link href={`/account/orders/${order.id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
          <ProductImage src={item.image} alt="" size={84} rounded="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <StatusBadge meta={st.meta} size="sm" />
            <p className="text-[14px] font-semibold text-ink-900">{st.headline}</p>
          </div>
          {st.detail && <p className="mt-1 text-xs text-ink-500">{st.detail}</p>}
          <Link href={slug ? `/p/${slug}` : `/account/orders/${order.id}`} className="mt-2 line-clamp-2 text-[14px] leading-snug text-ink-800 hover:text-brand-700">
            {item.title}
          </Link>
          <p className="mt-1 text-xs text-ink-500">
            {item.variant ? `${item.variant} · ` : ""}Qty {item.quantity} · Sold by {sellerName(item.sellerId)}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(item.price * item.quantity)}</p>
          {showReturnWindow && (
            <p className="mt-1.5 text-xs text-ink-500">
              {ri.policy.summary}. Return window closes on {shortDate(ri.windowEndsAt!)}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 empty:hidden sm:w-48 sm:shrink-0 sm:flex-col [&>button]:flex-1 [&>a]:flex-1 sm:[&>button]:flex-none sm:[&>a]:flex-none">
        {active && first && (
          <ButtonLink href={`/account/orders/${order.id}`} size="sm" variant="primary" icon={order.status === "out_for_delivery" ? MapPinned : Truck} className="sm:w-full">
            Track package
          </ButtonLink>
        )}
        {active && mode && first && <CancelOrderButton mode={mode} {...cancelProps(order)} className="sm:w-full" />}
        {st.ret && (
          <ButtonLink href={`/account/returns#${st.ret.id}`} size="sm" variant="secondary" icon={Undo2} className="sm:w-full">
            {st.ret.resolution === "refund" ? "Track return" : "Track replacement"}
          </ButtonLink>
        )}
        {delivered && ri.eligible && (
          <ButtonLink href={`/account/orders/${order.id}/return?item=${item.id}`} size="sm" variant="secondary" icon={RotateCcw} className="sm:w-full">
            Return or replace
          </ButtonLink>
        )}
        {delivered && slug && !reviewed.has(slug) && !st.ret && (
          <ButtonLink href={`/account/reviews?write=${slug}`} size="sm" variant="secondary" icon={Star} className="sm:w-full">
            Write a review
          </ButtonLink>
        )}
        {!active && <BuyAgainButton title={item.title.split(/[,(]/)[0]!.trim()} className="sm:w-full" />}
      </div>
    </li>
  );
}
