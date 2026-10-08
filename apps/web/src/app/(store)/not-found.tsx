import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { categories } from "@/lib/mock";

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-ink-50 text-ink-500 ring-1 ring-line">
        <Compass size={26} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm font-semibold text-brand-700">Page not found</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 lg:text-4xl">We could not find that page</h1>
      <p className="mt-3 max-w-md text-[15px] text-ink-600">The link may be old or the product may no longer be listed. Try searching, or start from one of these.</p>
      <form action="/s" method="get" className="mt-8 flex w-full max-w-lg gap-2">
        <label htmlFor="nf-q" className="sr-only">
          Search AltasGoods
        </label>
        <input
          id="nf-q"
          name="q"
          placeholder="Search for products, brands and more"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-4 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
        <button type="submit" className="h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Search
        </button>
      </form>
      <ul className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.slug}`} className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:border-ink-300">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-10 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        Back to the home page <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
