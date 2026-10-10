import { BadgeCheck, Check, Coins, Crown, Headset, Minus, Tag, Timer, Truck, Zap } from "lucide-react";
import { formatDayMonthYear } from "@/components/store/delivery";
import { PlusPlanAction } from "@/components/store/plus-join";
import { PlusManage } from "@/components/store/plus-manage";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { currentUser } from "@/lib/api/server";
import { PLUS_MEMBERSHIP, PLUS_PLANS } from "@/lib/mock/store-extra";
import { cn, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "AltasGoods Plus" };

const BENEFITS = [
  { icon: Truck, title: "Free delivery, every order", body: "No minimum order value." },
  { icon: Zap, title: "One-day delivery", body: "On AltasGoods Fulfilled items in top cities." },
  { icon: Timer, title: "24 hour early access", body: "Shop AltasGoods Big Days and Plus Day a day before everyone." },
  { icon: Coins, title: "2x AltasCoins", body: "2 coins per ₹100 instead of 1, up to 100 coins per order." },
  { icon: Tag, title: "Plus-only deals", body: "Member prices and coupons like PLUS200 all year." },
  { icon: Headset, title: "Priority support", body: "Shorter queues on chat and call-backs within 15 minutes." },
];

const COMPARE: [string, string | boolean, string | boolean][] = [
  ["Delivery fee", "Free on every order", "Free above ₹499, else ₹40"],
  ["One-day delivery in top cities", true, false],
  ["Early access to sale events", "24 hours early", false],
  ["AltasCoins per ₹100", "2", "1"],
  ["Plus-only deals and coupons", true, false],
  ["Priority customer support", true, false],
  ["Easy returns and AltasGoods Guarantee", true, true],
];

export default async function PlusPage() {
  // membership comes from the signed-in account; plan details and savings are still sample data (no membership API yet)
  const user = await currentUser();
  const member = Boolean(user?.isPlus);
  const m = PLUS_MEMBERSHIP;
  return (
    <div className="pb-16 lg:pb-24">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
        <div className="pointer-events-none absolute -top-32 -right-20 size-[30rem] rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
        <div className={cn(STORE_CONTAINER, "relative grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-16")}>
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent-300">
              <Crown size={18} aria-hidden="true" /> AltasGoods Plus
            </p>
            <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight lg:text-[52px]">Everything faster, everything free to deliver</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-100">
              One membership for free delivery on every order, one-day delivery in top cities, early sale access and double AltasCoins. From {formatINR(83)} a month on the
              annual plan. Cancel any time in one step.
            </p>
          </div>

          {member ? (
            <div className="rounded-2xl bg-white/[0.07] p-6 ring-1 ring-white/15 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Your membership</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-0.5 text-xs font-semibold text-ink-950">
                  <BadgeCheck size={13} aria-hidden="true" /> Active
                </span>
              </div>
              <p className="mt-1 text-[13px] text-brand-200">
                {m.plan} plan, member since {formatDayMonthYear(m.since)}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { k: formatINR(m.savedThisYear), v: "saved this year" },
                  { k: String(m.freeDeliveries), v: "free deliveries" },
                  { k: formatNumber(m.coinsEarned), v: "AltasCoins earned" },
                ].map((s) => (
                  <div key={s.v} className="flex flex-col-reverse rounded-xl bg-white/[0.06] px-3 py-3">
                    <dt className="mt-0.5 text-xs text-brand-200">{s.v}</dt>
                    <dd className="font-display text-xl font-semibold tabular-nums">{s.k}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <PlusManage renewsOn={formatDayMonthYear(m.renewsOn)} refundNote="If you have used less than the plan price in benefits, we refund the unused amount to your original payment method." />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className={STORE_CONTAINER}>
        <section aria-labelledby="plus-benefits" className="mt-14">
          <h2 id="plus-benefits" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            What you get
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-4 rounded-2xl border border-line p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <b.icon size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink-900">{b.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-600">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="plus-plans" className="mt-14">
          <h2 id="plus-plans" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Plans
          </h2>
          <p className="mt-1.5 text-[15px] text-ink-600">Prices include GST. No hidden charges, no automatic upgrades.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:max-w-4xl">
            {PLUS_PLANS.map((p) => {
              const current = member && p.name === m.plan;
              return (
                <div key={p.id} className={cn("relative rounded-2xl border p-6", p.best ? "border-brand-500 ring-1 ring-brand-500" : "border-line")}>
                  {p.best && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Best value</span>}
                  <p className="text-sm font-semibold text-ink-600">{p.name}</p>
                  <p className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tracking-tight text-ink-900">{formatINR(p.price)}</span>
                    <span className="text-sm text-ink-500">a {p.period}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-500">
                    {p.id === "annual" ? `That is ${formatINR(p.perMonth)} a month. ` : ""}
                    {p.note}
                  </p>
                  <PlusPlanAction plan={p} best={p.best} mode={!user ? "signed_out" : current ? "current" : member ? "switch" : "join"} />
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="plus-compare" className="mt-14 lg:max-w-4xl">
          <h2 id="plus-compare" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Plus compared
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-ink-50 text-left text-xs text-ink-500">
                  <th className="px-5 py-3 font-medium">Benefit</th>
                  <th className="px-5 py-3 font-semibold text-brand-700">With Plus</th>
                  <th className="px-5 py-3 font-medium">Without Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COMPARE.map(([label, a, b]) => (
                  <tr key={label}>
                    <td className="px-5 py-3 text-ink-800">{label}</td>
                    {[a, b].map((v, i) => (
                      <td key={i} className="px-5 py-3">
                        {v === true ? (
                          <span className="inline-flex items-center gap-1.5 text-success-700">
                            <Check size={16} aria-hidden="true" /> Included
                          </span>
                        ) : v === false ? (
                          <span className="inline-flex items-center gap-1.5 text-ink-400">
                            <Minus size={16} aria-hidden="true" /> Not included
                          </span>
                        ) : (
                          <span className={i === 0 ? "font-medium text-ink-900" : "text-ink-600"}>{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Cancelling is as easy as joining: one screen, no calls. If you cancel an annual plan and have used less than its price in benefits, we refund the difference.
          </p>
        </section>
      </div>
    </div>
  );
}
