import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Crown, Info, Landmark, Timer, Zap } from "lucide-react";
import { SaleCountdown } from "@/components/store/countdown";
import { CouponCard } from "@/components/store/coupon-card";
import { DealCard } from "@/components/store/deal-card";
import { formatPromise, formatTime } from "@/components/store/delivery";
import { ProductCard, featuredOffer } from "@/components/store/product-card";
import { percentOff } from "@/components/store/price";
import { Rail, RailItem } from "@/components/store/rail";
import { Section, SectionTitle } from "@/components/store/section";
import { categories, getProduct, products, SALE_EVENT } from "@/lib/mock";
import { BANK_OFFERS, DEALS_OF_THE_DAY, FLASH_DEALS, inStock, isBrowsable, storefrontCoupons } from "@/lib/mock/store-extra";
import { cn } from "@/lib/utils";

export const metadata = { title: "AltasGoods Big Days deals" };

const DISCOUNTS = [20, 30, 40];

export default async function DealsPage(props: PageProps<"/deals">) {
  const sp = await props.searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const minOff = Number(typeof sp.off === "string" ? sp.off : 0) || 0;
  const match = (id: string) => {
    const p = getProduct(id);
    // suppressed listings cannot be bought, so their deal tiles are not shown
    if (!p || !isBrowsable(p)) return false;
    const o = featuredOffer(p);
    return (!cat || p.categoryId === `cat-${cat}`) && percentOff(o.price, o.mrp) >= minOff;
  };
  const flash = FLASH_DEALS.filter((d) => match(d.productId)).sort((a, b) => +new Date(a.endsAt) - +new Date(b.endsAt));
  const dotd = DEALS_OF_THE_DAY.filter((d) => match(d.productId));
  const coupons = storefrontCoupons().filter((c) => !c.firstOrderOnly);
  const href = (patch: { cat?: string; off?: number }) => {
    const q = new URLSearchParams();
    const c = patch.cat ?? cat;
    const o = patch.off ?? minOff;
    if (c) q.set("cat", c);
    if (o) q.set("off", String(o));
    const s = q.toString();
    return `/deals${s ? `?${s}` : ""}#deals`;
  };
  const railCats = ["electronics", "fashion", "home", "beauty"].filter((c) => !cat || c === cat);

  return (
    <div className="pb-16 lg:pb-24">
      {/* Event hero */}
      <Section className="pt-4 lg:pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-brand-950 text-white">
          <Image src="/images/banners/hero-festive.jpg" alt="" fill loading="eager" sizes="100vw" className="object-cover object-right opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/85 to-brand-950/10" aria-hidden="true" />
          <div className="relative grid gap-8 px-6 py-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-12 lg:py-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-300 ring-1 ring-white/15">
                <span className="size-1.5 rounded-full bg-accent-400" aria-hidden="true" /> Live now, {formatPromise(SALE_EVENT.startsAt)} to {formatPromise(SALE_EVENT.endsAt)}
              </p>
              <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight lg:text-[56px]">{SALE_EVENT.name}</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 lg:text-base">
                India&apos;s calmest festive sale. Every deal price is checked against the lowest price of the last 30 days, and every timer counts down to a real end
                time.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2 text-[13px]">
                {[
                  { icon: Landmark, label: "10% off with Kaveri Bank cards" },
                  { icon: BadgePercent, label: "Extra 10% with BIGDAYS10" },
                  { icon: Crown, label: "Plus members got 24 hour early access" },
                ].map((b) => (
                  <li key={b.label} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/90 ring-1 ring-white/10">
                    <b.icon size={14} className="text-accent-300" aria-hidden="true" /> {b.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:justify-self-end">
              <p className="text-sm font-medium text-white/70">Sale ends in</p>
              <div className="mt-3">
                <SaleCountdown endsAt={SALE_EVENT.endsAt} />
              </div>
              <p className="mt-3 text-[13px] text-white/60">
                Ends {formatPromise(SALE_EVENT.endsAt)} at {formatTime(SALE_EVENT.endsAt)}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Filters */}
      <Section className="mt-8">
        <div id="deals" className="flex scroll-mt-28 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Deal categories" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
            <ul className="flex gap-2">
              {[{ slug: "", name: "All deals" }, ...categories.map((c) => ({ slug: c.slug, name: c.name.split(" & ")[0]! }))].map((c) => (
                <li key={c.slug || "all"} className="shrink-0">
                  <Link
                    href={href({ cat: c.slug })}
                    scroll={false}
                    aria-current={cat === c.slug ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center rounded-full px-4 text-[13px] font-medium transition-colors",
                      cat === c.slug ? "bg-ink-900 text-white" : "border border-line text-ink-700 hover:border-ink-300",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-ink-500">Discount</span>
            {[0, ...DISCOUNTS].map((d) => (
              <Link
                key={d}
                href={href({ off: d })}
                scroll={false}
                aria-current={minOff === d ? "true" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-lg px-3 font-medium transition-colors",
                  minOff === d ? "bg-accent-100 text-accent-900" : "text-ink-700 hover:bg-ink-50",
                )}
              >
                {d ? `${d}%+` : "Any"}
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* Flash deals */}
      <Section className="mt-10" labelledBy="deals-flash">
        <SectionTitle
          id="deals-flash"
          title={
            <span className="flex items-center gap-2">
              <Zap size={22} className="text-accent-600" aria-hidden="true" /> Blu Flash Deals
            </span>
          }
          description="Up to 12 hours each, limited quantity, at least 15% below the 30 day low"
        />
        {flash.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {flash.map((d) => (
              <li key={d.productId} className="flex">
                <DealCard product={getProduct(d.productId)!} deal={d} className="w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-500">
            No flash deals match these filters right now. New flash deals start every few hours.
          </p>
        )}
      </Section>

      {/* Deal of the day */}
      {dotd.length > 0 && (
        <Section className="mt-14" labelledBy="deals-dotd">
          <SectionTitle
            id="deals-dotd"
            title="Blu Deal of the Day"
            description="One-day prices, at least 20% below the 30 day low"
            aside={
              <span className="hidden items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-900 ring-1 ring-accent-100 ring-inset sm:inline-flex">
                <Timer size={13} aria-hidden="true" /> Ends today at {formatTime(DEALS_OF_THE_DAY[0]!.endsAt)}
              </span>
            }
          />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {dotd.map((d) => (
              <li key={d.productId} className="flex">
                <DealCard product={getProduct(d.productId)!} deal={d} showTimer={false} className="w-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Coupons and bank offers */}
      <Section className="mt-14" labelledBy="deals-coupons">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle id="deals-coupons" title="Coupons to collect" description="Collect one, it applies in your cart when you are eligible" />
            <div className="grid gap-3">
              {coupons.map((c) => (
                <CouponCard key={c.code} coupon={c} />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle title="Bank and partner offers" description="One bank offer per order, applied automatically at payment" />
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {BANK_OFFERS.map((o) => (
                <li key={o.id} className="flex gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
                    <Landmark size={17} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="text-sm">
                    <span className="block font-medium text-ink-900">{o.title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-500">{o.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Category rails */}
      {railCats.map((slug) => {
        const c = categories.find((x) => x.slug === slug)!;
        const list = products
          .filter((p) => p.categoryId === c.id && isBrowsable(p) && inStock(p))
          .filter((p) => percentOff(featuredOffer(p).price, featuredOffer(p).mrp) >= Math.max(minOff, 20))
          .sort((a, b) => percentOff(featuredOffer(b).price, featuredOffer(b).mrp) - percentOff(featuredOffer(a).price, featuredOffer(a).mrp));
        if (list.length < 2) return null;
        return (
          <Section key={slug} className="mt-14" labelledBy={`deals-${slug}`}>
            <SectionTitle id={`deals-${slug}`} title={`Top deals in ${c.name.toLowerCase()}`} href={`/c/${slug}?sort=discount`} />
            <Rail label={`Top deals in ${c.name}`}>
              {list.map((p) => (
                <RailItem key={p.id}>
                  <ProductCard product={p} sizes="(min-width: 1024px) 16vw, 45vw" />
                </RailItem>
              ))}
            </Rail>
          </Section>
        );
      })}

      {/* Honesty note */}
      <Section className="mt-14">
        <div className="flex gap-4 rounded-2xl bg-ink-50 p-5 lg:p-6">
          <Info size={20} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-ink-600">
            <p className="font-semibold text-ink-900">How AltasGoods prices deals</p>
            <p className="mt-1 max-w-3xl">
              A deal price must be below the lowest price the item sold for in the last 30 days and can never exceed the M.R.P. During the event, sellers can lower a
              deal price but not raise it. &ldquo;Claimed&rdquo; bars show the share of the deal quantity already sold, and timers end at the real end time.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
