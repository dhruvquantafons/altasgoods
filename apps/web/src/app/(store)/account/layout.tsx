import type { Metadata } from "next";
import { AccountMobileNav, AccountSidebar } from "@/components/account/account-nav";
import { loadAccountOrders } from "@/lib/api/account-orders";
import { loadMyReturns, toAccountReturn } from "@/lib/api/returns";
import { currentUser } from "@/lib/api/server";
import { isActive } from "@/components/account/lib";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s | Your account | AltasGoods" },
};

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const [user, orders, returns] = await Promise.all([
    currentUser(),
    loadAccountOrders().catch(() => []),
    loadMyReturns().then((r) => r.returns.map((x) => toAccountReturn(x, "your original payment method")), () => []),
  ]);
  // only counts the API knows; wishlist and notifications are not stored yet
  const counts = {
    orders: orders.filter((o) => isActive(o.status)).length,
    returns: returns.filter((r) => !["completed", "rejected", "cancelled"].includes(r.status)).length,
  };
  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <AccountSidebar
            name={user?.name ?? user?.email ?? "Your account"}
            memberSince={user ? new Date(user.createdAt).getFullYear().toString() : undefined}
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
