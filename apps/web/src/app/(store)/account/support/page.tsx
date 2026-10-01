import Link from "next/link";
import { ChevronRight, CreditCard, Crown, Mail, Package, PhoneCall, ShieldCheck, Store, Undo2, UserRound } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { CUSTOMER_TICKET_STATUS, dateLabel, isActive, itemState, relativeDay, shortTitle, timeLabel } from "@/components/account/lib";
import { ChatButton, GuaranteeClaimButton, RaiseTicketButton } from "@/components/account/support-forms";
import { Notice, Panel } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { accountOrders, customerTickets, getAccountOrder, guaranteeClaims } from "@/lib/mock/account-extra";
import type { OrderStatus } from "@/lib/status";
import { formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Help and support" };

const TOPICS = [
  { key: "delivery", label: "Delivery and tracking", body: "Late, missing or marked delivered", icon: Package },
  { key: "return", label: "Returns and refunds", body: "Pickups, replacements, refund status", icon: Undo2 },
  { key: "payment", label: "Payments", body: "Charges, EMI, UPI and Pay Later", icon: CreditCard },
  { key: "account", label: "Account and security", body: "Sign-in, OTP, profile and privacy", icon: UserRound },
  { key: "plus", label: "BluBuy Plus", body: "Benefits, renewal and cancellation", icon: Crown },
  { key: "seller", label: "Report a seller", body: "Wrong items, fake products, conduct", icon: Store },
];

const TOPIC_CATEGORY: Record<string, string> = {
  delivery: "Delivery",
  return: "Return and refund",
  cancel: "Delivery",
  payment: "Payment",
  account: "Account",
  plus: "Other",
  seller: "Seller dispute",
};

function issuesFor(status: OrderStatus) {
  if (isActive(status)) return ["Where is my order?", "Change delivery date", "Cancel an item", "Payment question"];
  if (status === "delivered") return ["Return or replace", "Item damaged or wrong", "Did not receive it", "Invoice and warranty"];
  if (status === "cancelled") return ["Refund status", "Why was it cancelled?"];
  return ["Refund status", "Something else"];
}

export default async function SupportPage(props: PageProps<"/account/support">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const focusId = one(sp.order);
  const topic = one(sp.topic);
  const focus = focusId ? getAccountOrder(focusId) : undefined;
  const recent = [focus, ...accountOrders.filter((o) => o.id !== focus?.id)].filter((o): o is NonNullable<typeof o> => Boolean(o)).slice(0, 4);
  const orderOptions = accountOrders.slice(0, 12).map((o) => ({ id: o.id, label: `${o.id}, ${shortTitle(o.items[0]!.title)}` }));
  const openTickets = customerTickets.filter((t) => !["resolved", "closed"].includes(t.status));

  return (
    <>
      <PageHeader
        title="Help and support"
        description="Get help with an order in a couple of taps, or reach BluBuy Care any time, day or night."
        actions={
          <>
            <RaiseTicketButton orders={orderOptions} defaultOrderId={focus?.id} defaultCategory={topic ? TOPIC_CATEGORY[topic] : undefined} autoOpen={Boolean(topic && topic !== "guarantee")} />
            <ChatButton autoOpen={one(sp.chat) === "1"} orderLabel={focus?.id} />
          </>
        }
      />

      {openTickets.some((t) => t.status === "awaiting_customer") && (
        <Notice tone="warning" title="We are waiting for your reply" className="mb-6">
          Ticket {openTickets.find((t) => t.status === "awaiting_customer")!.id} needs a photo from you so we can finish looking into it.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Get help with a recent order" description="Pick an order and tell us what is wrong." bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {recent.map((o) => {
                const st = itemState(o, o.items[0]!);
                const highlighted = o.id === focus?.id;
                return (
                  <li key={o.id} className={highlighted ? "bg-brand-50/50" : undefined}>
                    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-3.5">
                        <ProductImage src={o.items[0]!.image} alt="" size={48} rounded="md" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/account/orders/${o.id}`} className="block truncate text-[13.5px] font-medium text-ink-900 hover:text-brand-700">
                            {o.items[0]!.title}
                            {o.items.length > 1 && <span className="font-normal text-ink-500"> and {o.items.length - 1} more</span>}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            <StatusBadge meta={st.meta} size="sm" />
                            <span className="font-mono text-[12px]">{o.id}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:pl-[62px]">
                        {issuesFor(o.status).map((q) => (
                          <Link
                            key={q}
                            href={q === "Return or replace" ? `/account/orders/${o.id}/return` : q === "Cancel an item" || q === "Where is my order?" ? `/account/orders/${o.id}` : `/account/support?order=${o.id}&chat=1`}
                            className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-[12.5px] font-medium text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                          >
                            {q}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line px-5 py-3 sm:px-6">
              <Link href="/account/orders" className="text-[13px] font-medium text-brand-700 hover:underline">
                Choose a different order
              </Link>
            </div>
          </Panel>

          <Panel title="My tickets" description={`${openTickets.length} open`} bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {customerTickets.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-ink-900">{t.subject}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <span className="font-mono text-[12px] text-ink-700">{t.id}</span> · {t.category}
                      {t.orderId && (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={`/account/orders/${t.orderId}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                            {t.orderId}
                          </Link>
                        </>
                      )}{" "}
                      · Opened {dateLabel(t.createdAt)}
                    </p>
                    <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
                      <span className="font-medium text-ink-900">{t.lastFrom}:</span> {t.lastMessage}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                    <StatusBadge meta={CUSTOMER_TICKET_STATUS[t.status]} size="sm" />
                    <p className="text-xs text-ink-500">Updated {timeAgo(t.updatedAt)}</p>
                    {t.responseDueAt && t.status === "in_progress" && (
                      <p className="text-xs text-ink-500">
                        Next update by {relativeDay(t.responseDueAt)}, {timeLabel(t.responseDueAt)}
                      </p>
                    )}
                    {t.status === "awaiting_customer" && <ActionButton label="Reply" icon="message" size="xs" variant="secondary" toast="Reply sent to BluBuy Care" doneLabel="Replied" />}
                    {t.status === "resolved" && <ActionButton label="Reopen" size="xs" variant="ghost" toast={`Ticket ${t.id} reopened`} doneLabel="Reopened" />}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Browse help topics">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOPICS.map((tp) => (
                <li key={tp.key}>
                  <Link href={`/account/support?topic=${tp.key}`} className="group flex h-full items-start gap-3 rounded-xl border border-line p-4 transition-colors hover:border-line-strong hover:bg-ink-50/50">
                    <IconTile icon={tp.icon} tone="neutral" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-700">{tp.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{tp.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-950 p-5 text-white sm:p-6">
            <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <p className="text-[13px] font-medium text-brand-200">BluBuy Care</p>
              <p className="mt-1 font-display text-lg font-semibold">Talk to a person, 24 x 7</p>
              <p className="mt-1.5 text-sm text-brand-100">Plus members get priority. Average wait right now is under a minute.</p>
              <div className="mt-4 flex flex-col gap-2">
                <ChatButton orderLabel={focus?.id} variant="secondary" className="w-full" />
                <ActionButton label="Request a call-back" icon="phone" variant="ghost" size="md" className="w-full text-white hover:bg-white/10" toast="We will call +91 98450 12345 within 15 minutes" doneLabel="Call-back booked" />
              </div>
            </div>
          </section>

          <Panel title="BluBuy Guarantee" action={<ShieldCheck size={18} className="text-brand-600" aria-hidden="true" />}>
            <p className="text-[13px] leading-relaxed text-ink-600">
              If an item never arrives, is not what was described, or a refund is not issued, we step in, whichever seller you bought from.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink-600">
              <li>· File within 90 days of the latest promised date</li>
              <li>· For damaged or different items, contact the seller first and wait 48 hours</li>
              <li>· We decide within 7 days and refund you directly</li>
            </ul>
            <GuaranteeClaimButton orders={orderOptions} defaultOrderId={focus?.id} autoOpen={topic === "guarantee"} className="mt-4 w-full" />
            {guaranteeClaims.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Past claims</p>
                {guaranteeClaims.map((c) => (
                  <div key={c.id} className="mt-2.5">
                    <p className="text-[13px] font-medium text-ink-900">{c.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <Badge size="sm" tone="success" dot>
                        {c.status}, {formatINR(c.amount)} refunded
                      </Badge>
                      <span>
                        <span className="font-mono">{c.id}</span> · {dateLabel(c.decidedAt)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Grievance Officer">
            <p className="text-[13px] leading-relaxed text-ink-600">Not happy with how we handled something? Our Grievance Officer acknowledges within 48 hours and resolves within 30 days.</p>
            <ul className="mt-3 flex flex-col gap-2 text-[13px] text-ink-700">
              <li className="font-medium text-ink-900">Meera Krishnan</li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-ink-400" aria-hidden="true" />
                grievance@blubuy.in
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall size={14} className="text-ink-400" aria-hidden="true" />
                1800 309 2580, 9 AM to 6 PM
              </li>
            </ul>
            <p className="mt-3 text-xs text-ink-500">BluBuy Commerce Private Limited, 7th Floor, Lakeview Tech Park, Bengaluru 560103</p>
          </Panel>
        </div>
      </div>
      <p className="mt-6 flex items-center justify-center gap-1 text-xs text-ink-500">
        Looking for something else?
        <Link href="/account" className="inline-flex items-center font-medium text-brand-700 hover:underline">
          Back to your account
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}
