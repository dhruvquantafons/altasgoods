import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StatusMeta, Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

const tones: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-ink-100 text-ink-700 ring-ink-200", dot: "bg-ink-400" },
  info: { pill: "bg-info-50 text-info-700 ring-info-100", dot: "bg-info-500" },
  brand: { pill: "bg-brand-50 text-brand-700 ring-brand-100", dot: "bg-brand-500" },
  success: { pill: "bg-success-50 text-success-700 ring-success-100", dot: "bg-success-500" },
  warning: { pill: "bg-warning-50 text-warning-700 ring-warning-100", dot: "bg-warning-500" },
  danger: { pill: "bg-danger-50 text-danger-700 ring-danger-100", dot: "bg-danger-500" },
  accent: { pill: "bg-accent-50 text-accent-700 ring-accent-100", dot: "bg-accent-500" },
};

export function Badge({
  tone = "neutral",
  dot = false,
  icon: Icon,
  size = "md",
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        tones[tone].pill,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", tones[tone].dot)} aria-hidden="true" />}
      {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Renders any state-machine status through its canonical meta, e.g.
 * <StatusBadge meta={ORDER_STATUS[order.status]} />
 */
export function StatusBadge({ meta, size, className }: { meta: StatusMeta; size?: "sm" | "md"; className?: string }) {
  return (
    <Badge tone={meta.tone} dot size={size} className={className}>
      {meta.label}
    </Badge>
  );
}

export function toneText(tone: Tone) {
  return {
    neutral: "text-ink-600",
    info: "text-info-700",
    brand: "text-brand-700",
    success: "text-success-700",
    warning: "text-warning-700",
    danger: "text-danger-700",
    accent: "text-accent-700",
  }[tone];
}

export function toneBg(tone: Tone) {
  return {
    neutral: "bg-ink-100 text-ink-600",
    info: "bg-info-50 text-info-600",
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
    accent: "bg-accent-50 text-accent-600",
  }[tone];
}
