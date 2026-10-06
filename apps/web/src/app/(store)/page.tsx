import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Crown, Lock, Timer, Truck, Undo2, Wallet } from "lucide-react";
import { DealCard } from "@/components/store/deal-card";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { ProductCard } from "@/components/store/product-card";
import { Rail, RailItem } from "@/components/store/rail";
import { Section, SectionTitle } from "@/components/store/section";
import { SaleCountdown } from "@/components/store/countdown";
import { formatPromise, formatTime } from "@/components/store/delivery";
import { categories, getProduct, SALE_EVENT } from "@/lib/mock";
import {
  BANK_OFFERS,
  bestSellers,
  BRAND_SPOTLIGHTS,
  DEALS_OF_THE_DAY,
  HERO_SLIDES,
  isBrowsable,
  PLUS_PLANS,
  PROMO_TILES,
  recommendedForYou,
  SPONSORED_PRODUCT_IDS,
} from "@/lib/mock/store-extra";
import { cn, formatINR } from "@/lib/utils";

export const metadata = {
  title: { absolute: "AltasGoods: Shop smarter, live better" },
};

export default function HomePage() {
  // suppressed listings cannot be bought, so their deal tiles are not shown (they would fail at order placement)
  const deals = DEALS_OF_THE_DAY.map((d) => ({ deal: d, product: getProduct(d.productId)! })).filter((x) => x.product && isBrowsable(x.product));
  const best = bestSellers();
  const recommended = recommendedForYou();
  const dealEnds = DEALS_OF_THE_DAY[0]!.endsAt;
  const annual = PLUS_PLANS.find((p) => p.id === "annual")!;

  return (
    <div className="pb-16 lg:pb-24">
      {/* Hero */}
      <Section className="pt-4 lg:pt-6">
        <HeroCarousel slides={HERO_SLIDES} />
      </Section>

      {/* Sale strip */}
      <Section className="mt-6 lg:mt-8">
        <div className="relative overflow-hidden rounded-2xl bg-brand-950 px-5 py-6 text-white sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute -top-24 -right-10 size-80 rounded-full bg-brand-600/35 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-accent-400/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent-400" />
                </span>
                Live now, ends {formatPromise(SALE_EVENT.endsAt)} at {formatTime(SALE_EVENT.endsAt)}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight lg:text-[30px]">{SALE_EVENT.name}</h2>
              <p className="mt-1.5 text-sm text-brand-100 lg:text-[15px]">
                Deal prices are locked for the event and checked against the lowest price of the last 30 days. {BANK_OFFERS[0]!.title}, plus an extra 10% off with
                code BIGDAYS10.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:gap-6">
              <SaleCountdown endsAt={SALE_EVENT.endsAt} size="md" />
              <Link
                href="/deals"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-400 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300"
              >
                Explore deals <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Categories */}
      <Section className="mt-12 lg:mt-16" labelledBy="home-cats">
        <SectionTitle id="home-cats" title="Shop by category" />
        <ul className="grid grid-cols-5 gap-x-3 gap-y-5 sm:gap-x-5 lg:grid-cols-10 lg:gap-x-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="group flex flex-col items-center text-center">
                <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-line ring-inset">
                  <Image src={c.image!} alt="" fill sizes="(min-width: 1024px) 10vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="mt-2 text-xs leading-tight font-medium text-ink-800 group-hover:text-brand-700 sm:text-[13px]">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Deal of the Day */}
      <Section className="mt-12 lg:mt-16" labelledBy="home-dotd">
        <SectionTitle
          id="home-dotd"
          title="Blu Deal of the Day"
          description="One-day prices, at least 20% below the lowest price of the last 30 days"
          eyebrow={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-900 ring-1 ring-accent-100 ring-inset">
              <Timer size={13} aria-hidden="true" /> Ends today at {formatTime(dealEnds)}
            </span>
          }
          href="/deals"
          linkLabel="All deals"
        />
        <Rail label="Deals of the day">
          {deals.map(({ deal, product }) => (
            <RailItem key={product.id} className="lg:w-[calc((100%-4*1.5rem)/5)]">
              <DealCard product={product} deal={deal} />
            </RailItem>
          ))}
        </Rail>
      </Section>

      {/* Best sellers */}
      <Section className="mt-12 lg:mt-16" labelledBy="home-best">
        <SectionTitle id="home-best" title="Best sellers" description="Most bought on AltasGoods in the last 30 days" href="/s?sort=popularity" />
        <Rail label="Best sellers">
          {best.map((p, i) => (
            <RailItem key={p.id}>
              <ProductCard product={p} priority={i < 2} sizes="(min-width: 1024px) 16vw, 45vw" />
            </RailItem>
          ))}
        </Rail>
      </Section>

      {/* Promo tiles */}
      <Section className="mt-12 lg:mt-16">
        <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
          {PROMO_TILES.map((t) => (
            <Link key={t.id} href={t.href} className="group relative block h-56 overflow-hidden rounded-2xl bg-ink-100 lg:h-64">
              <Image src={t.image} alt={t.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              <div className={cn("absolute inset-0", t.align === "right" ? "bg-gradient-to-l" : "bg-gradient-to-r", "from-white/90 via-white/55 to-transparent")} aria-hidden="true" />
              <div className="absolute inset-0 bg-white/45 md:hidden" aria-hidden="true" />
              <div className={cn("relative flex h-full flex-col justify-center p-6 lg:p-8", t.align === "right" && "items-end text-right")}>
                <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">{t.eyebrow}</p>
                <p className="mt-2 max-w-[15rem] font-display text-2xl leading-tight font-semibold text-ink-900">{t.title}</p>
                <p className="mt-1.5 text-sm text-ink-600">{t.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  Shop now <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Recommended */}
      <Section className="mt-12 lg:mt-16" labelledBy="home-rec">
        <SectionTitle id="home-rec" title="Recommended for you" description="Picked from what you have browsed and bought, Ananya" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
          {recommended.map((p) => (
            <ProductCard key={p.id} product={p} sponsored={SPONSORED_PRODUCT_IDS.slice(0, 1).includes(p.id)} sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw" />
          ))}
        </div>
      </Section>

      {/* Brand spotlights */}
      <Section className="mt-12 lg:mt-16" labelledBy="home-brands">
        <SectionTitle id="home-brands" title="Brands in the spotlight" description="Verified brand stores on AltasGoods" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {BRAND_SPOTLIGHTS.map((b) => (
            <Link key={b.slug} href={`/s?brand=${b.slug}`} className={cn("group relative flex flex-col overflow-hidden rounded-2xl p-5 lg:p-6", b.tone)}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                <BadgeCheck size={14} className="text-brand-600" aria-hidden="true" /> Verified brand
              </span>
              <span className="mt-2 font-display text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">{b.brand}</span>
              <span className="mt-1 text-[13px] text-ink-600">{b.tagline}</span>
              <span className="relative mt-5 aspect-[4/3] overflow-hidden rounded-xl bg-white/60">
                <Image src={b.image} alt="" fill sizes="(min-width: 1024px) 22vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-900">
                Visit store <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Trust strip */}
      <Section className="mt-12 lg:mt-16">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            { icon: Lock, title: "Secure payments", body: "UPI, cards and EMI through RBI regulated partners. We never store card numbers." },
            { icon: Undo2, title: "Easy returns", body: "Free doorstep pickup. Refunds to AltasGoods Credits within 2 hours." },
            { icon: BadgeCheck, title: "AltasGoods Assured", body: "Extra quality checks, faster delivery and simpler returns." },
            { icon: Wallet, title: "Pay on delivery", body: "Cash or UPI at your door, with no extra charge, ever." },
          ].map((t) => (
            <li key={t.title} className="flex flex-col gap-3 bg-white p-5 lg:p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <t.icon size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink-900">{t.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-500">{t.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Plus banner */}
      <Section className="mt-12 lg:mt-16">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-50/60 px-6 py-8 lg:px-12 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-raised">
                <Crown size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-2xl font-semibold tracking-tight text-ink-900">AltasGoods Plus</p>
                <p className="mt-1 max-w-xl text-[15px] text-ink-600">
                  Free delivery on every order, one-day delivery in top cities, 24 hour early access to sales and 2x AltasCoins. {formatINR(annual.price)} a year, cancel any
                  time in one step.
                </p>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-700">
                  {[
                    { icon: Truck, label: "Free delivery, no minimum" },
                    { icon: Timer, label: "Early sale access" },
                    { icon: BadgeCheck, label: "Plus-only deals" },
                  ].map((b) => (
                    <li key={b.label} className="flex items-center gap-1.5">
                      <b.icon size={15} className="text-brand-600" aria-hidden="true" />
                      {b.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Link href="/plus" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 lg:self-auto">
              You are a member, see benefits <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
