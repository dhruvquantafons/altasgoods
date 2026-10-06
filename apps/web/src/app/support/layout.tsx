import type { Metadata } from "next";
import { SupportShell } from "@/components/shell/area-shells";
import { currentUser } from "@/lib/api/server";
import { currentTime, slaOf, tickets } from "@/lib/api/support";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Care Desk", template: "%s | AltasGoods Care Desk" },
};

const ROLE: Record<string, string> = {
  SUPPORT_AGENT: "Support Agent L1",
  SUPPORT_SPECIALIST: "Support Specialist L2",
  SUPPORT_SUPERVISOR: "Care Desk Supervisor",
  SUPER_ADMIN: "Super Admin",
};

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const [user, queue] = await Promise.all([currentUser(), tickets({ view: "open" }).catch(() => null)]);
  const now = currentTime();
  const urgent = (queue?.tickets ?? []).filter((t) => {
    const s = slaOf(t, now);
    return s.state === "breached" || s.state === "at_risk";
  });
  const notifications: Notification[] = [
    ...(urgent.length
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
      : []),
    { id: "s-policy", kind: "system", title: "Refund policy updated", body: "Big Days return window extended to 14 days for electronics.", at: new Date(now - 300 * 60_000).toISOString(), read: true, href: "/support/knowledge" },
  ];
  return (
    <SupportShell
      notifications={notifications}
      counts={{ open: queue?.counts.open || undefined }}
      user={user ? { name: user.name ?? user.phone, role: user.staffRoles.map((r) => ROLE[r]).filter(Boolean).join(", ") || "AltasGoods staff" } : undefined}
    >
      {children}
    </SupportShell>
  );
}
