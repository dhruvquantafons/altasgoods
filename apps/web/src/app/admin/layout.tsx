import type { Metadata } from "next";
import { AdminShell } from "@/components/shell/area-shells";
import { loadAdminItems, loadAdminReturns } from "@/lib/api/admin-fulfilment";
import { currentUser } from "@/lib/api/server";
import { roleLabel } from "@/lib/api/staff";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "AltasGoods Control", template: "%s | AltasGoods Control" },
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
  const at = new Date().toISOString();
  const notifications: Notification[] = [
    ...(counts.toAccept
      ? [{ id: "a-accept", kind: "order" as const, title: `${counts.toAccept} order line${counts.toAccept === 1 ? "" : "s"} to accept`, body: "Accept them so they can be packed and shipped on time.", at, read: false, href: "/admin/orders" }]
      : []),
    ...(counts.returns
      ? [{ id: "a-returns", kind: "alert" as const, title: `${counts.returns} return${counts.returns === 1 ? "" : "s"} waiting on the store`, body: "Review late requests and record quality checks.", at, read: false, href: "/admin/returns" }]
      : []),
  ];
  return (
    <AdminShell
      notifications={notifications}
      user={user ? { name: user.name ?? user.email, role: roleLabel(user.staffRoles, "AltasGoods Control") } : undefined}
      counts={counts}
    >
      {children}
    </AdminShell>
  );
}
