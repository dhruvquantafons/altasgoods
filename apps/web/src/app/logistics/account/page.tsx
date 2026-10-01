import { accountTab, StaffAccountPage } from "@/components/shell/staff-account";

export const metadata = { title: "Your account" };

export default async function LogisticsAccountPage(props: PageProps<"/logistics/account">) {
  const sp = await props.searchParams;
  return (
    <StaffAccountPage
      workspaceName="Hub Console"
      tab={accountTab(sp.tab)}
      person={{ name: "Naveen Kumar", role: "Hub Manager", email: "naveen.kumar@blubuy.in", phone: "+91 99001 27734", team: "Whitefield Delivery Hub", location: "Whitefield, Bengaluru", memberSince: "2026-07-20T09:00:00+05:30", userId: "EMP-LOG-0142" }}
      topics={[
        { key: "linehaul", label: "Line haul delays", description: "Inbound trucks running late against their ETA" },
        { key: "ndr", label: "NDR and failed deliveries", description: "Cases due for action and customer responses" },
        { key: "cod", label: "COD deposits", description: "Pending and short cash deposits" },
        { key: "sla", label: "SLA at risk", description: "Shipments that may miss their promise date" },
      ]}
    />
  );
}
