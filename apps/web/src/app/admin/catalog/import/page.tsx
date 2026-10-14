import { ProductImport } from "@/components/admin/catalog/product-import";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Import products" };

export default function ImportProductsPage() {
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
