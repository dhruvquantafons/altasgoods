import { AddProductWizard, type CatalogEntry, type CategoryNode } from "@/components/seller/catalog/add-product-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { categories, getBrand, getCategory, products } from "@/lib/mock";
import { bsinFor, RATE_CARD, SELLER } from "@/lib/mock/seller-extra";

export const metadata = { title: "Add a product" };

export default async function AddProductPage(props: PageProps<"/seller/catalog/new">) {
  const sp = await props.searchParams;
  const mode = sp.mode === "create" ? "create" : "start";
  const catalog: CatalogEntry[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    image: p.image,
    brand: getBrand(p.brandId)?.name ?? "",
    category: getCategory(p.categoryId)?.name ?? "",
    categoryId: p.categoryId,
    subcategory: p.subcategory,
    bsin: bsinFor(p.id),
    price: Math.min(...p.offers.map((o) => o.price)),
    mrp: p.mrp,
    sellers: p.offers.length,
    mine: p.offers.some((o) => o.sellerId === SELLER.id),
  }));
  // approved categories first so the most relevant products surface without a query
  catalog.sort((a, b) => Number(SELLER.categories.includes(b.categoryId)) - Number(SELLER.categories.includes(a.categoryId)) || Number(a.mine) - Number(b.mine));
  const tree: CategoryNode[] = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    commission: c.commission,
    image: c.image,
    children: (c.children ?? []).map((x) => ({ id: x.id, name: x.name })),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Listings", href: "/seller/catalog" }, { label: "Add a product" }]}
        title="Add a product"
        description="Sell a product that is already on AltasGoods, or create a new one. Offers on existing products go live after automatic checks; new products are reviewed first."
      />
      <AddProductWizard catalog={catalog} categories={tree} approved={SELLER.categories} rateCard={RATE_CARD} initialFlow={mode} />
    </>
  );
}
