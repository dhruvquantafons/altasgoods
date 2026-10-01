import type { Metadata } from "next";
import { AdminShell } from "@/components/shell/area-shells";
import { loadKycSummary } from "@/lib/api/review";
import { currentUser } from "@/lib/api/server";
import { adminNotifications, returns } from "@/lib/mock";

export const metadata: Metadata = {
  title: { default: "BluBuy Control", template: "%s | BluBuy Control" },
};

const ROLE: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_ADMIN: "Operations Admin",
  SELLER_VERIFIER: "Seller Onboarding Verifier",
  RISK_ANALYST: "Risk and Fraud Analyst",
  AUDITOR: "Auditor",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, kyc] = await Promise.all([currentUser(), loadKycSummary()]);
  const openReturns = returns.filter((r) => ["requested", "qc_failed"].includes(r.status)).length;
  return (
    <AdminShell
      notifications={adminNotifications}
      user={user ? { name: user.name ?? user.phone, role: user.staffRoles.map((r) => ROLE[r] ?? r).join(", ") || "BluBuy Control" } : undefined}
      counts={{ sellerApprovals: kyc?.awaitingReview || undefined, catalogQueue: 212, returns: openReturns }}
    >
      {children}
    </AdminShell>
  );
}
