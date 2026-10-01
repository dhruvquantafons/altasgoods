import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionTitle({
  title,
  description,
  href,
  linkLabel = "View all",
  eyebrow,
  className,
  id,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  linkLabel?: string;
  eyebrow?: ReactNode;
  className?: string;
  id?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 lg:mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h2 id={id} className="text-xl font-semibold tracking-tight text-ink-900 lg:text-[26px] lg:leading-tight">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-500 lg:text-[15px]">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {aside}
        {href && (
          <Link href={href} className="group flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
            {linkLabel}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Section({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </section>
  );
}
