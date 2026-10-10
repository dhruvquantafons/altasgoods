import Link from "next/link";
import { BookOpen, FileText, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/logistics/ops-client";
import { formatDay, Mono, one, qs } from "@/components/logistics/ops-ui";
import { CopyButton } from "@/components/support/copy-button";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { articles, macros, type Article } from "@/lib/mock/ops-extra";
import { cn, formatNumber } from "@/lib/utils";

export const metadata = { title: "Macros and policies" };

function articleText(a: Article) {
  return [a.title, a.summary, a.category, ...a.sections.flatMap((s) => [s.heading ?? "", s.body ?? "", ...(s.bullets ?? []), ...(s.table?.rows.flat() ?? [])])].join(" ").toLowerCase();
}

export default async function KnowledgePage(props: PageProps<"/support/knowledge">) {
  const sp = await props.searchParams;
  const raw = (one(sp.q) ?? "").trim();
  const q = raw.toLowerCase();
  const type = one(sp.type) ?? "all";

  const foundArticles = type === "macros" ? [] : articles.filter((a) => !q || articleText(a).includes(q));
  const foundMacros = type === "articles" ? [] : macros.filter((m) => !q || `${m.title} ${m.category} ${m.body}`.toLowerCase().includes(q));
  const selected = foundArticles.find((a) => a.slug === one(sp.a)) ?? foundArticles[0];
  const base = { q: raw || undefined, type: type === "all" ? undefined : type };

  return (
    <>
      <PageHeader title="Macros and policies" description="Canned replies and the policies behind them: return windows, refund timelines, cancellation, COD and claims." />

      <Card className="mb-6">
        <AutoSubmitForm action="/support/knowledge" className="flex flex-wrap items-center gap-2 p-4">
          <Input name="q" defaultValue={raw} icon={Search} placeholder="Search policies and macros, for example refund UPI or return window" aria-label="Search knowledge" className="min-w-0 flex-1 basis-72" />
          <Select name="type" defaultValue={type} aria-label="Type" className="w-40">
            <option value="all">Everything</option>
            <option value="articles">Policies only</option>
            <option value="macros">Macros only</option>
          </Select>
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            Search
          </button>
        </AutoSubmitForm>
      </Card>

      {foundArticles.length === 0 && foundMacros.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nothing found" description={`No policy or macro mentions "${raw}". Try a shorter term such as refund or COD.`} action={<Link href="/support/knowledge" className="text-[13px] font-medium text-brand-700">Clear search</Link>} />
        </Card>
      ) : (
        <>
          {foundArticles.length > 0 && (
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <nav aria-label="Policy articles" className="flex flex-col gap-2">
                {foundArticles.map((a) => {
                  const active = a.slug === selected?.slug;
                  return (
                    <Link
                      key={a.slug}
                      href={`/support/knowledge${qs({ ...base, a: a.slug })}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-[var(--radius-card)] border px-4 py-3 transition-colors",
                        active ? "border-brand-200 bg-brand-50/60 shadow-[inset_2px_0_0_var(--color-brand-600)]" : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink-900">{a.title}</span>
                        <FileText size={14} className={active ? "text-brand-600" : "text-ink-400"} aria-hidden="true" />
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{a.summary}</span>
                      <span className="mt-1.5 block text-[11px] font-medium text-ink-400">{a.category}</span>
                    </Link>
                  );
                })}
              </nav>

              {selected && (
                <Card className="min-w-0 self-start lg:sticky lg:top-24">
                  <div className="border-b border-line px-6 pt-5 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand" size="sm" icon={BookOpen}>
                        {selected.category}
                      </Badge>
                      <span className="text-xs text-ink-500">
                        Updated {formatDay(selected.updatedAt)} by {selected.owner}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-ink-900">{selected.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-ink-600">{selected.summary}</p>
                  </div>
                  <div className="flex max-w-3xl flex-col gap-5 px-6 py-5">
                    {selected.sections.map((s, i) => (
                      <section key={i}>
                        {s.heading && <h3 className="mb-1.5 text-sm font-semibold text-ink-900">{s.heading}</h3>}
                        {s.body && <p className="text-sm leading-relaxed text-ink-700">{s.body}</p>}
                        {s.bullets && (
                          <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-ink-700">
                            {s.bullets.map((b) => (
                              <li key={b} className="flex gap-2.5">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden="true" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.table && (
                          <div className="overflow-x-auto rounded-xl border border-line scrollbar-thin">
                            <table className="w-full text-left text-[13px]">
                              <thead className="bg-ink-50/70">
                                <tr>
                                  {s.table.head.map((h) => (
                                    <th key={h} className="px-3.5 py-2.5 text-xs font-medium whitespace-nowrap text-ink-500">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line">
                                {s.table.rows.map((r) => (
                                  <tr key={r.join("|")}>
                                    {r.map((c, ci) => (
                                      <td key={ci} className={cn("px-3.5 py-2.5 align-top text-ink-700", ci === 0 && "font-medium text-ink-900")}>
                                        {c}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {foundMacros.length > 0 && (
            <>
              <SectionHeading title="Macros" description={`${foundMacros.length} canned replies. Placeholders in braces fill in from the ticket when inserted in the composer.`} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {foundMacros.map((m) => (
                  <Card key={m.id} className="flex flex-col">
                    <CardHeader title={m.title} description={m.category} action={<Mono className="text-[11px] text-ink-400">{m.id}</Mono>} />
                    <p className="flex-1 px-5 pt-2 pb-4 text-[13px] leading-relaxed text-ink-600">
                      {m.body.split(/(\{\w+\})/g).map((part, i) =>
                        /^\{\w+\}$/.test(part) ? (
                          <span key={i} className="rounded bg-brand-50 px-1 font-mono text-[12px] text-brand-700">
                            {part}
                          </span>
                        ) : (
                          part
                        ),
                      )}
                    </p>
                    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-500">
                      <span>
                        Used {formatNumber(m.uses)} times, updated {formatDay(m.updatedAt)}
                      </span>
                      <CopyButton text={m.body} />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
