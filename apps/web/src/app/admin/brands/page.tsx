import { BrandManager } from "@/components/admin/catalog/brand-manager";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminBrands } from "@/lib/api/admin-catalog";
import { canEditArea } from "@/lib/api/server";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const [brands, edit] = await Promise.all([loadAdminBrands(), canEditArea("brands")]);
  return (
    <>
      <PageHeader title="Brands" description="Brands shoppers can filter by. Renaming a brand updates search for its products." />
      <BrandManager brands={brands} canEdit={edit} />
    </>
  );
}
