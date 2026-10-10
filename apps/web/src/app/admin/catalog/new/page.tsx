import { ProductForm } from "@/components/admin/catalog/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminBrands, loadAdminCategories } from "@/lib/api/admin-catalog";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([loadAdminCategories(), loadAdminBrands()]);
  return (
    <>
      <PageHeader title="Add product" breadcrumbs={[{ label: "Products", href: "/admin/catalog" }, { label: "Add product" }]} />
      <ProductForm categories={categories} brands={brands} />
    </>
  );
}
