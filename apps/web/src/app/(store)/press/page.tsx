import Image from "next/image";
import type { Metadata } from "next";
import { Download, Mail } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { ABOUT_NUMBERS, PRESS_RELEASES } from "@/lib/mock/company";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Press" };

export default function PressPage() {
  const [lead, ...rest] = PRESS_RELEASES;
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Press" }]}
        eyebrow="Press room"
        title="News from BluBuy"
        description="Announcements, numbers and resources for journalists. For interviews and data requests, write to press@blubuy.in."
      />

      <div className={cn(STORE_CONTAINER, "mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="min-w-0">
          {lead && (
            <article className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-[21/8] bg-ink-50">
                <Image src="/images/banners/hero-festive.jpg" alt="Warm festive lights" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" priority />
              </div>
              <div className="p-6 lg:p-8">
                <p className="text-[13px] text-ink-500">
                  <span className="font-semibold text-brand-700">{lead.category}</span> <span aria-hidden="true">·</span> {formatDate(lead.date)}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{lead.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{lead.summary}</p>
              </div>
            </article>
          )}

          <h2 className="mt-12 text-lg font-semibold text-ink-900">Earlier announcements</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
            {rest.map((r) => (
              <li key={r.slug} className="p-5 lg:px-6">
                <p className="text-[13px] text-ink-500">
                  <span className="font-semibold text-brand-700">{r.category}</span> <span aria-hidden="true">·</span> {formatDate(r.date)}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold text-ink-900">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{r.summary}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-semibold text-ink-900">Media contact</h2>
            <p className="mt-1 text-sm text-ink-500">We reply to journalists within one working day.</p>
            <a href="mailto:press@blubuy.in" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
              <Mail size={15} aria-hidden="true" />
              press@blubuy.in
            </a>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-semibold text-ink-900">Brand assets</h2>
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-ink-50 p-4">
              <LogoMark className="size-10" />
              <LogoMark inverted className="size-10 rounded-[9px] ring-1 ring-line" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">Logo files, product photography and leadership photos. Please do not alter the logo or its colours.</p>
            <a href="mailto:press@blubuy.in?subject=Media%20kit%20request" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink-800 hover:bg-ink-50">
              <Download size={15} aria-hidden="true" />
              Request the media kit
            </a>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-semibold text-ink-900">BluBuy at a glance</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              {ABOUT_NUMBERS.map((n) => (
                <div key={n.label}>
                  <dd className="font-display text-xl font-semibold text-ink-900">{n.value}</dd>
                  <dt className="text-xs text-ink-500">{n.label}</dt>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
