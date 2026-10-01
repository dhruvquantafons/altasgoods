import { CmsStudio, type StudioProduct } from "@/components/admin/cms-studio";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { PageHeader } from "@/components/ui/page-header";
import { categories, products } from "@/lib/mock";
import { heroBanners, homeSlots } from "@/lib/mock/admin-extra";
import { formatCompact } from "@/lib/utils";

export const metadata = { title: "Storefront CMS" };

export default function CmsPage() {
  const ids = new Set(homeSlots.flatMap((s) => s.productIds ?? []));
  const productMap: Record<string, StudioProduct> = Object.fromEntries(
    products.filter((p) => ids.has(p.id)).map((p) => [p.id, { id: p.id, title: p.title, image: p.image, price: p.price, mrp: p.mrp }]),
  );
  const live = heroBanners.filter((b) => b.status === "live");
  const impressions = live.reduce((a, b) => a + b.impressions, 0);
  const ctr = live.reduce((a, b) => a + b.ctr * b.impressions, 0) / impressions;

  return (
    <>
      <PageHeader title="Storefront CMS" description="Homepage merchandising: slot order, hero banners, rails and targeting. Preview by persona before you publish; every publish is audited." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Live slots", value: homeSlots.filter((s) => s.status === "live").length, hint: `${homeSlots.filter((s) => s.status !== "live").length} scheduled or draft` },
          { label: "Live hero banners", value: live.length, hint: "rotating every 6 seconds" },
          { label: "Hero impressions", value: formatCompact(impressions), hint: "live banners, since launch" },
          { label: "Hero click-through", value: `${ctr.toFixed(1)}%`, hint: "weighted by impressions" },
        ]}
      />

      <CmsStudio slots={homeSlots} banners={heroBanners} products={productMap} categories={categories.map((c) => ({ id: c.id, name: c.name, image: c.image ?? "" }))} />
    </>
  );
}
