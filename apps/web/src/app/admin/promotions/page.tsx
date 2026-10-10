import { CircleCheck, CircleX } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { EVENT_STATUS } from "@/components/admin/admin-status";
import { CreateCoupon } from "@/components/admin/create-coupon";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { coupons as allCoupons } from "@/lib/mock";

// seller-funded coupons in the demo data have no place in a single store
const coupons = allCoupons.filter((c) => c.fundedBy !== "seller");
import { dealSubmissions, saleEvents } from "@/lib/mock/admin-extra";
import { COUPON_STATUS } from "@/lib/status";
import { cn, formatCompact, formatDateShort, formatINR, formatNumber, NOW } from "@/lib/utils";

export const metadata = { title: "Coupons and sales" };

const RANGE_START = new Date("2026-07-01T00:00:00+05:30").getTime();
const RANGE_END = new Date("2027-01-01T00:00:00+05:30").getTime();
const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pos = (iso: string | number) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - RANGE_START) / (RANGE_END - RANGE_START)) * 100));
const BAR_LABEL = { ended: "Ended", live: "Live now", submissions_open: "Deals open", planning: "Planning" } as const;
const FUNDING = { blubuy: "AltasGoods funded", seller: "Brand funded", bank: "Bank funded" } as const;

function dealCheck(d: (typeof dealSubmissions)[number]) {
  const pct = Math.round(((d.low30d - d.dealPrice) / d.low30d) * 100);
  if (d.dealPrice > d.mrp) return { ok: false, pct, why: "Deal price above M.R.P." };
  if (pct < 0) return { ok: false, pct, why: "Above the 30 day low: pre-event price hike" };
  if (pct < d.requiredPct) return { ok: false, pct, why: `Only ${pct}% below the 30 day low, needs ${d.requiredPct}%` };
  return { ok: true, pct, why: `${pct}% below the 30 day low` };
}

