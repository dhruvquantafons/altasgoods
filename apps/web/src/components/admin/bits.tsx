/**
 * Small presentational pieces shared by AltasGoods Control pages. No hooks, so
 * they render in server and client components alike.
 */
import type { ReactNode } from "react";
import { CircleCheck, CircleX, Clock, TriangleAlert } from "lucide-react";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { durationLabel, minutesUntil } from "./helpers";

/** SLA countdown as words plus an icon: "Due in 5 h", "Overdue by 2 h". */
export function SlaText({ dueAt, warnWithinMins = 12 * 60, className }: { dueAt: string; warnWithinMins?: number; className?: string }) {
  const mins = minutesUntil(dueAt);
  const overdue = mins < 0;
  const soon = !overdue && mins <= warnWithinMins;
  const Icon = overdue ? TriangleAlert : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] whitespace-nowrap tabular-nums",
        overdue ? "font-medium text-danger-700" : soon ? "font-medium text-warning-700" : "text-ink-600",
        className,
      )}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {overdue ? `Overdue by ${durationLabel(mins)}` : `Due in ${durationLabel(mins)}`}
    </span>
  );
}

/** Automated check result: icon + words, never colour alone. */
export function CheckMark({ result, className }: { result: "pass" | "warn" | "fail"; className?: string }) {
  const Icon = result === "pass" ? CircleCheck : result === "warn" ? TriangleAlert : CircleX;
  const tone = result === "pass" ? "text-success-600" : result === "warn" ? "text-warning-600" : "text-danger-600";
  return <Icon size={16} strokeWidth={2} className={cn("shrink-0", tone, className)} aria-label={result === "pass" ? "Passed" : result === "warn" ? "Needs review" : "Failed"} />;
}

const meterFill: Record<Tone, string> = {
  neutral: "bg-ink-400",
  info: "bg-info-500",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  accent: "bg-accent-500",
};

/** Compact score meter for table cells: number plus a short bar. */
export function ScoreMeter({ value, max = 100, tone, label, className }: { value: number; max?: number; tone: Tone; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="w-8 text-right text-[13px] font-semibold text-ink-900 tabular-nums">{value}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label ?? "Score"}>
        <span className={cn("block h-full rounded-full", meterFill[tone])} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
    </span>
  );
}

/** Label/value row for summary panels (right aligned tabular value). */
export function SummaryRow({ label, value, strong, className }: { label: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 text-[13px]", className)}>
      <dt className={strong ? "font-medium text-ink-900" : "text-ink-600"}>{label}</dt>
      <dd className={cn("text-right tabular-nums", strong ? "font-semibold text-ink-900" : "font-medium text-ink-900")}>{value}</dd>
    </div>
  );
}

/** Mono identifier, optionally linked. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] text-ink-800", className)}>{children}</span>;
}

/** Quiet inline label (maker, checker, tier names) as a bordered chip. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border border-line bg-ink-50 px-1.5 py-px text-[11px] font-medium text-ink-600", className)}>{children}</span>;
}
