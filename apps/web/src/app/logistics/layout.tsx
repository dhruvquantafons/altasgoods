import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogisticsShell } from "@/components/shell/area-shells";
import { currentUser } from "@/lib/api/server";
import { isAdmin, roleLabel } from "@/lib/api/staff";

export const metadata: Metadata = {
  title: { default: "Shipping", template: "%s | AltasGoods Shipping" },
};

export default async function LogisticsLayout({ children }: { children: React.ReactNode }) {
  // the proxy sends everyone else to sign in first; this is the server side of the same rule
  const user = await currentUser();
  if (!user || !isAdmin(user.staffRoles)) notFound();
  return <LogisticsShell user={{ name: user.name ?? user.email, role: roleLabel(user.staffRoles, "Shipping") }}>{children}</LogisticsShell>;
}
