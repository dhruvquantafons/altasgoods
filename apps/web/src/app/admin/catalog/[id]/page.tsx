import { ProductForm } from "@/components/admin/catalog/product-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminBrands, loadAdminCategories, loadAdminProduct } from "@/lib/api/admin-catalog";
import { formatDateTime, formatNumber } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/admin/catalog/[id]">) {
  const { id } = await props.params;
  const p = await loadAdminProduct(id);
  return { title: p.title };
}

export default async function EditProductPage(props: PageProps<"/admin/catalog/[id]">) {
  const { id } = await props.params;
  const [product, categories, brands] = await Promise.all([loadAdminProduct(id), loadAdminCategories(), loadAdminBrands()]);
  return (
    <>
      <PageHeader
        title={product.title}
        breadcrumbs={[{ label: "Products", href: "/admin/catalog" }, { label: product.sku }]}
        description={`Last updated ${formatDateTime(product.updatedAt)}. ${formatNumber(product.soldLast30d)} sold in the last 30 days, rated ${product.rating.toFixed(1)} from ${formatNumber(product.ratingCount)} ratings.`}
        meta={product.active ? <Badge tone="success">On sale</Badge> : <Badge tone="neutral">Off sale</Badge>}
      />
      <ProductForm key={product.updatedAt} product={product} categories={categories} brands={brands} />
    </>
  );
}
