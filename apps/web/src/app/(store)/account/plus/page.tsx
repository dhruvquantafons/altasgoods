import { BadgePercent, CalendarHeart, Coins, Crown, Headset, PartyPopper, Timer, Truck, Zap } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { dateLabel } from "@/components/account/lib";
import { PlusManage } from "@/components/account/plus-manage";
import { KeyValue, Panel } from "@/components/account/ui";
import { IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { PLUS_MEMBERSHIP, PLUS_PLANS } from "@/lib/mock/account-extra";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "AltasGoods Plus" };

const BENEFITS = [
  { icon: Truck, title: "Free delivery on every order", body: "No minimum order value." },
  { icon: Zap, title: "One-day delivery", body: "In top cities on AltasGoods Fulfilled items." },
  { icon: Timer, title: "24 hour early access", body: "To AltasGoods Big Days and AltasGoods Plus Day deals." },
  { icon: Coins, title: "2x AltasCoins", body: "2 coins for every ₹100, up to 100 per order." },
  { icon: BadgePercent, title: "Plus-only prices", body: "Member prices and coupons on thousands of products." },
  { icon: Headset, title: "Priority support", body: "Shorter waits on chat and call-back." },
];

export default function PlusPage() {
  const m = PLUS_MEMBERSHIP;
  const multiple = Math.floor(m.totalSaved / m.price);
  return (
    <>
      <PageHeader title="AltasGoods Plus" description="Your membership, what it has saved you and everything included." />

      <section className="relative mb-6 overflow-hidden rounded-[var(--radius-card)] bg-brand-950 text-white">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/15">
                <Crown size={13} className="text-accent-300" aria-hidden="true" />
                Annual member
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/20 px-2.5 py-1 text-xs font-semibold text-success-100 ring-1 ring-success-500/30">
                <span className="size-1.5 rounded-full bg-success-500" aria-hidden="true" />
                Active
              </span>
            </div>
            <p className="mt-5 text-sm text-brand-200">You have saved this membership year</p>
            <p className="mt-1 text-[44px] leading-none font-semibold tracking-tight tabular-nums">{formatINR(m.totalSaved)}</p>
            <p className="mt-3 max-w-lg text-sm text-brand-100">
              That is {multiple} times the {formatINR(m.price)} you paid, across {m.ordersThisYear} orders. A member since {new Date(m.memberSince).getFullYear()}.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] md:text-right">
            <div>
              <dt className="text-brand-200">Renews on</dt>
              <dd className="mt-0.5 font-semibold">{dateLabel(m.renewsOn)}</dd>
            </div>
            <div>
              <dt className="text-brand-200">Plan</dt>
              <dd className="mt-0.5 font-semibold">{formatINR(m.price)} a year</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Savings by month" description={`Since ${dateLabel(m.periodStart)}. September includes AltasGoods Big Days.`}>
            <BarChart
              data={m.monthlySavings.map((d) => ({ label: d.label, saved: d.value }))}
              series={[{ key: "saved", label: "Saved" }]}
              format="inr"
              height={220}
              emphasis={m.monthlySavings.length - 1}
              ariaLabel="Amount saved with AltasGoods Plus each month, November to September"
            />
            <dl className="mt-5 grid gap-x-8 gap-y-2.5 border-t border-line pt-4 sm:grid-cols-2">
              {m.savings.map((s) => (
                <div key={s.key}>
                  <KeyValue label={s.label} value={formatINR(s.value)} />
                  <p className="text-xs text-ink-500">{s.detail}</p>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Your benefits">
            <ul className="grid gap-5 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3.5">
                  <IconTile icon={b.icon} tone="brand" size="sm" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink-900">{b.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Manage membership">
            <PlusManage
              planId={m.planId}
              plans={PLUS_PLANS.map((p) => ({ ...p }))}
              renewsOnLabel={dateLabel(m.renewsOn)}
              renewalMethod={m.renewalMethod}
              autoRenew={m.autoRenew}
              refundEstimate={m.totalSaved > m.price ? 0 : Math.round((m.price * 42) / 365)}
            />
          </Panel>

          <Panel title="Coming up for members">
            <ul className="flex flex-col gap-4">
              <li className="flex gap-3">
                <IconTile icon={PartyPopper} tone="accent" size="sm" />
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">Diwali early access</p>
                  <p className="mt-0.5 text-xs text-ink-500">Deals open for you 24 hours early, from 27 Oct.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <IconTile icon={CalendarHeart} tone="brand" size="sm" />
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">Renewal reminder</p>
                  <p className="mt-0.5 text-xs text-ink-500">We will remind you on 5 Nov, a week before renewal.</p>
                </div>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
