import { CalendarClock, CircleCheck, Zap } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { CreateCoupon, NominateDeals } from "@/components/seller/promotions/promotions-client";
import { MiniStat, Mono, SlaText, StatStrip } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { dealNominations, flashDeals, getListing, inventoryRows, PROMO_STATUS, saleEvents, sellerCoupons } from "@/lib/mock/seller-extra";
import { COUPON_STATUS, type Tone } from "@/lib/status";
import { cn, formatCompact, formatDate, formatDateShort, formatDateTime, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Promotions" };

const EVENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  live: { label: "Live now", tone: "success" },
  nominations_open: { label: "Nominations open", tone: "warning" },
  upcoming: { label: "Upcoming", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
};

export default function PromotionsPage() {
  const diwali = saleEvents.find((e) => e.id === "ev-diwali")!;
  const couponSales = sellerCoupons.reduce((a, c) => a + c.sales, 0);
  const couponCost = sellerCoupons.reduce((a, c) => a + c.spent, 0);
  const dealSales = saleEvents.reduce((a, e) => a + (e.sales ?? 0), 0);
  const dealCost = Math.round(dealSales * 0.17);
  const live = sellerCoupons.filter((c) => c.status === "active").length + flashDeals.filter((d) => d.status === "live").length + dealNominations.filter((d) => d.status === "live").length;

  const candidates = inventoryRows
    .filter((r) => r.channel === "fulfilled" && r.status === "live" && !dealNominations.some((d) => d.eventId === "ev-diwali" && d.listingId === r.listingId))
    .map((r) => {
      const l = getListing(r.listingId)!;
      return { id: l.id, title: l.title, image: l.image, price: l.price, mrp: l.mrp, low30: Math.round(l.price * 0.97), fcStock: r.fcAvailable };
    });

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Sale events, Blu Flash Deals and seller coupons. Deal prices must beat your lowest price of the last 30 days, and are locked once an event starts; you can only lower them."
        actions={
          <>
            <CreateCoupon />
            <NominateDeals candidates={candidates} minDiscount={diwali.minDiscount} eventName={diwali.name} deadline={formatDateTime(diwali.nominateBy!)} />
          </>
        }
      />

      <StatStrip className="mb-6">
        <MiniStat label="Promotion sales, this quarter" value={formatCompact(couponSales + dealSales, true)} hint="Deals and coupons combined" />
        <MiniStat label="Discount you funded" value={formatCompact(couponCost + dealCost, true)} hint="Coupon redemptions and deal markdowns" />
        <MiniStat label="Sales per rupee of discount" value={`${((couponSales + dealSales) / (couponCost + dealCost)).toFixed(1)}x`} hint="Return on discount" />
        <MiniStat label="Live promotions" value={live} hint="Deals, flash deals and coupons" />
      </StatStrip>

      <h2 className="mb-3 text-base font-semibold text-ink-900">Sale events</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {saleEvents.map((e) => {
          const st = EVENT_STATUS[e.status]!;
          return (
            <Card key={e.id} className={cn("flex flex-col", e.status === "nominations_open" && "border-brand-200")}>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-ink-900">{e.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDateShort(e.startsAt)} to {formatDate(e.endsAt)}
                    </p>
                  </div>
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                </div>
                {e.nominateBy && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-700">
                    <CalendarClock size={14} className="text-ink-400" aria-hidden="true" />
                    Nominate by {formatDateTime(e.nominateBy)} <SlaText dueAt={e.nominateBy} warnHours={72} />
                  </p>
                )}
                <ul className="mt-4 flex flex-col gap-2">
                  {e.requirements.map((r) => (
                    <li key={r} className="flex gap-2 text-[13px] text-ink-600">
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="grid grid-cols-3 border-t border-line text-center">
                <div className="px-3 py-3">
                  <dt className="text-[11px] text-ink-500">Nominated</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{e.nominated}</dd>
                </div>
                <div className="border-x border-line px-3 py-3">
                  <dt className="text-[11px] text-ink-500">Approved</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{e.approved}</dd>
                </div>
                <div className="px-3 py-3">
                  <dt className="text-[11px] text-ink-500">Deal sales</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-ink-900 tabular-nums">{e.sales ? formatCompact(e.sales, true) : "None yet"}</dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Deal nominations" description="Event deals you submitted and their review status" />
          <TableContainer className="mt-3">
            <Table className="min-w-[640px]">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH align="right">30-day low</TH>
                  <TH align="right">Deal price</TH>
                  <TH align="right">Units</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {dealNominations.map((d) => {
                  const l = getListing(d.listingId)!;
                  const off = Math.round((1 - d.dealPrice / d.low30) * 100);
                  return (
                    <TR key={d.id}>
                      <TD>
                        <div className="flex max-w-[20rem] items-center gap-3">
                          <ProductImage src={l.image} alt="" size={36} rounded="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink-900">{l.title}</p>
                            <p className="mt-0.5 text-xs text-ink-500">{saleEvents.find((e) => e.id === d.eventId)?.name}</p>
                            {d.note && <p className="mt-1 text-xs whitespace-normal text-danger-700">{d.note}</p>}
                          </div>
                        </div>
                      </TD>
                      <TD align="right" className="text-ink-500">
                        {formatINR(d.low30)}
                      </TD>
                      <TD align="right">
                        <p className="font-medium text-ink-900">{formatINR(d.dealPrice)}</p>
                        <p className="text-xs text-success-700">{off}% off</p>
                      </TD>
                      <TD align="right">{formatNumber(d.units)}</TD>
                      <TD>
                        <StatusBadge meta={PROMO_STATUS[d.status]} size="sm" />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Blu Flash Deals" description="Up to 12 hours, quantity capped, at least 15% below the 30-day low" />
          <ul className="mt-2 divide-y divide-line">
            {flashDeals.map((d) => {
              const l = getListing(d.listingId)!;
              const claimedPct = Math.round((d.claimed / d.units) * 100);
              const isLive = d.status === "live";
              return (
                <li key={d.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <ProductImage src={l.image} alt="" size={36} rounded="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{l.title.split(/[,(]/)[0]!.trim()}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatINR(d.dealPrice)} <span className="line-through">{formatINR(d.price)}</span>, {formatDateShort(d.startsAt)} {formatDateTime(d.startsAt).split(", ")[1]} to {formatDateTime(d.endsAt).split(", ")[1]}
                      </p>
                    </div>
                    <StatusBadge meta={PROMO_STATUS[d.status]} size="sm" />
                  </div>
                  {(isLive || d.status === "ended") && (
                    <div className="mt-2.5 pl-12">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="flex items-center gap-1 text-ink-600">
                          {isLive && <Zap size={12} className="text-accent-600" aria-hidden="true" />}
                          {d.claimed} of {d.units} claimed
                        </span>
                        {isLive && <SlaText dueAt={d.endsAt} className="text-xs" />}
                      </div>
                      <Progress value={claimedPct} tone={isLive ? "accent" : "neutral"} size="sm" label={`${claimedPct}% claimed`} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Deal fee ₹1,500 per flash deal during AltasGoods Big Days, ₹300 at other times.</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Seller coupons" description="Funded by you; shown on your product pages and applied at checkout" />
        <TableContainer className="mt-3">
          <Table className="min-w-[900px]">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Code</TH>
                <TH>Discount</TH>
                <TH>Audience and dates</TH>
                <TH>Budget used</TH>
                <TH align="right">Redemptions</TH>
                <TH align="right">Sales</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {sellerCoupons.map((c) => {
                const used = Math.min(100, Math.round((c.spent / c.budget) * 100));
                return (
                  <TR key={c.id}>
                    <TD>
                      <Mono className="font-semibold text-ink-900">{c.code}</Mono>
                      <p className="mt-0.5 max-w-[14rem] truncate text-xs text-ink-500">{c.description.replace(/^Apex Retail: /, "")}</p>
                    </TD>
                    <TD className="text-[13px]">
                      {c.type === "percent" ? `${c.value}% off` : `${formatINR(c.value)} off`}
                      <p className="text-xs text-ink-500">
                        Min {formatINR(c.minOrder)}
                        {c.maxDiscount ? `, max ${formatINR(c.maxDiscount)}` : ""}
                      </p>
                    </TD>
                    <TD className="text-[13px]">
                      {c.audience}
                      <p className="text-xs text-ink-500">
                        {formatDateShort(c.startsAt)} to {formatDateShort(c.endsAt)}
                      </p>
                    </TD>
                    <TD className="w-44">
                      <p className="mb-1 text-xs text-ink-700 tabular-nums">
                        {formatCompact(c.spent, true)} <span className="text-ink-500">of {formatCompact(c.budget, true)}</span>
                      </p>
                      <Progress value={used} tone={used > 85 ? "warning" : "brand"} size="sm" label={`${used}% of budget used`} />
                    </TD>
                    <TD align="right">
                      {formatNumber(c.redemptions)}
                      <p className="text-xs text-ink-500">of {formatNumber(c.limit)}</p>
                    </TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {c.sales ? formatCompact(c.sales, true) : "None yet"}
                    </TD>
                    <TD>
                      <StatusBadge meta={COUPON_STATUS[c.status]} size="sm" />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
          Coupon fee: 1% of coupon-attributed sales, capped at ₹2,000 per coupon per month. One coupon per item, applied after any deal price.
        </p>
      </Card>
    </>
  );
}
