import { ArrowDownLeft, ArrowUpRight, Gift, HandHeart, Info, Undo2 } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { dateLabel, dateTimeLabel } from "@/components/account/lib";
import { AddGiftCardButton, BuyGiftCardButton } from "@/components/account/money-forms";
import { IconDot, Panel } from "@/components/account/ui";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { CREDITS, GIFT_CARD_DESIGNS, giftCards, walletTransactions, type WalletKind } from "@/lib/mock/account-extra";
import type { Tone } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";

export const metadata = { title: "AltasGoods Credits" };

const KIND: Record<WalletKind, { icon: typeof Gift; tone: Tone; label: string }> = {
  refund: { icon: Undo2, tone: "success", label: "Refund" },
  gift_card: { icon: Gift, tone: "accent", label: "Gift card" },
  goodwill: { icon: HandHeart, tone: "brand", label: "Goodwill" },
  spent: { icon: ArrowUpRight, tone: "neutral", label: "Spent" },
  withdrawal: { icon: ArrowUpRight, tone: "neutral", label: "Withdrawn" },
};

const DESIGN_BG: Record<Tone, string> = {
  neutral: "from-ink-700 to-ink-900",
  info: "from-info-500 to-info-700",
  brand: "from-brand-500 to-brand-800",
  success: "from-success-500 to-success-700",
  warning: "from-warning-500 to-warning-700",
  danger: "from-danger-500 to-danger-700",
  accent: "from-accent-300 to-accent-600",
};

export default async function WalletPage(props: PageProps<"/account/wallet">) {
  const sp = await props.searchParams;
  const filter = sp.type === "in" ? "in" : sp.type === "out" ? "out" : "all";
  const txns = walletTransactions.filter((t) => (filter === "in" ? t.amount > 0 : filter === "out" ? t.amount < 0 : true));

  return (
    <>
      <PageHeader title="AltasGoods Credits" description="Store credit from refunds, gift cards and goodwill. Use it on any order, together with any payment method." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
            <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-500">Available balance</p>
                <p className="mt-1.5 text-[40px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(CREDITS.balance)}</p>
                <p className="mt-2 max-w-xs text-[13px] text-ink-500">Applied automatically at checkout. You can switch it off for any order.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 md:flex-nowrap">
                <AddGiftCardButton />
                <ActionButton
                  label="Move to bank"
                  variant="secondary"
                  size="md"
                  toast="Withdrawal requested. It reaches your bank in 1 to 2 business days"
                  confirm={{
                    title: `Move ${formatINR(CREDITS.refund.amount)} to your bank?`,
                    body: "Only credits that came from refunds can be moved back, to the account they were paid from. Gift card and goodwill credits stay in AltasGoods.",
                    confirmLabel: "Move to bank",
                  }}
                />
              </div>
            </div>
            <dl className="grid border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
              {[
                { label: "From refunds", value: CREDITS.refund.amount, note: "Never expires, can be moved to bank" },
                { label: "From gift cards", value: CREDITS.giftCard.amount, note: `Expires ${dateLabel(CREDITS.giftCard.expiresOn)}` },
                { label: "Goodwill credit", value: CREDITS.goodwill.amount, note: `Expires ${dateLabel(CREDITS.goodwill.expiresOn)}` },
              ].map((b, i) => (
                <div key={b.label} className={cn("px-5 py-4 sm:px-6", i > 0 && "border-t border-line sm:border-t-0")}>
                  <dt className="text-xs text-ink-500">{b.label}</dt>
                  <dd className="mt-1 text-[17px] font-semibold text-ink-900 tabular-nums">{formatINR(b.value)}</dd>
                  <dd className="mt-0.5 text-xs text-ink-500">{b.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Panel
            title="Transactions"
            action={
              <TabLinks
                variant="pill"
                active={filter}
                items={[
                  { key: "all", label: "All", href: "/account/wallet" },
                  { key: "in", label: "Added", href: "/account/wallet?type=in" },
                  { key: "out", label: "Spent", href: "/account/wallet?type=out" },
                ]}
              />
            }
            bodyClassName="px-0 pb-1 sm:px-0"
          >
            <ul className="divide-y divide-line">
              {txns.map((t) => {
                const k = KIND[t.kind];
                return (
                  <li key={t.id} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
                    <IconDot icon={t.amount > 0 && t.kind === "refund" ? ArrowDownLeft : k.icon} tone={k.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink-900">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {t.detail} · {dateTimeLabel(t.at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-[14px] font-semibold tabular-nums", t.amount > 0 ? "text-success-700" : "text-ink-900")}>
                        {t.amount > 0 ? "+" : "-"}
                        {formatINR(Math.abs(t.amount))}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500 tabular-nums">Balance {formatINR(t.balance)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
            <div className="relative h-40 overflow-hidden bg-ink-50">
              {GIFT_CARD_DESIGNS.slice(0, 3).map((d, i) => (
                <div
                  key={d.id}
                  className={cn("absolute flex h-24 w-40 flex-col justify-between rounded-xl bg-gradient-to-br p-3 text-white shadow-raised", DESIGN_BG[d.tone])}
                  style={{ left: `calc(50% - 140px + ${i * 60}px)`, top: `${20 + (i % 2) * 12}%`, transform: `rotate(${(i - 1) * 7}deg)` }}
                  aria-hidden="true"
                >
                  <p className="font-display text-[12px] font-semibold">AltasGoods</p>
                  <p className="text-[11px] opacity-90">{d.name}</p>
                </div>
              ))}
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-ink-900">AltasGoods Gift Card</h2>
              <p className="mt-1 text-[13px] text-ink-500">From ₹100 to ₹10,000, delivered by email in minutes. Valid for a year on anything sold on AltasGoods.</p>
              <BuyGiftCardButton designs={GIFT_CARD_DESIGNS} className="mt-4 w-full" />
            </div>
          </section>

          <Panel title="Your gift cards">
            <ul className="flex flex-col gap-4">
              {giftCards.map((g) => (
                <li key={g.id} className="flex items-start gap-3">
                  <IconDot icon={Gift} tone="accent" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink-900">
                      {formatINR(g.amount)} {g.design}
                      <Badge size="sm" tone={g.direction === "received" ? "success" : "neutral"}>
                        {g.status}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {g.direction === "received" ? `From ${g.from}, card ending ${g.code}` : `Sent to ${g.to}, card ending ${g.code}`}
                    </p>
                    <p className="text-xs text-ink-500">
                      {g.direction === "received" ? `Added ${dateLabel(g.activatedAt)}` : `Sent ${dateLabel(g.activatedAt)}`} · Expires {dateLabel(g.expiresOn)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-[13px] text-ink-600 shadow-card">
            <Info size={17} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
            <p>
              AltasGoods Credits is a closed-loop balance for use on AltasGoods only. Gift cards cannot be reloaded, resold or exchanged for cash. Instant refunds to Credits arrive
              in under 2 hours.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
