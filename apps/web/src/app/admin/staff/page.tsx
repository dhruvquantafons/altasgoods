import { notFound } from "next/navigation";
import { StaffManager } from "@/components/admin/staff-manager";
import { PageHeader } from "@/components/ui/page-header";
import { loadStaff } from "@/lib/api/admin-system";
import { currentUser } from "@/lib/api/server";
import { canSee } from "@/lib/api/staff";

export const metadata = { title: "Staff" };

/** Who works in AltasGoods Control. Super Admins only; the proxy and the API both check. */
export default async function StaffPage() {
  const user = await currentUser();
  if (!user || !canSee(user.staffRoles, "staff")) notFound();
  const members = await loadStaff();
  return (
    <>
      <PageHeader
        title="Staff"
        description="Everyone who can sign in to AltasGoods Control or the Care Desk, and what each of them can do. Every change is in the audit log."
      />
      <StaffManager members={members} meId={user.id} />
    </>
  );
}
