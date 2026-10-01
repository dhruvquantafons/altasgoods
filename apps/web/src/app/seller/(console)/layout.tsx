import type { Metadata } from "next";
import { Info } from "lucide-react";
import { SellerShell } from "@/components/shell/area-shells";
import { loadSellerLines, pendingCount } from "@/lib/api/seller-orders";
import { loadSellerReturns } from "@/lib/api/seller-returns";
import { currentUser } from "@/lib/api/server";
import { CURRENT_SELLER_ID, getSeller, sellerNotifications } from "@/lib/mock";

export const metadata: Metadata = {
  title: { default: "Seller Hub", template: "%s | BluBuy Seller Hub" },
};

const ROLE: Record<string, string> = { OWNER: "Owner", MANAGER: "Manager", OPERATIONS: "Operations", CATALOG: "Catalog", FINANCE: "Finance", READ_ONLY: "Viewer" };

export default async function SellerConsoleLayout({ children }: { children: React.ReactNode }) {
  const [user, pending, openReturns] = await Promise.all([
    currentUser(),
    loadSellerLines().then(
      (r) => pendingCount(r.counts),
      () => undefined,
    ),
    // requests to decide and items to grade
    loadSellerReturns().then(
      (r) => r.filter((x) => x.status === "PENDING_SELLER_REVIEW" || x.status === "RECEIVED").length,
      () => undefined,
    ),
  ]);
  const membership = user?.sellers[0];
  // seeded sellers share ids with the sample data; sellers who joined through onboarding have none yet
  const sample = getSeller(membership?.id ?? CURRENT_SELLER_ID);
  return (
    <SellerShell
      store={{
        name: membership?.displayName ?? sample?.displayName ?? "Your store",
        tier: membership?.tier ?? sample?.tier ?? "Bronze",
        city: membership?.city ?? sample?.city ?? "",
        status: membership?.status ?? sample?.status ?? "",
      }}
      user={user && membership ? { name: user.name ?? user.phone, role: `${ROLE[membership.role] ?? membership.role}, ${membership.displayName}` } : undefined}
      notifications={sample ? sellerNotifications : []}
      counts={{ pendingOrders: pending || undefined, openReturns: openReturns || undefined, messages: sample ? 3 : undefined }}
    >
      {!sample && membership && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-[13px] text-brand-800">
          <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{membership.displayName} is {membership.status === "APPROVED" ? "approved" : membership.status.toLowerCase()}.</span> Orders are connected to your account. Listings, inventory, payments and the other tools show sample data until they are connected.
          </span>
        </p>
      )}
      {children}
    </SellerShell>
  );
}
