import Link from "next/link";
import { ArrowRight, CheckCheck, Clock3, Inbox, MessagesSquare, Timer, UserX } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { BarList, StackedBar } from "@/components/charts/static";
import { durationLabel, formatTime, Mono } from "@/components/logistics/ops-ui";
import { CHANNEL, SlaBadge } from "@/components/support/meta";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { currentUser } from "@/lib/api/server";
import { currentTime, loadAgents, slaOf, tickets } from "@/lib/api/support";
import { TICKET_PRIORITY } from "@/lib/status";
import { formatDateShort, formatWeekday } from "@/lib/utils";

export const metadata = { title: "Overview" };

const DAY = 86_400_000;
const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default async function CareDeskOverview() {
  const [{ tickets: active }, { tickets: all }, agents, user] = await Promise.all([tickets({ view: "open" }), tickets({ view: "all" }), loadAgents(), currentUser()]);
  const now = currentTime();
  const unassigned = active.filter((t) => !t.assignee);
  const withSla = active.map((t) => ({ t, sla: slaOf(t, now) }));
  const atRisk = withSla.filter((x) => x.sla.state === "breached" || x.sla.state === "at_risk").sort((a, b) => a.sla.minsLeft - b.sla.minsLeft);
  const next = atRisk[0]?.t ?? unassigned[0] ?? active[0];

  // the last 7 days, from the tickets themselves
  const week = all.filter((t) => now - Date.parse(t.createdAt) < 7 * DAY);
  const firstResponse = average(week.filter((t) => t.firstResponseAt).map((t) => (Date.parse(t.firstResponseAt!) - Date.parse(t.createdAt)) / 60_000));
  const resolvedWeek = all.filter((t) => t.resolvedAt && now - Date.parse(t.resolvedAt) < 7 * DAY);
  const resolution = average(resolvedWeek.map((t) => (Date.parse(t.resolvedAt!) - Date.parse(t.createdAt)) / 3_600_000));

  const days = Array.from({ length: 14 }, (_, i) => new Date(now - (13 - i) * DAY));
  const sameDay = (iso: string, d: Date) => new Date(iso).toDateString() === d.toDateString();
  const chart = days.map((d) => ({
    label: formatDateShort(d.toISOString()),
    created: all.filter((t) => sameDay(t.createdAt, d)).length,
    resolved: all.filter((t) => t.resolvedAt && sameDay(t.resolvedAt, d)).length,
  }));

  const byCategory = Object.entries(
    active.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value, href: `/support/tickets?category=${encodeURIComponent(label)}` }))
    .sort((a, b) => b.value - a.value);
  const byChannel = (Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((c) => ({ label: CHANNEL[c].label, value: active.filter((t) => t.channel === c).length }));
  const team = agents.filter((a) => a.level !== "Admin").map((a) => ({ ...a, open: active.filter((t) => t.assigneeId === a.id).length }));

  const today = new Date(now);
  const hour = Math.floor(((today.getUTCHours() * 60 + today.getUTCMinutes() + 330) % 1440) / 60);

  return (
    <>
      <PageHeader
        title={`${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${(user?.name ?? "there").split(" ")[0]}`}
        description={`Care Desk queue for ${formatWeekday(today)}, as of ${formatTime(today)}.`}
        actions={
          <>
            <ButtonLink href="/support/tickets" variant="secondary" icon={Inbox}>
              Open inbox
            </ButtonLink>
            {next && (
              <ButtonLink href={`/support/tickets/${next.id}`} iconRight={ArrowRight}>
                Pick next ticket
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard
          label="Open queue"
          value={active.filter((t) => t.status !== "awaiting_customer").length}
          icon={Inbox}
          footer={`${active.filter((t) => t.status === "awaiting_customer").length} awaiting the customer`}
          href="/support/tickets"
        />
        <StatCard label="Unassigned" value={unassigned.length} icon={UserX} footer="Waiting for an agent" href="/support/tickets?view=unassigned" />
        <StatCard label="First response" value={firstResponse === null ? "None yet" : durationLabel(Math.round(firstResponse))} icon={Timer} footer="Average, tickets from the last 7 days" />
        <StatCard label="Resolution time" value={resolution === null ? "None yet" : `${resolution < 10 ? resolution.toFixed(1) : Math.round(resolution)} h`} icon={Clock3} footer="Average, resolved in the last 7 days" />
        <StatCard label="Resolved" value={resolvedWeek.length} icon={CheckCheck} footer="In the last 7 days" className="col-span-2 md:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Reply overdue or due soon"
              description="Most urgent first"
              action={
                atRisk.length ? (
                  <Badge tone={atRisk.some((x) => x.sla.state === "breached") ? "danger" : "warning"}>
                    {atRisk.length} ticket{atRisk.length === 1 ? "" : "s"}
                  </Badge>
                ) : undefined
              }
            />
            {atRisk.length === 0 ? (
              <EmptyState icon={CheckCheck} title="No replies are overdue" description="Every open ticket is inside its reply target." />
            ) : (
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
            )}
          </Card>

          <Card>
            <CardHeader title="Tickets, last 14 days" description="Created and resolved per day" />
            <div className="px-5 pt-3 pb-5">
              <AreaChart
                data={chart}
                series={[
                  { key: "created", label: "Created" },
                  { key: "resolved", label: "Resolved", slot: 2 },
                ]}
                height={240}
                ariaLabel="Tickets created and resolved per day over the last 14 days"
              />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Team workload" description="Open tickets assigned to each agent" />
            <ul className="mt-2 divide-y divide-line">
              {team.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={a.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">
                      {a.name}
                      {a.name === user?.name && <span className="ml-1.5 text-xs font-normal text-ink-500">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-ink-500">{a.level}</p>
                  </div>
                  <p className="text-[13px] font-medium text-ink-900 tabular-nums">{a.open} open</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Open tickets by category" />
            <div className="px-5 pt-4 pb-5">{byCategory.length ? <BarList items={byCategory} /> : <p className="text-sm text-ink-500">No open tickets.</p>}</div>
          </Card>

          <Card>
            <CardHeader title="Channel mix" description="Open tickets by contact channel" action={<MessagesSquare size={17} className="text-ink-400" aria-hidden="true" />} />
            <div className="px-5 pt-4 pb-5">
              <StackedBar segments={byChannel} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
