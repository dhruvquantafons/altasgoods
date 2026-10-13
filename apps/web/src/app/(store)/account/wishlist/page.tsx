import { SavedItems } from "@/components/account/saved-items";
import { PageHeader } from "@/components/ui/page-header";
import { getStoreCatalog } from "@/lib/store-catalog";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const catalog = await getStoreCatalog();
  const products = catalog.products.map((p) => ({ id: p.id, slug: p.slug, title: p.title, image: p.image, price: p.price, mrp: p.mrp, inStock: p.stock > 0 }));
  return (
    <>
      <PageHeader title="Wishlist" description="Things you have saved for later." />
      <SavedItems products={products} />
    </>
  );
}
