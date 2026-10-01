"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, LayoutGrid, Timer } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { NamedIcon } from "./icons";
import type { NavCategory } from "./types";

const OPEN_DELAY = 300;
const SWITCH_DELAY = 90;
const CLOSE_DELAY = 300;

/**
 * Category row with a hover-intent mega menu: opens after 300 ms, closes after
 * a 300 ms grace period, switches categories quickly once open (tolerates the
 * diagonal path), also opens on click and keyboard, closes on Escape.
 */
export function MegaMenu({ categories, dealLabel }: { categories: NavCategory[]; dealLabel: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(categories[0]?.slug ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDoc = (e: MouseEvent) => wrapRef.current && !wrapRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const intent = (slug: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        setActive(slug);
        setOpen(true);
      },
      open ? SWITCH_DELAY : OPEN_DELAY,
    );
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  const stay = () => clearTimeout(timer.current);

  const cat = categories.find((c) => c.slug === active) ?? categories[0]!;

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={leave} onMouseEnter={stay}>
      <div className="flex h-11 items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mega-menu-panel"
          onClick={() => {
            clearTimeout(timer.current);
            setOpen((o) => !o);
          }}
          className={cn(
            "flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-colors",
            open ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-800 hover:bg-ink-200",
          )}
        >
          <LayoutGrid size={15} strokeWidth={2} aria-hidden="true" />
          All categories
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <div className="relative min-w-0 flex-1">
          <ul className="flex items-center gap-0.5 overflow-x-auto pr-6 scrollbar-none">
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link
                  href={`/c/${c.slug}`}
                  title={c.name}
                  onMouseEnter={() => intent(c.slug)}
                  onFocus={() => open && setActive(c.slug)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium whitespace-nowrap transition-colors xl:px-2.5",
                    open && active === c.slug ? "bg-ink-100 text-ink-900" : "text-ink-700 hover:bg-ink-50 hover:text-ink-900",
                    pathname === `/c/${c.slug}` && "text-brand-700",
                  )}
                >
                  <NamedIcon name={c.icon} size={15} className="hidden text-ink-500 xl:block" />
                  {c.short}
                </Link>
              </li>
            ))}
          </ul>
          {/* fade edge hints at more categories when the row scrolls (narrow desktops) */}
          <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
        </div>
        <Link
          href="/deals"
          className="ml-1 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-50 px-3 text-[13px] font-semibold text-accent-900 ring-1 ring-accent-100 transition-colors ring-inset hover:bg-accent-100"
        >
          <Timer size={15} strokeWidth={2} aria-hidden="true" />
          {dealLabel}
        </Link>
      </div>

      {open && (
        <div
          id="mega-menu-panel"
          className="absolute inset-x-0 top-full z-40 -mt-px overflow-hidden rounded-b-2xl border border-line bg-white shadow-pop animate-fade-in"
          onMouseEnter={stay}
        >
          <div className="grid grid-cols-[15rem_1fr]">
            <ul className="border-r border-line bg-ink-25 py-3" role="list">
              {categories.map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => intent(c.slug)}
                    onFocus={() => setActive(c.slug)}
                    onClick={() => setActive(c.slug)}
                    aria-current={active === c.slug ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-2 text-left text-[13px] font-medium transition-colors",
                      active === c.slug ? "bg-white text-brand-700 shadow-[inset_2px_0_0_var(--color-brand-600)]" : "text-ink-700 hover:text-ink-900",
                    )}
                  >
                    <NamedIcon name={c.icon} size={16} className={active === c.slug ? "text-brand-600" : "text-ink-400"} />
                    <span className="flex-1">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-[1fr_1fr_17rem] gap-8 p-6">
              <div className="col-span-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-lg font-semibold text-ink-900">{cat.name}</p>
                  <Link href={`/c/${cat.slug}`} className="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                    Shop all <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
                  {cat.subs.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/s?q=${encodeURIComponent(s.name)}&cat=${cat.slug}`}
                        className="block rounded-md py-1.5 text-sm text-ink-700 transition-colors hover:text-brand-700"
                      >
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {cat.brands.length > 0 && (
                  <div className="mt-6 border-t border-line pt-5">
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Top brands</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {cat.brands.map((b) => (
                        <li key={b.slug}>
                          <Link
                            href={`/s?brand=${b.slug}`}
                            className="inline-flex h-8 items-center rounded-full border border-line px-3.5 text-[13px] font-medium text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-900"
                          >
                            {b.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Popular right now</p>
                {cat.featured.map((f) => (
                  <Link key={f.slug} href={`/p/${f.slug}`} className="group flex items-center gap-3 rounded-xl border border-line p-2.5 transition-colors hover:border-ink-300">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                      <Image src={f.image} alt="" fill sizes="64px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13px] leading-snug font-medium text-ink-800">{f.title}</span>
                      <span className="mt-1 block text-sm font-semibold text-ink-900 tabular-nums">{formatINR(f.price)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
