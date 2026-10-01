import { CalendarClock, ClipboardList, MessageSquareReply, Timer, Undo2 } from "lucide-react";
import { BarList } from "@/components/charts/static";
import { NDR_CASE_STATUS, NDR_RESPONSE } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { dueLabel, formatDay, formatDayTime, formatRelativeDay, MetricTile, minsUntil, one } from "@/components/logistics/ops-ui";
import { NdrQueue, type NdrRow } from "@/components/logistics/ndr-queue";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { associates } from "@/lib/mock";
import { ndrCases, type NdrCase } from "@/lib/mock/ops-extra";
import { NDR_REASON } from "@/lib/status";
import { addDays, NOW } from "@/lib/utils";

export const metadata = { title: "NDR" };

const TABS = [
  { key: "action", label: "Needs action", match: (c: NdrCase) => ["open", "awaiting_customer", "disputed"].includes(c.status) },
  { key: "scheduled", label: "Re-attempt scheduled", match: (c: NdrCase) => ["reattempt_scheduled", "reattempt_in_progress"].includes(c.status) },
  { key: "closed", label: "Closed", match: (c: NdrCase) => ["rto_approved", "resolved_delivered"].includes(c.status) },
  { key: "all", label: "All", match: () => true },
];

export default async function NdrPage(props: PageProps<"/logistics/ndr">) {
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === one(sp.tab)) ?? TABS[0]!;
  const open = ndrCases.filter((c) => c.status !== "rto_approved" && c.status !== "resolved_delivered");
  const awaiting = ndrCases.filter((c) => c.status === "awaiting_customer");
  const scheduled = ndrCases.filter((c) => c.status === "reattempt_scheduled" || c.status === "reattempt_in_progress");
  const dueSoon = ndrCases.filter((c) => TABS[0]!.match(c) && minsUntil(c.actionDueAt) < 120);
  const responded = open.filter((c) => c.response.kind !== "none");

  const rows: NdrRow[] = ndrCases
    .filter(tab.match)
    .sort((a, b) => +new Date(a.actionDueAt) - +new Date(b.actionDueAt))
    .map((c) => {
      const closed = c.status === "rto_approved" || c.status === "resolved_delivered";
      const m = minsUntil(c.actionDueAt);
      const scheduledCase = c.status === "reattempt_scheduled" || c.status === "reattempt_in_progress";
      return {
        id: c.id,
        awb: c.awb,
        customer: c.shipment.customerName,
        locality: c.shipment.city.split(",")[0]!,
        pincode: c.shipment.pincode,
        reason: NDR_REASON[c.reason],
        attempts: c.attempts,
        status: NDR_CASE_STATUS[c.status],
        closed,
        responseKind: c.response.kind,
        response: NDR_RESPONSE[c.response.kind],
        responseDetail: (() => {
          const parts = [
            c.response.date && ["reattempt", "address_update", "cod_to_prepaid"].includes(c.response.kind) ? `For ${formatRelativeDay(c.response.date).toLowerCase()}` : undefined,
            c.response.note,
          ].filter(Boolean);
          const text = parts.join(". ");
          return c.response.channel ? `${c.response.channel}${text ? `: ${text}` : ""}` : text || undefined;
        })(),
        due: closed ? "Closed" : scheduledCase ? (c.status === "reattempt_in_progress" ? "On today's run" : `Re-attempt ${formatRelativeDay(c.response.date ?? c.actionDueAt).toLowerCase()}`) : dueLabel(c.actionDueAt),
        dueTone: closed || scheduledCase ? "neutral" : m < 0 ? "danger" : m < 120 ? "warning" : "neutral",
        cod: c.shipment.cod ? c.shipment.codAmount : 0,
        associate: associates.find((a) => a.id === c.associateId)?.name,
        lastAttempt: formatDayTime(c.lastAttemptAt),
        flagged: c.fakeAttemptFlag,
      };
    });

  const dates = [1, 2, 4].map((d) => ({ value: addDays(NOW, d).toISOString().slice(0, 10), label: d === 1 ? `Tomorrow, ${formatDay(addDays(NOW, d))}` : formatDay(addDays(NOW, d)) }));
  dates.unshift({ value: NOW.toISOString().slice(0, 10), label: "Today, 1:00 pm wave" });

  const reasonCounts = Object.entries(
    ndrCases.reduce<Record<string, number>>((acc, c) => {
      acc[NDR_REASON[c.reason]] = (acc[NDR_REASON[c.reason]] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="NDR management"
        description="Failed delivery attempts with the customer's response. Up to 3 attempts within 5 days, then return to origin."
        actions={<ToastButton label="Send IVR reminders" icon="message" variant="primary" message={`IVR and WhatsApp reminders sent to ${awaiting.length} customers awaiting response`} size="md" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Open cases" value={open.length} hint={`${responded.length} with a customer response`} icon={ClipboardList} href="/logistics/ndr" />
        <MetricTile label="Due within 2 hours" value={dueSoon.length} tone={dueSoon.length ? "warning" : "neutral"} hint="Act before auto re-attempt" icon={Timer} />
        <MetricTile label="Re-attempts scheduled" value={scheduled.length} hint="Added to the next runsheet" icon={CalendarClock} href="/logistics/ndr?tab=scheduled" />
        <MetricTile label="Awaiting customer" value={awaiting.length} hint="Notified by SMS and WhatsApp" icon={MessageSquareReply} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 pt-1">
          <TabLinks
            active={tab.key}
            items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "action" ? "/logistics/ndr" : `/logistics/ndr?tab=${t.key}`, count: ndrCases.filter(t.match).length }))}
          />
        </div>
        <div className="pt-3">
          <NdrQueue rows={rows} dates={dates} />
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reasons" description="All NDR cases at this hub in the last 5 days" />
          <div className="px-5 pt-4 pb-5">
            <BarList items={reasonCounts} />
          </div>
        </Card>
        <Card>
          <CardHeader title="NDR and RTO policy" description="Applied automatically by the case engine" />
          <ul className="flex flex-col gap-3 px-5 pt-4 pb-5 text-[13px] leading-relaxed text-ink-600">
            {[
              "Customer notified within 30 minutes of a failed attempt, with options to pick a date, update address details, add a phone, pay online or cancel.",
              "No response in 24 hours: automatic re-attempt on the next working day.",
              "Immediate RTO for confirmed refusals, outside delivery area and customer cancellations.",
              "An attempt more than 500 m from the address, without a call, or outside the runsheet window is flagged as a fake attempt and gets a priority re-attempt.",
              "After the third failed attempt, or 5 days after the first, the case closes to RTO.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Undo2 size={14} className="mt-1 shrink-0 text-ink-400" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
