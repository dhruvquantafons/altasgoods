import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { ListingView, parseFilters, toQuery } from "@/components/store/listing";
import { ProductCard } from "@/components/store/product-card";
import { Rail, RailItem } from "@/components/store/rail";
import { SectionTitle } from "@/components/store/section";
import { categories, getCategory, productsByCategory } from "@/lib/mock";
import { inStock, isBrowsable, PRICE_BANDS, topBrandsIn } from "@/lib/mock/store-extra";
import { featuredOffer } from "@/components/store/product-card";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = getCategory(slug);
  return { title: c ? `${c.name}: shop online` : "Category" };
}

const BLURB: Record<string, string> = {
  mobiles: "5G phones, tablets and the accessories that go with them, with 7 day replacement and no cost EMI.",
  electronics: "Laptops, audio, cameras and wearables from verified brands, backed by brand warranty.",
  fashion: "Everyday cotton, festive ethnic wear and footwear, with free 10 day exchange.",
  home: "Furniture, lighting and kitchenware from independent studios across India.",
  appliances: "Kitchen and home appliances with installation and 2 year warranties.",
  beauty: "Skincare, fragrance and makeup, sealed and sourced from brands and authorised sellers.",
  grocery: "Coffee, tea, dry fruits and pantry staples, freshly packed and FSSAI certified.",
  books: "Fiction, non-fiction and collectible hardcovers, delivered in protective packaging.",
  sports: "Gear for yoga, the gym, cricket and cycling, built for daily training.",
  toys: "Safe, BIS certified toys and baby essentials that grow with your child.",
};

export default async function CategoryPage(props: PageProps<"/c/[slug]">) {
  const { slug } = await props.params;
  const cat = getCategory(slug);
  if (!cat || cat.parentId) notFound();
  const sp = await props.searchParams;
  const f = { ...parseFilters(sp), cat: "" };
  const base = productsByCategory(cat.slug);
  const basePath = `/c/${cat.slug}`;
  const curated = toQuery(f) === "";

  const live = base.filter(isBrowsable);
  const subs = (cat.children ?? []).map((s) => ({ ...s, product: live.find((p) => p.subcategory === s.name) })).filter((s) => s.product);
  const prices = live.map((p) => featuredOffer(p).price);
  const bands = PRICE_BANDS.filter((b) => prices.some((x) => x >= b.min && x <= b.max));
  const best = live.filter(inStock).sort((a, b) => b.soldLast30d - a.soldLast30d).slice(0, 10);
  const brandsHere = topBrandsIn(cat.id);

  const intro = curated ? (
    <div className="mt-4 lg:mt-5">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900">
        <Image src={cat.image!} alt="" fill loading="eager" sizes="100vw" className="object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/50 to-transparent" aria-hidden="true" />
        <div className="relative max-w-xl px-6 py-10 text-white lg:px-12 lg:py-14">
          <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">{live.length} products, {brandsHere.length} brands</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight lg:text-[40px] lg:leading-tight">{cat.name}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">{BLURB[cat.slug]}</p>
        </div>
      </div>

      {subs.length > 0 && (
        <section aria-labelledby="cat-subs" className="mt-10">
          <SectionTitle id="cat-subs" title={`Shop ${cat.name.toLowerCase()} by type`} />
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7 lg:gap-5">
            {subs.map((s) => (
              <li key={s.id}>
                <Link href={`${basePath}?sub=${encodeURIComponent(s.name)}`} className="group block text-center">
                  <span className="relative block aspect-square overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-line ring-inset">
                    <Image src={s.product!.image} alt="" fill sizes="(min-width: 1024px) 12vw, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </span>
                  <span className="mt-2 block text-[13px] font-medium text-ink-800 group-hover:text-brand-700">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="cat-price" className="rounded-2xl border border-line p-5 lg:p-6">
          <h2 id="cat-price" className="text-base font-semibold text-ink-900">
            Shop by budget
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {bands.map((b) => (
              <li key={b.key}>
                <Link
                  href={`${basePath}?price=${b.key}`}
                  className="flex h-full flex-col rounded-xl bg-ink-50 px-4 py-3 transition-colors hover:bg-brand-50"
                >
                  <span className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Budget</span>
                  <span className="mt-0.5 text-sm font-semibold text-ink-900">{b.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="cat-brands" className="rounded-2xl border border-line p-5 lg:p-6">
          <h2 id="cat-brands" className="text-base font-semibold text-ink-900">
            Top brands
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {brandsHere.map((b) => (
              <li key={b.id}>
                <Link
                  href={`${basePath}?brand=${b.slug}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-medium text-ink-800 transition-colors hover:border-ink-300"
                >
                  {b.verified && <BadgeCheck size={15} className="text-brand-600" aria-label="Verified brand" />}
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {best.length > 3 && (
        <section aria-labelledby="cat-best" className="mt-12">
          <SectionTitle id="cat-best" title={`Best sellers in ${cat.name}`} href={`${basePath}?sort=popularity`} />
          <Rail label={`Best sellers in ${cat.name}`}>
            {best.map((p) => (
              <RailItem key={p.id}>
                <ProductCard product={p} sizes="(min-width: 1024px) 16vw, 45vw" />
              </RailItem>
            ))}
          </Rail>
        </section>
      )}
      <div className="mt-14" />
    </div>
  ) : null;

  return (
    <ListingView
      base={base}
      filters={f}
      basePath={basePath}
      mode="category"
      heading={curated ? `All ${cat.name.toLowerCase()}` : cat.name}
      crumbs={[{ label: "Home", href: "/" }, { label: cat.name, href: curated ? undefined : basePath }]}
      intro={intro}
    />
  );
}
