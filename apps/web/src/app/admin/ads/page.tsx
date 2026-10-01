import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { AD_STATUS } from "@/components/admin/admin-status";
import { ageLabel, pctChange } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { AreaChart } from "@/components/charts/area-chart";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { sellers } from "@/lib/mock";
import { adPlacements, adReviewQueue, adsDaily, advertisers } from "@/lib/mock/admin-extra";
import { formatCompact, formatDateShort, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Ads platform" };

const sellerName = (id: string) => sellers.find((s) => s.id === id)?.displayName ?? id;

export default function AdsPage() {
  const sum = (k: "revenue" | "impressions" | "clicks" | "attributedSales", arr = adsDaily) => arr.reduce((a, d) => a + d[k], 0);
  const last7 = adsDaily.slice(-7);
  const prev7 = adsDaily.slice(-14, -7);
  const revenue = sum("revenue");
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const roas = sum("attributedSales") / revenue;

  return (
    <>
      <PageHeader title="Ads platform" description="BluBuy Ads: Sponsored Products, Sponsored Brands and Sponsored Display. Second-price CPC auction; every placement carries a visible Sponsored label (spec 10.16)." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Ad revenue, 30 days", value: formatCompact(revenue, true), delta: pctChange(sum("revenue", last7), sum("revenue", prev7)), deltaLabel: "last 7 vs prior 7", trend: adsDaily.slice(-14).map((d) => d.revenue) },
          { label: "Impressions", value: formatCompact(impressions), hint: "sponsored, 30 days" },
          { label: "Click-through rate", value: `${((clicks / impressions) * 100).toFixed(2)}%`, hint: `${formatCompact(clicks)} clicks` },
          { label: "Average CPC", value: formatINR(revenue / clicks, { paise: true }), hint: "after invalid click credits" },
          { label: "Advertiser ROAS", value: `${roas.toFixed(1)}x`, hint: `ACoS ${((1 / roas) * 100).toFixed(1)}%` },
          { label: "Active advertisers", value: advertisers.filter((a) => a.status !== "paused").length, hint: `${advertisers.filter((a) => a.status === "low_balance").length} low on wallet` },
        ]}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Ad revenue" description="Completed days, all ad formats" />
          <div className="px-5 pt-4 pb-5">
            <AreaChart data={adsDaily.map((d) => ({ label: formatDateShort(d.date), revenue: d.revenue }))} series={[{ key: "revenue", label: "Ad revenue" }]} format="inrCompact" height={250} ariaLabel="BluBuy Ads revenue per day, last 30 days" />
          </div>
        </Card>
          <Card className="min-w-0">
        <CardHeader title="Sponsored placements" description="Maximum 4 sponsored results per 20 organic on search. CPC floors are per placement; category floors default to ₹1." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Placement</TH>
                <TH className="hidden 2xl:table-cell">Slot limit</TH>
                <TH align="right">Impressions</TH>
                <TH align="right" className="hidden sm:table-cell">
                  CTR
                </TH>
                <TH align="right" className="hidden 2xl:table-cell">
                  Fill rate
                </TH>
                <TH align="right">CPC floor</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {adPlacements.map((p) => (
                <TR key={p.name}>
                  <TD>
                    <p className="text-[13px] font-medium text-ink-900">{p.name}</p>
                    <p className="text-xs text-ink-500">
                      {p.page}, {p.format}
                    </p>
                  </TD>
                  <TD className="hidden text-[13px] text-ink-600 2xl:table-cell">{p.limit}</TD>
                  <TD align="right">{formatCompact(impressions * p.share)}</TD>
                  <TD align="right" className="hidden sm:table-cell">
                    {p.ctr.toFixed(2)}%
                  </TD>
                  <TD align="right" className="hidden 2xl:table-cell">
                    {p.fill}%
                  </TD>
                  <TD align="right">₹{p.floor}</TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {formatCompact(revenue * p.share, true)}
                  </TD>
                  <TD align="right">
                    <ActionButton label="Edit" size="xs" variant="ghost" icon="edit" title={`CPC floor for ${p.name}`} fields={[{ name: "floor", label: "Floor (₹ per click)", type: "number", defaultValue: String(p.floor) }]} note="optional" toast="CPC floor updated from tomorrow's auctions" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
        </div>

        <Card className="min-w-0 self-start">
          <CardHeader title="Creative review" description={`${adReviewQueue.length} Sponsored Brands and Display creatives pending`} />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {adReviewQueue.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex gap-3">
                  <ProductImage src={c.image} alt="" size={44} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{c.headline}</p>
                    <p className="text-xs text-ink-500">
                      {sellerName(c.sellerId)}, {c.format}, {ageLabel(c.submittedAt)} ago
                    </p>
                    {c.flags.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {c.flags.map((f) => (
                          <li key={f} className="flex items-start gap-1 text-xs text-danger-700">
                            <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <ActionButton label="Approve" icon="check" size="xs" variant={c.flags.length ? "ghost" : "secondary"} title="Approve creative" description={`${c.format} for ${sellerName(c.sellerId)}, landing on ${c.landing}.`} warning={c.flags.length ? `Policy flags: ${c.flags.join("; ")}.` : undefined} note={c.flags.length ? "required" : "none"} toast="Creative approved, campaign can go live" doneLabel="Approved" />
                  <ActionButton label="Reject" icon="x" size="xs" variant={c.flags.length ? "secondary" : "ghost"} danger title="Reject creative" reasons={["Unsubstantiated claim", "False urgency", "Superlative without evidence", "Prohibited product", "Misleading price"]} note="optional" toast="Creative rejected, advertiser notified" doneLabel="Rejected" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Advertisers" description="Sellers running BluBuy Ads, last 30 days. Wallets are prepaid; low balances pause campaigns." />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Advertiser</TH>
                <TH align="right" className="hidden sm:table-cell">
                  Campaigns
                </TH>
                <TH align="right">Spend</TH>
                <TH align="right" className="hidden md:table-cell">
                  Attributed sales
                </TH>
                <TH align="right">ROAS</TH>
                <TH align="right" className="hidden lg:table-cell">
                  ACoS
                </TH>
                <TH align="right" className="hidden md:table-cell">
                  Wallet
                </TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {advertisers.map((a) => (
                <TR key={a.sellerId}>
                  <TD>
                    <Link href={`/admin/sellers/${a.sellerId}`} className="text-[13px] font-medium text-ink-900 hover:text-brand-700">
                      {a.name}
                    </Link>
                  </TD>
                  <TD align="right" className="hidden sm:table-cell">
                    {a.campaigns}
                  </TD>
                  <TD align="right">{formatINR(a.spend30d)}</TD>
                  <TD align="right" className="hidden md:table-cell">
                    {formatCompact(a.attributedSales, true)}
                  </TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {a.roas.toFixed(1)}x
                  </TD>
                  <TD align="right" className="hidden lg:table-cell">
                    {a.acos}%
                  </TD>
                  <TD align="right" className="hidden md:table-cell">
                    {formatINR(a.wallet)}
                  </TD>
                  <TD>
                    <StatusBadge meta={AD_STATUS[a.status]} size="sm" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
          {formatNumber(advertisers.length)} advertisers. Invalid clicks are filtered and credited daily; attribution window is 7 days from click.
        </p>
      </Card>
    </>
  );
}
