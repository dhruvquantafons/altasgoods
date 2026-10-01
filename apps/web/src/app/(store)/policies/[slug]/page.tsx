import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { HelpBand, InfoHero, PolicyArticle, PolicyCard, PolicyNav } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { getPolicy, POLICIES } from "@/lib/mock/company";
import { cn, formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getPolicy(slug)?.title ?? "Policy" };
}

export default async function PolicyPage(props: PageProps<"/policies/[slug]">) {
  const { slug } = await props.params;
  const policy = getPolicy(slug);
  if (!policy) notFound();
  const related = policy.related.map((s) => getPolicy(s)).filter((p) => p !== undefined);

  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Policies", href: "/policies" }, { label: policy.nav }]}
        title={policy.title}
        description={policy.summary}
      >
        <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-ink-500">
          <CalendarDays size={14} aria-hidden="true" />
          Last updated {formatDate(policy.updated)}
        </p>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px]")}>
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <PolicyNav active={policy.slug} />
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl">
          <PolicyArticle policy={policy} />

          {related.length > 0 && (
            <section aria-labelledby="related" className="mt-16 border-t border-line pt-10">
              <h2 id="related" className="text-lg font-semibold text-ink-900">
                Related policies
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((p) => (
                  <PolicyCard key={p.slug} policy={p} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-12 lg:hidden">
            <PolicyNav active={policy.slug} />
          </div>

          <div className="mt-12">
            <HelpBand />
          </div>
        </div>

        <aside className="hidden xl:block">
          <nav aria-label="On this page" className="sticky top-28">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">On this page</p>
            <ul className="flex flex-col gap-1.5 border-l border-line">
              {policy.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-0.5 pl-3 text-[13px] text-ink-500 hover:border-ink-400 hover:text-ink-900">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
