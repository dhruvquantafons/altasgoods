import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { durationLabel, formatDay, formatDayTime, KeyRow, maskPhone, Mono } from "@/components/logistics/ops-ui";
import { CHANNEL, SlaBadge, slaTitle } from "@/components/support/meta";
import { ReplyComposer } from "@/components/support/reply-composer";
import { ThreadItem } from "@/components/support/thread";
import { TicketActions, TicketControls, type GuaranteeCheck } from "@/components/support/ticket-actions";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { paise, uiItemStatus, uiOrderStatus, uiPaymentMethod, uiPaymentStatus } from "@/lib/api/format";
import { currentTime, isActiveTicket, loadAgents, loadCustomer, loadSupportOrder, loadTicket, slaOf, tickets, UI_TICKET_STATUS } from "@/lib/api/support";
import type { TicketDetail } from "@/lib/api/types";
import { MACROS, PRIORITY_POLICY } from "@/lib/care-policy";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, TICKET_PRIORITY, TICKET_STATUS, type TicketPriority } from "@/lib/status";
import { addDays, cn, formatDate, formatINR, formatNumber, timeAgo } from "@/lib/utils";

const EVENT_TEXT: Record<string, (from: string | null, to: string | null) => string> = {
  CREATED: () => "Ticket created",
  STATUS: (_f, t) => `Status set to ${t ? (TICKET_STATUS[UI_TICKET_STATUS[t as TicketDetail["status"]]]?.label ?? t) : "none"}`,
  PRIORITY: (_f, t) => `Priority set to ${t ? (TICKET_PRIORITY[t.toLowerCase() as TicketPriority]?.label ?? t) : "none"}`,
  ASSIGNEE: (_f, t) => (t ? `Assigned to ${t}` : "Unassigned"),
  ACTION: (_f, t) => `${(t ?? "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} raised`,
  APPROVAL: (_f, t) => `Refund ${t === "APPROVED" ? "approved" : "rejected"}`,
};

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
  const [{ ticket: t, detail }, agents, open] = await Promise.all([loadTicket(id), loadAgents(), tickets({ view: "open" })]);
  if (!t) notFound();

  const now = currentTime();
  const sla = slaOf(t, now);
  // an order in this database comes live; one from the imported history only has the ticket's snapshot
  const [order, customer, theirs] = await Promise.all([
    t.orderId ? loadSupportOrder(t.orderId) : null,
    t.customerId ? loadCustomer(t.customerId).catch(() => null) : null,
    t.customerId ? tickets({ view: "all", customerId: t.customerId }) : null,
  ]);
  const snapshot = detail.orderSnapshot;
  const prior = (theirs?.tickets ?? []).filter((x) => x.id !== t.id);
  const active = isActiveTicket(t);
  const firstName = t.customerName.split(" ")[0]!;
  const queue = open.tickets.map((x) => ({ x, sla: slaOf(x, now) })).sort((a, b) => (a.sla.state === "met" ? 1e9 : a.sla.minsLeft) - (b.sla.state === "met" ? 1e9 : b.sla.minsLeft));
  const next = queue.find((q) => q.x.id !== t.id)?.x;

  const contactedLongAgo = now - Date.parse(t.createdAt) > 48 * 3600_000;
  const promisedBy = order?.items.map((i) => i.promisedBy).sort().at(-1);
  const delivered = !!order?.items.some((i) => i.status === "DELIVERED" || i.status.startsWith("RETURN"));
  const guarantee: GuaranteeCheck[] = order && promisedBy
    ? [
        { label: `Within 90 days of the promised date (${formatDay(promisedBy)})`, ok: now - new Date(promisedBy).getTime() < 90 * 86_400_000 },
        delivered
          ? { label: "Delivered: claim covers damaged, defective, wrong or different items", ok: true }
          : { label: "Not delivered by the promised date plus 3 days", ok: now > addDays(promisedBy, 3).getTime() },
        { label: "Customer opened a return or contacted us at least 48 hours ago", ok: contactedLongAgo },
      ]
    : snapshot
      ? [
          { label: "Order placed on AltasGoods within the last 90 days", ok: true },
          { label: "Customer opened a return or contacted us at least 48 hours ago", ok: contactedLongAgo },
        ]
      : [];

  const statusOptions = [detail.status, ...detail.allowedStatuses].map((k) => ({ value: k, label: TICKET_STATUS[UI_TICKET_STATUS[k]].label }));
  const priorityOptions = (["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((k) => {
    const ui = k.toLowerCase() as TicketPriority;
    return { value: k, label: `${TICKET_PRIORITY[ui].label} (${PRIORITY_POLICY[ui].code})` };
  });
  const agentOptions = agents.map((a) => ({ value: a.id, label: `${a.name}, ${a.level}` }));
  const channel = CHANNEL[t.channel];
  const thread = detail.messages;

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
              {thread.map((m) => (
                <ThreadItem
                  key={m.id}
                  item={{ kind: m.kind.toLowerCase() as "customer" | "agent" | "system" | "note", author: m.author, body: m.body, time: formatDayTime(m.at), attachments: m.attachments }}
                />
              ))}
            </ol>
            <ReplyComposer
              ticketId={t.id}
              channel={channel.label}
              disabled={detail.status === "CLOSED"}
              macros={MACROS}
              context={{
                first_name: firstName,
                order_id: t.orderId ?? "your order",
                agent_name: detail.you.name.split(" ")[0]!,
                promise_date: formatDay(addDays(new Date(now), 2)),
                refund_amount: order ? paise(order.totalPaise) : snapshot ? formatINR(snapshot.total) : "the amount",
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
              <KeyRow label="First response">{sla.respondedAt ? timeAgo(sla.respondedAt, now) : <span className="text-warning-700">Not yet</span>}</KeyRow>
            </dl>
            {sla.resolutionBreached && (
              <p className="mx-5 mb-4 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">Resolution target passed. Escalate or resolve today.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Ticket" />
            <div className="px-5 pt-3 pb-5">
              <TicketControls
                key={`${detail.status}-${detail.priority}-${detail.assignee?.id ?? ""}`}
                ticketId={t.id}
                status={detail.status}
                priority={detail.priority}
                assigneeId={detail.assignee?.id}
                statuses={statusOptions}
                priorities={priorityOptions}
                agents={agentOptions}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Actions" description="Allowed for this order and your limits" />
            <div className="px-5 pt-3 pb-5">
              <TicketActions
                ticketId={t.id}
                level={detail.you.level}
                limit={detail.you.refundLimitPaise / 100}
                guarantee={guarantee}
                history={detail.actions}
                closed={detail.status === "CLOSED"}
                order={t.orderId && snapshot ? { id: t.orderId, ...snapshot } : undefined}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Activity" description="Every change is saved and logged" />
            <ol className="flex flex-col gap-2.5 px-5 pt-3 pb-5">
              {[...detail.events].reverse().slice(0, 12).map((e, i) => (
                <li key={`${e.at}-${i}`} className="text-[13px]">
                  <p className="text-ink-800">{(EVENT_TEXT[e.type] ?? (() => e.type))(e.fromValue, e.toValue)}</p>
                  <p className="text-xs text-ink-500">
                    {e.actor}, {formatDayTime(e.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Customer and order context */}
        <div className="order-3 flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
          <Card>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <Avatar name={t.customerName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{t.customerName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {customer?.status === "BLOCKED" && (
                      <Badge tone="danger" size="sm" icon={ShieldAlert}>
                        Blocked
                      </Badge>
                    )}
                    {customer ? <span className="text-xs text-ink-500">Since {new Date(customer.createdAt).getFullYear()}</span> : <span className="text-xs text-ink-500">No AltasGoods account linked</span>}
                  </div>
                </div>
              </div>
              {customer && (
                <>
                  <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
                    {[
                      { label: "Orders", value: formatNumber(customer.orderCount) },
                      { label: "Spent", value: paise(customer.spentPaise) },
                      { label: "Tickets", value: prior.length + 1 },
                    ].map((x) => (
                      <div key={x.label} className="bg-white px-2 py-2.5">
                        <dd className="text-[14px] font-semibold text-ink-900 tabular-nums">{x.value}</dd>
                        <dt className="text-[11px] text-ink-500">{x.label}</dt>
                      </div>
                    ))}
                  </dl>
                  <dl className="mt-3 border-t border-line pt-1">
                    <KeyRow label="Mobile">{customer.phone ? <Mono>{maskPhone(customer.phone)}</Mono> : "Not given"}</KeyRow>
                    <KeyRow label="Email">
                      <span className="font-mono text-[12px]">{maskEmail(customer.email)}</span>
                    </KeyRow>
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
                description={`Placed ${formatDate(order.placedAt)}${promisedBy ? `, promised by ${formatDay(promisedBy)}` : ""}`}
              />
              <div className="px-5 pt-3 pb-5">
                <StatusBadge meta={ORDER_STATUS[uiOrderStatus(order.status)]} />
                <ul className="mt-3 flex flex-col gap-3">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex gap-3">
                      <ProductImage src={it.image} alt="" size={44} rounded="md" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink-900">{it.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {it.qty} x {paise(it.unitPricePaise)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                          <StatusBadge meta={ORDER_STATUS[uiItemStatus(it.status)]} size="sm" />
                          {it.awb && <Mono className="text-[11px]">{it.awb}</Mono>}
                          {it.trackingUrl && (
                            <a href={it.trackingUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                              Track
                            </a>
                          )}
                        </div>
                        {it.trackingStatus && <p className="mt-0.5 text-xs text-ink-500">Latest scan: {it.trackingStatus}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 border-t border-line pt-1">
                  <KeyRow label="Payment">
                    <span className="flex flex-col items-end gap-1">
                      {PAYMENT_METHOD[uiPaymentMethod(order.paymentMethod)]}
                      <StatusBadge meta={PAYMENT_STATUS[uiPaymentStatus(order.paymentStatus)]} size="sm" />
                    </span>
                  </KeyRow>
                  <KeyRow label="Order total">{paise(order.totalPaise)}</KeyRow>
                </dl>
                {order.events.length > 0 && (
                  <>
                    <p className="mt-4 mb-2 text-xs font-semibold tracking-[0.05em] text-ink-500 uppercase">Latest</p>
                    <Timeline
                      items={[...order.events]
                        .reverse()
                        .slice(0, 5)
                        .map((e, i) => ({
                          title: e.toStatus.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
                          time: formatDayTime(e.at),
                          description: e.note ?? undefined,
                          tone: i === 0 ? (e.toStatus === "DELIVERED" ? "success" : e.toStatus === "CANCELLED" || e.toStatus.startsWith("RTO") ? "warning" : "brand") : "neutral",
                        }))}
                    />
                  </>
                )}
                <Link href={`/support/orders/${order.id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                  Open order <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : snapshot && t.orderId ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    Order <Mono className="text-[13px] font-normal text-ink-600">{t.orderId}</Mono>
                  </span>
                }
              />
              <div className="px-5 pt-3 pb-5">
                <ul className="flex flex-col gap-2">
                  {snapshot.items.map((it) => (
                    <li key={it.id} className="text-[13px]">
                      <p className="line-clamp-2 font-medium text-ink-900">{it.title}</p>
                      <p className="text-xs text-ink-500">
                        {it.quantity} x {formatINR(it.price)}
                      </p>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 border-t border-line pt-1">
                  <KeyRow label="Payment">{snapshot.paymentLabel}</KeyRow>
                  <KeyRow label="Order total">{formatINR(snapshot.total)}</KeyRow>
                </dl>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="No linked order" description="This ticket is not tied to an order. Look the order up to see its details." />
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
