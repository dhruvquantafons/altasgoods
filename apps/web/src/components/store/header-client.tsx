"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Store,
  Tag,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { useCart, usePincode, useWishlist } from "./cart-context";
import { isValidPincode, lookupPincode } from "./delivery";
import { NamedIcon } from "./icons";
import type { AddressLite, NavCategory, Suggestion } from "./types";

/* ------------------------------- Search --------------------------------- */

interface SearchProps {
  categories: { slug: string; name: string }[];
  suggestions: Suggestion[];
  className?: string;
}

/** Wrap in <Suspense> (reads the current query from the URL). */
export function SearchBox(props: SearchProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const initialQ = pathname === "/s" ? (params.get("q") ?? "") : "";
  const initialCat = pathname === "/s" ? (params.get("cat") ?? "") : pathname.startsWith("/c/") ? pathname.split("/")[2] ?? "" : "";
  return <SearchBoxInner key={`${initialQ}|${initialCat}`} {...props} initialQ={initialQ} initialCat={initialCat} />;
}

export function SearchBoxFallback({ categories, className }: Pick<SearchProps, "categories" | "className">) {
  return <SearchShell categories={categories} className={className} q="" cat="" />;
}

function SearchShell({
  categories,
  className,
  q,
  cat,
  onQ,
  onCat,
  onSubmit,
  inputProps,
  children,
}: {
  categories: { slug: string; name: string }[];
  className?: string;
  q: string;
  cat: string;
  onQ?: (v: string) => void;
  onCat?: (v: string) => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  children?: React.ReactNode;
}) {
  const id = useId();
  const catLabel = categories.find((c) => c.slug === cat)?.name ?? "All";
  return (
    <form action="/s" method="get" role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <div className="group flex h-11 w-full items-stretch rounded-xl border border-line-strong bg-ink-50 transition-colors focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
        <label htmlFor={`${id}-cat`} className="sr-only">
          Search in category
        </label>
        <div className="relative hidden shrink-0 sm:block">
          <select
            id={`${id}-cat`}
            name="cat"
            {...(onCat ? { value: cat, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onCat(e.target.value) } : { defaultValue: cat })}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none flex h-full max-w-40 items-center gap-1.5 rounded-l-xl border-r border-line bg-ink-100/70 pr-2.5 pl-3.5 text-[13px] font-medium text-ink-700"
          >
            <span className="truncate">{catLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-ink-500" />
          </span>
        </div>
        <label htmlFor={`${id}-q`} className="sr-only">
          Search BluBuy
        </label>
        <input
          id={`${id}-q`}
          name="q"
          type="search"
          {...(onQ ? { value: q, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onQ(e.target.value) } : { defaultValue: q })}
          placeholder="Search products and brands"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none sm:text-sm"
          {...inputProps}
        />
        <button
          type="submit"
          aria-label="Search"
          className="m-1 flex w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700"
        >
          <Search size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {children}
    </form>
  );
}

function SearchBoxInner({ categories, suggestions, className, initialQ, initialCat }: SearchProps & { initialQ: string; initialCat: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const scored = suggestions
      .map((s) => {
        const l = s.label.toLowerCase();
        const idx = l.indexOf(term);
        const wordStart = l.split(/\s+/).some((w) => w.startsWith(term));
        return { s, score: idx === 0 ? 0 : wordStart ? 1 : idx > 0 ? 2 : 9 };
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || (a.s.kind === "category" ? -1 : 1));
    return scored.slice(0, 8).map((x) => x.s);
  }, [q, suggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => wrapRef.current && !wrapRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (open && active >= 0 && matches[active]) return go(matches[active].href);
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (cat) sp.set("cat", cat);
    go(`/s${sp.size ? `?${sp}` : ""}`);
  };

  const highlight = (label: string) => {
    const term = q.trim();
    const i = label.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return <span className="font-semibold text-ink-900">{label}</span>;
    // emphasise the predicted part, not the typed part (Baymard)
    return (
      <>
        <span className="text-ink-600">{label.slice(0, i + term.length)}</span>
        <span className="font-semibold text-ink-900">{label.slice(i + term.length)}</span>
      </>
    );
  };

  const showList = open && matches.length > 0;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <SearchShell
        categories={categories}
        q={q}
        cat={cat}
        onQ={(v) => {
          setQ(v);
          setOpen(true);
          setActive(-1);
        }}
        onCat={setCat}
        onSubmit={onSubmit}
        inputProps={{
          role: "combobox",
          "aria-expanded": showList,
          "aria-controls": listId,
          "aria-autocomplete": "list",
          "aria-activedescendant": active >= 0 ? `${listId}-${active}` : undefined,
          onFocus: () => setOpen(true),
          onKeyDown: (e) => {
            if (!matches.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (a + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          },
        }}
      >
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-pop animate-fade-in"
          >
            {matches.map((m, i) => (
              <li
                key={`${m.kind}-${m.href}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(m.href);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-2 text-sm", i === active ? "bg-ink-50" : "")}
              >
                {m.kind === "product" ? (
                  <Search size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
                ) : m.kind === "brand" ? (
                  <Tag size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
                ) : (
                  <ChevronRight size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{highlight(m.label)}</span>
                {m.kind === "category" && m.context && <span className="shrink-0 text-xs text-brand-700">in {m.context}</span>}
                {m.kind === "category" && !m.context && <span className="shrink-0 text-xs text-brand-700">Category</span>}
                {m.kind === "brand" && <span className="shrink-0 text-xs text-ink-500">Brand</span>}
              </li>
            ))}
          </ul>
        )}
      </SearchShell>
    </div>
  );
}

/* ------------------------------ Cart / wishlist ------------------------- */

export function CartButton({ compact = false }: { compact?: boolean }) {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-lg text-ink-800 transition-colors hover:bg-ink-50",
        compact ? "size-10 justify-center" : "h-11 px-2.5",
      )}
    >
      <span className="relative">
        <ShoppingCart size={22} strokeWidth={1.8} aria-hidden="true" />
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-2 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ring-2 ring-white",
            count ? "bg-brand-600 text-white" : "bg-ink-200 text-ink-600",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      </span>
      {!compact && <span className="hidden text-sm font-semibold xl:inline">Cart</span>}
    </Link>
  );
}

export function WishlistLink() {
  const { ids } = useWishlist();
  return (
    <Link href="/account/wishlist" className="hidden h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50 lg:inline-flex">
      <span className="relative">
        <Heart size={21} strokeWidth={1.8} aria-hidden="true" />
        {ids.length > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2 rounded-full bg-brand-600 ring-2 ring-white" />
        )}
      </span>
      <span className="hidden xl:inline">Wishlist</span>
      <span className="sr-only">, {ids.length} saved</span>
    </Link>
  );
}

/* ------------------------------ Account menu ---------------------------- */

interface Customer {
  firstName: string;
  plus: boolean;
  bluCoins: number;
  credits: number;
}

export function AccountMenu({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 150);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 300);
  };

  const links = [
    { href: "/account", label: "Your account", icon: UserRound },
    { href: "/account/orders", label: "Orders and returns", icon: Package },
    { href: "/account/wishlist", label: "Wishlist", icon: Heart },
    { href: "/plus", label: "BluBuy Plus", icon: Crown, note: customer.plus ? "Member" : undefined },
    { href: "/account/rewards", label: "BluCoins", icon: Coins, note: formatNumber(customer.bluCoins) },
    { href: "/account/wallet", label: "BluBuy Credits", icon: Wallet, note: `₹${formatNumber(customer.credits)}` },
    { href: "/help", label: "Help centre", icon: HelpCircle },
  ];

  return (
    <div ref={ref} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-left transition-colors hover:bg-ink-50"
      >
        <UserRound size={21} strokeWidth={1.8} className="text-ink-800 lg:hidden" aria-hidden="true" />
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="text-xs text-ink-500">Hello, {customer.firstName}</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-ink-900">
            Account and lists <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
          </span>
        </span>
        <span className="sr-only lg:hidden">Account</span>
      </button>
      {open && (
        <div id={menuId} className="absolute top-full right-0 z-50 mt-1.5 w-72 rounded-2xl border border-line bg-white p-2 shadow-pop animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-semibold text-brand-800">
              {customer.firstName[0]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">Hello, {customer.firstName}</p>
              {customer.plus ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-700">
                  <Crown size={12} aria-hidden="true" /> BluBuy Plus member
                </p>
              ) : (
                <Link href="/plus" className="text-xs font-medium text-brand-700 hover:underline">
                  Join BluBuy Plus
                </Link>
              )}
            </div>
          </div>
          <ul className="mt-1.5">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                  <l.icon size={17} strokeWidth={1.8} className="text-ink-500" aria-hidden="true" />
                  <span className="flex-1">{l.label}</span>
                  {l.note && <span className="text-xs font-medium text-ink-500 tabular-nums">{l.note}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 border-t border-line pt-1.5">
            <Link href="/login" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900">
              <LogOut size={17} strokeWidth={1.8} className="text-ink-500" aria-hidden="true" />
              Not {customer.firstName}? Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Deliver to ----------------------------- */

export function DeliverTo({ addresses, name, variant = "bar" }: { addresses: AddressLite[]; name: string; variant?: "bar" | "line" }) {
  const { pincode, setPincode } = usePincode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const info = lookupPincode(pincode);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (pin: string) => {
    if (!isValidPincode(pin)) {
      setError("Enter a valid 6 digit pincode");
      return;
    }
    setPincode(pin);
    setError(null);
    setDraft("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-md text-left transition-colors",
          variant === "bar" ? "h-7 px-1.5 text-[13px] text-ink-600 hover:bg-ink-100 hover:text-ink-900" : "w-full py-2 text-[13px] text-ink-700",
        )}
      >
        <MapPin size={15} strokeWidth={1.9} className="shrink-0 text-ink-500" aria-hidden="true" />
        <span className="truncate">
          Deliver to {name}, <span className="font-semibold text-ink-900">{info?.city ?? "India"} {pincode}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-ink-400" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-pop animate-fade-in">
          <p className="font-display text-[15px] font-semibold text-ink-900">Choose your location</p>
          <p className="mt-0.5 text-[13px] text-ink-500">Delivery dates, cash on delivery and offers depend on your pincode.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {addresses.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => apply(a.pincode)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                    a.pincode === pincode ? "border-brand-500 bg-brand-50/60" : "border-line hover:border-line-strong hover:bg-ink-50",
                  )}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    {a.name}
                    <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-600 uppercase">{a.type}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">
                    {a.line1}, {a.city} {a.pincode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply(draft);
            }}
          >
            <label htmlFor="deliver-pin" className="sr-only">
              Pincode
            </label>
            <input
              id="deliver-pin"
              inputMode="numeric"
              maxLength={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter a pincode"
              aria-invalid={!!error}
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
            <button type="submit" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              Apply
            </button>
          </form>
          {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Mobile nav ----------------------------- */

export function MobileNav({ categories, customer }: { categories: NavCategory[]; customer: Customer }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="flex size-10 items-center justify-center rounded-lg text-ink-800 hover:bg-ink-50 lg:hidden">
        <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-pop animate-slide-in">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <Logo size="sm" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <Link href="/account" className="flex items-center gap-3 bg-brand-950 px-4 py-4 text-white">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/10 font-display font-semibold">{customer.firstName[0]}</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">Hello, {customer.firstName}</span>
                  <span className="block text-xs text-brand-200">{customer.plus ? "BluBuy Plus member" : "Your account"}</span>
                </span>
                <ChevronRight size={18} className="text-brand-200" aria-hidden="true" />
              </Link>
              <nav aria-label="Shop by category" className="px-2 py-3">
                <p className="px-2 pb-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">Shop by category</p>
                {categories.map((c) => (
                  <details key={c.slug} className="group rounded-lg">
                    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
                        <NamedIcon name={c.icon} size={17} />
                      </span>
                      <span className="flex-1">{c.name}</span>
                      <ChevronDown size={16} className="text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <ul className="mb-2 ml-13 border-l border-line pl-3">
                      <li>
                        <Link href={`/c/${c.slug}`} className="block py-1.5 text-sm font-medium text-brand-700">
                          Shop all {c.name}
                        </Link>
                      </li>
                      {c.subs.map((s) => (
                        <li key={s.slug}>
                          <Link href={`/s?q=${encodeURIComponent(s.name)}&cat=${c.slug}`} className="block py-1.5 text-sm text-ink-600 hover:text-ink-900">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </nav>
              <div className="border-t border-line px-2 py-3">
                {[
                  { href: "/deals", label: "Big Days deals", icon: Tag },
                  { href: "/account/orders", label: "Orders and returns", icon: Package },
                  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
                  { href: "/plus", label: "BluBuy Plus", icon: Crown },
                  { href: "/sell", label: "Sell on BluBuy", icon: Store },
                  { href: "/help", label: "Help centre", icon: HelpCircle },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50">
                    <span className="flex size-8 items-center justify-center text-ink-500">
                      <l.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    {l.label}
                  </Link>
                ))}
                <Link href="/login" className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-ink-600 hover:bg-ink-50">
                  <span className="flex size-8 items-center justify-center text-ink-500">
                    <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  Sign out
                </Link>
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