export default function PromotionsPage() {
  const active = coupons.filter((c) => c.status === "active");
  const bigDays = coupons.filter((c) => c.startsAt.startsWith("2026-09-26"));
  const spend = coupons.filter((c) => c.fundedBy === "blubuy" && c.status !== "scheduled").reduce((a, c) => a + c.usage * (c.type === "flat" ? c.value : Math.min(c.maxDiscount ?? 500, 2400 * (c.value / 100))), 0);
  const pending = saleEvents.reduce((a, e) => a + e.dealsPending, 0);
  const today = pos(NOW.toISOString());

  return (
    <>
      <PageHeader title="Coupons and sales" description="Sale events, platform coupons and deal approvals. Deal prices must beat the 30 day low (no pre-event hikes) and never exceed M.R.P. (spec 10.16)." actions={<CreateCoupon />} />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Active coupons", value: active.length, hint: `${coupons.filter((c) => c.status === "scheduled").length} scheduled` },
          { label: "Big Days redemptions", value: formatCompact(bigDays.reduce((a, c) => a + c.usage, 0)), hint: "since 26 Sep" },
          { label: "AltasGoods-funded discount", value: formatCompact(spend, true), hint: "estimated, live coupons" },
          { label: "Deals awaiting approval", value: formatNumber(pending), hint: "across events", href: "#deals" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader title="Sale events" description="July to December 2026. Every deal is approved per category before it goes live." />
        {/* Timeline (md and up) */}
        <div className="hidden px-5 pt-4 pb-5 md:block">
          <div className="grid grid-cols-[220px_1fr] gap-x-4">
            <div />
            <div className="relative grid grid-cols-6 border-b border-line pb-2 text-xs text-ink-500">
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            {saleEvents.map((e) => {
              const left = pos(e.startsAt);
              const width = Math.max(1.2, pos(e.endsAt) - left);
              return [
                <div key={`${e.id}-label`} className="flex flex-col justify-center border-b border-line py-3">
                  <p className="text-[13px] font-medium text-ink-900">{e.name}</p>
                  <p className="text-xs text-ink-500">
                    {formatDateShort(e.startsAt)} to {formatDateShort(e.endsAt)}
                  </p>
                </div>,
                <div key={`${e.id}-track`} className="relative border-b border-line">
                  <div className="absolute inset-0 grid grid-cols-6" aria-hidden="true">
                    {MONTHS.map((m) => (
                      <span key={m} className="border-l border-line first:border-l-0" />
                    ))}
                  </div>
                  <div className="absolute inset-y-0 w-px bg-danger-500" style={{ left: `${today}%` }} aria-hidden="true" />
                  <div
                    className={cn(
                      "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold whitespace-nowrap",
                      e.status === "live" ? "bg-accent-400 text-ink-950" : e.status === "ended" ? "bg-ink-200 text-ink-700" : e.status === "submissions_open" ? "bg-brand-100 text-brand-800 ring-1 ring-brand-200 ring-inset" : "border border-dashed border-ink-300 bg-white text-ink-600",
                    )}
                    style={{ left: `min(${left}%, calc(100% - 88px))`, width: `${width}%`, minWidth: 88 }}
                  >
                    {BAR_LABEL[e.status]}
                  </div>
                </div>,
              ];
            })}
            <div />
            <p className="pt-2 text-xs text-ink-500">
              <span className="mr-1.5 inline-block h-3 w-px translate-y-0.5 bg-danger-500" aria-hidden="true" />
              Today, {formatDateShort(NOW)}
            </p>
          </div>
        </div>
        <div className="grid gap-px border-t border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {saleEvents.map((e) => (
            <div key={e.id} className="bg-surface px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink-900">{e.name}</p>
                <StatusBadge meta={EVENT_STATUS[e.status]} size="sm" />
              </div>
              <p className="mt-0.5 text-xs text-ink-500 md:hidden">
                {formatDateShort(e.startsAt)} to {formatDateShort(e.endsAt)}
              </p>
              <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-500">Deals approved</dt>
                  <dd className="font-medium tabular-nums">{formatNumber(e.dealsApproved)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Awaiting review</dt>
                  <dd className="font-medium tabular-nums">{formatNumber(e.dealsPending)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">{e.gmv ? "GMV" : "GMV target"}</dt>
                  <dd className="font-medium tabular-nums">{formatCompact(e.gmv ?? e.targetGmv, true)}</dd>
                </div>
              </dl>
              {e.gmv !== undefined && <Progress value={e.gmv} max={e.targetGmv} size="sm" tone={e.status === "live" ? "accent" : "success"} className="mt-2.5" label={`${e.name} GMV against target`} />}
              <p className="mt-2.5 text-xs text-ink-500">
                {e.status === "submissions_open" && e.submissionsClose ? `Deal submissions close ${formatDateShort(e.submissionsClose)}. ` : ""}
                {e.earlyAccess ? `Early access: ${e.earlyAccess}.` : "Phases not yet scheduled."}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Coupons" description="Store and bank coupons. A coupon ends automatically when its budget or limit is used." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH className="hidden lg:table-cell">Description</TH>
                <TH>Funding</TH>
                <TH align="right" className="hidden sm:table-cell">
                  Discount
                </TH>
                <TH align="right" className="hidden md:table-cell">
                  Min order
                </TH>
                <TH className="hidden md:table-cell">Usage</TH>
                <TH className="hidden xl:table-cell">Valid</TH>
                <TH>Status</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {coupons.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <span className="font-mono text-[13px] font-medium text-ink-900">{c.code}</span>
                  </TD>
                  <TD className="hidden max-w-[280px] truncate text-[13px] text-ink-600 lg:table-cell">{c.description}</TD>
                  <TD className="text-[13px]">{FUNDING[c.fundedBy]}</TD>
                  <TD align="right" className="hidden sm:table-cell">
                    {c.type === "percent" ? `${c.value}%` : formatINR(c.value)}
                    {c.maxDiscount && <p className="text-xs text-ink-500">up to {formatINR(c.maxDiscount)}</p>}
                  </TD>
                  <TD align="right" className="hidden md:table-cell">
                    {formatINR(c.minOrder)}
                  </TD>
                  <TD className="hidden md:table-cell">
                    <div className="w-32">
                      <p className="mb-1 text-xs text-ink-600 tabular-nums">
                        {formatNumber(c.usage)} of {formatCompact(c.limit)}
                      </p>
                      <Progress value={c.usage} max={c.limit} size="sm" label={`${c.code} usage`} />
                    </div>
                  </TD>
                  <TD className="hidden text-[13px] text-ink-600 xl:table-cell">
                    {formatDateShort(c.startsAt)} to {formatDateShort(c.endsAt)}
                  </TD>
                  <TD>
                    <StatusBadge meta={COUPON_STATUS[c.status]} size="sm" />
                  </TD>
                  <TD align="right">
                    {c.status === "active" && <ActionButton label="Pause" icon="pause" size="xs" variant="ghost" title={`Pause ${c.code}`} description="Customers can no longer apply the code. Orders already placed keep the discount." reasons={["Budget review", "Abuse detected", "Campaign change", "Partner request"]} note="optional" toast={`${c.code} paused`} doneLabel="Paused" />}
                    {c.status === "paused" && <ActionButton label="Resume" icon="play" size="xs" variant="ghost" title={`Resume ${c.code}`} note="optional" toast={`${c.code} resumed`} doneLabel="Active" />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>

      <Card id="deals">
        <CardHeader title="Deal approvals" description="Price checked against the lowest selling price of the last 30 days and the event minimum discount" />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Deal</TH>
                <TH className="hidden md:table-cell">Type</TH>
                <TH align="right">Deal price</TH>
                <TH align="right" className="hidden lg:table-cell">
                  30 day low
                </TH>
                <TH>Price check</TH>
                <TH align="right" className="hidden lg:table-cell">
                  Stock
                </TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {dealSubmissions.map((d) => {
                const chk = dealCheck(d);
                return (
                  <TR key={d.id}>
                    <TD>
                      <div className="flex max-w-[300px] items-center gap-3">
                        <ProductImage src={d.image} alt="" size={38} rounded="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink-900">{d.title}</span>
                          <span className="block text-xs text-ink-500">
                            <span className="font-mono">{d.id}</span>
                          </span>
                        </span>
                      </div>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">
                      {d.dealType}
                      <p className="text-xs text-ink-500">min {d.requiredPct}% below 30 day low</p>
                    </TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(d.dealPrice)}
                      <p className="text-xs font-normal text-ink-500 line-through">{formatINR(d.mrp)}</p>
                    </TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {formatINR(d.low30d)}
                    </TD>
                    <TD className="max-w-[220px] whitespace-normal">
                      <span className={cn("inline-flex items-start gap-1.5 text-[13px]", chk.ok ? "text-success-700" : "text-danger-700")}>
                        {chk.ok ? <CircleCheck size={15} className="mt-px shrink-0" aria-hidden="true" /> : <CircleX size={15} className="mt-px shrink-0" aria-hidden="true" />}
                        <span>
                          <span className="font-medium">{chk.ok ? "Passed" : "Failed"}</span>
                          <span className="block text-xs">{chk.why}</span>
                        </span>
                      </span>
                    </TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {formatNumber(d.stock)}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1.5">
                        <ActionButton
                          label="Approve"
                          icon="check"
                          size="xs"
                          title="Approve deal"
                          description="The deal price is locked once the event's price lock starts; it may only be lowered."
                          summary={[
                            { label: "Deal price", value: formatINR(d.dealPrice) },
                            { label: "30 day low", value: formatINR(d.low30d) },
                            { label: "Discount", value: `${chk.pct}%` },
                            { label: "Stock committed", value: formatNumber(d.stock) },
                          ]}
                          warning={chk.ok ? undefined : `This deal fails the price check: ${chk.why}. Approving needs a reason.`}
                          note={chk.ok ? "none" : "required"}
                          toast="Deal approved"
                          doneLabel="Approved"
                        />
                        <ActionButton label="Reject" icon="x" size="xs" variant="ghost" danger title="Reject deal" reasons={["Discount below the event minimum", "Pre-event price hike", "Price above M.R.P.", "Insufficient stock commitment", "Seller not eligible (health or tier)"]} note="optional" toast="Deal rejected, seller notified" doneLabel="Rejected" />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}
