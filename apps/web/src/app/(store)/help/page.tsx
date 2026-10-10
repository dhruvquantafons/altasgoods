import Image from "next/image";
import Link from "next/link";
import Form from "next/form";
import { ChevronDown, Clock, Headset, LogIn, Mail, MessageCircle, PhoneCall, Scale, Search, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { NamedIcon } from "@/components/store/icons";
import { formatDayMonth } from "@/components/store/delivery";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { loadMyOrders, toUiOrder } from "@/lib/api/account-orders";
import { currentUser } from "@/lib/api/server";
import { COMPANY, GRIEVANCE_OFFICER, HELP_FAQS, HELP_TOPICS } from "@/lib/mock/store-extra";
import { ORDER_STATUS } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";

export const metadata = { title: "Help centre" };

const RETURN_WINDOWS = [
  ["Fashion: apparel, footwear, bags, watches, eyewear", "10 days", "Refund, replacement or exchange"],
  ["Furniture and large home", "10 days", "Refund or replacement"],
  ["Home decor, furnishing, kitchen", "7 days", "Refund or replacement"],
  ["Mobiles, tablets, laptops", "7 days", "Replacement only"],
  ["Electronics and small appliances", "7 days", "Replacement only"],
  ["Large appliances", "10 days", "Replacement after technician visit"],
  ["Books, toys, sports, stationery", "7 days", "Replacement only"],
  ["Beauty and personal care", "7 days", "Refund if unopened and sealed"],
  ["Grocery and packaged food", "2 days", "Refund for damaged, expired or wrong"],
];

function issuesFor(status: string) {
  if (["delivered"].includes(status)) return ["Return or replace", "Item damaged or missing", "Get invoice"];
  if (["placed", "confirmed", "packed", "ready_to_ship"].includes(status)) return ["Cancel order", "Change delivery address", "Payment issue"];
  if (["shipped", "in_transit", "out_for_delivery", "undelivered"].includes(status)) return ["Where is my order?", "Reschedule delivery", "Cancel order"];
  return ["Refund status", "Something else"];
}

export default async function HelpPage(props: PageProps<"/help">) {
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const faqs = q ? HELP_FAQS.filter((f) => `${f.q} ${f.a} ${f.group}`.toLowerCase().includes(q.toLowerCase())) : HELP_FAQS;
  // the shopper's real recent orders (newest first), so every chip opens an order that exists
  const user = await currentUser();
  const recent = user ? (await loadMyOrders().catch(() => [])).slice(0, 3).map(toUiOrder) : [];
  const first = user?.name?.split(" ")[0];

  return (
    <div className="pb-16 lg:pb-24">
      <div className="border-b border-line bg-gradient-to-b from-brand-50/70 to-white">
        <div className={cn(STORE_CONTAINER, "py-10 lg:py-14")}>
          <p className="text-sm font-semibold text-brand-700">AltasGoods help centre</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 lg:text-[40px]">How can we help{first ? `, ${first}` : ""}?</h1>
          <Form action="/help" scroll={false} className="mt-6 flex max-w-2xl gap-2">
            <label htmlFor="help-q" className="sr-only">
              Search help articles
            </label>
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                id="help-q"
                name="q"
                defaultValue={q}
                placeholder="Search for refunds, cancellation, COD, OTP..."
                className="h-12 w-full rounded-xl border border-line-strong bg-white pr-4 pl-11 text-[15px] shadow-xs focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
              />
            </div>
            <button type="submit" className="h-12 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              Search
            </button>
          </Form>
        </div>
      </div>

      <div className={cn(STORE_CONTAINER, "mt-10")}>
        {/* Order aware help */}
        {!q && !user && (
          <Link href="/login?next=/help" className="flex items-center gap-3 rounded-2xl border border-line p-4 transition-colors hover:border-ink-300">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <LogIn size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink-900">Need help with an order?</span>
              <span className="mt-0.5 block text-[13px] text-ink-500">Sign in to see your recent orders and fix an issue in a couple of taps.</span>
            </span>
          </Link>
        )}
        {!q && recent.length > 0 && (
          <section aria-labelledby="help-orders">
            <h2 id="help-orders" className="text-lg font-semibold text-ink-900">
              Need help with a recent order?
            </h2>
            <ul className="mt-4 grid gap-4 lg:grid-cols-3">
              {recent.map((o) => (
                <li key={o.id} className="flex flex-col rounded-2xl border border-line p-4">
                  <div className="flex gap-3">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                      <Image src={o.items[0]!.image} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-ink-900">{o.items[0]!.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        <span className="font-mono">{o.id}</span>, {formatINR(o.total)}, placed {formatDayMonth(o.placedAt)}
                      </p>
                      <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" className="mt-1.5" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {issuesFor(o.status).map((i) => (
                      <Link key={i} href={`/account/orders/${o.id}`} className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-xs font-medium text-ink-700 hover:bg-ink-50">
                        {i}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Topics */}
        {!q && (
          <section aria-labelledby="help-topics" className="mt-12">
            <h2 id="help-topics" className="text-lg font-semibold text-ink-900">
              Browse help topics
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {HELP_TOPICS.map((t) => (
                <li key={t.title}>
                  <Link href={t.href} className="group flex h-full gap-3.5 rounded-2xl border border-line p-4 transition-colors hover:border-ink-300">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <NamedIcon name={t.icon} size={19} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900 group-hover:text-brand-700">{t.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">{t.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0">
            {/* FAQs */}
            <section aria-labelledby="help-faq">
              <h2 id="help-faq" className="text-lg font-semibold text-ink-900">
                {q ? `${faqs.length} answer${faqs.length === 1 ? "" : "s"} for "${q}"` : "Frequently asked questions"}
              </h2>
              {q && (
                <Link href="/help" className="mt-1 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
                  Clear search
                </Link>
              )}
              <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
                {faqs.map((f, i) => (
                  <details key={f.id} id={`faq-${f.id}`} open={!!q && i === 0} className="group scroll-mt-28 px-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="mb-0.5 block text-xs font-medium text-ink-500">{f.group}</span>
                        {f.q}
                      </span>
                      <ChevronDown size={18} className="shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="pb-5 text-sm leading-relaxed text-ink-600">{f.a}</p>
                  </details>
                ))}
                {faqs.length === 0 && <p className="px-5 py-8 text-sm text-ink-500">No articles match. Try different words or contact us below.</p>}
              </div>
            </section>

            {/* Policies */}
            <section aria-labelledby="help-policies" className="mt-14">
              <h2 id="help-policies" className="text-lg font-semibold text-ink-900">
                Policies
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                <article id="returns" className="scroll-mt-28 rounded-2xl border border-line p-5 lg:p-6">
                  <h3 className="text-base font-semibold text-ink-900">Returns and refunds</h3>
                  <p className="mt-1 text-sm text-ink-600">Windows are counted from the delivery date. Doorstep pickup is free.</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-ink-50 text-xs text-ink-500">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Category</th>
                          <th className="px-4 py-2.5 font-medium">Window</th>
                          <th className="px-4 py-2.5 font-medium">Resolution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {RETURN_WINDOWS.map(([c, w, r]) => (
                          <tr key={c}>
                            <td className="px-4 py-2.5 text-ink-800">{c}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-ink-900 tabular-nums">{w}</td>
                            <td className="px-4 py-2.5 text-ink-600">{r}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
                    Innerwear, hygiene products, opened consumables, personalised items and gift cards are not returnable, but damaged, defective or wrong items can always be
                    reported within 7 days.
                  </p>
                  <Link href="/policies/returns" className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 hover:underline">
                    Read the full returns policy
                  </Link>
                </article>
                {[
                  { id: "shipping", title: "Shipping and delivery", body: "Orders confirmed before 2 pm count from the same day. Delivery is free for orders of ₹499 or more, otherwise ₹40 per order, always shown before you pay. Promise dates are calculated for your pincode and shown on every product." },
                  { id: "cancellation", title: "Cancellation", body: "Cancel any item before it ships for a full refund and no fee. Once shipped, you can request cancellation and the parcel returns to us, or refuse it at the door. Prepaid refunds start within 1 hour, and AltasGoods Credits are restored immediately." },
                  { id: "payments", title: "Payments", body: "Pay by UPI, credit or debit card, net banking, EMI, AltasGoods Pay Later, AltasGoods Credits and gift cards, or pay on delivery for orders up to ₹50,000. Card numbers are never stored by AltasGoods; saved cards are tokenised by our payment partner. Failed payments are reversed automatically within 1 business day." },
                  { id: "credits", title: "AltasGoods Credits and gift cards", body: "Refund credits never expire and can be moved back to your bank. Gift cards are valid for 1 year from activation and cannot be reloaded or encashed. Both can be used on any order at checkout." },
                  { id: "guarantee", title: "AltasGoods Guarantee", body: "If an item does not arrive, arrives materially different, or a refund is not issued, open a return or contact us first. If it is not resolved within 48 hours, file a claim from the order page within 90 days of the latest promised delivery date and AltasGoods decides." },
                  { id: "terms", title: "Terms of use", body: "AltasGoods is operated by AltasGoods Commerce Private Limited, which sells and ships every product on the store. Prices include GST, and we issue one tax invoice for each order." },
                  { id: "privacy", title: "Privacy", body: "We collect only what we need to deliver your orders and keep your account safe, under the Digital Personal Data Protection Act, 2023. Promotional messages need your consent, which you can withdraw any time. Download or delete your data from Account, then Privacy and data." },
                  { id: "account", title: "Account and sign in", body: "Sign in with your mobile number and a one-time password. Changing your mobile number needs codes sent to both the old and new numbers. AltasGoods will never ask for your OTP, PIN or card details on a call." },
                ].map((p) => (
                  <article key={p.id} id={p.id} className="scroll-mt-28 rounded-2xl border border-line p-5 lg:p-6">
                    <h3 className="text-base font-semibold text-ink-900">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{p.body}</p>
                    <Link
                      href={`/policies/${p.id === "account" ? "account-security" : p.id}`}
                      className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 hover:underline"
                    >
                      Read the full policy
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section id="about" aria-labelledby="help-about" className="mt-14 scroll-mt-28 rounded-2xl bg-ink-50 p-5 lg:p-6">
              <h2 id="help-about" className="text-base font-semibold text-ink-900">
                About AltasGoods
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                AltasGoods is a calmer Indian store built in Bengaluru, selling and shipping every product itself. Our promise: honest prices,
                real delivery dates and no hidden charges. {COMPANY.legalName}, CIN {COMPANY.cin}.
              </p>
              <Link href="/about" className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 hover:underline">
                More about AltasGoods
              </Link>
            </section>
          </div>

          {/* Contact and grievance */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <section id="contact" aria-labelledby="help-contact" className="scroll-mt-28 rounded-2xl border border-line p-5">
              <h2 id="help-contact" className="text-base font-semibold text-ink-900">
                Contact us
              </h2>
              <p className="mt-1 text-[13px] text-ink-500">Self-service is fastest, but we are here when you need a person.</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {[
                  { icon: MessageCircle, title: "Chat with us", body: "Typical reply in 2 minutes", href: "/contact" },
                  { icon: PhoneCall, title: "Request a call back", body: "Pick a time, we call you", href: "/contact#call-back" },
                  { icon: Headset, title: `Call ${COMPANY.customerCare}`, body: `Toll free, ${COMPANY.customerCareHours}`, href: `tel:${COMPANY.customerCare.replace(/\s/g, "")}` },
                  { icon: Mail, title: COMPANY.email, body: "Reply within 24 hours", href: `mailto:${COMPANY.email}` },
                ].map((c) => (
                  <li key={c.title}>
                    <a href={c.href} className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-ink-300">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
                        <c.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink-900">{c.title}</span>
                        <span className="block text-xs text-ink-500">{c.body}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section id="grievance" aria-labelledby="help-grievance" className="scroll-mt-28 rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
              <h2 id="help-grievance" className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Scale size={17} className="text-brand-700" aria-hidden="true" /> Grievance redressal
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                Not happy with how we resolved your issue? Write to our Grievance Officer, appointed under the Consumer Protection (E-Commerce) Rules, 2020.
              </p>
              <dl className="mt-4 flex flex-col gap-2.5 text-[13px]">
                <div>
                  <dt className="text-ink-500">Grievance Officer</dt>
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
                  <dt className="text-ink-500">Address</dt>
                  <dd className="text-ink-900">{GRIEVANCE_OFFICER.address}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Hours</dt>
                  <dd className="text-ink-900">{GRIEVANCE_OFFICER.hours}</dd>
                </div>
              </dl>
              <ul className="mt-4 flex flex-col gap-2 border-t border-brand-100 pt-4 text-[13px] text-ink-700">
                <li className="flex items-center gap-2">
                  <Clock size={14} className="text-brand-700" aria-hidden="true" /> Acknowledged within {GRIEVANCE_OFFICER.ackHours} hours
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-brand-700" aria-hidden="true" /> Resolved within one month of receipt
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
