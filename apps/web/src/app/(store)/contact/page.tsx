import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Briefcase, Building2, Clock, Headset, Mail, MessageCircle, Newspaper, Package, PhoneCall, Scale } from "lucide-react";
import { CallbackRequest } from "@/components/store/callback-request";
import { InfoHero } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { currentUser } from "@/lib/api/server";
import { COMPANY, GRIEVANCE_OFFICER } from "@/lib/mock/store-extra";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contact us" };

const channels = [
  { icon: Package, title: "Help with an order", body: "Track, cancel, return or report a problem. Fastest for anything about an order.", cta: "Go to your orders", href: "/account/orders" },
  { icon: MessageCircle, title: "Chat with us", body: "Talk to a person from Help in the app or on the web. Typical reply in 2 minutes.", cta: "Start a chat", href: "/account/support" },
  { icon: PhoneCall, title: `Call ${COMPANY.customerCare}`, body: `Toll free, ${COMPANY.customerCareHours}. Or ask us to call you back, below.`, cta: "Call now", href: `tel:${COMPANY.customerCare.replace(/\s/g, "")}` },
  { icon: Mail, title: COMPANY.email, body: "For anything that needs attachments or a written record. Reply within 24 hours.", cta: "Write to us", href: `mailto:${COMPANY.email}` },
];

const teams = [
  { icon: Newspaper, title: "Press and media", body: "Write to press@altasgoods.in for interviews, data and images.", href: "/press", cta: "Press room" },
  { icon: Briefcase, title: "Careers", body: "See open roles and how we hire.", href: "/careers", cta: "Open roles" },
];

export default async function ContactPage() {
  // signed-in shoppers get their number filled in for a call back
  const user = await currentUser();
  const phone = user?.phone.replace(/\D/g, "").slice(-10) ?? "";
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact us" }]}
        eyebrow="Contact us"
        title="We are here when you need a person"
        description="Most questions are answered fastest from your order page, but every channel below reaches a real member of our Care Desk team."
      >
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-700 ring-1 ring-line">
          <Clock size={14} className="text-brand-600" aria-hidden="true" />
          Customer care is open {COMPANY.customerCareHours}
        </p>
      </InfoHero>

      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c) => (
            <div key={c.title} className="flex flex-col rounded-2xl border border-line bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <c.icon size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-4 text-[15px] font-semibold break-words text-ink-900">{c.title}</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{c.body}</p>
              <a href={c.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                {c.cta}
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>

        <section id="call-back" aria-labelledby="call-back-heading" className="mt-6 scroll-mt-28 rounded-2xl border border-line bg-white p-6 lg:p-8">
          <h2 id="call-back-heading" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <PhoneCall size={18} className="text-brand-600" aria-hidden="true" /> Request a call back
          </h2>
          <p className="mt-1 mb-5 text-sm text-ink-500">Tell us your number and a time that suits you. Calls are made {COMPANY.customerCareHours}.</p>
          <CallbackRequest careNumber={COMPANY.customerCare} defaultPhone={phone} signedIn={Boolean(user)} />
        </section>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="other-teams" className="rounded-2xl border border-line bg-white p-6 lg:p-8">
            <h2 id="other-teams" className="text-lg font-semibold text-ink-900">
              Other teams
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {teams.map((t) => (
                <li key={t.title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
                    <t.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink-900">{t.title}</p>
                    <p className="text-sm text-ink-500">{t.body}</p>
                  </div>
                  <Link href={t.href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
                    {t.cta}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-4 rounded-xl bg-ink-50 p-4">
              <Building2 size={18} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
              <div className="text-sm leading-relaxed text-ink-600">
                <p className="font-semibold text-ink-900">{COMPANY.legalName}</p>
                <p>{COMPANY.registeredOffice}</p>
                <p className="mt-1 text-[13px] text-ink-500">
                  CIN {COMPANY.cin}, GSTIN {COMPANY.gstin}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="grievance" className="rounded-2xl border border-brand-200 bg-brand-50/50 p-6 lg:p-8">
            <h2 id="grievance" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
              <Scale size={18} className="text-brand-700" aria-hidden="true" /> Grievance Officer
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              Not satisfied with how we resolved your issue? Our Grievance Officer, appointed under the Consumer Protection (E-Commerce) Rules, 2020, will review it.
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
              <div>
                <dt className="text-ink-500">Name</dt>
                <dd className="font-semibold text-ink-900">{GRIEVANCE_OFFICER.name}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Email</dt>
                <dd>
                  <a href={`mailto:${GRIEVANCE_OFFICER.email}`} className="font-medium text-brand-700 hover:underline">
                    {GRIEVANCE_OFFICER.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Phone</dt>
                <dd className="text-ink-900">{GRIEVANCE_OFFICER.phone}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Hours</dt>
                <dd className="text-ink-900">{GRIEVANCE_OFFICER.hours}</dd>
              </div>
            </dl>
            <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-700">
              <Headset size={14} className="text-brand-700" aria-hidden="true" />
              Acknowledged within {GRIEVANCE_OFFICER.ackHours} hours, resolved within one month
            </p>
            <Link href="/policies/grievance" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              How grievances are handled
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
