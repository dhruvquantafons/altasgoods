import { Clock3, Gauge, Smile, Timer, TicketCheck } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { Sparkline } from "@/components/charts/static";
import { Dot } from "@/components/logistics/ops-ui";
import { PRESENCE } from "@/components/support/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { careAgents, careDaily, CURRENT_AGENT } from "@/lib/mock/ops-extra";
import { cn, formatDateShort, formatNumber, sum } from "@/lib/utils";

export const metadata = { title: "Team performance" };

const avg = (xs: number[]) => xs.reduce((a, v) => a + v, 0) / Math.max(1, xs.length);
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

export default function PerformancePage() {
  const last7 = careDaily.slice(-7);
  const prev7 = careDaily.slice(-14, -7);
  const resolved = sum(last7, (d) => d.resolved);
  const agents = [...careAgents].sort((a, b) => b.handled7d - a.handled7d);
  const volume = careDaily.map((d) => ({ label: formatDateShort(d.date), created: d.created, resolved: d.resolved }));
  const quality = careDaily.map((d) => ({ label: formatDateShort(d.date), csat: d.csat }));

  return (
    <>
      <PageHeader
        title="Team performance"
        description="Care Desk productivity and quality over the last 14 completed days. Today is excluded until the day closes."
        actions={<ToastButton label="Export report" icon="download" message="Team performance for 17 Sept to 30 Sept exported as CSV" size="md" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard label="Resolved, 7 days" value={formatNumber(resolved)} icon={TicketCheck} delta={pct(resolved, sum(prev7, (d) => d.resolved))} deltaLabel="vs previous 7 days" />
        <StatCard label="First response" value={`${avg(last7.map((d) => d.frtMins)).toFixed(1)} min`} icon={Timer} upIsGood={false} delta={pct(avg(last7.map((d) => d.frtMins)), avg(prev7.map((d) => d.frtMins)))} deltaLabel="vs previous 7 days" />
        <StatCard label="Handle time" value={`${avg(last7.map((d) => d.ahtMins)).toFixed(1)} min`} icon={Clock3} upIsGood={false} delta={pct(avg(last7.map((d) => d.ahtMins)), avg(prev7.map((d) => d.ahtMins)))} deltaLabel="vs previous 7 days" />
        <StatCard label="CSAT" value={`${avg(last7.map((d) => d.csat)).toFixed(1)}%`} icon={Smile} delta={pct(avg(last7.map((d) => d.csat)), avg(prev7.map((d) => d.csat)))} deltaLabel="vs previous 7 days" />
        <StatCard
          label="SLA met"
          value={`${avg(last7.map((d) => d.sla)).toFixed(1)}%`}
          icon={Gauge}
          delta={pct(avg(last7.map((d) => d.sla)), avg(prev7.map((d) => d.sla)))}
          deltaLabel="vs previous 7 days"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Volume" description="Tickets created and resolved per day. BluBuy Big Days started on 26 Sept." />
          <div className="px-5 pt-3 pb-5">
            <AreaChart
              data={volume}
              series={[
                { key: "created", label: "Created" },
                { key: "resolved", label: "Resolved", slot: 2 },
              ]}
              height={260}
              ariaLabel="Tickets created and resolved per day, last 14 completed days"
            />
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Customer satisfaction" description="Share of surveys rated 4 or 5" />
          <div className="px-5 pt-3 pb-5">
            <AreaChart data={quality} series={[{ key: "csat", label: "CSAT" }]} format="percent" height={260} ariaLabel="Daily CSAT percentage, last 14 completed days" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Agents" description="Last 7 days unless noted. QA is the average transcript score from sampled conversations." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Agent</TH>
                <TH align="right">Today</TH>
                <TH align="right">7 days</TH>
                <TH>Trend</TH>
                <TH align="right">First response</TH>
                <TH align="right">Handle time</TH>
                <TH align="right">CSAT</TH>
                <TH align="right">SLA</TH>
                <TH align="right">QA</TH>
              </TR>
            </THead>
            <TBody>
              {agents.map((a) => (
                <TR key={a.name}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="relative">
                        <Avatar name={a.fullName} size="sm" />
                        <Dot tone={PRESENCE[a.presence].tone} className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-white" />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-ink-900">
                          {a.fullName}
                          {a.name === CURRENT_AGENT.name && <span className="ml-1.5 text-xs font-normal text-ink-500">(you)</span>}
                        </p>
                        <p className="text-xs text-ink-500">
                          {a.level}, {a.team}, {PRESENCE[a.presence].label.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD align="right">{a.handledToday}</TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {a.handled7d}
                  </TD>
                  <TD>
                    <Sparkline values={a.trend} width={72} height={24} />
                  </TD>
                  <TD align="right" className={cn(a.frtMins > 4.5 && "text-warning-700")}>
                    {a.frtMins} min
                  </TD>
                  <TD align="right">{a.ahtMins} min</TD>
                  <TD align="right" className={cn(a.csat < 88 ? "text-warning-700" : "text-ink-900")}>
                    {a.csat}%
                  </TD>
                  <TD align="right" className={cn(a.sla < 92 && "text-warning-700")}>
                    {a.sla}%
                  </TD>
                  <TD align="right">{a.qa}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Values under target are highlighted: first response over 4.5 min, CSAT under 88%, SLA under 92%.</p>
      </Card>
    </>
  );
}
