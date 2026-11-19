import Link from "next/link";
import { Fact } from "@/components/store/placeholder";
import { companyLegalName } from "@/lib/legal";
import { Building2, Headset, Mail, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { STORE_CONTAINER } from "./store-header";

interface FooterProps {
  company: { legalName: string; cin: string; gstin: string; registeredOffice: string; customerCare: string; customerCareHours: string; email: string };
  grievance: { name: string; designation: string; email: string; phone: string; hours: string; ackHours: number; resolutionDays: number };
}

const columns = [
  {
    title: "About",
    links: [
      { label: "About AltasGoods", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Big Days sale", href: "/deals" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "Track your order", href: "/account/orders" },
      { label: "Payments", href: "/policies/payments" },
      { label: "AltasGoods Guarantee", href: "/policies/guarantee" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "Policy",
    links: [
      { label: "Returns policy", href: "/policies/returns" },
      { label: "Shipping policy", href: "/policies/shipping" },
      { label: "Cancellation policy", href: "/policies/cancellation" },
      { label: "Terms of use", href: "/policies/terms" },
      { label: "Privacy", href: "/policies/privacy" },
      { label: "Grievance redressal", href: "/policies/grievance" },
    ],
  },
];

const payments = ["UPI", "Credit cards", "Debit cards", "Net banking", "EMI", "AltasGoods Pay Later", "Gift cards", "Cash on delivery"];

export function StoreFooter({ company, grievance }: FooterProps) {
  return (
    <footer className="mt-auto bg-brand-950 text-brand-100">
      <div className={`${STORE_CONTAINER} grid gap-10 py-12 lg:grid-cols-[1.3fr_repeat(3,1fr)]`}>
        <div className="max-w-sm">
          <Logo inverted />
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Honest prices, real delivery dates and easy returns. Every order is sold, packed and shipped by AltasGoods.
          </p>
          <div id="app-download" className="mt-6 scroll-mt-24 rounded-xl bg-white/[0.05] p-4 ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Smartphone size={16} strokeWidth={1.8} aria-hidden="true" /> AltasGoods app
              <span className="rounded-full bg-accent-400 px-2 py-px text-[11px] font-semibold text-ink-950">Coming soon</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-200">
              Our Android and iOS app is in the works. Until then, the full store works beautifully in your phone&apos;s browser.
            </p>
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-semibold tracking-wider text-brand-300 uppercase">{col.title}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-brand-100 transition-colors hover:text-white hover:underline hover:underline-offset-4">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Legal and grievance (Consumer Protection (E-Commerce) Rules, 2020) */}
      <div className="border-t border-white/10">
        <div className={`${STORE_CONTAINER} grid gap-8 py-8 md:grid-cols-3`}>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Building2 size={16} strokeWidth={1.8} aria-hidden="true" /> Registered office
            </p>
            <address className="mt-2 text-[13px] leading-relaxed text-brand-200 not-italic">
              <Fact value={company.legalName} />
              <br />
              <Fact value={company.registeredOffice} />
              <br />
              CIN <Fact value={company.cin} />
              <br />
              GSTIN <Fact value={company.gstin} />
            </address>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Headset size={16} strokeWidth={1.8} aria-hidden="true" /> Customer care
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-200">
              <Fact value={company.customerCare} link="tel" className="text-brand-100 hover:text-white" /> (toll free), <Fact value={company.customerCareHours} />
              <br />
              <Fact value={company.email} link="mailto" className="text-brand-100 hover:text-white" />
            </p>
          </div>
          <div id="grievance-officer">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" /> Grievance Officer
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-200">
              <span className="text-brand-100">
                <Fact value={grievance.name} />
              </span>
              , {grievance.designation}
              <br />
              <Mail size={12} className="mr-1 inline" aria-hidden="true" />
              <Fact value={grievance.email} link="mailto" className="text-brand-100 hover:text-white" />
              <span className="mx-1.5 text-brand-300">·</span>
              <Phone size={12} className="mr-1 inline" aria-hidden="true" />
              <Fact value={grievance.phone} link="tel" className="text-brand-100 hover:text-white" />
              <br />
              <Fact value={grievance.hours} />. Complaints are acknowledged within {grievance.ackHours} hours and resolved within one month.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className={`${STORE_CONTAINER} flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-brand-300">We accept</span>
            {payments.map((p) => (
              <span key={p} className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium text-brand-100">
                {p}
              </span>
            ))}
          </div>
          <p className="text-xs text-brand-300">© 2026 {companyLegalName(company) ?? "AltasGoods"}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
