import { redirect } from "next/navigation";
import { ProductImport } from "@/components/admin/catalog/product-import";
import { PageHeader } from "@/components/ui/page-header";
import { canEditArea } from "@/lib/api/server";

export const metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  if (!(await canEditArea("catalog"))) redirect("/admin/catalog");
  return (
    <>
      <PageHeader
        title="Import products"
        description="Add or update many products at once from a spreadsheet saved as CSV."
        breadcrumbs={[{ label: "Products", href: "/admin/catalog" }, { label: "Import" }]}
      />
      <ProductImport />
    </>
  );
}
