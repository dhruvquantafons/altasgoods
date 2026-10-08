import type { Metadata } from "next";
import { AccountMobileNav, AccountSidebar } from "@/components/account/account-nav";
import { accountNotifications, accountReturns, ACCOUNT_PROFILE, wishlistCount } from "@/lib/mock/account-extra";
import { loadAccountOrders } from "@/lib/api/account-orders";
import { CURRENT_CUSTOMER } from "@/lib/mock";
import { isActive } from "@/components/account/lib";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s | Your account | AltasGoods" },
};

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const orders = await loadAccountOrders().catch(() => []);
  const counts = {
    orders: orders.filter((o) => isActive(o.status)).length,
    returns: accountReturns.filter((r) => !["completed", "rejected", "cancelled"].includes(r.status)).length,
    notifications: accountNotifications.filter((n) => !n.read).length,
    wishlist: wishlistCount,
  };
  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <AccountSidebar
            name={CURRENT_CUSTOMER.name}
            plus={CURRENT_CUSTOMER.plusMember}
            memberSince={new Date(ACCOUNT_PROFILE.memberSince).getFullYear().toString()}
            counts={counts}
          />
          <div className="min-w-0">
            <AccountMobileNav counts={counts} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
