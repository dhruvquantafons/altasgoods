import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Check, ChevronRight, Globe, ShieldCheck, Undo2, Wrench } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/page-header";
import { formatDayMonthYear } from "@/components/store/delivery";
import { Gallery, type GalleryView } from "@/components/store/gallery";
import { OffersList } from "@/components/store/offers";
import { BuyBox, LivePrice, MobileBuyBar, PdpProvider, VariantPicker, type PdpData, type PdpVariant } from "@/components/store/pdp-client";
import { AssuredMark } from "@/components/store/price";
import { cardBadge, featuredOffer, ProductCard } from "@/components/store/product-card";
import { FrequentlyBoughtTogether, QnaSection } from "@/components/store/qna";
import { Rail, RailItem } from "@/components/store/rail";
import { ReviewsSection } from "@/components/store/reviews";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { Stars } from "@/components/ui/misc";
import { reviewsFor } from "@/lib/mock";
import { currentUser } from "@/lib/api/server";
import { getStoreCatalog } from "@/lib/store-catalog";
import {
  aspectRatings,
  bankOffersFor,
  COMPANY,
  GRIEVANCE_OFFICER,
  dealFor,
  frequentlyBoughtWith,
  inStock,
  legalDeclarations,
  questionsFor,
  ratingHistogram,
  returnPolicyFor,
  similarProducts,
  storefrontCoupons,
  toCartProduct,
  warrantyFor,
} from "@/lib/mock/store-extra";
import type { Product } from "@/lib/types";
import { cn, formatCompact, formatNumber } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = (await getStoreCatalog()).product(slug);
  if (!p) return { title: "Product not found" };
  return { title: p.title.split(/[,(]/)[0]!.trim(), description: `${p.title}. ${p.highlights.slice(0, 2).join(". ")}.` };
}

const VIEWS: Omit<GalleryView, "src" | "alt">[] = [
  { scale: 1, origin: "50% 50%" },
  { scale: 1.7, origin: "38% 42%" },
  { scale: 1.45, origin: "68% 62%" },
  { scale: 1.25, origin: "50% 28%" },
];
const VIEW_NAMES = ["front view", "close-up of the details", "close-up of the finish", "top view"];

function buildVariants(p: Product, price: number): PdpVariant[] {
  return p.variants.map((v) => {
    const inTitle = v.values.find((x) => p.title.includes(x.label))?.label;
    const preferred = v.name === "Size" ? v.values.find((x) => (x.label === "M" || x.label === "UK 8") && x.available)?.label : undefined;
    const def = inTitle ?? preferred ?? v.values.find((x) => x.available)?.label;
    if (v.name !== "Storage") return { name: v.name, default: def, values: v.values };
    const baseIdx = v.values.findIndex((x) => x.label === def);
    return {
      name: v.name,
      default: def,
      values: v.values.map((x, i) => ({ ...x, price: i === baseIdx ? price : Math.round((price * (1 + 0.12 * (i - baseIdx))) / 1000) * 1000 - 1 })),
    };
  });
}


