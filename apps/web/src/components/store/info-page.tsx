import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/page-header";
import { POLICIES, type Policy, type PolicyBlock } from "@/lib/mock/company";
import { cn, formatDate } from "@/lib/utils";
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

/** Renders one policy content block. */
function Block({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-[15px] leading-relaxed text-ink-700">{block.text}</p>;
    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((it) => (
            <li key={it} className="flex gap-3 text-[15px] leading-relaxed text-ink-700">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
              {it}
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="flex flex-col gap-4">
          {block.items.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">{i + 1}</span>
              <div>
                <p className="text-[15px] font-semibold text-ink-900">{s.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-ink-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs text-ink-500">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((r) => (
                <tr key={r.join("|")}>
                  {r.map((c, i) => (
                    <td key={i} className={cn("px-4 py-3", i === 0 ? "text-ink-800" : "text-ink-900", c.length <= 12 && "whitespace-nowrap")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <p className="flex gap-3 rounded-xl bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700">
          <Info size={17} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          {block.text}
        </p>
      );
  }
}

export function PolicyArticle({ policy }: { policy: Policy }) {
  return (
    <article className="flex flex-col gap-12">
      {policy.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
          <h2 id={`${s.id}-h`} className="text-xl font-semibold text-ink-900">
            {s.heading}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

/** Left navigation listing every policy, with the current one highlighted. */
export function PolicyNav({ active }: { active: string }) {
  return (
    <nav aria-label="Policies" className="flex flex-col gap-0.5">
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">Policies</p>
      {POLICIES.map((p) => (
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
export function PolicyCard({ policy, className }: { policy: Policy; className?: string }) {
  return (
    <Link href={`/policies/${policy.slug}`} className={cn("group flex flex-col rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-raised", className)}>
      <p className="text-[15px] font-semibold text-ink-900 group-hover:text-brand-700">{policy.title}</p>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{policy.summary}</p>
      <p className="mt-4 flex items-center justify-between text-xs text-ink-400">
        Updated {formatDate(policy.updated)}
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
