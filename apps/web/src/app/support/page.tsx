import Link from "next/link";
import { ArrowRight, Clock3, Gauge, Inbox, MessagesSquare, Smile, Timer } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { BarList, StackedBar } from "@/components/charts/static";
import { CardLink, Dot, formatTime, Mono } from "@/components/logistics/ops-ui";
import { CHANNEL, PRESENCE, SlaBadge } from "@/components/support/meta";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { tickets } from "@/lib/mock";
import { careAgents, careDaily, careToday, CURRENT_AGENT, isActiveTicket, ticketSla } from "@/lib/mock/ops-extra";
import { TICKET_PRIORITY } from "@/lib/status";
import { cn, formatDateShort, formatNumber, formatWeekday, NOW } from "@/lib/utils";

export const metadata = { title: "Overview" };

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

export default function CareDeskOverview() {
  const active = tickets.filter(isActiveTicket);
  const unassigned = active.filter((t) => !t.assignee);
  const withSla = active.map((t) => ({ t, sla: ticketSla(t) }));
  const atRisk = withSla.filter((x) => x.sla.state === "breached" || x.sla.state === "at_risk").sort((a, b) => a.sla.minsLeft - b.sla.minsLeft);
  const y = careDaily.at(-1)!;
  const next = atRisk[0]?.t ?? active[0]!;

  const chart = careDaily.map((d) => ({ label: formatDateShort(d.date), created: d.created, resolved: d.resolved }));
  const byCategory = Object.entries(
    active.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value, href: `/support/tickets?category=${encodeURIComponent(label)}` }))
    .sort((a, b) => b.value - a.value);
  const byChannel = (Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((c) => ({ label: CHANNEL[c].label, value: active.filter((t) => t.channel === c).length }));
  const online = careAgents.filter((a) => a.presence === "online" || a.presence === "busy");
  const hour = Math.floor(((NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440) / 60);

  return (
    <>
      <PageHeader
        title={`${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${CURRENT_AGENT.fullName.split(" ")[0]}`}
        description={`Care Desk queue health for ${formatWeekday(NOW)}, live as of ${formatTime(NOW)}.`}
        actions={
          <>
            <ButtonLink href="/support/tickets" variant="secondary" icon={Inbox}>
              Open inbox
            </ButtonLink>
            <ButtonLink href={`/support/tickets/${next.id}`} iconRight={ArrowRight}>
              Pick next ticket
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard
          label="Open queue"
          value={active.filter((t) => t.status !== "awaiting_customer").length}
          icon={Inbox}
          footer={`${unassigned.length} unassigned, ${active.filter((t) => t.status === "awaiting_customer").length} awaiting customer`}
          href="/support/tickets"
        />
        <StatCard label="First response" value={`${careToday.frtMins} min`} icon={Timer} delta={pct(careToday.frtMins, y.frtMins)} upIsGood={false} deltaLabel="vs yesterday" />
        <StatCard label="Resolution time" value={`${careToday.resolutionHrs} h`} icon={Clock3} delta={pct(careToday.resolutionHrs, y.resolutionHrs)} upIsGood={false} deltaLabel="vs yesterday" />
        <StatCard label="SLA compliance" value={`${careToday.sla}%`} icon={Gauge} delta={pct(careToday.sla, y.sla)} deltaLabel="vs yesterday" />
        <StatCard label="CSAT" value={`${careToday.csat}%`} icon={Smile} delta={pct(careToday.csat, y.csat)} deltaLabel="vs yesterday" className="col-span-2 md:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="SLA at risk"
              description="Overdue or due within the hour, most urgent first"
              action={
                <Badge tone={atRisk.some((x) => x.sla.state === "breached") ? "danger" : "warning"}>
                  {atRisk.length} ticket{atRisk.length === 1 ? "" : "s"}
                </Badge>
              }
            />
            <ul className="mt-2 divide-y divide-line">
              {atRisk.slice(0, 8).map(({ t, sla }) => {
                const Ch = CHANNEL[t.channel].icon;
                return (
                  <li key={t.id}>
                    <Link href={`/support/tickets/${t.id}`} className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-ink-50/70 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Mono className="text-xs text-ink-500">{t.id}</Mono>
                          <StatusBadge meta={TICKET_PRIORITY[t.priority]} size="sm" />
                          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                            <Ch size={13} aria-hidden="true" />
                            {CHANNEL[t.channel].label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[13px] font-medium text-ink-900">{t.subject}</p>
                        <p className="truncate text-xs text-ink-500">
                          {t.customerName}, {t.assignee ?? "Unassigned"}
                        </p>
                      </div>
                      <SlaBadge sla={sla} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Contacts, last 14 days" description="Tickets created and resolved per day, completed days only" action={<CardLink href="/support/performance">Team performance</CardLink>} />
            <div className="px-5 pt-3 pb-5">
              <AreaChart
                data={chart}
                series={[
                  { key: "created", label: "Created" },
                  { key: "resolved", label: "Resolved", slot: 2 },
                ]}
                height={240}
                ariaLabel="Tickets created and resolved per day over the last 14 completed days"
              />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Agent availability" description={`${online.length} of ${careAgents.length} agents signed in`} />
            <ul className="mt-2 divide-y divide-line">
              {careAgents.map((a) => {
                const load = tickets.filter((t) => isActiveTicket(t) && t.assignee === a.name).length;
                return (
                  <li key={a.name} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="relative">
                      <Avatar name={a.fullName} size="sm" />
                      <Dot tone={PRESENCE[a.presence].tone} className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">
                        {a.fullName}
                        {a.name === CURRENT_AGENT.name && <span className="ml-1.5 text-xs font-normal text-ink-500">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {a.presence === "online" && a.activeChats >= a.capacity ? "At chat capacity" : PRESENCE[a.presence].label}, {a.level}, {a.team}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-ink-900 tabular-nums">{load} open</p>
                      <p className="text-xs text-ink-500 tabular-nums">
                        {a.activeChats}/{a.capacity} chats
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Open tickets by category" />
            <div className="px-5 pt-4 pb-5">
              <BarList items={byCategory} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Channel mix" description="Open tickets by contact channel" action={<MessagesSquare size={17} className="text-ink-400" aria-hidden="true" />} />
            <div className="px-5 pt-4 pb-5">
              <StackedBar segments={byChannel} />
            </div>
          </Card>
        </div>
      </div>

      <p className={cn("mt-8 text-center text-xs text-ink-400")}>
        {formatNumber(careToday.created)} contacts today so far, {formatNumber(careToday.resolved)} resolved. Longest chat wait {careToday.longestWaitMins} min.
      </p>
    </>
  );
}
