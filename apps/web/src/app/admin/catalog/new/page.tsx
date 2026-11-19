import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/catalog/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminBrands, loadAdminCategories } from "@/lib/api/admin-catalog";
import { canEditArea } from "@/lib/api/server";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  // nothing to read here: read-only roles go back to the list
  if (!(await canEditArea("catalog"))) redirect("/admin/catalog");
  const [categories, brands] = await Promise.all([loadAdminCategories(), loadAdminBrands()]);
  return (
    <>
      <PageHeader title="Add product" breadcrumbs={[{ label: "Products", href: "/admin/catalog" }, { label: "Add product" }]} />
      <ProductForm categories={categories} brands={brands} />
    </>
  );
}
