import { CheckoutFlow } from "@/components/store/checkout-flow";
import { lineKey } from "@/components/store/pricing";
import { getProduct } from "@/lib/mock";
import { api, currentUser } from "@/lib/api/server";
import { toAddressLite } from "@/lib/api/store-adapters";
import { cartCatalog, CUSTOMER_WALLET, NET_BANKING_BANKS, storefrontCoupons } from "@/lib/mock/store-extra";

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

  const user = await currentUser();
  const addresses = ((await (await api()).GET("/v1/me/addresses")).data ?? []).map(toAddressLite);

  return (
    <CheckoutFlow
      catalog={cartCatalog()}
      coupons={storefrontCoupons()}
      // bank offers, Credits, gift cards and AltasCoins are not priced by the API yet, so they are off
      bankOffers={[]}
      banks={NET_BANKING_BANKS}
      wallet={{ ...CUSTOMER_WALLET, credits: 0, giftCard: 0, bluCoins: 0, plusMember: !!user?.isPlus }}
      customer={{ name: user?.name ?? "", phone: user?.phone.replace(/^\+91/, "") ?? "" }}
      addresses={addresses}
      buyNow={buyNow}
    />
  );
}
