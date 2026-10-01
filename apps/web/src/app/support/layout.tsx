import type { Metadata } from "next";
import { SupportShell } from "@/components/shell/area-shells";
import { tickets } from "@/lib/mock";
import type { Notification } from "@/lib/types";
import { NOW } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "Care Desk", template: "%s | BluBuy Care Desk" },
};

const notifications: Notification[] = [
  { id: "s-1", kind: "alert", title: "2 urgent tickets near SLA breach", body: "Assign or respond within 30 minutes.", at: new Date(NOW.getTime() - 4 * 60_000).toISOString(), read: false, href: "/support/tickets?status=open" },
  { id: "s-2", kind: "system", title: "Refund policy updated", body: "Big Days return window extended to 14 days for electronics.", at: new Date(NOW.getTime() - 300 * 60_000).toISOString(), read: true, href: "/support/knowledge" },
];

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const open = tickets.filter((t) => ["open", "in_progress", "escalated"].includes(t.status)).length;
  return (
    <SupportShell notifications={notifications} counts={{ open }}>
      {children}
    </SupportShell>
  );
}
