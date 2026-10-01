import type { Metadata } from "next";
import { LogisticsShell } from "@/components/shell/area-shells";
import { CURRENT_HUB_ID, getHub, shipments } from "@/lib/mock";
import type { Notification } from "@/lib/types";
import { NOW } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "Hub Console", template: "%s | BluBuy Hub Console" },
};

const notifications: Notification[] = [
  { id: "l-1", kind: "alert", title: "Line haul delayed", body: "BOM-FC-02 to BLR-DH-WFD truck running 45 min late, ETA 11:40 AM.", at: new Date(NOW.getTime() - 9 * 60_000).toISOString(), read: false, href: "/logistics/inbound" },
  { id: "l-2", kind: "order", title: "11 NDR cases need action", body: "Customer re-attempt preferences received for 6 shipments.", at: new Date(NOW.getTime() - 50 * 60_000).toISOString(), read: false, href: "/logistics/ndr" },
  { id: "l-3", kind: "payment", title: "COD deposit pending", body: "3 associates have not deposited yesterday's cash.", at: new Date(NOW.getTime() - 140 * 60_000).toISOString(), read: true, href: "/logistics/cod" },
];

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const hub = getHub(CURRENT_HUB_ID)!;
  const ndr = shipments.filter((s) => s.destinationHubId === CURRENT_HUB_ID && s.status === "ndr").length;
  return (
    <LogisticsShell hub={{ code: hub.code, name: hub.name }} notifications={notifications} counts={{ ndr }}>
      {children}
    </LogisticsShell>
  );
}
