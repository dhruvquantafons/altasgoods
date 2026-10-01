import type { Metadata } from "next";
import { AdminShell } from "@/components/shell/area-shells";
import { adminNotifications, returns, sellers } from "@/lib/mock";

export const metadata: Metadata = {
  title: { default: "BluBuy Control", template: "%s | BluBuy Control" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const sellerApprovals = sellers.filter((s) => ["documents_submitted", "under_review", "action_required"].includes(s.status)).length;
  const openReturns = returns.filter((r) => ["requested", "qc_failed"].includes(r.status)).length;
  return (
    <AdminShell notifications={adminNotifications} counts={{ sellerApprovals, catalogQueue: 212, returns: openReturns }}>
      {children}
    </AdminShell>
  );
}
