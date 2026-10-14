import type { Metadata } from "next";
import { CartProvider } from "@/components/store/cart-context";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { api, currentUser } from "@/lib/api/server";
import { toAddressLite } from "@/lib/api/store-adapters";
import { StoreSettingsProvider } from "@/components/store/store-settings";
import { navCategories, searchSuggestions } from "@/lib/mock/store-extra";
import { getStoreCatalog } from "@/lib/store-catalog";
import { getStoreSettings } from "@/lib/store-settings";

export const metadata: Metadata = {
  title: {
    default: "AltasGoods: Shop smarter, live better",
    template: "%s | AltasGoods",
  },
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, catalog, settings] = await Promise.all([currentUser(), getStoreCatalog(), getStoreSettings()]);
  const addresses = user ? ((await (await api()).GET("/v1/me/addresses")).data ?? []).map(toAddressLite) : [];
  return (
    <StoreSettingsProvider
      rules={{
        fee: settings.delivery.feePaise / 100,
        freeFrom: settings.delivery.freeFromPaise / 100,
        codLimit: settings.cod.maxOrderPaise / 100,
      }}
    >
      <CartProvider signedIn={!!user}>
        <div className="flex min-h-screen flex-col bg-white">
          {settings.notice.enabled && settings.notice.message && (
            <p role="status" className="bg-ink-900 px-4 py-2 text-center text-[13px] font-medium text-white">
              {settings.notice.message}
            </p>
          )}
          <StoreHeader
            categories={navCategories(catalog.categories, catalog.products)}
            suggestions={searchSuggestions(catalog.categories, catalog.brands, catalog.products)}
            addresses={addresses}
            customer={{
              signedIn: !!user,
              firstName: user?.name?.split(" ")[0] ?? (user ? "there" : ""),
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
          <StoreFooter company={settings.company} grievance={settings.grievance} />
        </div>
      </CartProvider>
    </StoreSettingsProvider>
  );
}
