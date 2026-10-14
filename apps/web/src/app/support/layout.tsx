import type { Metadata } from "next";
import { SupportShell } from "@/components/shell/area-shells";
import { currentUser } from "@/lib/api/server";
import { roleLabel } from "@/lib/api/staff";
import { currentTime, slaOf, tickets } from "@/lib/api/support";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Care Desk", template: "%s | AltasGoods Care Desk" },
};

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const [user, queue] = await Promise.all([currentUser(), tickets({ view: "open" }).catch(() => null)]);
  const now = currentTime();
  const urgent = (queue?.tickets ?? []).filter((t) => {
    const s = slaOf(t, now);
    return s.state === "breached" || s.state === "at_risk";
  });
  const notifications: Notification[] = urgent.length
    ? [
        {
          id: "s-sla",
          kind: "alert" as const,
          title: `${urgent.length} ticket${urgent.length === 1 ? "" : "s"} near or past the reply SLA`,
          body: "Assign or respond first; they are at the top of the inbox.",
          at: new Date(now).toISOString(),
          read: false,
          href: "/support/tickets",
        },
      ]
    : [];
  return (
    <SupportShell
      notifications={notifications}
      counts={{ open: queue?.counts.open || undefined }}
      user={
        user
          ? {
              name: user.name ?? user.email,
              role: roleLabel(
                user.staffRoles.filter((r) => r.startsWith("SUPPORT_") || r === "SUPER_ADMIN"),
                "AltasGoods staff",
              ),
            }
          : undefined
      }
    >
      {children}
    </SupportShell>
  );
}
