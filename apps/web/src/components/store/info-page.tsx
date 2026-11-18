import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/page-header";
import type { StorePolicy, StorePolicyCard } from "@/lib/store-content";
import { cn, formatDate } from "@/lib/utils";
import { Prose } from "./prose";
import { STORE_CONTAINER } from "./store-header";

/** Title band shared by company, careers, press, contact and policy pages. */
export function InfoHero({
  eyebrow,
  title,
  description,
  crumbs,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line bg-gradient-to-b from-brand-50/70 to-white", className)}>
      <div className={cn(STORE_CONTAINER, "py-10 lg:py-14")}>
        {crumbs && <Breadcrumbs items={crumbs} className="mb-5" />}
        {eyebrow && <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-ink-900 lg:text-[40px] lg:leading-[1.15]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">{description}</p>}
        {children}
      </div>
    </div>
  );
}

export function PolicyArticle({ policy }: { policy: StorePolicy }) {
  return (
    <article className="flex flex-col gap-12">
      {policy.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
          <h2 id={`${s.id}-h`} className="text-xl font-semibold text-ink-900">
            {s.heading}
          </h2>
          <Prose markdown={s.body} className="mt-4" />
        </section>
      ))}
    </article>
  );
}

/** Left navigation listing every policy, with the current one highlighted. */
export function PolicyNav({ active, policies }: { active: string; policies: StorePolicyCard[] }) {
  return (
    <nav aria-label="Policies" className="flex flex-col gap-0.5">
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">Policies</p>
      {policies.map((p) => (
        <Link
          key={p.slug}
          href={`/policies/${p.slug}`}
          aria-current={p.slug === active ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors",
            p.slug === active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
          )}
        >
          {p.nav}
        </Link>
      ))}
    </nav>
  );
}

/** Card linking to another policy. */
export function PolicyCard({ policy, className }: { policy: StorePolicyCard; className?: string }) {
  return (
    <Link href={`/policies/${policy.slug}`} className={cn("group flex flex-col rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-raised", className)}>
      <p className="text-[15px] font-semibold text-ink-900 group-hover:text-brand-700">{policy.title}</p>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{policy.summary}</p>
      <p className="mt-4 flex items-center justify-between text-xs text-ink-400">
        Updated {formatDate(policy.updatedAt)}
        <ArrowRight size={15} className="text-ink-300 transition-colors group-hover:text-brand-600" aria-hidden="true" />
      </p>
    </Link>
  );
}

/** Closing help band used at the bottom of info pages. */
export function HelpBand({ title = "Still need help?", body = "Our team is here every day from 8 am to 10 pm." }: { title?: string; body?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-brand-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-8">
      <div>
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-brand-100">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/account/support" className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-ink-900 hover:bg-brand-50">
          Get help with an order
        </Link>
        <Link href="/contact" className="inline-flex h-10 items-center rounded-lg border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10">
          Contact us
        </Link>
      </div>
    </div>
  );
}
