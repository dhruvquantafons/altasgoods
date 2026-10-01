import { CartView } from "@/components/store/cart-view";
import { ProductCard } from "@/components/store/product-card";
import { Rail, RailItem } from "@/components/store/rail";
import { SectionTitle } from "@/components/store/section";
import { CURRENT_CUSTOMER } from "@/lib/mock";
import { bestSellers, cartCatalog, storefrontCoupons } from "@/lib/mock/store-extra";

export const metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <CartView catalog={cartCatalog()} coupons={storefrontCoupons()} plus={CURRENT_CUSTOMER.plusMember}>
      <section aria-labelledby="cart-more" className="mt-16">
        <SectionTitle id="cart-more" title="Customers also bought" description="Popular picks that ship with your order" />
        <Rail label="Customers also bought">
          {bestSellers().map((p) => (
            <RailItem key={p.id}>
              <ProductCard product={p} sizes="(min-width: 1024px) 16vw, 45vw" />
            </RailItem>
          ))}
        </Rail>
      </section>
    </CartView>
  );
}
