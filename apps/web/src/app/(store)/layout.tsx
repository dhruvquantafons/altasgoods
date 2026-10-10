import type { Metadata } from "next";
import { CartProvider } from "@/components/store/cart-context";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { api, currentUser } from "@/lib/api/server";
import { toAddressLite } from "@/lib/api/store-adapters";
import { COMPANY, CUSTOMER_WALLET, GRIEVANCE_OFFICER, navCategories, searchSuggestions } from "@/lib/mock/store-extra";
import { getStoreCatalog } from "@/lib/store-catalog";

export const metadata: Metadata = {
  title: { default: "AltasGoods: Shop smarter, live better", template: "%s | AltasGoods" },
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, catalog] = await Promise.all([currentUser(), getStoreCatalog()]);
  const addresses = user ? ((await (await api()).GET("/v1/me/addresses")).data ?? []).map(toAddressLite) : [];
  return (
    <CartProvider signedIn={!!user}>
      <div className="flex min-h-screen flex-col bg-white">
        <StoreHeader
          categories={navCategories(catalog.categories, catalog.products)}
          suggestions={searchSuggestions(catalog.categories, catalog.brands, catalog.products)}
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
          {!catalog.available && (
            <p role="alert" className="border-b border-warning-200 bg-warning-50 px-4 py-2.5 text-center text-[13px] text-warning-800">
              The store is having trouble loading products right now. Please try again in a few minutes.
            </p>
          )}
          {children}
        </main>
        <StoreFooter company={COMPANY} grievance={GRIEVANCE_OFFICER} />
      </div>
    </CartProvider>
  );
}
