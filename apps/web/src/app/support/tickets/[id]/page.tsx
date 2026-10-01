import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Crown, ShieldAlert } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { durationLabel, formatDay, formatDayTime, KeyRow, maskPhone, minsUntil, Mono } from "@/components/logistics/ops-ui";
import { CHANNEL, SlaBadge, slaTitle } from "@/components/support/meta";
import { ReplyComposer } from "@/components/support/reply-composer";
import { ThreadItem } from "@/components/support/thread";
import { TicketActions, TicketControls, type GuaranteeCheck } from "@/components/support/ticket-actions";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Progress, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { getOrder, sellerName, tickets } from "@/lib/mock";
import {
  careAgents,
  CURRENT_AGENT,
  isActiveTicket,
  macros,
  PRIORITY_POLICY,
  shipmentForOrder,
  SUPERVISOR,
  ticketCustomer,
  ticketsForCustomer,
  ticketSla,
  ticketThread,
} from "@/lib/mock/ops-extra";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPMENT_STATUS, TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus } from "@/lib/status";
import { addDays, cn, formatDate, formatINR, formatNumber, NOW, timeAgo } from "@/lib/utils";

export function generateStaticParams() {
  return tickets.map((t) => ({ id: t.id }));
}

export async function generateMetadata(props: PageProps<"/support/tickets/[id]">) {
  const { id } = await props.params;
  return { title: `Ticket ${id}` };
}

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u!.slice(0, 2)}${"*".repeat(Math.max(3, u!.length - 2))}@${d}`;
}

export default async function TicketWorkspace(props: PageProps<"/support/tickets/[id]">) {
  const { id } = await props.params;
  const t = tickets.find((x) => x.id === id);
  if (!t) notFound();

  const sla = ticketSla(t);
  const thread = ticketThread(t);
  const order = t.orderId ? getOrder(t.orderId) : undefined;
  const customer = ticketCustomer(t);
  const shipment = order ? shipmentForOrder(order.id) : undefined;
  const prior = ticketsForCustomer(t.customerName).filter((x) => x.id !== t.id);
  const active = isActiveTicket(t);
  const firstName = t.customerName.split(" ")[0]!;
  const queue = tickets.filter(isActiveTicket).sort((a, b) => ticketSla(a).minsLeft - ticketSla(b).minsLeft);
  const next = queue.find((x) => x.id !== t.id);

  const risk = customer?.riskScore ?? 0;
  const riskTone = risk >= 70 ? "danger" : risk >= 40 ? "warning" : "success";

  const guarantee: GuaranteeCheck[] = order
    ? [
        { label: `Within 90 days of the promised date (${formatDay(order.promisedBy)})`, ok: NOW.getTime() - new Date(order.promisedBy).getTime() < 90 * 86_400_000 },
        order.status === "delivered" || order.status === "return_requested"
          ? { label: "Delivered: claim covers damaged, defective, wrong or different items", ok: true }
          : { label: "Not delivered by the promised date plus 3 days", ok: NOW.getTime() > addDays(order.promisedBy, 3).getTime() },
        { label: "Customer contacted the seller or opened a return at least 48 hours ago", ok: minsUntil(t.createdAt) < -48 * 60 },
      ]
    : [];

  const statusOptions = (Object.keys(TICKET_STATUS) as TicketStatus[]).map((k) => ({ value: k, label: TICKET_STATUS[k].label }));
  const priorityOptions = (Object.keys(TICKET_PRIORITY) as TicketPriority[]).reverse().map((k) => ({ value: k, label: `${TICKET_PRIORITY[k].label} (${PRIORITY_POLICY[k].code})` }));
  const agentOptions = careAgents.map((a) => ({ value: a.name, label: `${a.fullName}, ${a.level}` }));
  const channel = CHANNEL[t.channel];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ticket inbox", href: "/support/tickets" }, { label: t.id }]}
        title={t.subject}
        meta={
          <>
            <Mono className="text-xs text-ink-500">{t.id}</Mono>
            <StatusBadge meta={TICKET_STATUS[t.status]} />
            <StatusBadge meta={TICKET_PRIORITY[t.priority]} />
            <Badge tone="neutral" icon={channel.icon}>
              {channel.label}
            </Badge>
            <span title={slaTitle(sla)}>
              <SlaBadge sla={sla} size="md" />
            </span>
          </>
        }
        actions={
          next && (
            <ButtonLink href={`/support/tickets/${next.id}`} variant="secondary" iconRight={ArrowRight}>
              Next in queue
            </ButtonLink>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[264px_minmax(0,1fr)_336px]">
        {/* Conversation */}
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 xl:col-start-2 xl:row-span-1">
          <Card>
            <CardHeader title="Conversation" description={`Started ${formatDayTime(t.createdAt)} by ${channel.label.toLowerCase()}, ${t.category.toLowerCase()}`} />
            <ol className="flex flex-col gap-4 px-5 pt-4 pb-5">
              {thread.map((m, i) => (
                <ThreadItem key={i} item={{ kind: m.kind, author: m.author, body: m.body, time: formatDayTime(m.at) }} />
              ))}
            </ol>
            <ReplyComposer
              channel={channel.label}
              agentName={CURRENT_AGENT.name}
              macros={macros.map((m) => ({ id: m.id, title: m.title, category: m.category, body: m.body }))}
              context={{
                first_name: firstName,
                order_id: order?.id ?? "your order",
                agent_name: CURRENT_AGENT.fullName.split(" ")[0]!,
                promise_date: order ? formatDay(addDays(NOW, 2)) : "the new date",
                refund_amount: order ? formatINR(order.total) : "the amount",
              }}
            />
          </Card>
        </div>

        {/* Properties and actions */}
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1 xl:col-start-1">
          <Card>
            <CardHeader title="SLA" description={`${PRIORITY_POLICY[t.priority].code}: reply within ${durationLabel(PRIORITY_POLICY[t.priority].firstResponseMins)}, resolve within ${PRIORITY_POLICY[t.priority].resolutionHours} h`} />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Next reply">
                <span className={cn(sla.state === "breached" ? "text-danger-700" : sla.state === "at_risk" ? "text-warning-700" : "text-ink-900")}>{sla.paused ? "Paused" : formatDayTime(sla.dueAt)}</span>
              </KeyRow>
              <KeyRow label="Resolve by">
                <span className={cn(sla.resolutionBreached ? "text-danger-700" : "text-ink-900")}>{formatDayTime(sla.resolutionDueAt)}</span>
              </KeyRow>
              <KeyRow label="First response">{sla.respondedAt ? timeAgo(sla.respondedAt) : <span className="text-warning-700">Not yet</span>}</KeyRow>
            </dl>
            {sla.resolutionBreached && (
              <p className="mx-5 mb-4 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">Resolution target passed. Escalate or resolve today.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Ticket" />
            <div className="px-5 pt-3 pb-5">
              <TicketControls status={t.status} priority={t.priority} assignee={t.assignee} statuses={statusOptions} priorities={priorityOptions} agents={agentOptions} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Actions" description="Allowed for this order and your limits" />
            <div className="px-5 pt-3 pb-5">
              <TicketActions
                ticketId={t.id}
                level={CURRENT_AGENT.level}
                limit={CURRENT_AGENT.refundLimit}
                supervisor={SUPERVISOR.name}
                guarantee={guarantee}
                customerFirstName={firstName}
                order={
                  order && {
                    id: order.id,
                    total: order.total,
                    paymentLabel: PAYMENT_METHOD[order.payment.method],
                    cod: order.payment.method === "cod",
                    items: order.items.map((it) => ({ id: it.id, title: it.title, price: it.price, quantity: it.quantity })),
                    seller: sellerName(order.items[0]!.sellerId),
                  }
                }
              />
            </div>
          </Card>
        </div>

        {/* Customer 360 and order context */}
        <div className="order-3 flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
          <Card>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <Avatar name={t.customerName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{t.customerName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {customer?.plusMember && (
                      <Badge tone="brand" size="sm" icon={Crown}>
                        BluBuy Plus
                      </Badge>
                    )}
                    {customer && customer.status !== "active" && (
                      <Badge tone="danger" size="sm" icon={ShieldAlert}>
                        {customer.status === "flagged" ? "Risk flagged" : "Blocked"}
                      </Badge>
                    )}
                    {customer && <span className="text-xs text-ink-500">Since {new Date(customer.joinedAt).getFullYear()}</span>}
                  </div>
                </div>
              </div>
              {customer && (
                <>
                  <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
                    {[
                      { label: "Orders", value: formatNumber(customer.orders) },
                      { label: "Lifetime value", value: formatINR(customer.lifetimeValue) },
                      { label: "Tickets", value: prior.length + 1 },
                    ].map((s) => (
                      <div key={s.label} className="bg-white px-2 py-2.5">
                        <dd className="text-[14px] font-semibold text-ink-900 tabular-nums">{s.value}</dd>
                        <dt className="text-[11px] text-ink-500">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-ink-600">Risk score</span>
                      <span className={cn("font-semibold tabular-nums", riskTone === "danger" ? "text-danger-700" : riskTone === "warning" ? "text-warning-700" : "text-success-700")}>
                        {risk} of 100, {riskTone === "danger" ? "high" : riskTone === "warning" ? "medium" : "low"}
                      </span>
                    </div>
                    <Progress value={risk} tone={riskTone} size="sm" className="mt-1.5" label="Customer risk score" />
                  </div>
                  <dl className="mt-3 border-t border-line pt-1">
                    <KeyRow label="Phone">
                      <Mono>{maskPhone(customer.phone)}</Mono>
                    </KeyRow>
                    <KeyRow label="Email">
                      <span className="font-mono text-[12px]">{maskEmail(customer.email)}</span>
                    </KeyRow>
                    <KeyRow label="City">
                      {customer.city}, {customer.state}
                    </KeyRow>
                    <KeyRow label="BluCoins">{formatNumber(customer.bluCoins)}</KeyRow>
                  </dl>
                  <Link href={`/support/customers/${customer.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                    Open customer profile <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
          </Card>

          {order ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    Order <Mono className="text-[13px] font-normal text-ink-600">{order.id}</Mono>
                  </span>
                }
                description={`Placed ${formatDate(order.placedAt)}, promised by ${formatDay(order.promisedBy)}`}
              />
              <div className="px-5 pt-3 pb-5">
                <StatusBadge meta={ORDER_STATUS[order.status]} />
                <ul className="mt-3 flex flex-col gap-3">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex gap-3">
                      <ProductImage src={it.image} alt="" size={44} rounded="md" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink-900">{it.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {it.quantity} x {formatINR(it.price)}, sold by {sellerName(it.sellerId)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 border-t border-line pt-1">
                  <KeyRow label="Payment">
                    <span className="flex flex-col items-end gap-1">
                      {PAYMENT_METHOD[order.payment.method]}
                      <StatusBadge meta={PAYMENT_STATUS[order.payment.status]} size="sm" />
                    </span>
                  </KeyRow>
                  <KeyRow label="Order total">{formatINR(order.total)}</KeyRow>
                  {shipment && (
                    <KeyRow label="Shipment">
                      <span className="flex flex-col items-end gap-1">
                        <Link href={`/logistics/shipments/${shipment.id}`} className="font-mono text-[13px] text-brand-700 hover:underline">
                          {shipment.id}
                        </Link>
                        <StatusBadge meta={SHIPMENT_STATUS[shipment.status]} size="sm" />
                      </span>
                    </KeyRow>
                  )}
                </dl>
                <p className="mt-4 mb-2 text-xs font-semibold tracking-[0.05em] text-ink-500 uppercase">Timeline</p>
                <Timeline
                  items={[...order.timeline]
                    .reverse()
                    .slice(0, 5)
                    .map((e, i) => ({
                      title: e.label,
                      time: formatDayTime(e.at),
                      description: e.location,
                      tone: i === 0 ? (e.status === "delivered" ? "success" : e.status === "undelivered" || e.status === "cancelled" ? "warning" : "brand") : "neutral",
                    }))}
                />
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="No linked order" description="Account tickets are not tied to an order. Search orders to link one." />
              <div className="px-5 pt-3 pb-5">
                <ButtonLink href="/support/orders" variant="secondary" size="sm">
                  Order lookup
                </ButtonLink>
              </div>
            </Card>
          )}

          {prior.length > 0 && (
            <Card>
              <CardHeader title="Previous tickets" />
              <ul className="divide-y divide-line px-5 pt-1 pb-2">
                {prior.slice(0, 4).map((p) => (
                  <li key={p.id} className="py-2.5">
                    <Link href={`/support/tickets/${p.id}`} className="group block">
                      <span className="flex items-center justify-between gap-2">
                        <Mono className="text-xs text-ink-500">{p.id}</Mono>
                        <StatusBadge meta={TICKET_STATUS[p.status]} size="sm" />
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-800 group-hover:text-brand-700">{p.subject}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {!active && <p className="mt-6 text-center text-xs text-ink-500">This ticket is {TICKET_STATUS[t.status].label.toLowerCase()}. Replies from the customer within 7 days reopen it.</p>}
    </>
  );
}
