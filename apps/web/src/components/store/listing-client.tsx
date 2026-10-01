"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sort control. Every option's URL is computed on the server; the client only navigates. */
export function SortSelect({ options, value, className }: { options: { key: string; label: string; href: string }[]; value: string; className?: string }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <label htmlFor={id} className="hidden text-[13px] whitespace-nowrap text-ink-500 sm:block">
        Sort by
      </label>
      <div className="relative">
        <ArrowUpDown size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const o = options.find((x) => x.key === e.target.value);
            if (o) router.push(o.href, { scroll: false });
          }}
          className="h-9 cursor-pointer appearance-none rounded-lg border border-line-strong bg-white pr-8 pl-8 text-[13px] font-medium text-ink-800 shadow-xs hover:border-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Mobile filter sheet. The filter panel itself is server rendered and passed
 * in as children; links inside navigate and the sheet closes on the new URL.
 */
export function FilterSheet({ children, activeCount, resultCount, stateKey, clearHref }: { children: ReactNode; activeCount: number; resultCount: number; stateKey: string; clearHref: string }) {
  const [open, setOpen] = useState(false);
  const [lastKey, setLastKey] = useState(stateKey);
  if (stateKey !== lastKey) {
    setLastKey(stateKey);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 text-[13px] font-medium text-ink-800 shadow-xs lg:hidden"
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        Filters
        {activeCount > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{activeCount}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-pop animate-fade-in">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="font-display text-base font-semibold text-ink-900">Filters</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2 scrollbar-thin">{children}</div>
            <div className="flex items-center gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Link href={clearHref} scroll={false} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line-strong text-sm font-medium text-ink-800">
                Clear all
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 flex-[2] items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                Show {resultCount} result{resultCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
