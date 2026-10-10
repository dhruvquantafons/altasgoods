import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CalendarDays, MapPin, Users } from "lucide-react";
import { ApplyForm } from "@/components/store/apply-form";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { getRole, ROLES } from "@/lib/mock/company";
import { cn, formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return ROLES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(props: PageProps<"/careers/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getRole(slug)?.title ?? "Careers" };
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-[15px] leading-relaxed text-ink-700">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
            {it}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function RolePage(props: PageProps<"/careers/[slug]">) {
  const { slug } = await props.params;
  const role = getRole(slug);
  if (!role) notFound();
  const others = ROLES.filter((r) => r.slug !== role.slug && r.team === role.team).slice(0, 3);

  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero crumbs={[{ label: "Home", href: "/" }, { label: "Careers", href: "/careers" }, { label: role.title }]} eyebrow={role.team} title={role.title} description={role.summary}>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
          <li className="inline-flex items-center gap-1.5">
            <MapPin size={15} className="text-ink-400" aria-hidden="true" />
            {role.location}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Briefcase size={15} className="text-ink-400" aria-hidden="true" />
            {role.type}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users size={15} className="text-ink-400" aria-hidden="true" />
            {role.experience} experience
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays size={15} className="text-ink-400" aria-hidden="true" />
            Posted {formatDate(role.posted)}
          </li>
        </ul>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_400px]")}>
        <div className="flex max-w-3xl flex-col gap-10">
          <section>
            <h2 className="text-lg font-semibold text-ink-900">About the role</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
              {role.summary} You will work closely with a small, senior team, ship often and see the difference your work makes for customers across India.
            </p>
          </section>
          <List title="What you will do" items={role.responsibilities} />
          <List title="What we are looking for" items={role.requirements} />
          {role.niceToHave.length > 0 && <List title="Nice to have" items={role.niceToHave} />}

          {others.length > 0 && (
            <section className="border-t border-line pt-8">
              <h2 className="text-lg font-semibold text-ink-900">Other roles in {role.team.toLowerCase()}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {others.map((o) => (
                  <li key={o.slug}>
                    <Link href={`/careers/${o.slug}`} className="text-[15px] font-medium text-brand-700 hover:underline">
                      {o.title}
                    </Link>
                    <span className="ml-2 text-sm text-ink-500">{o.location}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/careers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-ink-900">
            <ArrowLeft size={15} aria-hidden="true" />
            All open roles
          </Link>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-lg font-semibold text-ink-900">Apply for this role</h2>
            <p className="mt-1 mb-5 text-sm text-ink-500">Takes about 3 minutes. No cover letter needed.</p>
            <ApplyForm roleTitle={role.title} />
          </div>
        </aside>
      </div>
    </div>
  );
}
