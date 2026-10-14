import Image from "next/image";
import Link from "next/link";
import { Info, Tag } from "lucide-react";
import { SaleCountdown } from "@/components/store/countdown";
import { CouponCard } from "@/components/store/coupon-card";
import { DealCard } from "@/components/store/deal-card";
import { formatPromise, formatTime } from "@/components/store/delivery";
import { ProductCard, featuredOffer } from "@/components/store/product-card";
import { percentOff } from "@/components/store/price";
import { Rail, RailItem } from "@/components/store/rail";
import { Section, SectionTitle } from "@/components/store/section";
import { inStock, isBrowsable } from "@/lib/mock/store-extra";
import { getStoreCatalog } from "@/lib/store-catalog";
import { getLiveSales, getStoreCoupons } from "@/lib/store-promotions";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const [sale] = await getLiveSales();
  return { title: sale ? `${sale.name} deals` : "Deals" };
}

const DISCOUNTS = [20, 30, 40];

export default async function DealsPage(props: PageProps<"/deals">) {
  const sp = await props.searchParams;
  const [catalog, liveSales, coupons] = await Promise.all([getStoreCatalog(), getLiveSales(), getStoreCoupons()]);
  const { categories, products } = catalog;
  const sale = liveSales[0];
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const minOff = Number(typeof sp.off === "string" ? sp.off : 0) || 0;
  const off = (p: (typeof products)[number]) => percentOff(featuredOffer(p).price, featuredOffer(p).mrp);
  const onSale = products
    .filter((p) => p.sale && isBrowsable(p) && (!cat || p.categorySlug === cat) && off(p) >= minOff)
    .sort((a, b) => b.sale!.percent - a.sale!.percent || off(b) - off(a));
  const href = (patch: { cat?: string; off?: number }) => {
    const q = new URLSearchParams();
    const c = patch.cat ?? cat;
    const o = patch.off ?? minOff;
    if (c) q.set("cat", c);
    if (o) q.set("off", String(o));
    const s = q.toString();
    return `/deals${s ? `?${s}` : ""}#deals`;
  };
  // the four categories with the most products (or just the chosen one)
  const railCats = [...categories]
    .sort((a, b) => catalog.inCategory(b.slug).length - catalog.inCategory(a.slug).length)
    .slice(0, 4)
    .map((c) => c.slug)
    .filter((c) => !cat || c === cat);

  return (
    <div className="pb-16 lg:pb-24">
      {/* The live sale */}
      <Section className="pt-4 lg:pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-brand-950 text-white">
          <Image src={sale?.bannerImage ?? "/images/banners/hero-festive.jpg"} alt="" fill loading="eager" sizes="100vw" className="object-cover object-right opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/85 to-brand-950/10" aria-hidden="true" />
          <div className="relative grid gap-8 px-6 py-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-12 lg:py-14">
            <div>
              {sale && (
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-300 ring-1 ring-white/15">
                  <span className="size-1.5 rounded-full bg-accent-400" aria-hidden="true" /> Live now, {formatPromise(sale.startsAt)} to {formatPromise(sale.endsAt)}
                </p>
              )}
              <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight lg:text-[56px]">{sale ? sale.name : "Deals"}</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 lg:text-base">
                {sale
                  ? sale.headline || sale.description || `${sale.discountPercent}% off while the sale lasts.`
                  : "No sale is running right now. Here are the biggest discounts on M.R.P. across the store."}
              </p>
              {coupons.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2 text-[13px]">
                  {coupons.slice(0, 2).map((c) => (
                    <li key={c.code} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/90 ring-1 ring-white/10">
                      <Tag size={14} className="text-accent-300" aria-hidden="true" /> {c.description} with {c.code}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {sale && (
              <div className="lg:justify-self-end">
                <p className="text-sm font-medium text-white/70">Sale ends in</p>
                <div className="mt-3">
                  <SaleCountdown endsAt={sale.endsAt} />
                </div>
                <p className="mt-3 text-[13px] text-white/60">
                  Ends {formatPromise(sale.endsAt)} at {formatTime(sale.endsAt)}
                </p>
              </div>
            )}
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
                className={cn("flex h-8 items-center rounded-lg px-3 font-medium transition-colors", minOff === d ? "bg-accent-100 text-accent-900" : "text-ink-700 hover:bg-ink-50")}
              >
                {d ? `${d}%+` : "Any"}
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* Products in the live sales */}
      {liveSales.length > 0 && (
        <Section className="mt-10" labelledBy="deals-sale">
          <SectionTitle id="deals-sale" title={sale ? `In the ${sale.name}` : "On sale"} description="Sale prices, charged exactly as shown at checkout" />
          {onSale.length ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
              {onSale.map((p) => (
                <li key={p.id} className="flex">
                  <DealCard product={p} className="w-full" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-500">No sale products match these filters. Try another category or discount.</p>
          )}
        </Section>
      )}

      {/* Coupons */}
      {coupons.length > 0 && (
        <Section className="mt-14" labelledBy="deals-coupons">
          <SectionTitle id="deals-coupons" title="Coupons to collect" description="Collect one, it applies in your cart when you are eligible" />
          <div className="grid gap-3 md:grid-cols-2">
            {coupons.map((c) => (
              <CouponCard key={c.code} coupon={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Category rails */}
      {railCats.map((slug) => {
        const c = categories.find((x) => x.slug === slug)!;
        const list = products
          .filter((p) => p.categoryId === c.id && isBrowsable(p) && inStock(p))
          .filter((p) => off(p) >= Math.max(minOff, 20))
          .sort((a, b) => off(b) - off(a));
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
              Sale prices are never above the M.R.P., timers end at the sale&apos;s real end time, and the price you see on a product is the price you are charged at
              checkout. Coupons apply on top of sale prices when your order qualifies.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
