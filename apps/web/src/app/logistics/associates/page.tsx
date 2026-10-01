import { Bike, Coffee, MapPinned, Moon } from "lucide-react";
import { AssociateRoster, type RosterRow } from "@/components/logistics/associate-roster";
import { ASSOCIATE_STATUS, VEHICLE } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { formatTime, maskPhone, MetricTile } from "@/components/logistics/ops-ui";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { associates, CURRENT_HUB_ID } from "@/lib/mock";
import { associateProfiles, runsheetFor } from "@/lib/mock/ops-extra";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Delivery associates" };

export default function AssociatesPage() {
  const roster = associates.filter((a) => a.hubId === CURRENT_HUB_ID);
  const rows: RosterRow[] = roster.map((a) => {
    const p = associateProfiles[a.id]!;
    const r = runsheetFor(a.id);
    return {
      id: a.id,
      name: a.name,
      phone: maskPhone(a.phone),
      statusKey: a.status,
      status: ASSOCIATE_STATUS[a.status],
      vehicle: VEHICLE[a.vehicle],
      vehicleNo: p.vehicleNo,
      beat: r ? `${r.beat.name} (${r.beat.code})` : undefined,
      runsheetId: r?.id,
      assigned: r?.deliveries ?? 0,
      delivered: r?.delivered ?? 0,
      failed: r?.failed ?? 0,
      pickups: r?.pickups ?? 0,
      codCollected: r?.codCollected ?? 0,
      codToCollect: r?.codToCollect ?? 0,
      rating: a.rating,
      firstAttemptRate: p.firstAttemptRate,
      fakeFlags: p.fakeAttemptFlags,
      checkedIn: p.checkedInAt ? formatTime(p.checkedInAt) : undefined,
      dispatched: r?.dispatchedAt ? formatTime(r.dispatchedAt) : undefined,
      joined: formatDate(p.joinedAt),
      kyc: p.kyc,
      languages: p.languages,
      employment: p.employment,
      last7: p.last7,
    };
  });
  const count = (s: string) => roster.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title="Delivery associates"
        description="Roster for Whitefield Delivery Hub: attendance, vehicles, today's runs and quality."
        actions={
          <>
            <ToastButton label="Attendance sheet" icon="download" message="Attendance for 1 Oct exported" size="md" />
            <ToastButton label="Onboard associate" icon="user" variant="primary" message="Onboarding link sent: KYC, police verification and device binding" size="md" />
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="On route" value={count("on_route")} hint="Dispatched on wave 1" icon={MapPinned} />
        <MetricTile label="At hub" value={count("available")} hint="Loading for the 11:00 am start" icon={Bike} />
        <MetricTile label="On break" value={count("on_break")} hint="Breaks capped at 30 minutes" icon={Coffee} />
        <MetricTile label="Off duty" value={count("off_duty")} hint="Weekly off or leave" icon={Moon} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Roster" description="Select an associate for today's run, last 7 days and profile" />
        <AssociateRoster rows={rows} />
      </Card>
    </>
  );
}
