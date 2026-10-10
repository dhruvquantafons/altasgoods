import { CheckoutFlow } from "@/components/store/checkout-flow";
import { lineKey } from "@/components/store/pricing";
import { api, currentUser } from "@/lib/api/server";
import { toAddressLite } from "@/lib/api/store-adapters";
import { cartCatalog, CUSTOMER_WALLET, NET_BANKING_BANKS, storefrontCoupons } from "@/lib/mock/store-extra";
import { getStoreCatalog } from "@/lib/store-catalog";

export const metadata = { title: "Secure checkout" };

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const catalog = await getStoreCatalog();
  const buyId = one(sp.buy);
  const product = buyId ? catalog.product(buyId) : undefined;
  const variant = one(sp.variant) || undefined;
  const buyNow = product ? { key: lineKey(product.id, variant), productId: product.id, qty: Math.max(1, Math.min(10, Number(one(sp.qty)) || 1)), variant } : undefined;

  const user = await currentUser();
  const addresses = ((await (await api()).GET("/v1/me/addresses")).data ?? []).map(toAddressLite);

  return (
    <CheckoutFlow
      catalog={cartCatalog(catalog.products)}
      coupons={storefrontCoupons()}
      // bank offers, Credits and gift cards are not priced by the API yet, so they are off
      bankOffers={[]}
      banks={NET_BANKING_BANKS}
      wallet={{ credits: 0, giftCard: 0, payLaterLimit: CUSTOMER_WALLET.payLaterLimit }}
      customer={{ name: user?.name ?? "", phone: user?.phone.replace(/^\+91/, "") ?? "" }}
      addresses={addresses}
      buyNow={buyNow}
    />
  );
}
