import { shortDate } from "@/components/account/lib";
import { WishlistView, type WishList } from "@/components/account/wishlist-view";
import { PageHeader } from "@/components/ui/page-header";
import { productBySlug, wishlists } from "@/lib/mock/account-extra";

export const metadata = { title: "Wishlist" };

export default function WishlistPage() {
  const lists: WishList[] = wishlists.map((l) => ({
    id: l.id,
    name: l.name,
    isDefault: l.isDefault,
    visibility: l.visibility,
    sharedWith: l.sharedWith,
    items: l.items.flatMap((i) => {
      const p = productBySlug(i.slug);
      if (!p) return [];
      return [
        {
          slug: p.slug,
          title: p.title,
          image: p.image,
          price: p.price,
          mrp: p.mrp,
          priceWhenAdded: i.priceWhenAdded,
          inStock: p.stock > 0,
          rating: p.rating,
          addedLabel: shortDate(i.addedAt),
          alert: i.alert,
        },
      ];
    }),
  }));

  return (
    <>
      <PageHeader title="Wishlist" description="Save things for later, plan gifts in separate lists and get an alert when prices drop." />
      <WishlistView initial={lists} />
    </>
  );
}
