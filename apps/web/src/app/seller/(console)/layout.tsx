import type { Metadata } from "next";
import { SellerShell } from "@/components/shell/area-shells";
import { CURRENT_SELLER_ID, getSeller, returns, sellerNotifications, sellerOrderLines } from "@/lib/mock";

export const metadata: Metadata = {
  title: { default: "Seller Hub", template: "%s | BluBuy Seller Hub" },
};

export default function SellerConsoleLayout({ children }: { children: React.ReactNode }) {
  const seller = getSeller(CURRENT_SELLER_ID)!;
  const pendingOrders = sellerOrderLines(CURRENT_SELLER_ID).filter(({ item }) => ["placed", "confirmed", "packed"].includes(item.status)).length;
  const openReturns = returns.filter((r) => r.sellerId === CURRENT_SELLER_ID && ["requested", "approved", "pickup_scheduled", "picked_up", "received"].includes(r.status)).length;
  return (
    <SellerShell
      store={{ name: seller.displayName, tier: seller.tier, city: seller.city, status: seller.status }}
      notifications={sellerNotifications}
      counts={{ pendingOrders, openReturns: openReturns || undefined, messages: 3 }}
    >
      {children}
    </SellerShell>
  );
}
