import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Flag, Mail, MapPin, Package, Phone, ShieldCheck, Star, ThumbsUp, Truck } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/page-header";
import { Stars } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { getCategory, getSeller, productsBySeller, sellers } from "@/lib/mock";
import { isBrowsable, ratingHistogram, sellerAddress, sellerGrievance } from "@/lib/mock/store-extra";
import { cn, formatNumber } from "@/lib/utils";
import { formatDayMonthYear } from "@/components/store/delivery";

const LIVE = new Set(["active", "on_hold"]);

export function generateStaticParams() {
  return sellers.filter((s) => LIVE.has(s.status)).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: PageProps<"/store/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = getSeller(slug);
  return { title: s ? `${s.displayName} on AltasGoods` : "Seller" };
}

const FEEDBACK = [
  { who: "Rohit M.", stars: 5, text: "Packed well, shipped the same day and the invoice was in the box." },
  { who: "Lakshmi P.", stars: 5, text: "Exactly as described. Quick reply when I asked about the warranty." },
  { who: "Imran S.", stars: 4, text: "Good seller. Delivery took a day longer than promised but they kept me updated." },
];

export default async function SellerStorePage(props: PageProps<"/store/[slug]">) {
  const { slug } = await props.params;
  const seller = getSeller(slug);
  if (!seller || !LIVE.has(seller.status)) notFound();

  const list = productsBySeller(seller.id).filter(isBrowsable);
  const hist = ratingHistogram(seller.rating, seller.ratingCount);
  const positive = hist.slice(0, 2).reduce((a, h) => a + h.pct, 0);
  const g = sellerGrievance(seller);
  const cats = seller.categories.map((c) => getCategory(c)?.name).filter(Boolean);
  const fulfil = seller.fulfillment.map((f) => (f === "blubuy_fulfilled" ? "AltasGoods Fulfilled" : f === "easy_ship" ? "AltasGoods Ship" : "Self Ship"));

  return (
    <div className={cn(STORE_CONTAINER, "pt-5 pb-16 lg:pt-6 lg:pb-24")}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sellers" }, { label: seller.displayName }]} />

      <header className="mt-5 overflow-hidden rounded-2xl border border-line">
        <div className="h-24 bg-gradient-to-r from-brand-900 via-brand-700 to-brand-500 lg:h-28" aria-hidden="true" />
        <div className="flex flex-col gap-5 px-5 pb-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="-mt-10 flex size-20 items-center justify-center rounded-2xl bg-white font-display text-2xl font-semibold text-brand-700 shadow-raised ring-1 ring-line">
              {seller.displayName
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-ink-900">
                {seller.displayName}
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  <BadgeCheck size={13} aria-hidden="true" /> {seller.tier} seller
                </span>
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-600">
                <span className="flex items-center gap-1.5">
                  <Stars value={seller.rating} size={14} />
                  <span className="font-semibold text-ink-900">{seller.rating.toFixed(1)}</span> ({formatNumber(seller.ratingCount)} ratings)
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-ink-400" aria-hidden="true" /> {seller.city}, {seller.state}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays size={14} className="text-ink-400" aria-hidden="true" /> On AltasGoods since {new Date(seller.joinedAt).getFullYear()}
                </span>
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-center lg:text-right">
            <div>
              <dt className="text-xs text-ink-500">Positive feedback</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums">{positive}%</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Products</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums">{formatNumber(seller.liveListings)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Orders, 30 days</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums">{formatNumber(seller.orders30d)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <section aria-labelledby="seller-products" className="min-w-0">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 id="seller-products" className="text-xl font-semibold tracking-tight text-ink-900">
                Products from {seller.displayName}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {list.length} on AltasGoods now, in {cats.join(", ")}
              </p>
            </div>
          </div>
          {list.length ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:gap-x-6">
              {list.map((p, i) => (
                <li key={p.id} className="flex">
                  <ProductCard product={p} sellerId={seller.id} showAdd priority={i < 3} className="w-full" sizes="(min-width: 1024px) 22vw, 45vw" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-500">This seller has no live products right now.</p>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section aria-labelledby="seller-rating" className="rounded-2xl border border-line p-5">
            <h2 id="seller-rating" className="text-base font-semibold text-ink-900">
              Seller rating
            </h2>
            <p className="mt-1 text-[13px] text-ink-500">Delivery, packaging and accuracy, last 12 months</p>
            <ul className="mt-4 flex flex-col gap-2">
              {hist.map((h) => (
                <li key={h.stars} className="flex items-center gap-3 text-[13px]">
                  <span className="flex w-8 items-center gap-1 text-ink-700">
                    {h.stars} <Star size={11} className="fill-current" aria-hidden="true" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-ink-700" style={{ width: `${h.pct}%` }} />
                  </span>
                  <span className="w-10 text-right text-xs text-ink-500 tabular-nums">{h.pct}%</span>
                </li>
              ))}
            </ul>
            <ul className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
              {FEEDBACK.map((f) => (
                <li key={f.who} className="text-[13px]">
                  <Stars value={f.stars} size={12} />
                  <p className="mt-1 text-ink-700">&ldquo;{f.text}&rdquo;</p>
                  <p className="mt-0.5 text-xs text-ink-500">{f.who}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="seller-legal" className="rounded-2xl border border-line p-5">
            <h2 id="seller-legal" className="text-base font-semibold text-ink-900">
              Seller information
            </h2>
            <dl className="mt-3 flex flex-col gap-3 text-[13px]">
              <div>
                <dt className="text-ink-500">Legal name</dt>
                <dd className="mt-0.5 text-ink-900">{seller.legalName}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Registered address</dt>
                <dd className="mt-0.5 text-ink-900">{sellerAddress(seller)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">GSTIN</dt>
                <dd className="mt-0.5 font-mono text-[13px] text-ink-900">{seller.gstin}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Customer care</dt>
                <dd className="mt-0.5 flex flex-col gap-0.5 text-ink-900">
                  <a href={`tel:${seller.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Phone size={13} className="text-ink-400" aria-hidden="true" /> {seller.phone}
                  </a>
                  <a href={`mailto:${seller.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Mail size={13} className="text-ink-400" aria-hidden="true" /> {seller.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Grievance officer</dt>
                <dd className="mt-0.5 text-ink-900">
                  {g.name}, {g.email}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Shipping</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1.5">
                  {fulfil.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                      {f === "AltasGoods Fulfilled" ? <Package size={12} aria-hidden="true" /> : <Truck size={12} aria-hidden="true" />} {f}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Member since</dt>
                <dd className="mt-0.5 text-ink-900">{formatDayMonthYear(seller.joinedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-ink-50 p-5 text-[13px] text-ink-600">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <ShieldCheck size={16} className="text-brand-600" aria-hidden="true" /> Protected by AltasGoods Guarantee
            </p>
            <p className="mt-1 leading-relaxed">If an order from this seller does not arrive or is not as described, contact the seller first. After 48 hours, AltasGoods steps in.</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <Link href="/policies/guarantee" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                <ThumbsUp size={13} aria-hidden="true" /> How it works
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:underline">
                <Flag size={13} aria-hidden="true" /> Report this seller
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
