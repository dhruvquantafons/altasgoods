import Link from "next/link";
import { Suspense } from "react";
import { HelpCircle, Package, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu, CartButton, DeliverTo, MobileNav, SearchBox, SearchBoxFallback, WishlistLink } from "./header-client";
import { MegaMenu } from "./mega-menu";
import type { AddressLite, NavCategory, Suggestion } from "./types";

export const STORE_CONTAINER = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";

export function StoreHeader({
  categories,
  suggestions,
  addresses,
  customer,
}: {
  categories: NavCategory[];
  suggestions: Suggestion[];
  addresses: AddressLite[];
  customer: { signedIn: boolean; firstName: string; credits: number };
}) {
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">
        Skip to content
      </a>

      {/* Utility bar */}
      <div className="hidden border-b border-line bg-ink-50 lg:block">
        <div className={`${STORE_CONTAINER} flex h-9 items-center justify-between`}>
          <DeliverTo addresses={addresses} name={customer.firstName} />
          <nav aria-label="Utility" className="flex items-center gap-1 text-[13px] text-ink-600">
            {[
              { href: "/help", label: "Help", icon: HelpCircle },
              { href: "#app-download", label: "Download app", icon: Smartphone },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-ink-100 hover:text-ink-900">
                <l.icon size={14} strokeWidth={1.9} aria-hidden="true" />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main bar (sticky) */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className={`${STORE_CONTAINER} flex h-14 items-center gap-2 lg:h-16 lg:gap-6`}>
          <MobileNav categories={categories} customer={customer} />
          <Logo className="shrink-0" />
          <Suspense fallback={<SearchBoxFallback categories={cats} className="hidden max-w-3xl flex-1 lg:block" />}>
            <SearchBox categories={cats} suggestions={suggestions} className="hidden max-w-3xl flex-1 lg:block" />
          </Suspense>
          <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
            <AccountMenu customer={customer} />
            <Link href="/account/orders" className="hidden h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50 lg:inline-flex">
              <Package size={21} strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden xl:inline">Orders</span>
              <span className="sr-only xl:hidden">Orders</span>
            </Link>
            <WishlistLink />
            <CartButton />
          </div>
        </div>
        {/* Mobile search, always visible */}
        <div className="px-4 pb-3 sm:px-6 lg:hidden">
          <Suspense fallback={<SearchBoxFallback categories={cats} />}>
            <SearchBox categories={cats} suggestions={suggestions} />
          </Suspense>
        </div>
      </header>

      {/* Mobile deliver-to line */}
      <div className="border-b border-line bg-ink-50 px-4 sm:px-6 lg:hidden">
        <DeliverTo addresses={addresses} name={customer.firstName} variant="line" />
      </div>

      {/* Category row with mega menu (desktop) */}
      <div className="hidden border-b border-line bg-white lg:block">
        <div className={STORE_CONTAINER}>
          <MegaMenu categories={categories} dealLabel="Big Days deals" />
        </div>
      </div>

      {/* Category chips (mobile) */}
      <nav aria-label="Categories" className="border-b border-line bg-white lg:hidden">
        <ul className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none sm:px-6">
          <li className="shrink-0">
            <Link href="/deals" className="flex h-8 items-center rounded-full bg-accent-50 px-3.5 text-[13px] font-semibold text-accent-900 ring-1 ring-accent-100 ring-inset">
              Deals
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/c/${c.slug}`} className="flex h-8 items-center rounded-full border border-line px-3.5 text-[13px] font-medium text-ink-700">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
