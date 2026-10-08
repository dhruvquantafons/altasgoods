import { loadAccountOrders } from "@/lib/api/account-orders";
import Link from "next/link";
import { ArrowRight, Coins, Crown, Heart, Package, ShieldCheck, Undo2, Wallet } from "lucide-react";
import { dateLabel, greeting, isActive, itemState, shortDate, trackIndex } from "@/components/account/lib";
import { MoreLink, Panel, ProductRail, ProductTile, TrackMeter } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { IconTile } from "@/components/ui/misc";
import { CURRENT_CUSTOMER, getProduct } from "@/lib/mock";
import {
  ACCOUNT_PROFILE,
  accountReturns,
  BLUCOINS,
  CREDITS,
  PLUS_MEMBERSHIP,
  productBySlug,
  recentlyViewed,
  recommendations,
  SECURE_DELIVERY,
  wishlistCount,
  wishlists,
} from "@/lib/mock/account-extra";
import type { Tone } from "@/lib/status";
import { formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function AccountOverviewPage() {
  const accountOrders = await loadAccountOrders();
  const active = accountOrders.filter((o) => isActive(o.status));
  const arriving = [...active].sort((a, b) => trackIndex(b.status) - trackIndex(a.status) || +new Date(a.promisedBy) - +new Date(b.promisedBy)).slice(0, 4);
  const recent = accountOrders.filter((o) => !isActive(o.status)).slice(0, 4);
  const openReturns = accountReturns.filter((r) => !["completed", "rejected", "cancelled"].includes(r.status));
  const priceDrops = wishlists.flatMap((l) => l.items).filter((i) => (productBySlug(i.slug)?.price ?? Infinity) < i.priceWhenAdded).length;
  const expiring = BLUCOINS.expiring[0]!;

  const tiles: { label: string; value: string; hint: string; href: string; icon: typeof Package; tone: Tone }[] = [
    { label: "Orders", value: `${active.length} on the way`, hint: `${accountOrders.length} orders in 3 months`, href: "/account/orders", icon: Package, tone: "brand" },
    { label: "Returns", value: `${openReturns.length} open`, hint: "Pickups and refunds", href: "/account/returns", icon: Undo2, tone: "info" },
    { label: "Wishlist", value: `${wishlistCount} items`, hint: `${priceDrops} price drops`, href: "/account/wishlist", icon: Heart, tone: "danger" },
    { label: "AltasGoods Credits", value: formatINR(CREDITS.balance), hint: "Use on any order", href: "/account/wallet", icon: Wallet, tone: "success" },
    { label: "AltasCoins", value: formatNumber(BLUCOINS.balance), hint: `${expiring.coins} expire ${shortDate(expiring.expiresOn)}`, href: "/account/rewards", icon: Coins, tone: "accent" },
    { label: "AltasGoods Plus", value: "Active", hint: `Renews ${shortDate(PLUS_MEMBERSHIP.renewsOn)}`, href: "/account/plus", icon: Crown, tone: "neutral" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold text-ink-900 sm:text-[26px]">
            {greeting()}, {ACCOUNT_PROFILE.firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-500">Your orders, money and membership, all in one place.</p>
        </div>
        {CURRENT_CUSTOMER.plusMember && (
          <Link
            href="/account/plus"
            className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-[13px] text-ink-700 shadow-card hover:border-line-strong sm:self-auto"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-950 text-accent-300">
              <Crown size={13} strokeWidth={2.2} aria-hidden="true" />
            </span>
            You have saved <span className="font-semibold text-ink-900">{formatINR(PLUS_MEMBERSHIP.totalSaved)}</span> with Plus this year
          </Link>
        )}
      </div>

      <section aria-label="Account at a glance" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-px hover:shadow-raised"
          >
            <div className="flex items-center justify-between">
              <IconTile icon={t.icon} tone={t.tone} size="sm" />
              <ArrowRight size={15} className="text-ink-300 transition-colors group-hover:text-ink-600" aria-hidden="true" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-ink-500">{t.label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-ink-900 tabular-nums">{t.value}</p>
            <p className="mt-0.5 truncate text-xs text-ink-500">{t.hint}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Arriving soon" description={`${active.length} orders on the way`} action={<MoreLink href="/account/orders?status=active">All active orders</MoreLink>} bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {arriving.map((o) => {
                const first = o.items[0]!;
                const st = itemState(o, first);
                const secure = o.status === "out_for_delivery";
                return (
                  <li key={o.id}>
                    <Link href={`/account/orders/${o.id}`} className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-ink-50/60 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="relative shrink-0">
                          <ProductImage src={first.image} alt="" size={60} rounded="lg" />
                          {o.items.length > 1 && (
                            <span className="absolute -right-1.5 -bottom-1.5 rounded-full border-2 border-white bg-ink-900 px-1.5 text-[10px] leading-4 font-semibold text-white">
                              +{o.items.length - 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <StatusBadge meta={st.meta} size="sm" />
                            <p className="text-[13.5px] font-semibold text-ink-900">{st.headline}</p>
                          </div>
                          <p className="mt-1 truncate text-[13px] text-ink-600 group-hover:text-ink-900">{first.title}</p>
                          {secure && (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
                              <ShieldCheck size={13} aria-hidden="true" />
                              Delivery OTP <span className="font-mono tracking-[0.15em]">{SECURE_DELIVERY.otp}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <TrackMeter current={trackIndex(o.status)} className="sm:w-48 sm:shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Recent orders" action={<MoreLink href="/account/orders">All orders</MoreLink>} bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {recent.map((o) => {
                const first = o.items[0]!;
                const st = itemState(o, first);
                const slug = getProduct(first.productId)?.slug;
                return (
                  <li key={o.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                    <ProductImage src={first.image} alt="" size={52} rounded="md" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/account/orders/${o.id}`} className="block truncate text-[13.5px] font-medium text-ink-900 hover:text-brand-700">
                        {first.title}
                        {o.items.length > 1 && <span className="font-normal text-ink-500"> and {o.items.length - 1} more</span>}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                        <StatusBadge meta={st.meta} size="sm" />
                        <span>{st.headline}</span>
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[13.5px] font-semibold text-ink-900 tabular-nums">{formatINR(o.total)}</p>
                      <p className="text-xs text-ink-500">{dateLabel(o.placedAt)}</p>
                    </div>
                    {slug && (
                      <ButtonLink href={`/p/${slug}`} size="sm" variant="secondary" className="hidden shrink-0 md:inline-flex">
                        Buy again
                      </ButtonLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-950 p-5 text-white sm:p-6">
            <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-200">
                <Crown size={14} className="text-accent-300" aria-hidden="true" />
                AltasGoods Plus, annual
              </p>
              <p className="mt-3 text-[30px] leading-none font-semibold tracking-tight">{formatINR(PLUS_MEMBERSHIP.totalSaved)}</p>
              <p className="mt-1.5 text-sm text-brand-100">saved since {dateLabel(PLUS_MEMBERSHIP.periodStart)}, on a {formatINR(PLUS_MEMBERSHIP.price)} plan</p>
              <ul className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-[13px]">
                {PLUS_MEMBERSHIP.savings.slice(0, 3).map((s) => (
                  <li key={s.key} className="flex justify-between gap-3">
                    <span className="text-brand-100">{s.label}</span>
                    <span className="font-medium tabular-nums">{formatINR(s.value)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/account/plus" className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-white hover:underline">
                Manage membership
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <Panel title="Returns and refunds" action={<MoreLink href="/account/returns">View</MoreLink>}>
            <ul className="flex flex-col gap-4">
              {openReturns.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <ProductImage src={r.image} alt="" size={40} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">{r.productTitle}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {r.refund ? `${formatINR(r.refund.amount)} to ${r.refund.destination}` : r.resolution === "replacement" ? "Replacement" : "Return"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Quick links" bodyClassName="pt-3">
            <ul className="-mx-2 grid grid-cols-2 gap-1 text-[13px]">
              {[
                { label: "Addresses", href: "/account/addresses" },
                { label: "Payment methods", href: "/account/payments" },
                { label: "Your reviews", href: "/account/reviews" },
                { label: "Notifications", href: "/account/notifications" },
                { label: "Login and security", href: "/account/profile" },
                { label: "Help and support", href: "/account/support" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-lg px-2 py-2 text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Recommended for you" description="Based on what you have bought and browsed" className="mt-6">
        <ProductRail>
          {recommendations.slice(0, 6).map((r) => {
            const p = productBySlug(r.slug);
            return p ? <ProductTile key={r.slug} product={p} note={r.reason} /> : null;
          })}
        </ProductRail>
      </Panel>

      <Panel title="Recently viewed" action={<MoreLink href="/s">Keep shopping</MoreLink>} className="mt-6">
        <ProductRail>
          {recentlyViewed.slice(0, 6).map((slug) => {
            const p = productBySlug(slug);
            return p ? <ProductTile key={slug} product={p} /> : null;
          })}
        </ProductRail>
      </Panel>
    </>
  );
}
