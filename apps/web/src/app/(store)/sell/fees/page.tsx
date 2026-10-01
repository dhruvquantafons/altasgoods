import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgePercent, CalendarClock, Receipt, Truck } from "lucide-react";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { categories } from "@/lib/mock";
import {
  COMMISSION_FREE_UPTO,
  FIXED_FEE_SLABS,
  GST_ON_FEES_PERCENT,
  PAYOUT_HOLD_DAYS,
  RATE_CARD_VERSION,
  SHIPPING_RATE_CARD,
  TCS_PERCENT,
  TDS_PERCENT,
  TIER_FIXED_FEE_MODIFIER,
  TIER_SHIPPING_DISCOUNT,
} from "@/lib/mock/finance";
import { cn, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Fees and rate card" };

const TIERS = ["Platinum", "Gold", "Silver", "Bronze"] as const;

function slabLabel(i: number) {
  const lower = i === 0 ? 0 : FIXED_FEE_SLABS[i - 1]!.upTo + 1;
  const upper = FIXED_FEE_SLABS[i]!.upTo;
  return upper === Infinity ? `Above ${formatINR(lower - 1)}` : `${formatINR(lower)} to ${formatINR(upper)}`;
}

/** Worked example from the spec: a ₹1,499 home item, Gold seller, regional 800 g parcel. */
function workedExample() {
  const price = 1499;
  const commissionPct = categories.find((c) => c.slug === "home")?.commission ?? 10;
  const commission = (price * commissionPct) / 100;
  const fixed = FIXED_FEE_SLABS.find((s) => price <= s.upTo)!.fee + TIER_FIXED_FEE_MODIFIER.Gold;
  const shipping = SHIPPING_RATE_CARD[1]!.regional * (1 - TIER_SHIPPING_DISCOUNT.Gold / 100);
  const fees = commission + fixed + shipping;
  const gst = Math.round(fees * GST_ON_FEES_PERCENT) / 100;
  const taxable = Math.round((price / 1.18) * 100) / 100;
  const tcs = Math.round(taxable * TCS_PERCENT) / 100;
  const tds = Math.round(taxable * TDS_PERCENT) / 100;
  const net = price - fees - gst - tcs - tds;
  return {
    rows: [
      ["Item price, GST inclusive", "", price],
      [`Commission`, `${commissionPct}% of ${formatINR(price)}`, -commission],
      ["Fixed fee", `${formatINR(1001)} to ${formatINR(5000)} slab, plus Gold ${formatINR(TIER_FIXED_FEE_MODIFIER.Gold)}`, -fixed],
      ["Shipping fee", `500 g to 1 kg regional, less ${TIER_SHIPPING_DISCOUNT.Gold}% Gold discount`, -shipping],
      [`GST on fees`, `${GST_ON_FEES_PERCENT}% of ${formatINR(fees, { paise: true })}`, -gst],
      ["TCS", `${TCS_PERCENT}% of taxable value ${formatINR(taxable, { paise: true })}`, -tcs],
      ["TDS under section 194-O", `${TDS_PERCENT}% of taxable value`, -tds],
    ] as [string, string, number][],
    net,
  };
}

export default function FeesPage() {
  const example = workedExample();
  const sortedCats = categories.slice().sort((a, b) => a.commission - b.commission);

  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Sell on BluBuy", href: "/sell" }, { label: "Fees and rate card" }]}
        eyebrow="Fees and rate card"
        title="Simple fees, shown before you sell"
        description={`Three charges on each sale: commission, a fixed fee and shipping. Nothing for payment collection or cash on delivery, and zero commission on items priced up to ${formatINR(COMMISSION_FREE_UPTO)}.`}
      >
        <p className="mt-4 text-[13px] text-ink-500">Rate card version {RATE_CARD_VERSION}. Example rates for illustration, final terms are in your seller agreement.</p>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BadgePercent, title: `0% up to ${formatINR(COMMISSION_FREE_UPTO)}`, body: "No commission on everyday items, in every category." },
            { icon: Receipt, title: "No collection fee", body: "Payment gateway and cash on delivery costs are on us." },
            { icon: Truck, title: "Up to 15% off shipping", body: "Higher seller tiers pay less for every parcel." },
            { icon: CalendarClock, title: "Paid 3 times a week", body: `Monday, Wednesday and Friday, from delivery plus ${PAYOUT_HOLD_DAYS.Platinum} days.` },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <c.icon size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-4 text-[15px] font-semibold text-ink-900">{c.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="commission" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="commission" className="text-lg font-semibold text-ink-900">
              Commission
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              On the selling price including GST. Items priced up to {formatINR(COMMISSION_FREE_UPTO)} pay 0% in every category.
            </p>
            <table className="mt-5 w-full text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr className="border-b border-line">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Above {formatINR(COMMISSION_FREE_UPTO)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sortedCats.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 text-ink-800">{c.name}</td>
                    <td className="py-2.5 text-right font-semibold text-ink-900 tabular-nums">{c.commission}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="fixed" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="fixed" className="text-lg font-semibold text-ink-900">
              Fixed fee per item
            </h2>
            <p className="mt-1 text-sm text-ink-500">By item price. Second and later units of the same product in one package pay half.</p>
            <table className="mt-5 w-full text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr className="border-b border-line">
                  <th className="pb-2 font-medium">Item price</th>
                  <th className="pb-2 text-right font-medium">Fee, Platinum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {FIXED_FEE_SLABS.map((s, i) => (
                  <tr key={s.upTo}>
                    <td className="py-2.5 text-ink-800">{slabLabel(i)}</td>
                    <td className="py-2.5 text-right font-semibold text-ink-900 tabular-nums">{formatINR(s.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[13px] text-ink-500">
              Added per item by tier: {TIERS.map((t) => `${t} ${formatINR(TIER_FIXED_FEE_MODIFIER[t])}`).join(", ")}.
            </p>
          </section>
        </div>

        <section aria-labelledby="shipping" className="mt-6 rounded-2xl border border-line bg-white p-6 lg:p-8">
          <h2 id="shipping" className="text-lg font-semibold text-ink-900">
            Shipping fee per package
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            For BluBuy Ship, BluBuy Flex and BluBuy Fulfilled. Chargeable weight is the higher of actual and volumetric weight (L x W x H in cm, divided by 5,000).
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr className="border-b border-line">
                  <th className="pb-2 font-medium">Chargeable weight</th>
                  <th className="pb-2 text-right font-medium">Local</th>
                  <th className="pb-2 text-right font-medium">Regional</th>
                  <th className="pb-2 text-right font-medium">National</th>
                  <th className="pb-2 text-right font-medium">Special zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SHIPPING_RATE_CARD.map((r) => (
                  <tr key={r.weight}>
                    <td className="py-2.5 text-ink-800">{r.weight}</td>
                    {[r.local, r.regional, r.national, r.special].map((v, i) => (
                      <td key={i} className="py-2.5 text-right text-ink-900 tabular-nums">
                        {formatINR(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] text-ink-500">
            Tier discount on shipping: {TIERS.map((t) => `${t} ${TIER_SHIPPING_DISCOUNT[t]}%`).join(", ")}. Self Ship sellers pay no BluBuy shipping fee.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section aria-labelledby="example" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="example" className="text-lg font-semibold text-ink-900">
              Worked example
            </h2>
            <p className="mt-1 text-sm text-ink-500">A home and kitchen item, Gold seller, BluBuy Ship, 800 g parcel to another city in the same zone, prepaid.</p>
            <dl className="mt-5 divide-y divide-line text-sm">
              {example.rows.map(([label, how, amount]) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                  <dt>
                    <span className="text-ink-800">{label}</span>
                    {how && <span className="block text-xs text-ink-500">{how}</span>}
                  </dt>
                  <dd className="shrink-0 font-medium text-ink-900 tabular-nums">{formatINR(amount, { paise: true })}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 pt-3">
                <dt className="font-semibold text-ink-900">You receive</dt>
                <dd className="text-lg font-semibold text-success-700 tabular-nums">{formatINR(example.net, { paise: true })}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="payouts" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="payouts" className="text-lg font-semibold text-ink-900">
              When you get paid
            </h2>
            <p className="mt-1 text-sm text-ink-500">Payout runs every Monday, Wednesday and Friday. An order becomes eligible after delivery plus your tier hold.</p>
            <dl className="mt-5 divide-y divide-line text-sm">
              {TIERS.map((t) => (
                <div key={t} className="flex justify-between py-2.5">
                  <dt className="text-ink-800">{t}</dt>
                  <dd className="font-medium text-ink-900">Delivery plus {PAYOUT_HOLD_DAYS[t]} days</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
              GST of {GST_ON_FEES_PERCENT}% applies to every fee and is invoiced monthly. TCS and TDS are deposited against your GSTIN and PAN and appear in your tax
              documents in Seller Hub.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-4 rounded-2xl bg-brand-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div>
            <p className="font-display text-lg font-semibold">Ready to start selling?</p>
            <p className="mt-1 text-sm text-brand-100">Register in about 15 minutes with your GSTIN or PAN and a bank account.</p>
          </div>
          <Link href="/seller/register" className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-accent-400 px-5 text-sm font-semibold text-ink-950 hover:bg-accent-300 sm:self-auto">
            Register as a seller
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
