import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/logistics/ops-client";
import { one, qs } from "@/components/logistics/ops-ui";
import { CATEGORIES, CHANNEL, slaText, slaTone } from "@/components/support/meta";
import { TicketInbox, type InboxRow } from "@/components/support/ticket-inbox";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { currentTime, isActiveTicket, loadAgents, slaOf, tickets } from "@/lib/api/support";
import { PRIORITY_POLICY } from "@/lib/mock/ops-extra";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketPriority } from "@/lib/status";
import type { Ticket } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Ticket inbox" };

const VIEWS = [
  { key: "open", label: "All open" },
  { key: "mine", label: "Assigned to me" },
  { key: "unassigned", label: "Unassigned" },
  { key: "escalated", label: "Escalated" },
  { key: "awaiting", label: "Awaiting customer" },
  { key: "resolved", label: "Resolved" },
] as const;

export default async function TicketsPage(props: PageProps<"/support/tickets">) {
  const sp = await props.searchParams;
  const view = VIEWS.find((v) => v.key === one(sp.view)) ?? VIEWS[0]!;
  const q = (one(sp.q) ?? "").trim();
  const priority = one(sp.priority) ?? "";
  const category = one(sp.category) ?? "";
  const channel = one(sp.channel) ?? "";

  const [{ tickets: found, counts }, agents] = await Promise.all([tickets({ view: view.key, q, priority, category, channel }), loadAgents()]);
  const now = currentTime();
  // waiting and answered tickets go last; the rest by next reply due
  const rank = (s: ReturnType<typeof slaOf>) => (s.state === "met" ? 2e6 : s.state === "paused" ? 1e6 : s.minsLeft);
  const list = found
    .map((t) => ({ t, sla: slaOf(t, now) }))
    .sort((a, b) => (view.key === "resolved" ? +new Date(b.t.updatedAt) - +new Date(a.t.updatedAt) : rank(a.sla) - rank(b.sla)));

  const rows: InboxRow[] = list.map(({ t, sla }) => {
    const last = t.lastMessage;
    return {
      id: t.id,
      subject: t.subject,
      preview: last ? `${last.kind === "CUSTOMER" ? "" : `${last.author}: `}${last.body}` : "",
      customer: t.customerName,
      orderId: t.orderId,
      category: t.category,
      channel: CHANNEL[t.channel].label,
      priority: TICKET_PRIORITY[t.priority],
      status: TICKET_STATUS[t.status],
      pcode: PRIORITY_POLICY[t.priority].code,
      sla: slaText(sla),
      slaTone: slaTone(sla),
      assignee: t.assignee,
      updated: timeAgo(last?.at ?? t.updatedAt, now),
      closed: !isActiveTicket(t),
    };
  });

  const params = { view: view.key === "open" ? undefined : view.key, q: q || undefined, priority: priority || undefined, category: category || undefined, channel: channel || undefined };
  const filtered = Boolean(q || priority || category || channel);
  const agentOptions = agents.map((a) => ({ id: a.id, name: a.name, label: `${a.name}, ${a.level}` }));

  return (
    <>
      <PageHeader
        title="Ticket inbox"
        description="Every customer ticket across chat, email, phone and app, with SLA countdowns."
        actions={
          <Link href={rows[0] ? `/support/tickets/${rows[0].id}` : "/support/tickets"} className={buttonClasses({ variant: "primary" })}>
            Pick next ticket
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-5 pt-1">
          <TabLinks
            active={view.key}
            items={VIEWS.map((v) => ({ key: v.key, label: v.label, href: `/support/tickets${qs({ ...params, view: v.key === "open" ? undefined : v.key })}`, count: counts[v.key] }))}
          />
        </div>
        <AutoSubmitForm action="/support/tickets" className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          {view.key !== "open" && <input type="hidden" name="view" value={view.key} />}
          <Input name="q" defaultValue={q} icon={Search} inputSize="sm" placeholder="Search ticket, customer or order" aria-label="Search tickets" className="w-full sm:w-72" />
          <Select name="priority" defaultValue={priority} selectSize="sm" aria-label="Priority" className="w-[calc(50%-4px)] sm:w-36">
            <option value="">All priorities</option>
            {(Object.keys(TICKET_PRIORITY) as TicketPriority[]).reverse().map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY[p].label} ({PRIORITY_POLICY[p].code})
              </option>
            ))}
          </Select>
          <Select name="category" defaultValue={category} selectSize="sm" aria-label="Category" className="w-[calc(50%-4px)] sm:w-44">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select name="channel" defaultValue={channel} selectSize="sm" aria-label="Channel" className="w-full sm:w-36">
            <option value="">All channels</option>
            {(Object.keys(CHANNEL) as Ticket["channel"][]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL[c].label}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Search
          </button>
          {filtered && (
            <Link href={`/support/tickets${qs({ view: params.view })}`} className="px-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Clear filters
            </Link>
          )}
        </AutoSubmitForm>
        {/* stays mounted when the last ticket leaves the view, so its confirmation is still shown */}
        <TicketInbox
          key={`${view.key}-${q}-${priority}-${category}-${channel}`}
          rows={rows}
          agents={agentOptions}
          empty={<EmptyState icon={Inbox} title="Nothing in this view" description={filtered ? "No tickets match these filters. Clear them to see the full queue." : "The queue is clear. New tickets will appear here."} className="border-t border-line" />}
        />
        <div className="border-t border-line px-5 py-3 text-[13px] text-ink-500">
          {rows.length} ticket{rows.length === 1 ? "" : "s"} in {view.label.toLowerCase()}. First response targets: P1 15 min, P2 1 h, P3 4 h, P4 24 h.
        </div>
      </Card>
    </>
  );
}
