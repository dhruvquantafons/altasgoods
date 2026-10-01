import { CheckoutFlow } from "@/components/store/checkout-flow";
import { lineKey } from "@/components/store/pricing";
import { CURRENT_CUSTOMER, customerAddresses, getProduct } from "@/lib/mock";
import { BANK_OFFERS, cartCatalog, CUSTOMER_WALLET, NET_BANKING_BANKS, storefrontCoupons } from "@/lib/mock/store-extra";

export const metadata = { title: "Secure checkout" };

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const buyId = one(sp.buy);
  const product = buyId ? getProduct(buyId) : undefined;
  const sellerId = one(sp.seller);
  const variant = one(sp.variant) || undefined;
  const buyNow =
    product && product.offers.some((o) => o.sellerId === sellerId)
      ? { key: lineKey(product.id, sellerId, variant), productId: product.id, sellerId, qty: Math.max(1, Math.min(10, Number(one(sp.qty)) || 1)), variant }
      : undefined;

  return (
    <CheckoutFlow
      catalog={cartCatalog()}
      coupons={storefrontCoupons()}
      bankOffers={BANK_OFFERS}
      banks={NET_BANKING_BANKS}
      wallet={CUSTOMER_WALLET}
      customer={{ name: CURRENT_CUSTOMER.name, phone: customerAddresses[0]!.phone }}
      addresses={customerAddresses}
      buyNow={buyNow}
    />
  );
}
