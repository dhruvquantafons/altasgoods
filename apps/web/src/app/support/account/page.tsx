import { accountTab, StaffAccountPage } from "@/components/shell/staff-account";
import { staff } from "@/lib/mock";

export const metadata = { title: "Your account" };

export default async function SupportAccountPage(props: PageProps<"/support/account">) {
  const sp = await props.searchParams;
  const me = staff.find((s) => s.team === "Customer Experience")!;
  return (
    <StaffAccountPage
      workspaceName="Care Desk"
      tab={accountTab(sp.tab)}
      person={{ name: me.name, role: me.role, email: me.email, phone: "+91 97400 18823", team: me.team, location: "Hyderabad", memberSince: "2025-11-03T09:30:00+05:30", userId: "EMP-CX-0031" }}
      topics={[
        { key: "assigned", label: "Tickets assigned to you", description: "New assignments and customer replies" },
        { key: "sla", label: "SLA warnings", description: "Tickets close to their reply or resolution deadline" },
        { key: "escalations", label: "Escalations", description: "Tickets escalated to you or your team" },
        { key: "policy", label: "Policy updates", description: "Changes to return windows, refunds and macros" },
      ]}
    />
  );
}
