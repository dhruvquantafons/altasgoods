import Link from "next/link";
import Form from "next/form";
import type { ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, SearchX, Star, X } from "lucide-react";
import type { Product } from "@/lib/types";
import { categories, getBrand, getCategory } from "@/lib/mock";
import { DELIVERY_OPTIONS, DISCOUNT_BANDS, inStock, isBrowsable, PRICE_BANDS, RATING_OPTIONS, SORT_OPTIONS, SPONSORED_PRODUCT_IDS } from "@/lib/mock/store-extra";
import { cn, formatINR, formatNumber } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "@/components/ui/page-header";
import { DEFAULT_PINCODE, lookupPincode, promiseDays } from "./delivery";
import { FilterSheet, SortSelect } from "./listing-client";
import { featuredOffer, ProductCard } from "./product-card";
import { percentOff } from "./price";
import { STORE_CONTAINER } from "./store-header";

/* ------------------------------- Params --------------------------------- */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export interface Filters {
  q: string;
  cat: string;
  sub: string;
  brands: string[];
  price: string;
  min: string;
  max: string;
  rating: string;
  discount: string;
  assured: boolean;
  delivery: string;
  cod: boolean;
  avail: boolean;
  sort: string;
  page: number;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: SearchParamsRecord): Filters {
  return {
    q: one(sp.q).trim().slice(0, 80),
    cat: one(sp.cat),
    sub: one(sp.sub),
    brands: one(sp.brand).split(",").filter(Boolean),
    price: one(sp.price),
    min: one(sp.min).replace(/\D/g, ""),
    max: one(sp.max).replace(/\D/g, ""),
    rating: one(sp.rating),
    discount: one(sp.discount),
    assured: one(sp.assured) === "1",
    delivery: one(sp.delivery),
    cod: one(sp.cod) === "1",
    avail: one(sp.avail) === "1",
    sort: one(sp.sort) || "relevance",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
}

/** Query string for a filter state, omitting defaults. Any change resets paging. */
export function toQuery(f: Filters, patch: Partial<Filters> = {}) {
  const n = { ...f, page: 1, ...patch };
  const sp = new URLSearchParams();
  if (n.q) sp.set("q", n.q);
  if (n.cat) sp.set("cat", n.cat);
  if (n.sub) sp.set("sub", n.sub);
  if (n.brands.length) sp.set("brand", n.brands.join(","));
  if (n.price) sp.set("price", n.price);
  if (n.min) sp.set("min", n.min);
  if (n.max) sp.set("max", n.max);
  if (n.rating) sp.set("rating", n.rating);
  if (n.discount) sp.set("discount", n.discount);
  if (n.assured) sp.set("assured", "1");
  if (n.delivery) sp.set("delivery", n.delivery);
  if (n.cod) sp.set("cod", "1");
  if (n.avail) sp.set("avail", "1");
  if (n.sort && n.sort !== "relevance") sp.set("sort", n.sort);
  if (n.page > 1) sp.set("page", String(n.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------ Filtering -------------------------------- */

const pin = lookupPincode(DEFAULT_PINCODE);

function derived(p: Product) {
  const o = featuredOffer(p);
  return { price: o.price, off: percentOff(o.price, o.mrp), days: promiseDays(o.deliveryDays, pin), cod: o.codAvailable, available: inStock(p) };
}

type Facet = "cat" | "sub" | "brands" | "price" | "rating" | "discount" | "assured" | "delivery" | "cod" | "avail";

export function applyFilters(list: Product[], f: Filters, skip?: Facet) {
  const band = PRICE_BANDS.find((b) => b.key === f.price);
  const min = f.min ? Number(f.min) : undefined;
  const max = f.max ? Number(f.max) : undefined;
  return list.filter((p) => {
    if (!isBrowsable(p)) return false;
    const d = derived(p);
    if (skip !== "cat" && f.cat && getCategory(p.categoryId)?.slug !== f.cat) return false;
    if (skip !== "sub" && f.sub && p.subcategory !== f.sub) return false;
    if (skip !== "brands" && f.brands.length && !f.brands.includes(getBrand(p.brandId)?.slug ?? "")) return false;
    if (skip !== "price" && band && (d.price < band.min || d.price > band.max)) return false;
    if (skip !== "price" && min !== undefined && d.price < min) return false;
    if (skip !== "price" && max !== undefined && d.price > max) return false;
    if (skip !== "rating" && f.rating && p.rating < Number(f.rating)) return false;
    if (skip !== "discount" && f.discount && d.off < Number(f.discount)) return false;
    if (skip !== "assured" && f.assured && !p.assured) return false;
    if (skip !== "delivery" && f.delivery && d.days > Number(f.delivery)) return false;
    if (skip !== "cod" && f.cod && !d.cod) return false;
    if (skip !== "avail" && !f.avail && !d.available) return false;
    return true;
  });
}

function relevance(p: Product, q: string) {
  const t = p.title.toLowerCase();
  const term = q.toLowerCase();
  let s = 0;
  if (term) {
    if (t.startsWith(term)) s += 6;
    if ((getBrand(p.brandId)?.name ?? "").toLowerCase() === term) s += 4;
    if (p.subcategory.toLowerCase().includes(term)) s += 3;
    if (t.includes(term)) s += 2;
  }
  return s * 1e6 + p.rating * Math.log10(p.ratingCount + 10) * 1e3 + (p.assured ? 500 : 0);
}

/** `ranked` keeps the incoming order for relevance, for lists already ranked by the API. */
export function sortProducts(list: Product[], sort: string, q: string, ranked = false) {
  const arr = list.slice();
  const price = (p: Product) => featuredOffer(p).price;
  switch (sort) {
    case "popularity":
      return arr.sort((a, b) => b.soldLast30d - a.soldLast30d);
    case "price_asc":
      return arr.sort((a, b) => price(a) - price(b));
    case "price_desc":
      return arr.sort((a, b) => price(b) - price(a));
    case "newest":
      return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case "discount":
      return arr.sort((a, b) => derived(b).off - derived(a).off);
    case "rating":
      return arr.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    default:
      return ranked ? arr : arr.sort((a, b) => relevance(b, q) - relevance(a, q));
  }
}

/** Typo tolerance for empty results: closest brand, category or word in the catalogue. */
export function didYouMean(q: string, corpus: string[]) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const vocab = [...new Set(corpus.flatMap((c) => c.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 2))];
  const dist = (a: string, b: string) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length]![b.length]!;
  };
  let changed = false;
  const fixed = words.map((w) => {
    if (vocab.includes(w)) return w;
    let best = w;
    let bestD = Math.max(2, Math.floor(w.length / 3)) + 1;
    for (const v of vocab) {
      const d = dist(w, v);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best !== w) changed = true;
    return best;
  });
  return changed ? fixed.join(" ") : null;
}

/* ------------------------------- Rendering ------------------------------- */

const PAGE_SIZE = 24;

function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-4 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold tracking-wide text-ink-900 uppercase [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronRight size={16} className="text-ink-400 transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Option({ href, active, label, count, type = "checkbox" }: { href: string; active: boolean; label: ReactNode; count?: number; type?: "checkbox" | "radio" }) {
  const disabled = count === 0 && !active;
  return (
    <Link
      href={href}
      scroll={false}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md py-1.5 text-sm transition-colors",
        active ? "font-medium text-ink-900" : "text-ink-700 hover:text-ink-900",
        disabled && "pointer-events-none text-ink-400",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border transition-colors",
          type === "radio" ? "rounded-full" : "rounded",
          active ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-white",
        )}
      >
        {active && (type === "radio" ? <span className="size-1.5 rounded-full bg-white" /> : <Check size={11} strokeWidth={3} />)}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <span className="sr-only">(selected)</span>}
      {count !== undefined && <span className="text-xs text-ink-500 tabular-nums">{formatNumber(count)}</span>}
    </Link>
  );
}

