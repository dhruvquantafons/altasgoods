import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterSelect {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  /** width class, defaults to a comfortable fixed width */
  className?: string;
  /** value that means "no filter" (default "all") */
  defaultValue?: string;
}

/**
 * URL driven filter row: a GET form with search plus selects. Works without
 * JavaScript; params outside the form (for example the active tab) are kept
 * through hidden inputs.
 */
export function FilterBar({
  path,
  q,
  placeholder = "Search",
  selects = [],
  keep = {},
  className,
  searchClassName,
}: {
  path: string;
  q?: string;
  placeholder?: string;
  selects?: FilterSelect[];
  keep?: Record<string, string | undefined>;
  className?: string;
  searchClassName?: string;
}) {
  const active = Boolean(q) || selects.some((s) => s.value && s.value !== (s.defaultValue ?? "all"));
  const keepEntries = Object.entries(keep).filter(([, v]) => v !== undefined && v !== "") as [string, string][];
  const clearHref = keepEntries.length ? `${path}?${new URLSearchParams(keepEntries).toString()}` : path;
  return (
    <form method="get" action={path} className={cn("flex flex-wrap items-center gap-2", className)} role="search">
      {keepEntries.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className={cn("w-full sm:w-72", searchClassName)}>
        <span className="sr-only">{placeholder}</span>
        <Input name="q" type="search" icon={Search} defaultValue={q} placeholder={placeholder} inputSize="sm" />
      </label>
      {selects.map((s) => (
        <label key={s.name} className={cn("w-[calc(50%_-_0.25rem)] min-w-0", s.className ?? "sm:w-44")}>
          <span className="sr-only">{s.label}</span>
          <Select name={s.name} defaultValue={s.value ?? s.defaultValue ?? "all"} selectSize="sm" aria-label={s.label}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
      <Button type="submit" size="sm" variant="secondary">
        Apply
      </Button>
      {active && (
        <Link href={clearHref} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800">
          <X size={14} aria-hidden="true" />
          Clear
        </Link>
      )}
    </form>
  );
}
