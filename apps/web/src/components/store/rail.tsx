"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal rail: native scroll with snap, visible previous / next buttons on
 * desktop and a partially visible next card on mobile.
 */
export function Rail({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    const raf = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className={cn("group/rail relative", className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:gap-6 lg:px-0"
      >
        {children}
      </div>
      {(["prev", "next"] as const).map((d) => {
        const hidden = d === "prev" ? edges.start : edges.end;
        return (
          <button
            key={d}
            type="button"
            onClick={() => scroll(d === "prev" ? -1 : 1)}
            aria-label={d === "prev" ? `Scroll ${label} back` : `Scroll ${label} forward`}
            tabIndex={hidden ? -1 : 0}
            className={cn(
              "absolute top-[34%] z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink-800 shadow-raised transition-all hover:bg-ink-50 lg:flex",
              d === "prev" ? "-left-5" : "-right-5",
              hidden ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            {d === "prev" ? <ChevronLeft size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Fixed-width slot for a card inside a Rail. */
export function RailItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-[44vw] max-w-56 shrink-0 snap-start sm:w-52 lg:w-[calc((100%-5*1.5rem)/6)] lg:max-w-none", className)}>{children}</div>;
}