export default async function ProductPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const [catalog, user] = await Promise.all([getStoreCatalog(), currentUser()]);
  const p = catalog.product(slug);
  if (!p) notFound();

  const brand = { name: p.brandName, slug: p.brandSlug };
  const cat = { name: p.categoryName, slug: p.categorySlug };
  const snapshot = toCartProduct(p);
  const offer = featuredOffer(p);
  const deal = dealFor(p.id);
  const policy = returnPolicyFor(p, offer.returnWindowDays);
  const warranty = warrantyFor(p);
  const legal = legalDeclarations(p);
  const reviews = reviewsFor(p.id);
  const histogram = ratingHistogram(p.rating, p.ratingCount);
  const qa = questionsFor(p);
  const fbt = [p, ...frequentlyBoughtWith(catalog.products, p)];
  const similar = similarProducts(catalog.products, p);
  const plus = !!user?.isPlus;
  const coins = Math.min(100, Math.floor(offer.price / 100) * (plus ? 2 : 1));
  const coupon = storefrontCoupons().find((c) => c.code === "BIGDAYS10" && offer.price >= c.minOrder);
  const badge = cardBadge(p, !!deal);

  const data: PdpData = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: brand.name,
    variants: buildVariants(p, offer.price),
    offer: snapshot.offer,
    plus,
    large: snapshot.large,
    policyShort: policy.short,
    warranty,
    deal: deal ? { endsAt: deal.endsAt, claimedPct: deal.claimedPct, kind: deal.kind } : undefined,
  };

  // distinct photos are shown as they are; a single repeated photo gets zoomed detail views
  const distinct = new Set(p.gallery).size > 1;
  const views: GalleryView[] = p.gallery.map((src, i) =>
    distinct ? { src, alt: `${p.title}, image ${i + 1} of ${p.gallery.length}`, ...VIEWS[0]! } : { src, alt: `${p.title}, ${VIEW_NAMES[i] ?? `view ${i + 1}`}`, ...VIEWS[i % VIEWS.length]! },
  );

  return (
    <div className={cn(STORE_CONTAINER, "pt-5 pb-28 lg:pt-6 lg:pb-24")}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: cat.name, href: `/c/${cat.slug}` },
          { label: p.subcategory, href: `/c/${cat.slug}?sub=${encodeURIComponent(p.subcategory)}` },
          { label: p.title.split(/[,(]/)[0]!.trim() },
        ]}
      />

      <PdpProvider data={data}>
        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_340px]">
          {/* Gallery */}
          <div className="lg:row-span-2 xl:row-span-1">
            <div className="lg:sticky lg:top-24">
              <Gallery views={views} badge={badge?.label} />
            </div>
          </div>

          {/* Product information */}
          <div className="min-w-0">
            <Link href={`/s?brand=${brand.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              Visit the {brand.name} store
            </Link>
            <h1 className="mt-2 text-[22px] leading-snug font-semibold tracking-tight text-ink-900 lg:text-[26px]">{p.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <Link href="#reviews" className="flex items-center gap-2 hover:underline">
                <span className="font-semibold text-ink-900">{p.rating.toFixed(1)}</span>
                <Stars value={p.rating} size={15} />
                <span className="text-brand-700">{formatNumber(p.ratingCount)} ratings</span>
              </Link>
              <Link href="#questions" className="text-brand-700 hover:underline">
                {qa.length} answered questions
              </Link>
              {p.assured && <AssuredMark label="AltasGoods Assured" className="text-[13px]" />}
            </div>
            {p.soldLast30d >= 100 && (
              <p className="mt-2 text-[13px] text-ink-600">
                <span className="font-semibold text-ink-900">{formatCompact(Math.floor(p.soldLast30d / 100) * 100)}+ bought</span> in the past month
              </p>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <LivePrice mrp={offer.mrp} />
            </div>

            <div className="mt-6">
              <OffersList
                offers={bankOffersFor(offer.price)}
                coupon={coupon ? { code: coupon.code, description: coupon.description } : undefined}
                coins={coins}
                emiFrom={offer.price >= 3000 ? Math.ceil(offer.price / 6) : undefined}
              />
            </div>

            {p.variants.length > 0 && (
              <div className="mt-6">
                <VariantPicker />
              </div>
            )}

            <div className="mt-7">
              <h2 className="text-base font-semibold text-ink-900">About this item</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Undo2, label: policy.short },
                { icon: ShieldCheck, label: warranty },
                { icon: Globe, label: `Made in ${legal.find((l) => l.label === "Country of origin")?.value}` },
                { icon: Wrench, label: snapshot.large ? "Free installation" : "GST invoice" },
              ].map((f) => (
                <li key={f.label} className="flex flex-col items-center gap-2 rounded-xl bg-ink-50 px-2 py-3 text-center">
                  <f.icon size={18} strokeWidth={1.8} className="text-ink-600" aria-hidden="true" />
                  <span className="text-xs leading-snug text-ink-700">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Buy box */}
          <div className="min-w-0 lg:col-start-2 xl:col-start-auto">
            <div className="xl:sticky xl:top-24">
              <BuyBox />
            </div>
          </div>
        </div>
        <MobileBuyBar />
      </PdpProvider>

      {/* In-page navigation */}
      <nav aria-label="On this page" className="sticky top-[108px] z-20 -mx-4 mt-12 border-y border-line bg-white/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-16 lg:mx-0 lg:rounded-xl lg:border lg:px-2">
        <ul className="flex gap-1 overflow-x-auto scrollbar-none">
          {[
            ["#details", "Details", true],
            ["#returns", "Returns and warranty", true],
            ["#reviews", "Reviews", true],
            ["#questions", "Questions", true],
            ["#similar", "Similar products", true],
          ]
            .filter(([, , show]) => show)
            .map(([href, label]) => (
              <li key={href as string} className="shrink-0">
                <a href={href as string} className="flex h-11 items-center rounded-lg px-3 text-[13px] font-medium text-ink-600 hover:text-ink-900">
                  {label}
                </a>
              </li>
            ))}
        </ul>
      </nav>

      {/* Frequently bought together */}
      {fbt.length > 1 && (
        <section aria-labelledby="pdp-fbt" className="mt-14">
          <h2 id="pdp-fbt" className="mb-5 text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">
            Frequently bought together
          </h2>
          <FrequentlyBoughtTogether
            items={fbt.map((x) => {
              const o = featuredOffer(x);
              return { id: x.id, slug: x.slug, title: x.title, image: x.image, price: o.price, mrp: o.mrp, inStock: inStock(x) };
            })}
          />
        </section>
      )}

      {/* Details */}
      <section id="details" aria-labelledby="pdp-details" className="mt-14 scroll-mt-40">
        <h2 id="pdp-details" className="text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">
          Product details
        </h2>
        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h3 className="text-base font-semibold text-ink-900">Description</h3>
            <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-ink-700">{p.description}</p>
            <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-ink-700">
              Every unit is checked against this page before it leaves our warehouse. If anything is not right, you can request a{" "}
              {policy.short.toLowerCase()} from Your orders.
            </p>
            <h3 className="mt-8 text-base font-semibold text-ink-900">Product information</h3>
            <p className="mt-1 text-[13px] text-ink-500">Declarations under the Legal Metrology (Packaged Commodities) Rules, 2011</p>
            <dl className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
              {legal.map((l) => (
                <div key={l.label} className="grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 sm:grid-cols-[180px_1fr]">
                  <dt className="text-ink-500">{l.label}</dt>
                  <dd className="text-ink-800">{l.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Specifications</h3>
            <div className="mt-3 flex flex-col gap-5">
              {p.specs.map((g) => (
                <div key={g.group}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">{g.group}</p>
                  <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
                    {g.items.map((it) => (
                      <div key={it.label} className="grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 sm:grid-cols-[180px_1fr]">
                        <dt className="text-ink-500">{it.label}</dt>
                        <dd className="text-ink-800">{it.value}</dd>
                      </div>
                    ))}
                    <div className="grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 sm:grid-cols-[180px_1fr]">
                      <dt className="text-ink-500">{g === p.specs[0] ? "BSIN" : "Listed on AltasGoods"}</dt>
                      <dd className={g === p.specs[0] ? "font-mono text-[13px] text-ink-800" : "text-ink-800"}>
                        {g === p.specs[0] ? `B0${p.sku.replace(/\W/g, "").slice(-8)}` : formatDayMonthYear(p.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Returns, warranty and who sells it */}
      <section id="returns" aria-label="Returns, warranty and who sells it" className="mt-14 grid scroll-mt-40 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="rounded-2xl border border-line p-5 lg:p-6">
          <p className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <Undo2 size={18} className="text-ink-500" aria-hidden="true" /> Returns
          </p>
          <p className="mt-2 text-sm font-medium text-ink-900">{policy.short}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">{policy.detail}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            Damaged, defective or wrong items can always be reported within the window or 7 days, whichever is longer. Refunds to AltasGoods Credits arrive within 2 hours.
          </p>
          <Link href="/policies/returns" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Returns policy <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="rounded-2xl border border-line p-5 lg:p-6">
          <p className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <ShieldCheck size={18} className="text-ink-500" aria-hidden="true" /> Warranty
          </p>
          <p className="mt-2 text-sm font-medium text-ink-900">{warranty}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {warranty.startsWith("No")
              ? "This product is covered by AltasGoods returns and the AltasGoods Guarantee instead."
              : `Claim with ${brand.name} using your AltasGoods invoice. Keep the box and accessories for faster service.`}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            AltasGoods Guarantee: if your item does not arrive or is not as described, we make it right.
          </p>
        </div>
        <div className="rounded-2xl border border-line p-5 lg:p-6">
          <p className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <Building2 size={18} className="text-ink-500" aria-hidden="true" /> Sold by AltasGoods
          </p>
          <p className="mt-2 text-sm text-ink-600">Sold, packed and shipped by AltasGoods.</p>
          <dl className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed">
            <div>
              <dt className="inline text-ink-500">Legal name: </dt>
              <dd className="inline text-ink-800">{COMPANY.legalName}</dd>
            </div>
            <div>
              <dt className="inline text-ink-500">Address: </dt>
              <dd className="inline text-ink-800">{COMPANY.registeredOffice}</dd>
            </div>
            <div>
              <dt className="inline text-ink-500">Customer care: </dt>
              <dd className="inline text-ink-800">{COMPANY.customerCare}</dd>
            </div>
            <div>
              <dt className="inline text-ink-500">Grievance officer: </dt>
              <dd className="inline text-ink-800">
                {GRIEVANCE_OFFICER.name}, {GRIEVANCE_OFFICER.email}
              </dd>
            </div>
            <div>
              <dt className="inline text-ink-500">GSTIN: </dt>
              <dd className="inline font-mono text-xs text-ink-800">{COMPANY.gstin}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" aria-labelledby="pdp-reviews" className="mt-16 scroll-mt-40">
        <h2 id="pdp-reviews" className="mb-6 text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">
          Ratings and reviews
        </h2>
        <ReviewsSection
          rating={p.rating}
          ratingCount={p.ratingCount}
          reviewCount={p.reviewCount}
          histogram={histogram}
          aspects={aspectRatings(p)}
          sellerName="AltasGoods"
          reviews={reviews.map((r) => ({
            id: r.id,
            author: r.author,
            rating: r.rating,
            title: r.title,
            body: r.body,
            date: formatDayMonthYear(r.createdAt),
            sortKey: new Date(r.createdAt).getTime(),
            verified: r.verified,
            helpful: r.helpful,
            variant: data.variants.length ? data.variants.map((v) => `${v.name}: ${v.default}`).join(", ") : undefined,
            response:
              r.rating <= 2
                ? `We are sorry this did not meet your expectations, ${r.author.split(" ")[0]}. We have arranged a free replacement and shared your feedback with ${brand.name}.`
                : undefined,
          }))}
        />
      </section>

      {/* Questions */}
      <section id="questions" aria-labelledby="pdp-qa" className="mt-16 scroll-mt-40">
        <h2 id="pdp-qa" className="mb-5 text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">
          Questions and answers
        </h2>
        <QnaSection
          productTitle={p.title}
          items={qa.map((q) => ({
            id: q.id,
            question: q.question,
            askedBy: q.askedBy,
            askedOn: formatDayMonthYear(q.askedAt),
            votes: q.votes,
            answers: q.answers.map((a) => ({ by: a.by, role: a.role, body: a.body, on: formatDayMonthYear(a.at), helpful: a.helpful })),
          }))}
        />
      </section>

      {/* Similar */}
      <section id="similar" aria-labelledby="pdp-similar" className="mt-16 scroll-mt-40">
        <h2 id="pdp-similar" className="mb-5 text-xl font-semibold tracking-tight text-ink-900 lg:text-2xl">
          Similar products
        </h2>
        <Rail label="Similar products">
          {similar.map((s) => (
            <RailItem key={s.id}>
              <ProductCard product={s} sizes="(min-width: 1024px) 16vw, 45vw" />
            </RailItem>
          ))}
        </Rail>
      </section>
    </div>
  );
}
