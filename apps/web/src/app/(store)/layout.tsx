import type { Metadata } from "next";
import { CartProvider } from "@/components/store/cart-context";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { CURRENT_CUSTOMER, customerAddresses } from "@/lib/mock";
import { COMPANY, CUSTOMER_WALLET, GRIEVANCE_OFFICER, navCategories, searchSuggestions } from "@/lib/mock/store-extra";

export const metadata: Metadata = {
  title: { default: "BluBuy: Shop smarter, live better", template: "%s | BluBuy" },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <StoreHeader
          categories={navCategories()}
          suggestions={searchSuggestions()}
          addresses={customerAddresses}
          customer={{
            firstName: CURRENT_CUSTOMER.name.split(" ")[0]!,
            plus: CURRENT_CUSTOMER.plusMember,
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
