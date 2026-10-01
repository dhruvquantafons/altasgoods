import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { HEALTH_BAND, healthBand, TIER_TONE } from "@/components/admin/admin-status";
import { ScoreMeter } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { categories, sellers } from "@/lib/mock";
import { loadKycSummary } from "@/lib/api/review";
import { SELLER_STATUS } from "@/lib/status";
import type { Seller } from "@/lib/types";
import { formatCompact, formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Sellers" };

const ONBOARDING = ["registration_started", "documents_submitted", "under_review", "action_required"];

const TABS: { key: string; label: string; match: (s: Seller) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (s) => s.status === "active" },
  { key: "onboarding", label: "Onboarding", match: (s) => ONBOARDING.includes(s.status) },
  { key: "on_hold", label: "On hold", match: (s) => s.status === "on_hold" },
  { key: "suspended", label: "Suspended", match: (s) => s.status === "suspended" || s.status === "deactivated" },
];

export default async function SellersPage(props: PageProps<"/admin/sellers">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp(params, "status"))?.key ?? "all";
  const q = sp(params, "q")?.trim() ?? "";
  const tier = sp(params, "tier") ?? "all";
  const category = sp(params, "category") ?? "all";
  const current = { status: tab === "all" ? undefined : tab, q: q || undefined, tier: tier === "all" ? undefined : tier, category: category === "all" ? undefined : category };

  const needle = q.toLowerCase();
  const base = sellers.filter((s) => {
    if (needle && !`${s.displayName} ${s.legalName} ${s.gstin} ${s.city} ${s.ownerName}`.toLowerCase().includes(needle)) return false;
    if (tier !== "all" && s.tier !== tier) return false;
    if (category !== "all" && !s.categories.includes(category)) return false;
    return true;
  });
  const rows = base.filter(TABS.find((t) => t.key === tab)!.match).sort((a, b) => b.gmv30d - a.gmv30d);

  const active = sellers.filter((s) => s.status === "active");
  const kyc = await loadKycSummary();
  const openKyc = kyc?.open ?? 0;
  const gmv = sellers.reduce((a, s) => a + s.gmv30d, 0);
  const top3 = [...sellers].sort((a, b) => b.gmv30d - a.gmv30d).slice(0, 3).reduce((a, s) => a + s.gmv30d, 0);
  const avgHealth = Math.round(active.reduce((a, s) => a + s.health.score, 0) / active.length);

  return (
    <>
      <PageHeader
        title="Sellers"
        description="Every seller account with status, tier and Seller Health. Tiers are evaluated every 90 days; a Poor or Critical health band demotes immediately."
        actions={
          <ButtonLink href="/admin/sellers/approvals" size="sm" icon={ShieldCheck}>
            Review applications
          </ButtonLink>
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Active sellers", value: active.length, hint: `${formatNumber(active.reduce((a, s) => a + s.liveListings, 0))} live listings` },
          { label: "Onboarding", value: sellers.filter((s) => ONBOARDING.includes(s.status)).length, hint: `${openKyc} awaiting KYC decision`, href: "/admin/sellers?status=onboarding" },
          { label: "On hold or suspended", value: sellers.filter((s) => ["on_hold", "suspended"].includes(s.status)).length, hint: "payouts held", href: "/admin/sellers?status=on_hold" },
          { label: "Seller GMV, 30 days", value: formatCompact(gmv, true), hint: `top 3 sellers ${((top3 / gmv) * 100).toFixed(0)}% of GMV` },
          { label: "Average Seller Health", value: avgHealth, hint: `${HEALTH_BAND[healthBand(avgHealth)].label}, active sellers` },
        ]}
      />

      {openKyc > 0 && (
        <Link href="/admin/sellers/approvals" className="group mb-6 flex items-center gap-4 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50/60 px-5 py-4 transition-colors hover:bg-brand-50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-100">
            <Building2 size={19} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">{openKyc} seller applications need a KYC decision</span>
            <span className="block text-[13px] text-ink-600">
              {kyc?.oldestDays != null ? `Oldest has waited ${kyc.oldestDays === 0 ? "under a day" : `${kyc.oldestDays} ${kyc.oldestDays === 1 ? "day" : "days"}`}. ` : ""}GSTIN, PAN and penny drop checks have already run.
            </span>
          </span>
          <ArrowRight size={17} className="shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}

      <TabLinks
        className="mb-5"
        active={tab}
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: base.filter(t.match).length, href: hrefWith("/admin/sellers", current, { status: t.key === "all" ? undefined : t.key }) }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/sellers"
            q={q}
            placeholder="Name, GSTIN, city or owner"
            keep={{ status: current.status }}
            selects={[
              { name: "tier", label: "Tier", value: tier, className: "sm:w-36", options: [{ value: "all", label: "All tiers" }, ...["Platinum", "Gold", "Silver", "Bronze"].map((t) => ({ value: t, label: t }))] },
              { name: "category", label: "Category", value: category, options: [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No sellers match" description="Clear the filters or search by GSTIN." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Seller</TH>
                  <TH>Status</TH>
                  <TH className="hidden sm:table-cell">Tier</TH>
                  <TH className="hidden md:table-cell">Seller Health</TH>
                  <TH align="right">GMV, 30 days</TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Orders
                  </TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Live listings
                  </TH>
                  <TH align="right" className="hidden xl:table-cell">
                    Rating
                  </TH>
                  <TH className="hidden xl:table-cell">Joined</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((s) => {
                  const live = s.gmv30d > 0;
                  const band = healthBand(s.health.score);
                  return (
                    <TR key={s.id}>
                      <TD>
                        <Link href={`/admin/sellers/${s.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {s.displayName}
                        </Link>
                        <p className="max-w-[240px] truncate text-xs text-ink-500">
                          {s.legalName}, {s.city}
                        </p>
                      </TD>
                      <TD>
                        <StatusBadge meta={SELLER_STATUS[s.status]} size="sm" />
                      </TD>
                      <TD className="hidden sm:table-cell">
                        <Badge tone={TIER_TONE[s.tier]} size="sm">
                          {s.tier}
                        </Badge>
                      </TD>
                      <TD className="hidden md:table-cell">
                        {live ? (
                          <span className="flex items-center gap-2">
                            <ScoreMeter value={s.health.score} max={1000} tone={HEALTH_BAND[band].tone} label="Seller Health score" />
                            <span className="text-xs text-ink-500">{HEALTH_BAND[band].label}</span>
                          </span>
                        ) : (
                          <span className="text-[13px] text-ink-400">Starts at 600 on activation</span>
                        )}
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {live ? formatCompact(s.gmv30d, true) : "Not selling"}
                      </TD>
                      <TD align="right" className="hidden lg:table-cell">
                        {live ? formatNumber(s.orders30d) : "0"}
                      </TD>
                      <TD align="right" className="hidden lg:table-cell">
                        {formatNumber(s.liveListings)}
                      </TD>
                      <TD align="right" className="hidden xl:table-cell">
                        {s.rating ? s.rating.toFixed(1) : "New"}
                      </TD>
                      <TD className="hidden text-[13px] text-ink-600 xl:table-cell">{formatDate(s.joinedAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-500">
          {rows.length} of {sellers.length} sellers, sorted by GMV
        </p>
      </Card>
    </>
  );
}
