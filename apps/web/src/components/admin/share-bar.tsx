import { SERIES_COLORS } from "@/components/charts/format";
import { cn } from "@/lib/utils";

/**
 * Part-to-whole bar with a single-column legend. A local variant of the shared
 * StackedBar, whose two-column legend truncates labels inside narrow cards.
 */
export function ShareBar({ segments, className }: { segments: { label: string; value: number }[]; className?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(1)}%`).join(", ")}>
        {segments.map((s, i) => (
          <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: SERIES_COLORS[i] }} />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {segments.map((s, i) => (
          <li key={s.label} className={cn("flex items-center justify-between gap-3 text-[13px]")}>
            <span className="flex min-w-0 items-center gap-2 text-ink-600">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-medium text-ink-900 tabular-nums">{((s.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
