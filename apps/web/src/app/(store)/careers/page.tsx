import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, GraduationCap, HeartPulse, Home, MapPin, Sprout, Wallet } from "lucide-react";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { ROLES } from "@/lib/mock/company";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Careers" };

const benefits = [
  { icon: HeartPulse, title: "Health for your family", body: "Medical cover for you, your partner, children and parents, plus mental health support." },
  { icon: Wallet, title: "Meaningful ownership", body: "Every full time employee receives stock options in BluBuy." },
  { icon: Home, title: "Flexible and hybrid", body: "Three days together in the office, the rest wherever you work best." },
  { icon: GraduationCap, title: "Learning budget", body: "₹50,000 a year for courses, books and conferences." },
  { icon: Sprout, title: "Generous leave", body: "24 days of paid leave, 26 weeks of parental leave for every parent." },
  { icon: Clock, title: "Sensible hours", body: "No meetings on Wednesday afternoons, and we respect evenings and weekends." },
];

const steps = ["Application review within 7 days", "A conversation with the hiring manager", "A practical exercise based on real work", "Meet the team", "Offer"];

export default async function CareersPage(props: PageProps<"/careers">) {
  const sp = await props.searchParams;
  const team = typeof sp.team === "string" ? sp.team : "All";
  const teams = ["All", ...Array.from(new Set(ROLES.map((r) => r.team)))];
  const roles = team === "All" ? ROLES : ROLES.filter((r) => r.team === team);

  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Careers" }]}
        eyebrow="Careers at BluBuy"
        title="Help build a calmer, fairer marketplace for India"
        description="We are a small team doing work that reaches millions of homes and thousands of small businesses. If you care about craft and about people, we would love to hear from you."
      >
        <a href="#open-roles" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
          See {ROLES.length} open roles
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <section aria-labelledby="benefits">
          <h2 id="benefits" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            Why people join
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-line bg-white p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <b.icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="mt-4 text-[15px] font-semibold text-ink-900">{b.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="open-roles" aria-labelledby="roles-h" className="mt-16 scroll-mt-28 lg:mt-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="roles-h" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
                Open roles
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {roles.length} {roles.length === 1 ? "role" : "roles"}
                {team !== "All" && ` in ${team.toLowerCase()}`}
              </p>
            </div>
          </div>
          <nav aria-label="Filter by team" className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {teams.map((t) => (
              <Link
                key={t}
                href={t === "All" ? "/careers#open-roles" : `/careers?team=${encodeURIComponent(t)}#open-roles`}
                aria-current={t === team ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  t === team ? "border-ink-900 bg-ink-900 text-white" : "border-line-strong bg-white text-ink-700 hover:border-ink-400",
                )}
              >
                {t}
              </Link>
            ))}
          </nav>

          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {roles.map((r) => (
              <li key={r.slug}>
                <Link href={`/careers/${r.slug}`} className="group flex flex-col gap-2 p-5 transition-colors hover:bg-ink-50/60 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink-900 group-hover:text-brand-700">{r.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-ink-500">{r.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500 sm:justify-end">
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 font-medium text-ink-700">{r.team}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} aria-hidden="true" />
                      {r.location}
                    </span>
                    <span>Posted {timeAgo(r.posted)}</span>
                    <ArrowRight size={16} className="hidden text-ink-300 transition-colors group-hover:text-brand-600 sm:block" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="process" className="mt-16 lg:mt-20">
          <h2 id="process" className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">
            How we hire
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s} className="rounded-2xl border border-line bg-white p-5">
                <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
                <p className="mt-2 text-sm font-semibold text-ink-900">{s}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-500">
            BluBuy is an equal opportunity employer. We welcome people of every gender, caste, religion, region, disability, age and sexual orientation, and we make
            reasonable adjustments throughout the hiring process. We will never ask you to pay a fee at any stage.
          </p>
        </section>
      </div>
    </div>
  );
}
