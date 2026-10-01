import { Plus, Search, Upload } from "lucide-react";
import { ListingsTable, type ListingRow } from "@/components/seller/catalog/listings-table";
import { AutoSubmitSelect } from "@/components/seller/client-kit";
import { MiniStat, StatStrip } from "@/components/seller/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TableFooter } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { LISTING_TABS, SELLER, sellerListings } from "@/lib/mock/seller-extra";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Listings" };

export default async function CatalogPage(props: PageProps<"/seller/catalog">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  // the dashboard links here with ?status=suppressed, so accept both names
  const tabKey = one(sp.tab) || one(sp.status);
  const tab = LISTING_TABS.find((t) => t.key === tabKey) ?? LISTING_TABS[0]!;
  const q = one(sp.q).trim().toLowerCase();
  const channel = ["fulfilled", "ship"].includes(one(sp.channel)) ? one(sp.channel) : "all";
  const featured = ["won", "lost"].includes(one(sp.featured)) ? one(sp.featured) : "all";

  const filtered = sellerListings.filter((l) => {
    if (channel !== "all" && l.channel !== channel) return false;
    if (featured !== "all" && l.featured !== featured) return false;
    if (q && !`${l.title} ${l.brand} ${l.bsin} ${l.sku}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const inTab = (statuses: string[]) => filtered.filter((l) => !statuses.length || statuses.includes(l.status));
  const rows: ListingRow[] = inTab(tab.statuses).map((l) => ({
    id: l.id,
    title: l.title,
    image: l.image,
    brand: l.brand,
    bsin: l.bsin,
    sku: l.sku,
    status: l.status,
    note: l.note,
    quality: l.quality,
    issues: l.issues.length,
    price: l.price,
    mrp: l.mrp,
    stock: l.stock,
    channel: l.channel,
    featured: l.featured,
    featuredPct: l.featuredPct,
    featuredPrice: l.featuredPrice,
    lowestSeller: l.lowestSeller,
    units30d: l.units30d,
    sales30d: l.sales30d,
  }));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { tab: tab.key, q: one(sp.q), channel, featured, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  const tabs = LISTING_TABS.map((t) => ({ key: t.key, label: t.label, href: qs({ tab: t.key }), count: inTab(t.statuses).length }));

  const live = sellerListings.filter((l) => l.status === "live");
  const won = live.filter((l) => l.featured === "won").length;
  const attention = sellerListings.filter((l) => ["suppressed", "rejected", "out_of_stock", "blocked"].includes(l.status)).length;
  const avgQuality = Math.round(live.reduce((a, l) => a + l.quality, 0) / (live.length || 1));
  const filtersActive = Boolean(q) || channel !== "all" || featured !== "all";

  const toolbar = (
    <form method="get" className="flex flex-col gap-2.5 px-5 py-3.5 md:flex-row md:items-center">
      <input type="hidden" name="tab" value={tab.key} />
      <Input name="q" defaultValue={one(sp.q)} icon={Search} inputSize="sm" placeholder="Search title, brand, BSIN or SKU" className="w-full md:max-w-sm" aria-label="Search listings" />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AutoSubmitSelect name="channel" defaultValue={channel} selectSize="sm" aria-label="Fulfilment channel" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
          <option value="all">All channels</option>
          <option value="fulfilled">BluBuy Fulfilled</option>
          <option value="ship">BluBuy Ship</option>
        </AutoSubmitSelect>
        <AutoSubmitSelect name="featured" defaultValue={featured} selectSize="sm" aria-label="Featured offer" className="min-w-0 flex-1 sm:w-48 sm:flex-none">
          <option value="all">Any featured offer</option>
          <option value="won">Featured offer won</option>
          <option value="lost">Featured offer lost</option>
        </AutoSubmitSelect>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {filtersActive && (
          <a href={`?tab=${tab.key}`} className="px-1 text-[13px] font-medium text-brand-700 hover:underline">
            Clear filters
          </a>
        )}
      </div>
      <p className="text-xs text-ink-500 md:ml-auto">Click a price or stock value to edit it</p>
    </form>
  );

  return (
    <>
      <PageHeader
        title="Listings"
        description="Your offers on BluBuy. Price and stock changes go live within 15 minutes; title, image and brand changes are reviewed first while the old content stays live."
        actions={
          <>
            <ButtonLink href="/seller/catalog/bulk" variant="secondary" icon={Upload}>
              Bulk upload
            </ButtonLink>
            <ButtonLink href="/seller/catalog/new" icon={Plus}>
              Add a product
            </ButtonLink>
          </>
        }
      />

      <StatStrip className="mb-6">
        <MiniStat label="Live listings" value={formatNumber(live.length)} hint={`Of ${formatNumber(sellerListings.length)} shown; ${formatNumber(SELLER.liveListings)} across your account`} />
        <MiniStat label="Featured offer won" value={`${won} of ${live.length}`} hint="Live listings you win" />
        <MiniStat label="Average listing quality" value={`${avgQuality} / 100`} hint="Images, bullets, attributes and A+ content" />
        <MiniStat label="Need attention" value={attention} hint="Suppressed, rejected or out of stock" tone={attention ? "warning" : undefined} />
      </StatStrip>

      <TabLinks items={tabs} active={tab.key} className="mb-4" />

      <Card className="overflow-hidden">
        <ListingsTable rows={rows} toolbar={toolbar} />
        {rows.length > 0 && <TableFooter shown={rows.length} total={rows.length} label={rows.length === 1 ? "listing" : "listings"} />}
      </Card>
    </>
  );
}
