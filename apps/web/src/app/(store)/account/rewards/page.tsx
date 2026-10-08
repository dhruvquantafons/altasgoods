import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Clapperboard, Coins, Crown, Hourglass, Plane, ShoppingBag, Sparkles, Star, Utensils, BedDouble, Smartphone } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { dateTimeLabel, deliveredAt, shortDate } from "@/components/account/lib";
import { IconDot, Notice, Panel } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getProduct } from "@/lib/mock";
import { accountOrders, BLUCOINS, coinTransactions, partnerRewards, returnPolicyFor } from "@/lib/mock/account-extra";
import type { Tone } from "@/lib/status";
import { cn, formatNumber, NOW } from "@/lib/utils";

export const metadata = { title: "AltasCoins" };

const KIND: Record<string, { tone: Tone; icon: typeof Coins }> = {
  earned: { tone: "accent", icon: ArrowDownLeft },
  bonus: { tone: "brand", icon: Sparkles },
  redeemed: { tone: "neutral", icon: ArrowUpRight },
  expired: { tone: "danger", icon: Hourglass },
};

const PARTNER_ICON: Record<string, typeof Plane> = { Entertainment: Clapperboard, Food: Utensils, Travel: Plane };

export default function RewardsPage() {
  const pending = accountOrders
    .filter((o) => o.status === "delivered" && deliveredAt(o))
    .map((o) => {
      const days = Math.max(...o.items.map((it) => Math.max(7, returnPolicyFor(getProduct(it.productId)).days)));
      const creditOn = new Date(new Date(deliveredAt(o)!).getTime() + days * 86400_000);
      return { order: o, creditOn, coins: Math.min(BLUCOINS.cap, Math.floor(o.total / 100) * BLUCOINS.earnRate) };
    })
    .filter((p) => p.creditOn.getTime() > NOW.getTime() && p.coins > 0)
    .sort((a, b) => +a.creditOn - +b.creditOn);
  const pendingTotal = pending.reduce((a, p) => a + p.coins, 0);
  const soon = BLUCOINS.expiring[0]!;

  return (
    <>
      <PageHeader title="AltasCoins" description="Earn coins on every order and spend them at checkout or on partner rewards. 1 coin is worth ₹1." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-accent-100 bg-gradient-to-br from-accent-50 to-white p-5 shadow-card sm:p-6">
            <div className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-accent-200/50 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-800">
                  <Coins size={15} aria-hidden="true" />
                  Your AltasCoins
                </p>
                <p className="mt-2 text-[44px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatNumber(BLUCOINS.balance)}</p>
                <p className="mt-2 text-sm text-ink-600">Worth ₹{formatNumber(BLUCOINS.balance)} at checkout, up to 10% of an order</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
                <dt className="text-ink-500">On the way</dt>
                <dd className="text-right font-semibold text-ink-900 tabular-nums">{formatNumber(pendingTotal)}</dd>
                <dt className="text-ink-500">Your earn rate</dt>
                <dd className="text-right font-semibold text-ink-900">2 per ₹100</dd>
                <dt className="text-ink-500">Cap per order</dt>
                <dd className="text-right font-semibold text-ink-900 tabular-nums">{BLUCOINS.cap}</dd>
              </dl>
            </div>
            <p className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs text-ink-700 ring-1 ring-accent-100">
              <Crown size={13} className="text-accent-700" aria-hidden="true" />
              AltasGoods Plus doubles your coins on every order
            </p>
          </section>

          <Notice tone="warning" icon={CalendarClock} title={`${soon.coins} coins expire on ${shortDate(soon.expiresOn)}`}>
            {soon.from}. Use them on your next order, or pick a partner reward below. Another {BLUCOINS.expiring[1]!.coins} coins expire on {shortDate(BLUCOINS.expiring[1]!.expiresOn)}.
          </Notice>

          <Panel title="Coin history" description="Earned, used and expired" bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {coinTransactions.map((c) => {
                const k = KIND[c.kind]!;
                return (
                  <li key={c.id} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
                    <IconDot icon={k.icon} tone={k.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink-900">{c.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {c.orderId ? (
                          <Link href={`/account/orders/${c.orderId}`} className="text-brand-700 hover:underline">
                            {c.detail}
                          </Link>
                        ) : (
                          c.detail
                        )}{" "}
                        · {dateTimeLabel(c.at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-[14px] font-semibold tabular-nums", c.coins > 0 ? "text-success-700" : c.kind === "expired" ? "text-danger-700" : "text-ink-900")}>
                        {c.coins > 0 ? "+" : "-"}
                        {formatNumber(Math.abs(c.coins))}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500 tabular-nums">Balance {formatNumber(c.balance)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Partner rewards" description="Swap coins for vouchers from AltasGoods partners.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {partnerRewards.map((r) => {
                const Icon = PARTNER_ICON[r.category] ?? BedDouble;
                const enough = BLUCOINS.balance >= r.coins;
                return (
                  <li key={r.id} className="flex flex-col rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <IconDot icon={Icon} tone="neutral" />
                      <Badge size="sm" tone="accent">
                        {formatNumber(r.coins)} coins
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs font-medium text-ink-500">{r.partner}</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-ink-900">{r.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {r.category} · {r.validity}
                    </p>
                    <div className="mt-4">
                      {enough ? (
                        <ActionButton
                          label="Redeem"
                          toast={`${r.partner} voucher sent to your email`}
                          doneLabel="Redeemed"
                          confirm={{
                            title: `Use ${formatNumber(r.coins)} coins?`,
                            body: `You will get "${r.title}" from ${r.partner} by email and SMS. Coins used for partner rewards cannot be refunded.`,
                            confirmLabel: "Redeem",
                          }}
                        />
                      ) : (
                        <p className="text-xs text-ink-500">You need {formatNumber(r.coins - BLUCOINS.balance)} more coins</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Coins on the way" description="Added once the return window closes">
            {pending.length ? (
              <ul className="flex flex-col gap-3.5">
                {pending.slice(0, 5).map((p) => (
                  <li key={p.order.id} className="flex items-center gap-3">
                    <ProductImage src={p.order.items[0]!.image} alt="" size={40} rounded="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{p.order.items[0]!.title}</p>
                      <p className="text-xs text-ink-500">On {shortDate(p.creditOn)}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-accent-800 tabular-nums">+{p.coins}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-500">Nothing pending right now.</p>
            )}
          </Panel>

          <Panel title="Ways to earn">
            <ul className="flex flex-col gap-4">
              {[
                { icon: ShoppingBag, title: "Shop on AltasGoods", body: "2 coins for every ₹100 as a Plus member, up to 100 per order." },
                { icon: Star, title: "Review what you bought", body: "Bonus coins during sale events for helpful, honest reviews. Coins never depend on your rating." },
                { icon: Smartphone, title: "Pay with UPI on Big Days", body: "Extra coins on UPI payments during AltasGoods Big Days." },
                { icon: Sparkles, title: "Plus Day bonus", body: "Members-only bonus coins on AltasGoods Plus Day." },
              ].map((w) => (
                <li key={w.title} className="flex gap-3">
                  <IconDot icon={w.icon} tone="accent" />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">{w.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{w.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <p className="px-1 text-xs leading-relaxed text-ink-500">
            Coins expire at the end of the sixth month after they are credited. Coins used on a cancelled or returned order come back with their original expiry, plus 30
            days if they have already expired.
          </p>
        </div>
      </div>
    </>
  );
}
