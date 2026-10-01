import Link from "next/link";
import { IndianRupee, MapPin, PackageCheck, Route, ShieldCheck } from "lucide-react";
import { CreateRunsheet, type ReadyShipment, type RunAssociate } from "@/components/logistics/create-runsheet";
import { RUNSHEET_STATUS, STOP_STATUS, VEHICLE } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { formatTime, isToday, KeyRow, MetricTile, Mono, Note, one, qs, SegmentBar } from "@/components/logistics/ops-ui";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Stepper } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { associates, CURRENT_HUB_ID, shipments } from "@/lib/mock";
import { beats, runsheets } from "@/lib/mock/ops-extra";
import { cn, formatCompact, formatINR, formatNumber, sum } from "@/lib/utils";

export const metadata = { title: "Delivery runs" };

const LIFECYCLE = ["created", "assigned", "dispatched", "returned_to_hub", "closed"] as const;

export default async function RunsPage(props: PageProps<"/logistics/runs">) {
  const sp = await props.searchParams;
  const selected = runsheets.find((r) => r.id === one(sp.rs)) ?? runsheets.find((r) => r.status === "dispatched")!;
  const da = associates.find((a) => a.id === selected.associateId);

  const dispatched = runsheets.filter((r) => r.status === "dispatched");
  const stops = sum(runsheets, (r) => r.stops);
  const delivered = sum(runsheets, (r) => r.delivered);
  const deliveries = sum(dispatched, (r) => r.deliveries);
  const codLeft = sum(runsheets, (r) => r.codToCollect - r.codCollected);

  const ready: ReadyShipment[] = shipments
    .filter((s) => s.destinationHubId === CURRENT_HUB_ID && s.status === "at_destination_hub")
    .map((s) => ({
      id: s.id,
      pincode: s.pincode,
      customer: s.customerName,
      locality: s.city.split(",")[0]!,
      cod: s.cod,
      codAmount: s.codAmount,
      weightKg: s.weightKg,
      dueToday: isToday(s.promisedBy),
    }))
    .sort((a, b) => Number(b.dueToday) - Number(a.dueToday));

  const capacity = { bike: [30, 40], scooter: [28, 35], ev: [30, 40], van: [45, 250] } as const;
  const runAssociates: RunAssociate[] = associates
    .filter((a) => a.hubId === CURRENT_HUB_ID)
    .map((a) => {
      const rs = runsheets.find((r) => r.associateId === a.id);
      const note =
        a.status === "off_duty" ? "Off duty today, call in for wave 2" : rs?.status === "assigned" ? `At hub, ${rs.stops} stops loaded for ${formatTime(rs.plannedStartAt)}` : rs ? `Back from wave 1 around ${formatTime(rs.expectedReturnAt)}` : "Available";
      return { id: a.id, name: a.name, vehicle: VEHICLE[a.vehicle], maxStops: capacity[a.vehicle][0], maxKg: capacity[a.vehicle][1], note };
    });

  const readyByBeat = beats
    .map((b) => ({ beat: b, n: ready.filter((s) => s.pincode === b.pincode).length }))
    .filter((x) => x.n > 0);
  const readyPins = [...new Set(ready.map((s) => s.pincode))];

  return (
    <>
      <PageHeader
        title="Delivery runs"
        description="Runsheets per associate for today: beat, stop sequence, progress and cash on delivery."
        actions={
          <>
            <ToastButton label="Print runsheets" icon="printer" message="15 runsheets sent to the dispatch printer" size="md" />
            <CreateRunsheet nextId={`RS-WFD-261001-${runsheets.length + 1}`} beats={beats.map((b) => ({ code: b.code, name: b.name, pincode: b.pincode }))} shipments={ready} associates={runAssociates} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Runsheets today" value={runsheets.length} hint={`${dispatched.length} on road, ${runsheets.filter((r) => r.status !== "dispatched").length} for wave 2`} icon={Route} />
        <MetricTile label="Stops planned" value={formatNumber(stops)} hint={`${sum(runsheets, (r) => r.pickups)} are return pickups`} icon={MapPin} />
        <MetricTile label="Delivered on runs" value={`${Math.round((delivered / Math.max(1, deliveries)) * 100)}%`} hint={`${delivered} of ${deliveries} wave 1 deliveries`} icon={PackageCheck} />
        <MetricTile label="COD still to collect" value={formatCompact(codLeft, true)} hint={`${formatCompact(sum(runsheets, (r) => r.codCollected), true)} collected so far`} icon={IndianRupee} />
      </div>

      <Card>
        <CardHeader title="Runsheets" description="Select a runsheet to see its stop sequence" />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Runsheet</TH>
                <TH>Associate</TH>
                <TH>Beat</TH>
                <TH>Status</TH>
                <TH>Stops and progress</TH>
                <TH align="right">COD to collect</TH>
                <TH align="right">Timing</TH>
              </TR>
            </THead>
            <TBody>
              {runsheets.map((r) => {
                const a = associates.find((x) => x.id === r.associateId);
                const active = r.id === selected.id;
                return (
                  <TR key={r.id} className={cn(active && "bg-brand-50/50 hover:bg-brand-50/60")}>
                    <TD className={cn(active && "shadow-[inset_2px_0_0_var(--color-brand-600)]")}>
                      <Link href={`/logistics/runs${qs({ rs: r.id })}`} scroll={false} className="font-mono text-[13px] font-medium text-brand-700 hover:underline" aria-current={active ? "true" : undefined}>
                        {r.id}
                      </Link>
                      <p className="text-xs text-ink-500">Wave {r.wave}</p>
                    </TD>
                    <TD>
                      {a ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.name} size="xs" />
                          <span className="text-[13px] text-ink-900">{a.name}</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-warning-700">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <p className="text-[13px] text-ink-800">{r.beat.name}</p>
                      <Mono className="text-xs text-ink-500">
                        {r.beat.code}, {r.beat.pincode}
                      </Mono>
                    </TD>
                    <TD>
                      <StatusBadge meta={RUNSHEET_STATUS[r.status]} size="sm" />
                      {r.onBreak && <p className="mt-1 text-xs text-warning-700">Associate on break</p>}
                    </TD>
                    <TD>
                      {r.status === "dispatched" ? (
                        <div className="flex items-center gap-3">
                          <SegmentBar
                            className="w-20"
                            total={r.stops}
                            segments={[
                              { value: r.delivered + r.pickedUp, tone: "success", label: "Done" },
                              { value: r.failed, tone: "warning", label: "Failed" },
                            ]}
                          />
                          <span className="text-[13px] text-ink-900 tabular-nums">
                            {r.delivered + r.pickedUp + r.failed}
                            <span className="text-ink-500">/{r.stops}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-ink-900 tabular-nums">
                          {r.stops} stops <span className="text-xs text-ink-500">not started</span>
                        </span>
                      )}
                      {r.pickups > 0 && (
                        <p className="mt-0.5 text-xs text-ink-500">
                          incl. {r.pickups} return pickup{r.pickups === 1 ? "" : "s"}
                        </p>
                      )}
                    </TD>
                    <TD align="right">
                      <span className="text-[13px] font-medium text-ink-900">{formatINR(r.codToCollect - r.codCollected)}</span>
                      <p className="text-xs text-ink-500">of {formatINR(r.codToCollect)}</p>
                    </TD>
                    <TD align="right" className="text-[13px]">
                      {r.dispatchedAt ? "Out" : "Starts"} {formatTime(r.dispatchedAt ?? r.plannedStartAt)}
                      <p className="text-xs text-ink-500">Back by {formatTime(r.expectedReturnAt)}</p>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={
              <span>
                Stop sequence <Mono className="ml-1 text-[13px] font-normal text-ink-500">{selected.id}</Mono>
              </span>
            }
            description={`${selected.beat.name}, ${selected.stops} stops in route order${da ? ` for ${da.name}` : ""}`}
            action={<StatusBadge meta={RUNSHEET_STATUS[selected.status]} size="sm" />}
          />
          <TableContainer className="mt-3 max-h-[34rem] overflow-y-auto">
            <Table>
              <THead className="sticky top-0 z-10 bg-ink-50">
                <TR>
                  <TH className="w-12">#</TH>
                  <TH>AWB</TH>
                  <TH>Customer and slot</TH>
                  <TH>Handling</TH>
                  <TH align="right">COD</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {selected.sequence.map((s) => {
                  const next = s.status === "pending" && selected.sequence.find((x) => x.status === "pending")?.seq === s.seq && selected.status === "dispatched";
                  return (
                    <TR key={s.seq} className={cn(next && "bg-brand-50/50")}>
                      <TD className="text-ink-500 tabular-nums">{s.seq}</TD>
                      <TD>
                        <Mono className="text-ink-900">{s.awb}</Mono>
                      </TD>
                      <TD>
                        <p className="text-[13px] text-ink-900">{s.customer}</p>
                        <p className="text-xs text-ink-500">{s.slot}</p>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {s.kind === "pickup" ? (
                            <Badge tone="info" size="sm">
                              Return pickup
                            </Badge>
                          ) : (
                            <Badge tone="neutral" size="sm">
                              Delivery
                            </Badge>
                          )}
                          {s.secure && (
                            <Badge tone="brand" size="sm" icon={ShieldCheck}>
                              OTP
                            </Badge>
                          )}
                          {s.openBox && (
                            <Badge tone="brand" size="sm">
                              Open Box
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD align="right" className="text-[13px]">
                        {s.cod ? <span className="font-medium text-ink-900">{formatINR(s.cod)}</span> : <span className="text-ink-400">Prepaid</span>}
                      </TD>
                      <TD>
                        {next ? (
                          <Badge tone="brand" dot size="sm">
                            Next stop
                          </Badge>
                        ) : (
                          <StatusBadge meta={STOP_STATUS[s.status]} size="sm" />
                        )}
                        {s.at && <span className="ml-2 text-xs text-ink-500">{formatTime(s.at)}</span>}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Runsheet lifecycle" description="Closes only when every stop is accounted for and cash is accepted" />
            <div className="px-3 pt-5 pb-2">
              <Stepper
                current={Math.max(0, LIFECYCLE.indexOf(selected.status as (typeof LIFECYCLE)[number]))}
                steps={[{ label: "Created" }, { label: "Assigned" }, { label: "Out" }, { label: "Back" }, { label: "Closed" }]}
              />
            </div>
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Deliveries">
                {selected.delivered} done, {selected.failed} failed, {selected.deliveries - selected.delivered - selected.failed} pending
              </KeyRow>
              <KeyRow label="Return pickups">
                {selected.pickedUp} of {selected.pickups}
              </KeyRow>
              <KeyRow label="COD">
                {formatINR(selected.codCollected)} of {formatINR(selected.codToCollect)}
              </KeyRow>
              <KeyRow label="Route length">{selected.distanceKm} km</KeyRow>
              <KeyRow label="Vehicle">{da ? VEHICLE[da.vehicle] : "To be assigned"}</KeyRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Ready for wave 2" description={`${ready.length} shipments sorted at hub across ${readyPins.length} pincodes`} />
            <ul className="divide-y divide-line px-5 pt-2 pb-3">
              {readyByBeat.slice(0, 8).map(({ beat, n }) => (
                <li key={beat.code} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate text-ink-700">
                    <Mono className="text-xs text-ink-500">{beat.code}</Mono> {beat.name}
                  </span>
                  <span className="font-medium text-ink-900 tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 pb-5">
              <Note tone="info">
                {ready.filter((s) => s.dueToday).length} of these are promised today. Load them on the 1:00 pm wave first to hold the delivery promise.
              </Note>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
