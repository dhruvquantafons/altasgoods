import { accountTab, StaffAccountPage } from "@/components/shell/staff-account";
import { staff } from "@/lib/mock";

export const metadata = { title: "Your account" };

export default async function AdminAccountPage(props: PageProps<"/admin/account">) {
  const sp = await props.searchParams;
  const me = staff[0]!;
  return (
    <StaffAccountPage
      workspaceName="BluBuy Control"
      tab={accountTab(sp.tab)}
      person={{ name: me.name, role: me.role, email: me.email, phone: "+91 98860 41122", team: me.team, location: "Bengaluru", memberSince: "2025-01-06T10:00:00+05:30", userId: "EMP-00001" }}
      topics={[
        { key: "alerts", label: "Operational alerts", description: "Payment gateway, catalog queue and SLA breaches" },
        { key: "approvals", label: "Approvals waiting on you", description: "Seller KYC, payout runs and deal approvals" },
        { key: "risk", label: "Risk and fraud", description: "Held orders and rule hits above threshold" },
        { key: "reports", label: "Scheduled reports", description: "Daily and monthly report deliveries" },
      ]}
    />
  );
}
