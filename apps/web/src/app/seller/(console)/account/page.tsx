import { accountTab, StaffAccountPage } from "@/components/shell/staff-account";
import { CURRENT_SELLER_ID, getSeller } from "@/lib/mock";

export const metadata = { title: "Your account" };

export default async function SellerAccountPage(props: PageProps<"/seller/account">) {
  const sp = await props.searchParams;
  const seller = getSeller(CURRENT_SELLER_ID)!;
  return (
    <StaffAccountPage
      workspaceName="Seller Hub"
      tab={accountTab(sp.tab)}
      person={{
        name: seller.ownerName,
        role: "Owner",
        email: seller.email,
        phone: seller.phone,
        team: seller.displayName,
        location: `${seller.city}, ${seller.state}`,
        memberSince: seller.joinedAt,
        userId: "SU-APEX-0001",
      }}
      topics={[
        { key: "orders", label: "New orders and dispatch deadlines", description: "Orders to confirm and items close to their dispatch-by time" },
        { key: "payments", label: "Payouts", description: "Scheduled, paid and held settlements" },
        { key: "listings", label: "Listing issues", description: "Suppressed listings, price alerts and low stock" },
        { key: "health", label: "Seller Health", description: "Metric warnings and policy notices" },
        { key: "promotions", label: "Events and promotions", description: "Sale event nominations and deal reminders" },
      ]}
    />
  );
}
