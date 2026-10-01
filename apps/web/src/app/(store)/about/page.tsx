import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Building2, CalendarClock, HeartHandshake, Scale, Sparkles } from "lucide-react";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { ABOUT_MILESTONES, ABOUT_NUMBERS, ABOUT_PRINCIPLES, OFFICES } from "@/lib/mock/company";
import { COMPANY } from "@/lib/mock/store-extra";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "About BluBuy" };

const principleIcons = [Scale, CalendarClock, HeartHandshake, Sparkles];

export default function AboutPage() {
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "About BluBuy" }]}
        eyebrow="About BluBuy"
        title="A calmer way to shop India's best sellers"
        description="BluBuy is an Indian marketplace built in Bengaluru. We connect customers with thousands of verified sellers and promise three simple things: honest prices, real delivery dates and no hidden charges."
      />

      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ABOUT_NUMBERS.map((n) => (
            <div key={n.label} className="rounded-2xl border border-line bg-white p-6">
              <dd className="font-display text-3xl font-semibold tracking-tight text-ink-900">{n.value}</dd>
              <dt className="mt-1 text-sm text-ink-500">{n.label}</dt>
            </div>
          ))}
        </dl>

        <section aria-labelledby="story" className="mt-16 grid items-center gap-10 lg:mt-20 lg:grid-cols-2">
          <div className="relative aspect-[5/3] overflow-hidden rounded-2xl bg-ink-50">
            <Image src="/images/banners/hero-home.jpg" alt="A calm, sunlit living room" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <h2 id="story" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
              Why we started
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-600">
              <p>
                Shopping online in India had become loud: countdown timers that reset, prices that rise just before a sale, fees that appear at the last step. Sellers, meanwhile,
                struggled with complex rate cards and slow payouts.
              </p>
              <p>
                We started BluBuy in 2025 to build the marketplace we wanted to use ourselves. One that is fast and wide in selection, but also honest, calm and fair to the
                small businesses that make it work.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="principles" className="mt-16 lg:mt-20">
          <h2 id="principles" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            What we stand for
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT_PRINCIPLES.map((p, i) => {
              const Icon = principleIcons[i]!;
              return (
                <div key={p.title} className="rounded-2xl border border-line bg-white p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[15px] font-semibold text-ink-900">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{p.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="journey" className="mt-16 lg:mt-20">
          <h2 id="journey" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Our journey so far
          </h2>
          <ol className="mt-8 grid gap-6 border-l border-line pl-6 lg:grid-cols-5 lg:gap-4 lg:border-t lg:border-l-0 lg:pt-6 lg:pl-0">
            {ABOUT_MILESTONES.map((m) => (
              <li key={m.title} className="relative">
                <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-brand-600 ring-4 ring-white lg:-top-[30px] lg:left-0" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-brand-700">{m.date}</p>
                <p className="mt-1 text-[15px] font-semibold text-ink-900">{m.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{m.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="offices" className="mt-16 lg:mt-20">
          <h2 id="offices" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Where we work
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFICES.map((o) => (
              <div key={o.city} className="rounded-2xl border border-line bg-white p-6">
                <Building2 size={19} strokeWidth={1.8} className="text-ink-400" aria-hidden="true" />
                <p className="mt-4 text-[15px] font-semibold text-ink-900">{o.city}</p>
                <p className="text-[13px] font-medium text-brand-700">{o.note}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{o.address}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-ink-500">
            {COMPANY.legalName}, CIN {COMPANY.cin}, GSTIN {COMPANY.gstin}. Registered office: {COMPANY.registeredOffice}.
          </p>
        </section>

        <section className="mt-16 grid gap-4 lg:mt-20 lg:grid-cols-2">
          <Link href="/careers" className="group flex items-center justify-between rounded-2xl bg-brand-950 p-6 text-white lg:p-8">
            <span>
              <span className="block font-display text-lg font-semibold">Build BluBuy with us</span>
              <span className="mt-1 block text-sm text-brand-100">Open roles in engineering, design, operations and more.</span>
            </span>
            <ArrowRight size={20} className="shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link href="/sell" className="group flex items-center justify-between rounded-2xl border border-line bg-white p-6 lg:p-8">
            <span>
              <span className="block font-display text-lg font-semibold text-ink-900">Sell on BluBuy</span>
              <span className="mt-1 block text-sm text-ink-500">Zero commission on items up to ₹999 and payouts three times a week.</span>
            </span>
            <ArrowRight size={20} className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
