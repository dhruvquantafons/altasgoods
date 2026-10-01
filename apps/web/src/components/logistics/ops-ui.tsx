/**
 * Small server-safe building blocks shared by the Hub Console and the Care Desk:
 * time and masking helpers, compact metric tiles, segmented progress, pagination.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Tone } from "@/lib/status";
import { cn, NOW } from "@/lib/utils";

/* ------------------------------ Time ------------------------------ */

const TZ = "Asia/Kolkata";
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const shortFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const keyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

/** "10:30 am" in IST. */
export function formatTime(d: string | Date) {
  return timeFmt.format(new Date(d));
}

/** "Thu, 1 Oct" in IST. */
export function formatDay(d: string | Date) {
  return dayFmt.format(new Date(d));
}

function dayDiff(d: string | Date) {
  const a = new Date(keyFmt.format(new Date(d))).getTime();
  const b = new Date(keyFmt.format(NOW)).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** "Today, 10:30 am", "Yesterday, 6:10 pm", "Tomorrow, 9:00 am" or "28 Sep, 3:20 pm". */
export function formatDayTime(d: string | Date) {
  const diff = dayDiff(d);
  const prefix = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : diff === 1 ? "Tomorrow" : shortFmt.format(new Date(d));
  return `${prefix}, ${formatTime(d)}`;
}

/** "Today", "Tomorrow", or "Sat, 3 Oct". */
export function formatRelativeDay(d: string | Date) {
  const diff = dayDiff(d);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : formatDay(d);
}

export function isToday(d: string | Date) {
  return dayDiff(d) === 0;
}

/** "45 min", "2 h 10 min", "3 d 4 h". */
export function durationLabel(mins: number) {
  const m = Math.abs(Math.round(mins));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** Minutes from NOW until a timestamp (negative when in the past). */
export function minsUntil(d: string | Date) {
  return Math.round((new Date(d).getTime() - NOW.getTime()) / 60_000);
}

/** "in 2 h 10 min" or "2 h 10 min overdue". */
export function dueLabel(d: string | Date) {
  const m = minsUntil(d);
  return m >= 0 ? `in ${durationLabel(m)}` : `${durationLabel(m)} overdue`;
}

/* ----------------------------- Masking ---------------------------- */

/** PII masking by default (section 8.2): "+91 98XXXXXX21". */
export function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

/** "Ananya Sharma" to "Ananya S." */
export function shortName(name: string) {
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first ?? name;
}

/* ------------------------------ Query ----------------------------- */

/** Builds "?a=1&b=2", dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/* ------------------------------ Atoms ----------------------------- */

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] tracking-tight", className)}>{children}</span>;
}

const toneText: Record<Tone, string> = {
  neutral: "text-ink-900",
  info: "text-info-700",
  brand: "text-brand-700",
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-danger-700",
  accent: "text-accent-700",
};

const dotTone: Record<Tone, string> = {
  neutral: "bg-ink-300",
  info: "bg-info-500",
  brand: "bg-brand-600",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  accent: "bg-accent-500",
};

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", dotTone[tone], className)} aria-hidden="true" />;
}

/**
 * Compact metric for dense strips: label, value, one line of context.
 * Use StatCard for the hero KPI row and this for secondary strips.
 */
export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium text-ink-500">{label}</p>
        {Icon && <Icon size={15} strokeWidth={1.8} className="shrink-0 text-ink-400" aria-hidden="true" />}
      </div>
      <p className={cn("mt-1.5 text-[22px] leading-none font-semibold tracking-tight tabular-nums", toneText[tone])}>{value}</p>
      {hint && <p className="mt-1.5 truncate text-xs text-ink-500">{hint}</p>}
    </>
  );
  const cls = cn("block min-w-0 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-card", href && "transition-shadow hover:shadow-raised", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const segTone: Record<Tone, string> = {
  neutral: "bg-ink-200",
  info: "bg-info-500",
  brand: "bg-brand-600",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  accent: "bg-accent-400",
};

/** Part-to-whole progress (delivered, failed, pending) with a 2px gap between parts. */
export function SegmentBar({
  segments,
  total,
  className,
  label,
  size = "md",
}: {
  segments: { value: number; tone: Tone; label: string }[];
  total: number;
  className?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const t = Math.max(1, total);
  const used = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div
      role="img"
      aria-label={label ?? segments.map((s) => `${s.label} ${s.value}`).join(", ") + ` of ${total}`}
      className={cn("flex w-full gap-[2px] overflow-hidden rounded-full bg-ink-100", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.label} className={cn("h-full first:rounded-l-full", segTone[s.tone], used >= t && "last:rounded-r-full")} style={{ width: `${(s.value / t) * 100}%` }} />
        ))}
    </div>
  );
}

/** "Attempt 2 of 3" as three small pips plus text. */
export function AttemptPips({ attempts, max = 3, className }: { attempts: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex gap-1" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-full", i < attempts ? (attempts >= max ? "bg-danger-500" : "bg-warning-500") : "bg-ink-200")} />
        ))}
      </span>
      <span className="text-xs text-ink-600 tabular-nums">
        {attempts} of {max}
      </span>
    </span>
  );
}

/** Label and value in a single row, for side panels. */
export function KeyRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 text-[13px]", className)}>
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink-900">{children}</dd>
    </div>
  );
}

/** Text link with a trailing arrow for card headers. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
      {children}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

/** URL driven pagination footer for operational lists. */
export function Pager({
  page,
  pageSize,
  total,
  hrefFor,
  label = "results",
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-500">
      <span>
        <span className="font-medium text-ink-800 tabular-nums">
          {from} to {to}
        </span>{" "}
        of <span className="font-medium text-ink-800 tabular-nums">{total.toLocaleString("en-IN")}</span> {label}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} scroll={false} className={cn(btn, "text-ink-700 hover:bg-ink-50")}>
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <span className={cn(btn, "text-ink-300")} aria-disabled="true">
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </span>
        )}
        <span className="px-1.5 tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} scroll={false} className={cn(btn, "text-ink-700 hover:bg-ink-50")}>
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <span className={cn(btn, "text-ink-300")} aria-disabled="true">
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Thin banner for policy notes and system context inside cards or above tables. */
export function Note({ icon: Icon, tone = "neutral", children, className }: { icon?: LucideIcon; tone?: Tone; children: ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: "border-line bg-ink-50 text-ink-600",
    info: "border-info-100 bg-info-50 text-info-700",
    brand: "border-brand-100 bg-brand-50 text-brand-800",
    success: "border-success-100 bg-success-50 text-success-700",
    warning: "border-warning-100 bg-warning-50 text-warning-700",
    danger: "border-danger-100 bg-danger-50 text-danger-700",
    accent: "border-accent-100 bg-accent-50 text-accent-800",
  };
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed", tones[tone], className)}>
      {Icon && <Icon size={16} strokeWidth={1.9} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
