import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BannerStudio } from "@/components/admin/banner-studio";
import { PageHeader } from "@/components/ui/page-header";
import { loadBanners } from "@/lib/api/admin-system";

export const metadata = { title: "Storefront CMS" };

export default async function CmsPage() {
  const banners = await loadBanners();
  return (
    <>
      <PageHeader
        title="Storefront CMS"
        description="The homepage hero slides and promo tiles. Changes show on the storefront as soon as you save, and every change is in the audit log. Sales and their homepage strip are managed in Coupons and sales."
        actions={
          <Link href="/" target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-white px-4 text-sm font-medium text-ink-800 hover:bg-ink-50">
            View homepage <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        }
      />
      <BannerStudio banners={banners} />
    </>
  );
}
