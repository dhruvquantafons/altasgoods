import { CloudOff, Fingerprint, KeyRound, Smartphone, Type, WifiOff } from "lucide-react";
import { NDR_REASON_ALL } from "@/components/logistics/meta";
import { CashScreen, DeliveryScreen, FailedScreen, FeatureNote, PhoneFrame, TodayScreen } from "@/components/logistics/rider-screens";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { associates } from "@/lib/mock";
import { cashDepositsYesterday, runsheets } from "@/lib/mock/ops-extra";

export const metadata = { title: "Associate app" };

export default function AssociateAppPage() {
  const run = runsheets.find((r) => r.status === "dispatched")!;
  const associate = associates.find((a) => a.id === run.associateId)!;
  const pending = run.sequence.filter((s) => s.status === "pending");
  const deliveryStop = pending.find((s) => s.kind === "delivery" && s.cod >= 999) ?? pending.find((s) => s.cod > 0) ?? pending[0]!;
  const failedStop = pending.find((s) => s.kind === "delivery" && s.seq !== deliveryStop.seq) ?? pending[1]!;
  const cash = cashDepositsYesterday.find((d) => d.associateId === associate.id)!;
  const returnsToHub = run.sequence.filter((s) => s.status === "failed").map((s) => s.awb);

  return (
    <>
      <PageHeader
        title="AltasGoods Rider"
        description="Design preview of the delivery associate app (Flutter). The same runsheet, NDR and cash data you see in Hub Console, from the associate's side."
        meta={
          <>
            <Badge tone="brand">Design preview</Badge>
            <Badge tone="neutral">Flutter, Android first</Badge>
            <span className="text-[13px] text-ink-500">
              Showing {associate.name} on <span className="font-mono">{run.id}</span>
            </span>
          </>
        }
      />

      <div className="rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-white to-ink-50 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 min-[640px]:grid-cols-2 min-[1400px]:grid-cols-4">
          <PhoneFrame label="1. Today's runsheet" darkStatus>
            <TodayScreen run={run} associate={associate.name} />
          </PhoneFrame>
          <PhoneFrame label="2. Secure Delivery and COD">
            <DeliveryScreen stop={deliveryStop} total={run.stops} />
          </PhoneFrame>
          <PhoneFrame label="3. Failed attempt and NDR reason">
            <FailedScreen
              stop={failedStop}
              reasons={[
                NDR_REASON_ALL.customer_unavailable,
                NDR_REASON_ALL.customer_refused,
                NDR_REASON_ALL.address_incomplete,
                NDR_REASON_ALL.premises_closed,
                NDR_REASON_ALL.cod_not_ready,
                NDR_REASON_ALL.reschedule_requested,
                NDR_REASON_ALL.otp_not_provided,
                NDR_REASON_ALL.entry_restricted,
              ]}
            />
          </PhoneFrame>
          <PhoneFrame label="4. End of shift cash">
            <CashScreen cash={cash.expected} upi={cash.upi} codShipments={cash.codShipments} returnsToHub={returnsToHub.length ? returnsToHub : [failedStop.awb]} />
          </PhoneFrame>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeatureNote icon={WifiOff} title="Offline first">
          Runsheet, scans and proof of delivery queue on the device and sync when the network returns. Weak-signal pincodes get pre-generated single use OTP fallback codes.
        </FeatureNote>
        <FeatureNote icon={Fingerprint} title="Device binding and selfie check">
          Login is mobile OTP plus a bound device. A selfie check at start of shift confirms the associate on the runsheet.
        </FeatureNote>
        <FeatureNote icon={KeyRound} title="Secure Delivery">
          Delivered cannot be marked without the customer&apos;s OTP on Secure Delivery shipments. Open Box adds a photo checklist and partial rejection.
        </FeatureNote>
        <FeatureNote icon={CloudOff} title="Failed attempts raise NDR">
          Each failed attempt needs a reason, a doorstep photo and a geo-tag. Attempts over 500 m from the address or without a call are flagged for review.
        </FeatureNote>
        <FeatureNote icon={Smartphone} title="Tap targets and one hand use">
          Primary actions sit in a fixed bottom bar at 54 px height. Every control is at least 44 px and reachable with a thumb.
        </FeatureNote>
        <FeatureNote icon={Type} title="Shared design tokens">
          Colours, radii and type ramp map 1:1 from the web tokens to Flutter ThemeData, so the app and Hub Console read as one product.
        </FeatureNote>
      </div>
    </>
  );
}
