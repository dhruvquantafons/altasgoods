import type { Metadata } from "next";
import { CartProvider } from "@/components/store/cart-context";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { api, currentUser } from "@/lib/api/server";
import { toAddressLite } from "@/lib/api/store-adapters";
import { COMPANY, CUSTOMER_WALLET, GRIEVANCE_OFFICER, navCategories, searchSuggestions } from "@/lib/mock/store-extra";

export const metadata: Metadata = {
  title: { default: "AltasGoods: Shop smarter, live better", template: "%s | AltasGoods" },
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const addresses = user ? ((await (await api()).GET("/v1/me/addresses")).data ?? []).map(toAddressLite) : [];
  return (
    <CartProvider signedIn={!!user}>
      <div className="flex min-h-screen flex-col bg-white">
        <StoreHeader
          categories={navCategories()}
          suggestions={searchSuggestions()}
          addresses={addresses}
          customer={{
            signedIn: !!user,
            firstName: user?.name?.split(" ")[0] ?? (user ? "there" : ""),
            plus: user?.isPlus ?? false,
            // stored value is not in the API yet; shown from the demo wallet
            bluCoins: CUSTOMER_WALLET.bluCoins,
            credits: CUSTOMER_WALLET.credits,
          }}
        />
        <main id="main" className="flex-1">
          {children}
        </main>
        <StoreFooter company={COMPANY} grievance={GRIEVANCE_OFFICER} />
      </div>
    </CartProvider>
  );
}
