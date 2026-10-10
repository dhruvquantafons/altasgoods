import { BrandManager } from "@/components/admin/catalog/brand-manager";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminBrands } from "@/lib/api/admin-catalog";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const brands = await loadAdminBrands();
  return (
    <>
      <PageHeader title="Brands" description="Brands shoppers can filter by. Renaming a brand updates search for its products." />
      <BrandManager brands={brands} />
    </>
  );
}
