import Link from "next/link";
import { ArrowRight, Check, CircleAlert, CircleCheck, CircleX, ShieldCheck } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { Sparkline } from "@/components/charts/static";
import { ToastButton } from "@/components/seller/client-kit";
import { Callout, TargetMeter } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { bandFor, HEALTH_BANDS, healthMetrics, scoreHistory, SELLER, TIERS, tierProgress, VIOLATION_STATUS, violations } from "@/lib/mock/seller-extra";
import { cn, formatCompact, formatDate, formatDateShort } from "@/lib/utils";

export const metadata = { title: "Account health" };

const LADDER = ["Warning", "Listing action", "Feature restrictions", "Payout hold", "Suspension", "Deactivation"];
const BAND_COLOR: Record<string, string> = { CRITICAL: "bg-danger-600", POOR: "bg-danger-500", FAIR: "bg-warning-500", GOOD: "bg-success-500", EXCELLENT: "bg-success-600" };

function fmtGate(v: number, f: "inr" | "pct" | "num" | "rating") {
  if (f === "inr") return formatCompact(v, true);
  if (f === "pct") return `${v.toFixed(2)}%`;
  if (f === "rating") return v.toFixed(1);
  return String(v);
}

export default function PerformancePage() {
  const h = SELLER.health;
  const band = bandFor(h.score);
  const next = [...HEALTH_BANDS].reverse().find((b) => b.min > h.score);
  const offTarget = healthMetrics.filter((m) => (m.comparator === "under" ? m.value >= m.target : m.value < m.target));
  const gates = tierProgress.gates.map((g) => ({ ...g, ok: g.comparator === "under" ? g.value < g.target : g.value >= g.target }));
  const failing = gates.filter((g) => !g.ok);
  const tierIndex = TIERS.findIndex((t) => t.key === tierProgress.current);
  const history = scoreHistory.map((s) => ({ label: formatDateShort(s.label), score: s.score }));

  return (
    <>
      <PageHeader
        title="Account health"
        description="AltasGoods Seller Health: a 0 to 1000 score built from your performance metrics and policy compliance. It decides your access to deals, ads, the Assured badge and the featured offer."
        actions={
          <ToastButton icon="download" message="Account health report for the last 180 days is being prepared.">
            Download report
          </ToastButton>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-ink-500">Seller Health score</p>
              <Badge tone={band.tone} dot>
                {band.label}
              </Badge>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-[48px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{h.score}</p>
              <p className="pb-1.5 text-sm text-ink-500">of 1000</p>
            </div>
            <div className="relative mt-5">
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Score ${h.score}, band ${band.label}`}>
                {[...HEALTH_BANDS].reverse().map((b) => (
                  <span key={b.key} className={cn("h-full", BAND_COLOR[b.key], b.key !== band.key && "opacity-35")} style={{ width: "20%" }} />
                ))}
              </div>
              <span className="absolute -top-1.5 h-[22px] w-1 -translate-x-1/2 rounded-full bg-ink-900 ring-2 ring-white" style={{ left: `${h.score / 10}%` }} aria-hidden="true" />
              <div className="mt-2 flex justify-between text-[11px] text-ink-500">
                {["Critical", "Poor", "Fair", "Good", "Excellent"].map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-ink-600">
              {next ? (
                <>
                  <span className="font-medium text-ink-900">{next.min - h.score} points from {next.label}.</span> You recover 10 points every week all metrics stay on target.
                </>
              ) : (
                "Top band. Keep every metric on target to stay here."
              )}
            </p>
          </div>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Score history" description="Weekly evaluations, last 12 weeks" action={<Badge tone="success">+{h.score - scoreHistory[0]!.score} points</Badge>} />
          <div className="px-5 pt-4 pb-5">
            <AreaChart data={history} series={[{ key: "score", label: "Seller Health score" }]} height={210} ariaLabel="Seller Health score by week" />
            <p className="mt-2 text-xs text-ink-500">The dip in early August came from 2 weeks above the late dispatch target during the Plus Day backlog (30 points each).</p>
          </div>
        </Card>
      </div>

      {offTarget.length === 0 ? (
        <Callout tone="success" icon={ShieldCheck} className="mb-6" title="Every metric is on target">
          Keep it up: no deductions at this week&apos;s evaluation on Monday.
        </Callout>
      ) : (
        <Callout tone="warning" icon={CircleAlert} className="mb-6" title={`${offTarget.length} metric off target`}>
          Each metric outside its target costs 30 points at the weekly evaluation.
        </Callout>
      )}

      <h2 className="mb-3 text-base font-semibold text-ink-900">Performance metrics</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {healthMetrics.map((m) => {
          const ok = m.comparator === "under" ? m.value < m.target : m.value >= m.target;
          const headroom = m.comparator === "under" ? m.target - m.value : m.value - m.target;
          const tight = ok && headroom / m.target < 0.3;
          return (
            <Card key={m.key} className="flex min-w-0 flex-col">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink-700">{m.label}</p>
                  <Badge size="sm" tone={!ok ? "danger" : tight ? "warning" : "success"}>
                    {!ok ? "Off target" : tight ? "Close to limit" : "On target"}
                  </Badge>
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-3">
                  <p className="text-[28px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{m.value.toFixed(2)}%</p>
                  <Sparkline values={m.trend} tone={ok ? "brand" : "danger"} />
                </div>
                <p className="mt-1.5 text-xs text-ink-500">
                  Target {m.comparator} {m.target}% over {m.window}. Applies to {m.appliesTo === "All orders" ? "all orders" : m.appliesTo}.
                </p>
                <TargetMeter value={m.value} target={m.target} comparator={m.comparator} max={m.comparator === "over" ? 100 : undefined} className="mt-4" />
                <p className="mt-4 text-xs leading-relaxed text-ink-600">{m.definition}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">{m.consequence}</p>
              </div>
              <Link href="/seller/orders?tab=delivered" className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] font-medium text-brand-700 hover:bg-ink-50/60">
                {m.affected} affected orders
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </Card>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader
            title="Policy compliance"
            description="Violations in the last 180 days. Points are restored when an appeal is accepted."
            action={<Badge tone={h.policyViolations ? "warning" : "success"}>{h.policyViolations ? `${h.policyViolations} open` : "No open violations"}</Badge>}
          />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {violations.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink-900">{v.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {v.category}, {v.severity.toLowerCase()} severity, {formatDate(v.at)}, <span className="font-mono">{v.id}</span>
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-600">{v.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <StatusBadge meta={VIOLATION_STATUS[v.status]} size="sm" />
                  <span className="text-xs text-ink-500 tabular-nums">{v.status === "appeal_accepted" ? `${v.points} points restored` : `${v.points} points`}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Consequence ladder" description="Each step notifies you with the reason and how to appeal" />
          <ol className="flex flex-col gap-0 px-5 pt-4 pb-5">
            {LADDER.map((step, i) => (
              <li key={step} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < LADDER.length - 1 && <span className="absolute top-6 left-[11px] h-full w-px bg-line-strong" aria-hidden="true" />}
                <span className={cn("relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", i === 0 ? "bg-warning-50 text-warning-700" : i >= 4 ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-600")}>{i + 1}</span>
                <span className="pt-0.5 text-[13px] text-ink-700">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink-900">Seller tier</h2>
      <Card className="mb-6">
        <div className="p-5">
          <ol className="grid grid-cols-4 gap-2" aria-label="Tier progress">
            {TIERS.map((t, i) => (
              <li key={t.key}>
                <div className={cn("h-1.5 rounded-full", i <= tierIndex ? "bg-brand-600" : "bg-ink-200")} />
                <p className={cn("mt-2 text-[13px] font-medium", i === tierIndex ? "text-brand-700" : i < tierIndex ? "text-ink-700" : "text-ink-500")}>
                  {t.key}
                  {i === tierIndex && <span className="ml-1.5 text-xs font-normal text-ink-500">current</span>}
                </p>
              </li>
            ))}
          </ol>
          {failing.length > 0 && (
            <Callout tone="warning" icon={CircleAlert} className="mt-5" title={`${failing.length} of ${gates.length} Platinum quality gates are not met`}>
              {(() => {
                const t = failing.map((g) => g.label.toLowerCase()).join(" and ");
                return t.charAt(0).toUpperCase() + t.slice(1);
              })()}{" "}
              {failing.length === 1 ? "is" : "are"} outside the Platinum gate. If {failing.length === 1 ? "it stays" : "they stay"} there at the evaluation on {formatDate(tierProgress.evaluation)}, you move to the highest tier whose gates you meet. Late dispatch of {SELLER.health.lateDispatchRate}% currently fits Silver.
            </Callout>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {gates.map((g) => (
              <div key={g.label} className={cn("rounded-xl border px-4 py-3", g.ok ? "border-line" : "border-danger-100 bg-danger-50/40")}>
                <p className="flex items-center gap-1.5 text-xs text-ink-500">
                  {g.ok ? <CircleCheck size={13} className="text-success-600" aria-hidden="true" /> : <CircleX size={13} className="text-danger-600" aria-hidden="true" />}
                  {g.label}
                </p>
                <p className="mt-1.5 text-[17px] font-semibold text-ink-900 tabular-nums">{fmtGate(g.value, g.format)}</p>
                <p className={cn("mt-0.5 text-xs", g.ok ? "text-ink-500" : "font-medium text-danger-700")}>
                  {g.ok ? "Met" : "Not met"}: {g.comparator} {fmtGate(g.target, g.format)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Window closes {formatDate(tierProgress.windowEnds)}. A Poor or Critical health band demotes immediately to Bronze; other gate misses wait for the quarterly evaluation.
          </p>
        </div>
        <TableContainer className="border-t border-line">
          <Table className="min-w-[860px]">
            <THead className="border-t-0">
              <TR className="hover:bg-transparent">
                <TH>Tier</TH>
                <TH>Scale, 90 days</TH>
                <TH>Quality gates</TH>
                <TH>Benefits</TH>
              </TR>
            </THead>
            <TBody>
              {TIERS.slice()
                .reverse()
                .map((t) => (
                  <TR key={t.key} className={cn(t.key === tierProgress.current && "bg-brand-50/40")}>
                    <TD className="font-medium text-ink-900">
                      {t.key}
                      {t.key === tierProgress.current && (
                        <Badge size="sm" tone="brand" className="ml-2">
                          You
                        </Badge>
                      )}
                    </TD>
                    <TD className="max-w-[14rem] text-[13px] whitespace-normal">{t.scale}</TD>
                    <TD className="max-w-[18rem] text-[13px] whitespace-normal">{t.gates}</TD>
                    <TD className="text-[13px] whitespace-normal">
                      <ul className="flex flex-col gap-1">
                        {t.benefits.map((b) => (
                          <li key={b} className="flex gap-1.5">
                            <Check size={13} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}
