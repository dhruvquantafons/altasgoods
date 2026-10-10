import type { Metadata } from "next";
import { AdminShell } from "@/components/shell/area-shells";
import { loadAdminItems, loadAdminReturns } from "@/lib/api/admin-fulfilment";
import { currentUser } from "@/lib/api/server";
import { adminNotifications } from "@/lib/mock";

export const metadata: Metadata = {
  title: { default: "AltasGoods Control", template: "%s | AltasGoods Control" },
};

const ROLE: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_ADMIN: "Operations Admin",
  CATALOG_MANAGER: "Catalog Manager",
  AUDITOR: "Auditor",
};

/** Sidebar badges: order lines to accept and returns waiting on the store. Missing when the API is unreachable. */
async function workCounts() {
  const [items, returns] = await Promise.all([
    loadAdminItems({ status: ["NEW"], pageSize: 1 }).catch(() => null),
    loadAdminReturns(["PENDING_REVIEW", "RECEIVED"]).catch(() => null),
  ]);
  return { toAccept: items?.counts.NEW || undefined, returns: returns?.length || undefined };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, counts] = await Promise.all([currentUser(), workCounts()]);
  return (
    <AdminShell
      notifications={adminNotifications}
      user={user ? { name: user.name ?? user.phone, role: user.staffRoles.map((r) => ROLE[r] ?? r).join(", ") || "AltasGoods Control" } : undefined}
      counts={counts}
    >
      {children}
    </AdminShell>
  );
}
