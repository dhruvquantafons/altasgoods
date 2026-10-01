import Link from "next/link";
import { cn } from "@/lib/utils";

/** The BluBuy mark: a rounded tile holding a geometric shopping bag that reads as a "b". */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className={inverted ? "fill-white" : "fill-brand-600"} />
      <path
        d="M11 8.5v15M11 15.5a5 5 0 1 1 0 6.2"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={inverted ? "stroke-brand-600" : "stroke-white"}
      />
      <circle cx="22.5" cy="10" r="1.9" className={inverted ? "fill-accent-500" : "fill-accent-300"} />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  label,
  inverted = false,
  size = "md",
}: {
  className?: string;
  href?: string | null;
  /** Optional product label shown after the wordmark, e.g. "Seller Central" */
  label?: string;
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} className={size === "sm" ? "size-7" : size === "lg" ? "size-10" : "size-8"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.03em]",
            size === "sm" ? "text-[17px]" : size === "lg" ? "text-2xl" : "text-[19px]",
            inverted ? "text-white" : "text-ink-900",
          )}
        >
          Blu<span className={inverted ? "text-brand-200" : "text-brand-600"}>Buy</span>
        </span>
        {label && (
          <span className={cn("mt-1 text-[11px] font-medium tracking-wide", inverted ? "text-brand-100" : "text-ink-500")}>
            {label}
          </span>
        )}
      </span>
    </span>
  );
  if (href === null) return content;
  return (
    <Link href={href} aria-label="BluBuy home" className="rounded-lg">
      {content}
    </Link>
  );
}
