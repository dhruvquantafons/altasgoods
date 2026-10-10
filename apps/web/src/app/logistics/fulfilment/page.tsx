import { Boxes, Clock3, Gauge, PackageCheck, PackagePlus, ScanBarcode, ShieldCheck, Truck } from "lucide-react";
import { APPOINTMENT_STATUS, OUTBOUND_STATUS, PACK_STATION_STATUS, PICKLIST_STATUS } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { dueLabel, formatTime, MetricTile, minsUntil, Mono, one, SegmentBar } from "@/components/logistics/ops-ui";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { getHub, sellerName } from "@/lib/mock";
import { fcSnapshots } from "@/lib/mock/ops-extra";
import { cn, formatNumber, sum } from "@/lib/utils";

export const metadata = { title: "Fulfilment centres" };

function Cutoff({ at }: { at: string }) {
  const m = minsUntil(at);
  return (
    <span className={cn("text-[13px] whitespace-nowrap", m < 0 ? "text-ink-500" : m < 90 ? "font-medium text-warning-700" : "text-ink-700")}>
      {formatTime(at)}
      <span className="block text-xs font-normal text-ink-500">{m < 0 ? "Passed" : dueLabel(at)}</span>
    </span>
  );
}

export default async function FulfilmentPage(props: PageProps<"/logistics/fulfilment">) {
  const sp = await props.searchParams;
  const fc = fcSnapshots.find((f) => f.hubId === one(sp.fc)) ?? fcSnapshots[0]!;
  const hub = getHub(fc.hubId)!;
  const nextWave = fc.pickLists.find((p) => p.status === "planned");

  return (
    <>
      <PageHeader
        title="Fulfilment centres"
        description="AltasGoods FC Console: inbound and GRN, putaway, picking, packing and dispatch by carrier cut-off."
        meta={
          <>
            <Badge tone="neutral">
              <Mono className="text-xs">{hub.code}</Mono>
            </Badge>
            <span className="text-[13px] text-ink-500">
              {hub.city}, managed by {hub.manager}. {fc.shift}.
            </span>
          </>
        }
        actions={nextWave && <ToastButton label="Release next wave" icon="truck" variant="primary" message={`Wave ${nextWave.wave} released: ${nextWave.orders} orders to ${nextWave.zone}`} size="md" />}
      />

      <TabLinks
        variant="pill"
        className="mb-6"
        active={fc.hubId}
        items={fcSnapshots.map((f) => {
          const h = getHub(f.hubId)!;
          return { key: f.hubId, label: h.name.replace(" Fulfilment Centre", ""), href: `/logistics/fulfilment?fc=${f.hubId}`, count: undefined };
        })}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="Units received" value={formatNumber(fc.unitsReceived)} hint={`of ${formatNumber(fc.unitsPlanned)} planned`} icon={PackagePlus} />
        <MetricTile label="Putaway backlog" value={formatNumber(fc.putawayBacklog)} hint={`${sum(fc.putaway, (p) => p.totes)} totes waiting`} icon={Boxes} />
        <MetricTile label="Orders to pick" value={formatNumber(fc.ordersToPick)} hint={`Next cut-off ${formatTime(fc.nextCutoff)}`} tone="warning" icon={ScanBarcode} />
        <MetricTile label="Pack rate" value={`${fc.packRate}/h`} tone={fc.packRate < fc.packRateTarget ? "warning" : "success"} hint={`Target ${fc.packRateTarget} per station`} icon={PackageCheck} />
        <MetricTile label="Dispatched today" value={formatNumber(fc.dispatched)} hint={`${fc.returnsBacklog} returns to grade`} icon={Truck} />
        <MetricTile label="Inventory accuracy" value={`${fc.inventoryAccuracy}%`} hint={`Dock to stock ${fc.dockToStockHrs} h`} icon={Gauge} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Inbound appointments and GRN" description="Supplier deliveries to the AltasGoods warehouse, by dock slot" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Appointment</TH>
                  <TH>Supplier and slot</TH>
                  <TH>Dock</TH>
                  <TH>Received</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {fc.appointments.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <Mono className="font-medium text-ink-900">{a.id}</Mono>
                      <p className="text-xs text-ink-500">{a.boxes} boxes</p>
                    </TD>
                    <TD>
                      <p className="text-[13px] text-ink-900">{sellerName(a.sellerId)}</p>
                      <p className="text-xs text-ink-500">{a.slot}</p>
                    </TD>
                    <TD>
                      <Mono className="text-ink-700">{a.dock}</Mono>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Progress value={a.unitsReceived} max={a.unitsExpected} size="sm" tone={a.status === "grn_posted" ? "success" : "brand"} className="w-20" label={`${a.id} received`} />
                        <span className="text-xs text-ink-600 tabular-nums">
                          {formatNumber(a.unitsReceived)}/{formatNumber(a.unitsExpected)}
                        </span>
                      </div>
                      {(a.damaged > 0 || a.excess > 0 || (a.status === "grn_posted" && a.unitsReceived < a.unitsExpected)) && (
                        <p className="mt-1 text-xs text-warning-700">
                          {[a.status === "grn_posted" && a.unitsExpected - a.unitsReceived > 0 ? `${a.unitsExpected - a.unitsReceived} short` : "", a.damaged ? `${a.damaged} damaged` : "", a.excess ? `${a.excess} excess` : ""].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge meta={APPOINTMENT_STATUS[a.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Putaway by zone" description="Totes received and waiting for a bin" />
          <ul className="divide-y divide-line px-5 pt-1 pb-2">
            {fc.putaway.map((p) => (
              <li key={p.zone} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-900">{p.zone}</p>
                  <p className="text-xs text-ink-500">
                    {p.totes} totes, {formatNumber(p.units)} units
                  </p>
                </div>
                <span className={cn("flex items-center gap-1 text-xs font-medium whitespace-nowrap", p.oldestMins > 120 ? "text-warning-700" : "text-ink-500")}>
                  <Clock3 size={13} aria-hidden="true" />
                  Oldest {p.oldestMins >= 60 ? `${Math.floor(p.oldestMins / 60)} h ${p.oldestMins % 60} min` : `${p.oldestMins} min`}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Bins are suggested by velocity, size and zone. Totes older than 2 hours are highlighted.</p>
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Pick lists" description="Waves ordered by carrier cut-off and delivery promise" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Pick list</TH>
                  <TH>To lane</TH>
                  <TH>Cut-off</TH>
                  <TH>Picked</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {fc.pickLists.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Mono className="font-medium text-ink-900">{p.id}</Mono>
                      <p className="text-xs text-ink-500">
                        Wave {p.wave}, {p.picker}
                      </p>
                      {p.priority !== "Standard" && (
                        <Badge tone="brand" size="sm" icon={p.priority === "Secure Delivery" ? ShieldCheck : undefined} className="mt-1">
                          {p.priority}
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      <Mono className="text-xs text-ink-700">{p.lane.replace("BLR-FC-01 to ", "").replace("BOM-FC-02 to ", "").replace("DEL-FC-01 to ", "")}</Mono>
                      <p className="text-xs text-ink-500">{p.zone}</p>
                    </TD>
                    <TD>
                      <Cutoff at={p.cutoff} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <SegmentBar size="sm" className="w-12" total={p.units} segments={[{ value: p.picked, tone: p.status === "short_pick" ? "warning" : p.picked >= p.units ? "success" : "brand", label: "Picked" }]} />
                        <span className="text-xs text-ink-600 tabular-nums">
                          {p.picked}/{p.units}
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge meta={PICKLIST_STATUS[p.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Inventory accuracy" description="Cycle counts today by zone" />
          <ul className="divide-y divide-line px-5 pt-1 pb-2">
            {fc.cycleCounts.map((c) => (
              <li key={c.zone} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-ink-900">{c.zone}</span>
                  <span className={cn("text-[13px] font-semibold tabular-nums", c.accuracy < 99 ? "text-warning-700" : "text-ink-900")}>{c.accuracy.toFixed(2)}%</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {c.counted} of {formatNumber(c.bins)} bins counted, {c.variances} variance{c.variances === 1 ? "" : "s"} to approve
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Outbound by carrier cut-off" description="Packages sorted to lanes and loaded on trailers" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Lane</TH>
                  <TH>Cut-off</TH>
                  <TH>Loaded</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {fc.outbound.map((o) => (
                  <TR key={o.lane}>
                    <TD>
                      <Mono className="text-[13px] font-medium text-ink-900">{o.lane}</Mono>
                      <p className="text-xs text-ink-500">
                        {o.destination}, trailer <span className="font-mono">{o.trailer}</span>
                      </p>
                    </TD>
                    <TD>
                      <Cutoff at={o.cutoff} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Progress value={o.loaded} max={o.packages} size="sm" tone={o.loaded >= o.packages ? "success" : "brand"} className="w-20" label={`${o.lane} loaded`} />
                        <span className="text-xs text-ink-600 tabular-nums">
                          {formatNumber(o.loaded)}/{formatNumber(o.packages)}
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge meta={OUTBOUND_STATUS[o.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Pack stations" description={`${fc.packStations.filter((p) => p.status === "active").length} of ${fc.packStations.length} packing`} />
          <ul className="divide-y divide-line px-5 pt-1 pb-2">
            {fc.packStations.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Mono className="w-11 shrink-0 font-medium text-ink-900">{p.id}</Mono>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink-800">
                    {p.packer}
                    {p.secureBags && <span className="ml-1.5 text-xs text-brand-700">Secure bags</span>}
                  </p>
                  <p className="text-xs text-ink-500">{p.status === "offline" ? "No packer assigned" : `${formatNumber(p.packedToday)} packed, queue ${p.queue}`}</p>
                </div>
                <div className="text-right">
                  <StatusBadge meta={PACK_STATION_STATUS[p.status]} size="sm" />
                  {p.ratePerHr > 0 && <p className={cn("mt-0.5 text-xs tabular-nums", p.ratePerHr < fc.packRateTarget ? "text-warning-700" : "text-ink-500")}>{p.ratePerHr}/h</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
