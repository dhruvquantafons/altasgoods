import { IndianRupee, MousePointerClick, Percent, TrendingUp, Wallet } from "lucide-react";
import { AdsMetricChart, CampaignsTable, CreateCampaign, KeywordsTable } from "@/components/seller/advertising/ads-client";
import { ToastButton } from "@/components/seller/client-kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { AD_WALLET, adCampaigns, adDaily, adKeywords, sellerListings } from "@/lib/mock/seller-extra";
import { formatCompact, formatDate, formatDateShort, formatINR } from "@/lib/utils";

export const metadata = { title: "Advertising" };

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

export default function AdvertisingPage() {
  const last = adDaily.slice(-14);
  const prev = adDaily.slice(-28, -14);
  const sum = (arr: typeof adDaily, k: "spend" | "sales" | "clicks" | "orders" | "impressions") => arr.reduce((a, d) => a + d[k], 0);
  const spend = sum(last, "spend");
  const sales = sum(last, "sales");
  const pSpend = sum(prev, "spend");
  const pSales = sum(prev, "sales");
  const acos = (spend / sales) * 100;
  const pAcos = (pSpend / pSales) * 100;
  const roas = sales / spend;
  const pRoas = pSales / pSpend;

  const chart = last.map((d) => ({ label: formatDateShort(d.date), sales: d.sales, spend: d.spend, clicks: d.clicks, acos: Math.round((d.spend / d.sales) * 1000) / 10 }));
  const nameOf = (id: string) => adCampaigns.find((c) => c.id === id)?.name ?? id;
  const topKeywords = adKeywords
    .slice()
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 9);
  const promotable = sellerListings.filter((l) => l.status === "live" && l.featured === "won");

  return (
    <>
      <PageHeader
        title="Advertising"
        description="AltasGoods Ads campaign manager. Sponsored results are labelled and limited to 4 per 20 organic results; you pay per click from your ad wallet."
        actions={
          <>
            <ToastButton icon="download" message="Search term report for the last 14 days is being prepared.">
              Search term report
            </ToastButton>
            <CreateCampaign products={promotable.map((l) => ({ id: l.id, title: l.title, image: l.image, price: l.price }))} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ad spend, last 14 days" value={formatCompact(spend, true)} delta={pct(spend, pSpend)} deltaLabel="vs previous 14 days" upIsGood={false} icon={IndianRupee} trend={last.map((d) => d.spend)} />
        <StatCard label="Ad sales, last 14 days" value={formatCompact(sales, true)} delta={pct(sales, pSales)} deltaLabel="vs previous 14 days" icon={TrendingUp} trend={last.map((d) => d.sales)} />
        <StatCard
          label="ACoS"
          value={`${acos.toFixed(1)}%`}
          delta={pct(acos, pAcos)}
          deltaLabel="vs previous 14 days"
          upIsGood={false}
          icon={Percent}
          footer="Ad spend divided by ad sales. Lower is better; 15 to 25% is healthy."
        />
        <StatCard label="ROAS" value={`${roas.toFixed(1)}x`} delta={pct(roas, pRoas)} deltaLabel="vs previous 14 days" icon={MousePointerClick} footer="Ad sales for every rupee spent. Attribution: 7 days after a click." />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Performance" description="Completed days only, last 14 days" />
          <div className="px-5 pt-4 pb-5">
            <AdsMetricChart data={chart} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Ad wallet" action={<Badge tone="success">Auto-recharge on</Badge>} />
          <div className="px-5 pt-3 pb-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Wallet size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(AD_WALLET.balance)}</p>
                <p className="mt-1 text-xs text-ink-500">About {Math.round(AD_WALLET.balance / (spend / 14))} days at your current spend</p>
              </div>
            </div>
            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-600">Auto-recharge</dt>
                <dd className="text-right text-ink-900">
                  {formatINR(AD_WALLET.autoRecharge.amount)} when below {formatINR(AD_WALLET.autoRecharge.below)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-600">Last recharge</dt>
                <dd className="text-right text-ink-900">
                  {formatINR(AD_WALLET.lastRecharge.amount)}, {formatDate(AD_WALLET.lastRecharge.at)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-600">Deduct from payouts</dt>
                <dd className="text-ink-900">{AD_WALLET.deductFromPayouts ? "On" : "Off"}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <ToastButton size="sm" className="w-full" message="Recharge of ₹50,000 started. Pay by UPI or net banking to complete it.">
                Recharge wallet
              </ToastButton>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Campaigns" description="Lifetime totals. Click a daily budget to change it; switch a campaign off to pause it." />
        <div className="mt-3 border-t border-line">
          <CampaignsTable
            rows={adCampaigns.map((c) => ({
              id: c.id,
              name: c.name,
              typeLabel: c.typeLabel,
              targeting: c.targeting,
              status: c.status,
              dailyBudget: c.dailyBudget,
              spend: c.spend,
              impressions: c.impressions,
              clicks: c.clicks,
              ctr: c.ctr,
              cpc: c.cpc,
              orders: c.orders,
              sales: c.sales,
              acos: c.acos,
              roas: c.roas,
            }))}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Top keywords" description="Across manual Sponsored Products campaigns, by ad sales. Click a bid to change it." />
        <div className="mt-3">
          <KeywordsTable
            rows={topKeywords.map((k) => ({
              id: k.id,
              campaign: nameOf(k.campaignId),
              keyword: k.keyword,
              match: k.match,
              bid: k.bid,
              suggested: k.suggested,
              impressions: k.impressions,
              clicks: k.clicks,
              spend: k.spend,
              sales: k.sales,
              status: k.status,
            }))}
          />
        </div>
      </Card>
    </>
  );
}
