import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  href: string;
  count?: number;
}

/**
 * URL driven tabs (server safe). Use with searchParams, e.g.
 * <TabLinks active={status} items={[{ key: "all", label: "All", href: "?status=all" }]} />
 */
export function TabLinks({ items, active, className, variant = "underline" }: { items: TabItem[]; active: string; className?: string; variant?: "underline" | "pill" }) {
  if (variant === "pill")
    return (
      <nav className={cn("inline-flex flex-wrap items-center gap-1 rounded-xl bg-ink-100 p-1", className)}>
        {items.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={t.key === active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
              t.key === active ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs text-ink-400 tabular-nums">{t.count}</span>}
          </Link>
        ))}
      </nav>
    );
  return (
    <nav className={cn("flex items-center gap-6 overflow-x-auto border-b border-line scrollbar-none", className)}>
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "relative inline-flex h-11 shrink-0 items-center gap-2 text-sm font-medium transition-colors",
            t.key === active ? "text-ink-900" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                t.key === active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
              )}
            >
              {t.count.toLocaleString("en-IN")}
            </span>
          )}
          {t.key === active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </Link>
      ))}
    </nav>
  );
}
