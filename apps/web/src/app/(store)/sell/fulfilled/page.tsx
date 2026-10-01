import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Check, Minus, PackageCheck, RotateCcw, Truck, Warehouse } from "lucide-react";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { hubs } from "@/lib/mock";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "BluBuy Fulfilled" };

const steps = [
  { icon: Warehouse, title: "Send your stock", body: "Create an inbound shipment in Seller Hub and book a delivery slot at the recommended fulfilment centre." },
  { icon: PackageCheck, title: "We store and pack", body: "Every unit is checked, labelled and stored. When an order comes in, we pick, pack and hand it to BluBuy Logistics." },
  { icon: Truck, title: "Fast, Assured delivery", body: "Your listings carry the BluBuy Assured badge and qualify for one-day delivery for BluBuy Plus members." },
  { icon: RotateCcw, title: "We handle returns", body: "Returns come back to our centre, are graded, and sellable units go straight back into your inventory." },
];

const fees = [
  ["Pick and pack", "₹14 per unit, ₹55 for heavy or bulky items"],
  ["Storage", "₹35 per cubic foot per month, ₹50 from October to December"],
  ["Aged inventory", "₹10 per unit per month after 180 days, ₹20 after 365 days"],
  ["Inbound placement", "Free to the recommended centre, ₹3 per unit to a centre you choose"],
  ["Labelling service", "₹4 per unit"],
  ["Removal or disposal", "₹10 per unit plus shipping, or ₹5 per unit to dispose"],
];

const compare: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Who packs and ships", "BluBuy", "You pack, BluBuy picks up", "You and your courier"],
  ["BluBuy Assured badge", true, "Gold and above", false],
  ["One-day delivery for Plus members", true, "Select pincodes", false],
  ["Cash on delivery", true, true, false],
  ["Returns handled by BluBuy", true, "Pickup only", false],
  ["Storage fees", true, false, false],
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check size={17} className="mx-auto text-success-600" aria-label="Yes" />;
  if (v === false) return <Minus size={17} className="mx-auto text-ink-300" aria-label="No" />;
  return <span className="text-[13px] text-ink-700">{v}</span>;
}

export default function FulfilledPage() {
  const centres = hubs.filter((h) => h.type === "fulfillment_center");
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Sell on BluBuy", href: "/sell" }, { label: "BluBuy Fulfilled" }]}
        eyebrow="BluBuy Fulfilled"
        title="Send us your stock. We do the rest."
        description="Store your products in BluBuy fulfilment centres and we pick, pack, ship and handle returns, with the BluBuy Assured badge on every listing."
      >
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-700 ring-1 ring-line">
          <BadgeCheck size={14} className="text-brand-600" aria-hidden="true" />
          Fulfilled fees are waived for your first 100 units or 90 days
        </p>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
              </div>
              <p className="mt-4 text-[15px] font-semibold text-ink-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="fees" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="fees" className="text-lg font-semibold text-ink-900">
              Fulfilled fees
            </h2>
            <p className="mt-1 text-sm text-ink-500">In addition to the standard commission, fixed fee and shipping fee.</p>
            <dl className="mt-5 divide-y divide-line text-sm">
              {fees.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6">
                  <dt className="font-medium text-ink-900">{k}</dt>
                  <dd className="text-ink-600 sm:text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/sell/fees" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              See the full rate card
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>

          <section aria-labelledby="centres" className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="relative aspect-[21/9] bg-ink-50">
              <Image src="/images/banners/hero-electronics.jpg" alt="A laptop glowing in a dark room" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
            </div>
            <div className="p-6 lg:p-8">
              <h2 id="centres" className="text-lg font-semibold text-ink-900">
                Our fulfilment centres
              </h2>
              <ul className="mt-4 divide-y divide-line">
                {centres.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                    <span>
                      <span className="block font-medium text-ink-900">{c.name}</span>
                      <span className="font-mono text-xs text-ink-500">{c.code}</span>
                    </span>
                    <span className="text-ink-600">{formatNumber(c.capacity)} units a day</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section aria-labelledby="compare" className="mt-6 rounded-2xl border border-line bg-white p-6 lg:p-8">
          <h2 id="compare" className="text-lg font-semibold text-ink-900">
            Compare ways to ship
          </h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-xs text-ink-500">
                <tr className="border-b border-line">
                  <th className="pb-2 text-left font-medium" />
                  <th className="pb-2 font-semibold text-brand-700">BluBuy Fulfilled</th>
                  <th className="pb-2 font-medium">BluBuy Ship</th>
                  <th className="pb-2 font-medium">Self Ship</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compare.map(([label, a, b, c]) => (
                  <tr key={label}>
                    <td className="py-3 text-ink-800">{label}</td>
                    <td className="py-3 text-center">
                      <Cell v={a} />
                    </td>
                    <td className="py-3 text-center">
                      <Cell v={b} />
                    </td>
                    <td className="py-3 text-center">
                      <Cell v={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-12 flex flex-col gap-4 rounded-2xl bg-brand-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div>
            <p className="font-display text-lg font-semibold">Already selling on BluBuy?</p>
            <p className="mt-1 text-sm text-brand-100">Create your first inbound shipment from Inventory in Seller Hub.</p>
          </div>
          <Link href="/seller/inventory" className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-white px-5 text-sm font-semibold text-ink-900 hover:bg-brand-50 sm:self-auto">
            Open Seller Hub
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