function FilterPanel({ base, f, basePath, mode }: { base: Product[]; f: Filters; basePath: string; mode: "search" | "category" }) {
  const href = (patch: Partial<Filters>) => `${basePath}${toQuery(f, patch)}`;
  const count = (skip: Facet, pred: (p: Product) => boolean) => applyFilters(base, f, skip).filter(pred).length;

  const catOptions =
    mode === "search"
      ? categories.map((c) => ({ key: c.slug, label: c.name, n: count("cat", (p) => p.categoryId === c.id) })).filter((c) => c.n > 0 || f.cat === c.key)
      : [];
  const subOptions =
    mode === "category"
      ? [...new Set(base.map((p) => p.subcategory))].map((s) => ({ key: s, label: s, n: count("sub", (p) => p.subcategory === s) }))
      : [];
  const brandIds = [...new Set(base.filter(isBrowsable).map((p) => p.brandId))];
  const brandOptions = brandIds
    .map((id) => getBrand(id)!)
    .map((b) => ({ key: b.slug, label: b.name, n: count("brands", (p) => p.brandId === b.id) }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const topBrands = brandOptions.slice(0, 8);
  const moreBrands = brandOptions.slice(8);

  const hidden = (omit: string[]) => {
    const keep = new URLSearchParams(toQuery(f).slice(1));
    omit.forEach((k) => keep.delete(k));
    return [...keep.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  };

  return (
    <div>
      {mode === "search" && catOptions.length > 0 && (
        <FilterGroup title="Category">
          <Option type="radio" href={href({ cat: "", sub: "" })} active={!f.cat} label="All categories" />
          {catOptions.map((c) => (
            <Option key={c.key} type="radio" href={href({ cat: c.key, sub: "" })} active={f.cat === c.key} label={c.label} count={c.n} />
          ))}
        </FilterGroup>
      )}
      {mode === "category" && subOptions.length > 1 && (
        <FilterGroup title="Type">
          <Option type="radio" href={href({ sub: "" })} active={!f.sub} label="All types" />
          {subOptions.map((s) => (
            <Option key={s.key} type="radio" href={href({ sub: s.key })} active={f.sub === s.key} label={s.label} count={s.n} />
          ))}
        </FilterGroup>
      )}

      {brandOptions.length > 0 && (
        <FilterGroup title="Brand">
          {topBrands.map((b) => {
            const on = f.brands.includes(b.key);
            return (
              <Option
                key={b.key}
                href={href({ brands: on ? f.brands.filter((x) => x !== b.key) : [...f.brands, b.key] })}
                active={on}
                label={b.label}
                count={b.n}
              />
            );
          })}
          {moreBrands.length > 0 && (
            <details className="group/more">
              <summary className="mt-1 cursor-pointer list-none text-[13px] font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">{moreBrands.length} more brands</span>
                <span className="hidden group-open/more:inline">Show fewer</span>
              </summary>
              <div className="mt-1">
                {moreBrands.map((b) => {
                  const on = f.brands.includes(b.key);
                  return (
                    <Option
                      key={b.key}
                      href={href({ brands: on ? f.brands.filter((x) => x !== b.key) : [...f.brands, b.key] })}
                      active={on}
                      label={b.label}
                      count={b.n}
                    />
                  );
                })}
              </div>
            </details>
          )}
        </FilterGroup>
      )}

      <FilterGroup title="Price">
        {PRICE_BANDS.map((b) => (
          <Option
            key={b.key}
            type="radio"
            href={href({ price: f.price === b.key ? "" : b.key, min: "", max: "" })}
            active={f.price === b.key}
            label={b.label}
            count={count("price", (p) => {
              const pr = featuredOffer(p).price;
              return pr >= b.min && pr <= b.max;
            })}
          />
        ))}
        <Form action={basePath} scroll={false} className="mt-3 flex items-end gap-2">
          {hidden(["min", "max", "price", "page"])}
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-500">
            Min
            <input name="min" inputMode="numeric" defaultValue={f.min} placeholder="₹0" className="h-9 w-full rounded-lg border border-line-strong px-2.5 text-sm text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none" />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-500">
            Max
            <input name="max" inputMode="numeric" defaultValue={f.max} placeholder="Any" className="h-9 w-full rounded-lg border border-line-strong px-2.5 text-sm text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none" />
          </label>
          <button type="submit" className="h-9 shrink-0 rounded-lg border border-line-strong bg-white px-3 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
            Go
          </button>
        </Form>
      </FilterGroup>

      <FilterGroup title="Customer rating">
        {RATING_OPTIONS.map((r) => (
          <Option
            key={r}
            type="radio"
            href={href({ rating: f.rating === String(r) ? "" : String(r) })}
            active={f.rating === String(r)}
            label={
              <span className="inline-flex items-center gap-1">
                {r}
                <Star size={13} className="fill-accent-400 text-accent-400" aria-hidden="true" />
                <span>and above</span>
              </span>
            }
            count={count("rating", (p) => p.rating >= r)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Discount">
        {DISCOUNT_BANDS.map((d) => (
          <Option
            key={d}
            type="radio"
            href={href({ discount: f.discount === String(d) ? "" : String(d) })}
            active={f.discount === String(d)}
            label={`${d}% or more`}
            count={count("discount", (p) => derived(p).off >= d)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Delivery">
        {DELIVERY_OPTIONS.map((d) => (
          <Option
            key={d.key}
            type="radio"
            href={href({ delivery: f.delivery === d.key ? "" : d.key })}
            active={f.delivery === d.key}
            label={d.label}
            count={count("delivery", (p) => derived(p).days <= d.days)}
          />
        ))}
        <Option href={href({ cod: !f.cod })} active={f.cod} label="Pay on delivery available" count={count("cod", (p) => derived(p).cod)} />
      </FilterGroup>

      <FilterGroup title="Programs and availability">
        <Option href={href({ assured: !f.assured })} active={f.assured} label="BluBuy Assured" count={count("assured", (p) => p.assured)} />
        <Option href={href({ avail: !f.avail })} active={f.avail} label="Include out of stock" count={count("avail", (p) => !inStock(p))} />
      </FilterGroup>
    </div>
  );
}

export function ListingView({
  base,
  filters: f,
  basePath,
  mode,
  heading,
  crumbs,
  intro,
  emptyHint,
  ranked,
}: {
  base: Product[];
  ranked?: boolean;
  filters: Filters;
  basePath: string;
  mode: "search" | "category";
  heading: ReactNode;
  crumbs: Crumb[];
  intro?: ReactNode;
  emptyHint?: ReactNode;
}) {
  const results = sortProducts(applyFilters(base, f), f.sort, f.q, ranked);
  const sponsored = f.sort === "relevance" ? results.filter((p) => SPONSORED_PRODUCT_IDS.includes(p.id) && inStock(p)).slice(0, 2) : [];
  const organic = results.filter((p) => !sponsored.includes(p));
  const ordered = [...sponsored, ...organic];
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const pageItems = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (patch: Partial<Filters>) => `${basePath}${toQuery(f, patch)}`;

  const chips: { label: string; href: string }[] = [];
  if (mode === "search" && f.cat) chips.push({ label: getCategory(f.cat)?.name ?? f.cat, href: href({ cat: "", sub: "" }) });
  if (f.sub) chips.push({ label: f.sub, href: href({ sub: "" }) });
  f.brands.forEach((b) => chips.push({ label: getBrand(b)?.name ?? b, href: href({ brands: f.brands.filter((x) => x !== b) }) }));
  if (f.price) chips.push({ label: PRICE_BANDS.find((b) => b.key === f.price)?.label ?? f.price, href: href({ price: "" }) });
  if (f.min || f.max)
    chips.push({ label: `${f.min ? formatINR(Number(f.min)) : "₹0"} to ${f.max ? formatINR(Number(f.max)) : "any"}`, href: href({ min: "", max: "" }) });
  if (f.rating) chips.push({ label: `${f.rating} stars and above`, href: href({ rating: "" }) });
  if (f.discount) chips.push({ label: `${f.discount}% off or more`, href: href({ discount: "" }) });
  if (f.delivery) chips.push({ label: DELIVERY_OPTIONS.find((d) => d.key === f.delivery)?.label ?? "", href: href({ delivery: "" }) });
  if (f.cod) chips.push({ label: "Pay on delivery", href: href({ cod: false }) });
  if (f.assured) chips.push({ label: "BluBuy Assured", href: href({ assured: false }) });
  if (f.avail) chips.push({ label: "Including out of stock", href: href({ avail: false }) });

  const clearHref = `${basePath}${toQuery(f, { cat: "", sub: "", brands: [], price: "", min: "", max: "", rating: "", discount: "", assured: false, delivery: "", cod: false, avail: false })}`;
  const sortOptions = SORT_OPTIONS.map((o) => ({ key: o.key, label: o.label, href: href({ sort: o.key }) }));
  const from = ordered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, ordered.length);
  const panel = <FilterPanel base={base} f={f} basePath={basePath} mode={mode} />;

  return (
    <div className={cn(STORE_CONTAINER, "pt-5 pb-16 lg:pt-6 lg:pb-24")}>
      <Breadcrumbs items={crumbs} />
      {intro}
      <div className="mt-4 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between lg:mt-5">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-ink-900 lg:text-[28px]">{heading}</h1>
          <p className="mt-1 text-sm text-ink-500" aria-live="polite">
            {ordered.length ? (
              <>
                Showing {from} to {to} of {formatNumber(ordered.length)} result{ordered.length === 1 ? "" : "s"}
                {sponsored.length > 0 && <span className="text-ink-400">, including {sponsored.length} sponsored</span>}
              </>
            ) : (
              "No matching products"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterSheet activeCount={chips.length} resultCount={ordered.length} stateKey={toQuery(f)} clearHref={clearHref}>
            {panel}
          </FilterSheet>
          <SortSelect options={sortOptions} value={f.sort} className="ml-auto sm:ml-0" />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[256px_1fr] lg:gap-10">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 scrollbar-thin">
            <div className="flex items-center justify-between pb-1">
              <p className="font-display text-base font-semibold text-ink-900">Filters</p>
              {chips.length > 0 && (
                <Link href={clearHref} scroll={false} className="text-[13px] font-semibold text-brand-700 hover:underline">
                  Clear all
                </Link>
              )}
            </div>
            {panel}
          </div>
        </aside>

        <div className="min-w-0">
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  scroll={false}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-white pr-2 pl-3 text-[13px] font-medium text-ink-800 transition-colors hover:border-ink-400"
                >
                  {c.label}
                  <X size={14} className="text-ink-500" aria-hidden="true" />
                  <span className="sr-only">Remove filter</span>
                </Link>
              ))}
              <Link href={clearHref} scroll={false} className="ml-1 text-[13px] font-semibold text-brand-700 hover:underline">
                Clear all
              </Link>
            </div>
          )}

          {pageItems.length ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
              {pageItems.map((p, i) => (
                <li key={p.id} className="flex">
                  <ProductCard
                    product={p}
                    sponsored={sponsored.includes(p)}
                    showAdd
                    priority={i < 4}
                    className="w-full"
                    sizes="(min-width: 1280px) 22vw, (min-width: 640px) 30vw, 46vw"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-500 ring-1 ring-line">
                <SearchX size={22} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink-900">Nothing matches these filters</h2>
              <div className="mt-1 max-w-md text-sm text-ink-500">{emptyHint ?? "Try removing a filter or searching with fewer words."}</div>
              {chips.length > 0 && (
                <Link href={clearHref} className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                  Clear all filters
                </Link>
              )}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
              <Link
                href={href({ page: page - 1 })}
                aria-disabled={page === 1}
                className={cn("flex h-9 items-center gap-1 rounded-lg border border-line-strong px-3 text-sm", page === 1 && "pointer-events-none opacity-40")}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Previous
              </Link>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href({ page: n })}
                  aria-current={n === page ? "page" : undefined}
                  className={cn("flex size-9 items-center justify-center rounded-lg text-sm font-medium", n === page ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100")}
                >
                  {n}
                </Link>
              ))}
              <Link
                href={href({ page: page + 1 })}
                aria-disabled={page === pages}
                className={cn("flex h-9 items-center gap-1 rounded-lg border border-line-strong px-3 text-sm", page === pages && "pointer-events-none opacity-40")}
              >
                Next <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
