import Link from "next/link";
import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { CreateRule, PriceTable, RulesTable, type PriceRow } from "@/components/seller/pricing/pricing-client";
import { MiniStat, StatStrip } from "@/components/seller/primitives";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { feesForLine } from "@/lib/mock";
import { getListing, priceAlerts, pricingActivity, pricingRules, SELLER, sellerListings } from "@/lib/mock/seller-extra";
import { cn, formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  const live = sellerListings.filter((l) => l.status === "live");
  const ruleOf = (id: string) => pricingRules.find((r) => r.status === "active" && r.listings.includes(id))?.name;
  const rows: PriceRow[] = live.map((l) => {
    const fees = feesForLine(l.productId, l.price, 1, false, SELLER.tier);
    const net = l.price + fees.reduce((a, f) => a + f.amount, 0);
    return {
      id: l.id,
      title: l.title,
      image: l.image,
      sku: l.sku,
      price: l.price,
      mrp: l.mrp,
      featured: l.featured,
      featuredPct: l.featuredPct,
      featuredPrice: l.featuredPrice,
      lowestPrice: l.lowestPrice,
      lowestSeller: l.lowestSeller,
      netPerUnit: net,
      netRatio: net / l.price,
      rule: ruleOf(l.id),
    };
  });
  const won = live.filter((l) => l.featured === "won");
  const weighted = Math.round(live.reduce((a, l) => a + l.featuredPct * l.sessions30d, 0) / (live.reduce((a, l) => a + l.sessions30d, 0) || 1));
  const activeRules = pricingRules.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Compare your prices with the featured offer and the lowest competing offer, preview what you receive per unit, and let rules keep prices competitive."
        actions={<CreateRule listings={live.map((l) => ({ id: l.id, title: l.title }))} />}
      />

      <StatStrip className="mb-6">
        <MiniStat label="Featured offer won" value={`${won.length} of ${live.length}`} hint="Live listings" />
        <MiniStat label="Featured offer share" value={`${weighted}%`} hint="Of page views, weighted by traffic" />
        <MiniStat label="Price alerts" value={priceAlerts.length} hint="Unusually high or low prices" tone={priceAlerts.length ? "warning" : undefined} />
        <MiniStat label="Automated rules" value={`${activeRules} active`} hint={`${pricingRules.reduce((a, r) => a + r.changes7d, 0)} price changes in 7 days`} />
      </StatStrip>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Price manager" description="Click your price to change it. Prices must stay at or below M.R.P.; what you receive updates as you edit." />
        <div className="mt-3 border-t border-line">
          <PriceTable rows={rows} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Price alerts" description="Prices that look out of line with the market or your own history" />
            <ul className="mt-2 divide-y divide-line">
              {priceAlerts.map((a) => {
                const l = getListing(a.listingId)!;
                const high = a.kind === "high";
                return (
                  <li key={a.listingId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <ProductImage src={l.image} alt="" size={44} rounded="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{l.title}</p>
                      <p className={cn("mt-0.5 flex items-center gap-1 text-[13px] font-medium", high ? "text-warning-700" : "text-danger-700")}>
                        {high ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
                        {high ? "High price" : "Low price"}: {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{a.detail}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(l.price)}</p>
                      <p className="text-xs text-ink-500 tabular-nums">
                        {high ? "Featured" : "Median"} {formatINR(a.reference)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Automated pricing rules" description="Rules run every 15 minutes and log every change below" />
            <div className="mt-2 border-t border-line">
              <RulesTable
                rules={pricingRules.map((r) => ({ id: r.id, name: r.name, strategy: r.strategy, detail: r.detail, listings: r.listings.length, floor: r.floor, status: r.status, lastRun: r.lastRun, changes7d: r.changes7d }))}
              />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Recent price changes" />
            <ul className="mt-2 divide-y divide-line">
              {pricingActivity.map((a) => {
                const l = getListing(a.listingId)!;
                const down = a.to < a.from;
                return (
                  <li key={a.at + a.listingId} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/seller/catalog/${l.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
                        {l.title.split(/[,(]/)[0]!.trim()}
                      </Link>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] tabular-nums">
                        <span className="text-ink-400 line-through">{formatINR(a.from)}</span>
                        {down ? <ArrowDown size={13} className="text-success-600" aria-hidden="true" /> : <ArrowUp size={13} className="text-warning-600" aria-hidden="true" />}
                        <span className="font-medium text-ink-900">{formatINR(a.to)}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {a.rule}, {timeAgo(a.at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="How the featured offer is chosen" />
            <div className="px-5 pt-3 pb-5">
              <ul className="flex flex-col gap-2.5 text-[13px]">
                {[
                  ["Landed price (price plus delivery fee)", 50],
                  ["Delivery promise to the customer's pincode", 20],
                  ["Seller Health score", 15],
                  ["Fulfilment program (Fulfilled, Flex, Assured)", 10],
                  ["Seller rating", 5],
                ].map(([label, w]) => (
                  <li key={label as string}>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-700">{label}</span>
                      <span className="font-medium text-ink-900 tabular-nums">{w}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-[var(--color-chart-1)]" style={{ width: `${(w as number) * 2}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Only live offers with stock, an ODR under 1% and a Seller Health band above Critical can win. Near ties within 1% rotate between sellers.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
