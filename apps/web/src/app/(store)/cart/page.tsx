import { CartView } from "@/components/store/cart-view";
import { ProductCard } from "@/components/store/product-card";
import { Rail, RailItem } from "@/components/store/rail";
import { SectionTitle } from "@/components/store/section";
import { bestSellers, cartCatalog } from "@/lib/mock/store-extra";
import { getStoreCatalog } from "@/lib/store-catalog";
import { getStoreCoupons } from "@/lib/store-promotions";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const [catalog, coupons] = await Promise.all([getStoreCatalog(), getStoreCoupons()]);
  return (
    <CartView catalog={cartCatalog(catalog.products)} coupons={coupons}>
      <section aria-labelledby="cart-more" className="mt-16">
        <SectionTitle id="cart-more" title="Customers also bought" description="Popular picks that ship with your order" />
        <Rail label="Customers also bought">
          {bestSellers(catalog.products).map((p) => (
            <RailItem key={p.id}>
              <ProductCard product={p} sizes="(min-width: 1024px) 16vw, 45vw" />
            </RailItem>
          ))}
        </Rail>
      </section>
    </CartView>
  );
}
