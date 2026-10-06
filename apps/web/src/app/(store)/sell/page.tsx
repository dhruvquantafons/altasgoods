import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgePercent, Banknote, ChevronDown, Clock, GraduationCap, Megaphone, ShieldCheck, Users } from "lucide-react";
import { SellerSignIn } from "@/components/seller/seller-sign-in";
import { NamedIcon } from "@/components/store/icons";
import { STORE_CONTAINER } from "@/components/store/store-header";
import {
  categories,
  COMMISSION_FREE_UPTO,
  feesForLine,
  FIXED_FEE_SLABS,
  GST_ON_FEES_PERCENT,
  PAYOUT_HOLD_DAYS,
  SHIPPING_RATE_CARD,
  TCS_PERCENT,
  TDS_PERCENT,
  TIER_FIXED_FEE_MODIFIER,
} from "@/lib/mock";
import { SELL_PROGRAMS, SELL_STEPS } from "@/lib/mock/store-extra";
import { cn, formatINR } from "@/lib/utils";

export const metadata = { title: "Sell on AltasGoods" };

const EXAMPLE_PRICE = 1599;

export default function SellPage() {
  const example = feesForLine("p-kurta-ethnic", EXAMPLE_PRICE, 1, false, "Gold");
  const deductions = example.reduce((a, f) => a + f.amount, 0);
  const net = EXAMPLE_PRICE + deductions;
  const slabLabel = (i: number) => {
    const s = FIXED_FEE_SLABS[i]!;
    const prev = i === 0 ? 0 : FIXED_FEE_SLABS[i - 1]!.upTo + 1;
    if (i === 0) return `Up to ${formatINR(s.upTo)}`;
    return s.upTo === Infinity ? `Above ${formatINR(prev - 1)}` : `${formatINR(prev)} to ${formatINR(s.upTo)}`;
  };

  return (
    <div className="pb-16 lg:pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="pointer-events-none absolute -top-40 right-0 size-[36rem] rounded-full bg-brand-600/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-48 left-1/4 size-96 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
        <div className={cn(STORE_CONTAINER, "relative grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20")}>
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100 ring-1 ring-white/15">AltasGoods Seller Hub</p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight lg:text-[56px]">Sell to customers across India, on fair terms</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-100">
              Zero commission on items up to {formatINR(COMMISSION_FREE_UPTO)}, no collection fee on prepaid or cash on delivery orders, and payouts as soon as delivery
              plus {PAYOUT_HOLD_DAYS.Platinum} days.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/seller/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent-400 px-6 text-[15px] font-semibold text-ink-950 hover:bg-accent-300">
                Start selling <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <SellerSignIn className="inline-flex h-12 items-center rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">Seller Hub login</SellerSignIn>
            </div>
            <p className="mt-4 text-[13px] text-brand-200">Takes about 10 minutes. Keep your GSTIN or PAN, bank details and pickup address handy.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "0%", v: `commission on items up to ${formatINR(COMMISSION_FREE_UPTO)}` },
              { k: `${PAYOUT_HOLD_DAYS.Platinum} days`, v: "after delivery to get paid, for Platinum sellers" },
              { k: "₹0", v: "collection fee on UPI, cards or cash on delivery" },
              { k: "19,000+", v: "pincodes served by AltasGoods Logistics" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <p className="font-display text-3xl font-semibold tracking-tight">{s.k}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-brand-100">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={STORE_CONTAINER}>
        {/* Steps */}
        <section aria-labelledby="sell-steps" className="mt-16">
          <h2 id="sell-steps" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            From sign up to first payout
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {SELL_STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-semibold text-white">{i + 1}</span>
                <p className="mt-4 text-[15px] font-semibold text-ink-900">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Fees */}
        <section id="fees" aria-labelledby="sell-fees" className="mt-16 scroll-mt-28">
          <h2 id="sell-fees" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Simple, published fees
          </h2>
          <p className="mt-1.5 max-w-2xl text-[15px] text-ink-600">
            You pay a commission, a small fixed fee and shipping. That is it. {GST_ON_FEES_PERCENT}% GST applies to fees and is claimable as input tax credit.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-line p-5 lg:col-span-1">
              <p className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <BadgePercent size={18} className="text-brand-600" aria-hidden="true" /> Commission
              </p>
              <p className="mt-1 text-[13px] text-ink-500">0% on items up to {formatINR(COMMISSION_FREE_UPTO)} in every category. Above that:</p>
              <ul className="mt-3 divide-y divide-line text-sm">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-ink-700">
                      <NamedIcon name={c.icon} size={15} className="text-ink-400" />
                      {c.name}
                    </span>
                    <span className="font-semibold text-ink-900 tabular-nums">{c.commission}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-6 lg:col-span-2">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-line p-5">
                  <p className="text-base font-semibold text-ink-900">Fixed fee per item</p>
                  <p className="mt-1 text-[13px] text-ink-500">
                    Platinum rates. Gold +{formatINR(TIER_FIXED_FEE_MODIFIER.Gold)}, Silver +{formatINR(TIER_FIXED_FEE_MODIFIER.Silver)}, Bronze +
                    {formatINR(TIER_FIXED_FEE_MODIFIER.Bronze)}.
                  </p>
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {FIXED_FEE_SLABS.map((s, i) => (
                      <li key={i} className="flex justify-between py-2">
                        <span className="text-ink-700">{slabLabel(i)}</span>
                        <span className="font-semibold text-ink-900 tabular-nums">{formatINR(s.fee)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-line p-5">
                  <p className="text-base font-semibold text-ink-900">What you never pay</p>
                  <ul className="mt-3 flex flex-col gap-3 text-sm text-ink-700">
                    {["No collection or payment gateway fee", "No extra fee on cash on delivery orders", "No listing or registration fee", "No fee to join sale events", "No penalty for customer cancellations before dispatch"].map((x) => (
                      <li key={x} className="flex items-start gap-2.5">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" /> {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
                  <p className="text-base font-semibold text-ink-900">Shipping with AltasGoods Logistics</p>
                  <p className="text-[13px] text-ink-500">Per package, by chargeable weight and zone. Tier discounts up to 15%.</p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-ink-50 text-xs text-ink-500">
                      <tr>
                        <th className="px-5 py-2.5 text-left font-medium">Weight</th>
                        <th className="px-3 py-2.5 text-right font-medium">Local</th>
                        <th className="px-3 py-2.5 text-right font-medium">Regional</th>
                        <th className="px-3 py-2.5 text-right font-medium">National</th>
                        <th className="px-5 py-2.5 text-right font-medium">Special zones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {SHIPPING_RATE_CARD.map((r) => (
                        <tr key={r.weight}>
                          <td className="px-5 py-2.5 text-ink-700">{r.weight}</td>
                          <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{formatINR(r.local)}</td>
                          <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{formatINR(r.regional)}</td>
                          <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{formatINR(r.national)}</td>
                          <td className="px-5 py-2.5 text-right text-ink-900 tabular-nums">{formatINR(r.special)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Worked example */}
          <div className="mt-6 grid gap-6 rounded-2xl bg-ink-50 p-5 lg:grid-cols-[1fr_1.2fr] lg:p-8">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Worked example</p>
              <p className="mt-2 font-display text-xl font-semibold text-ink-900">A {formatINR(EXAMPLE_PRICE)} cotton kurta, sold by a Gold seller, shipped regionally</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                TCS ({TCS_PERCENT}%) and TDS ({TDS_PERCENT}%) are government taxes collected on your behalf and credited to your GST and income tax accounts, so you can claim
                them back.
              </p>
              <div className="relative mt-5 hidden aspect-[4/3] max-w-xs overflow-hidden rounded-xl lg:block">
                <Image src="/images/products/kurta-ethnic.jpg" alt="" fill sizes="320px" className="object-cover" />
              </div>
            </div>
            <dl className="rounded-xl bg-white p-5 text-sm ring-1 ring-line">
              <div className="flex justify-between py-1.5">
                <dt className="font-medium text-ink-900">Selling price (incl. GST)</dt>
                <dd className="font-semibold text-ink-900 tabular-nums">{formatINR(EXAMPLE_PRICE)}</dd>
              </div>
              {example.map((f) => (
                <div key={f.label} className="flex justify-between py-1.5">
                  <dt className="text-ink-600">{f.label}</dt>
                  <dd className="text-ink-800 tabular-nums">{f.amount ? `-${formatINR(-f.amount)}` : formatINR(0)}</dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-line pt-3">
                <dt className="font-semibold text-ink-900">You receive</dt>
                <dd className="font-display text-lg font-semibold text-success-700 tabular-nums">{formatINR(net)}</dd>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Paid {PAYOUT_HOLD_DAYS.Gold} days after delivery for Gold sellers ({PAYOUT_HOLD_DAYS.Platinum} for Platinum, {PAYOUT_HOLD_DAYS.Silver} for Silver,{" "}
                {PAYOUT_HOLD_DAYS.Bronze} for Bronze). Payouts run Monday, Wednesday and Friday.
              </p>
            </dl>
          </div>
        </section>

        {/* Programs */}
        <section id="programs" aria-labelledby="sell-programs" className="mt-16 scroll-mt-28">
          <h2 id="sell-programs" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Ship your way
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {SELL_PROGRAMS.map((p) => (
              <div key={p.name} className="rounded-2xl border border-line p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <NamedIcon name={p.icon} size={19} />
                </span>
                <p className="mt-4 text-[15px] font-semibold text-ink-900">{p.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Growth tools */}
        <section aria-labelledby="sell-grow" className="mt-16">
          <h2 id="sell-grow" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Tools to grow
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Megaphone, t: "AltasGoods Ads", b: "Sponsored products and brand ads, pay only per click, clearly labelled to shoppers." },
              { icon: Clock, t: "Sale events", b: "Nominate deals for AltasGoods Big Days and Plus Day with honest 30 day price checks." },
              { icon: Users, t: "Seller Health", b: "One score and clear targets for cancellations, late dispatch and defects." },
              { icon: GraduationCap, t: "Seller Academy", b: "Short lessons on listings, packaging and GST, in English and Hindi." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-ink-50 p-5">
                <x.icon size={20} className="text-ink-700" aria-hidden="true" />
                <p className="mt-3 text-[15px] font-semibold text-ink-900">{x.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{x.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="sell-faq" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="sell-faq" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
              Questions sellers ask
            </h2>
            <p className="mt-2 text-sm text-ink-600">Still unsure? Our seller success team calls you back within one business day after you register.</p>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {[
              ["Do I need a GSTIN?", "Yes for most categories. Books and other GST exempt categories can register with PAN only."],
              ["When do I get paid?", `As soon as delivery plus ${PAYOUT_HOLD_DAYS.Platinum} to ${PAYOUT_HOLD_DAYS.Bronze} days depending on your tier, on the next Monday, Wednesday or Friday payout run.`],
              ["Who handles returns?", "AltasGoods Logistics picks up returns with a doorstep quality check. Damaged or wrong returns can be claimed through AltasGoods SafeClaim."],
              ["Can I sell on other marketplaces too?", "Of course. There is no exclusivity on AltasGoods."],
            ].map(([q, a]) => (
              <details key={q} className="group px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown size={18} className="shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-ink-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 flex flex-col items-start gap-5 rounded-2xl bg-brand-600 px-6 py-8 text-white lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex items-start gap-4">
            <Banknote size={28} className="shrink-0 text-brand-100" aria-hidden="true" />
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight">Your first sale could be this week</p>
              <p className="mt-1 text-sm text-brand-100">Register today, list in minutes and start receiving orders once your KYC is verified.</p>
            </div>
          </div>
          <Link href="/seller/register" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-brand-700 hover:bg-brand-50">
            Register as a seller <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
