import Link from "next/link";
import { CircleAlert, PackageOpen, Plane, ScanLine, ShieldAlert, Truck } from "lucide-react";
import { BAG_STATUS, DISCREPANCY_KIND, LINEHAUL_STATUS } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { formatTime, MetricTile, Mono, Note, one, qs, SegmentBar } from "@/components/logistics/ops-ui";
import { ScanReceive } from "@/components/logistics/scan-receive";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { getHub } from "@/lib/mock";
import { bags, beats, inboundDiscrepancies, lineHauls, sortByBeat } from "@/lib/mock/ops-extra";
import { cn, formatINR, formatNumber, sum } from "@/lib/utils";

export const metadata = { title: "Inbound and sorting" };

export default async function InboundPage(props: PageProps<"/logistics/inbound">) {
  const sp = await props.searchParams;
  const docked = lineHauls.filter((l) => l.arrivedAt);
  const receiving = lineHauls.find((l) => l.status === "unloading") ?? docked[0]!;
  const selected = docked.find((l) => l.id === one(sp.lh)) ?? receiving;
  const atDock = lineHauls.filter((l) => l.status === "arrived");

  const totalBags = sum(docked, (l) => l.bags);
  const bagsIn = sum(docked, (l) => l.bagsReceived);
  const totalShip = sum(docked, (l) => l.shipments);
  const shipIn = sum(docked, (l) => l.shipmentsScanned);
  const open = inboundDiscrepancies.filter((d) => d.status !== "resolved");
  const count = (k: string) => open.filter((d) => d.kind === k).length;

  const selectedBags = bags.filter((b) => b.lineHaulId === selected.id);
  const pendingBags = bags
    .filter((b) => b.lineHaulId === receiving.id && b.status === "pending")
    .map((b) => ({ id: b.id, shipments: b.shipments, beat: b.beatCode }));
  const sorted = sum(sortByBeat, (s) => s.sorted);
  const expected = sum(sortByBeat, (s) => s.expected);

  return (
    <>
      <PageHeader
        title="Inbound and sorting"
        description="Line haul arrivals, bag manifests and the sort to delivery beats for today."
        actions={
          <>
            <ToastButton label="Print beat labels" icon="printer" message="Beat route labels sent to the sort station printer" size="md" />
            <ToastButton label="Close inbound" icon="check" variant="primary" message="Inbound cannot close: 2 line hauls still expected today" size="md" />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Line hauls today" value={`${docked.length} of ${lineHauls.length}`} hint={`${lineHauls.filter((l) => l.status === "delayed").length} delayed, next ETA ${formatTime(lineHauls.find((l) => !l.arrivedAt)!.etaAt)}`} icon={Truck} />
        <MetricTile label="Bags received" value={`${bagsIn} of ${totalBags}`} hint={`${totalBags - bagsIn} bags still on the dock`} icon={PackageOpen} />
        <MetricTile label="Shipments in-scanned" value={formatNumber(shipIn)} hint={`${Math.round((shipIn / totalShip) * 100)}% of ${formatNumber(totalShip)} manifested`} icon={ScanLine} />
        <MetricTile label="Open discrepancies" value={open.length} tone={open.length ? "warning" : "neutral"} hint={`${count("short")} short, ${count("excess")} excess, ${count("damaged")} damaged, ${count("misrouted")} misrouted`} icon={CircleAlert} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Line haul arrivals" description="Hub-to-hub manifests into BLR-DH-WFD today" />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Vehicle</TH>
                    <TH>From</TH>
                    <TH>Arrival</TH>
                    <TH>Status</TH>
                    <TH>Bags</TH>
                  </TR>
                </THead>
                <TBody>
                  {lineHauls.map((l) => {
                    const origin = getHub(l.originHubId)!;
                    return (
                      <TR key={l.id} className={cn(l.status === "delayed" && "bg-warning-50/40")}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
                              {l.mode === "air" ? <Plane size={14} aria-hidden="true" /> : <Truck size={14} aria-hidden="true" />}
                            </span>
                            <div>
                              <Mono className="font-medium text-ink-900">{l.vehicle}</Mono>
                              <p className="font-mono text-[11px] text-ink-500">{l.manifestId}</p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <p className="text-[13px] text-ink-900">{origin.name.replace(" Fulfilment Centre", " FC").replace(" Sort Centre", " SC")}</p>
                          <Mono className="text-xs text-ink-500">{origin.code}</Mono>
                        </TD>
                        <TD>
                          <p className={cn("text-[13px] font-medium tabular-nums", l.delayMins >= 30 ? "text-warning-700" : "text-ink-900")}>
                            {l.arrivedAt ? formatTime(l.arrivedAt) : `ETA ${formatTime(l.etaAt)}`}
                          </p>
                          <p className="text-xs whitespace-nowrap text-ink-500">
                            Due {formatTime(l.scheduledAt)}
                            {l.delayMins > 0 ? `, ${l.delayMins} min late` : ""}
                          </p>
                        </TD>
                        <TD>
                          <StatusBadge meta={LINEHAUL_STATUS[l.status]} size="sm" />
                          <p className="mt-1 text-xs whitespace-nowrap text-ink-500">
                            {l.dock ?? "No dock yet"}
                            {l.seal !== "Pending" && !l.sealIntact && <span className="font-medium text-danger-700">, seal mismatch</span>}
                          </p>
                        </TD>
                        <TD>
                          {l.arrivedAt ? (
                            <div className="flex items-center gap-2.5">
                              <Progress value={l.bagsReceived} max={l.bags} size="sm" tone={l.bagsReceived >= l.bags ? "success" : "brand"} className="w-16" label={`Bags received for ${l.id}`} />
                              <span className="text-xs text-ink-600 tabular-nums">
                                {l.bagsReceived}/{l.bags}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-500 tabular-nums">{l.bags} expected</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
          </Card>

          <Card>
            <CardHeader title="Bags and manifests" description="Scan each bag in, then debag and in-scan every shipment" />
            <div className="mt-2 px-5">
              <TabLinks
                variant="pill"
                active={selected.id}
                items={docked.map((l) => ({ key: l.id, label: getHub(l.originHubId)!.code, href: `/logistics/inbound${qs({ lh: l.id })}`, count: l.bags }))}
              />
            </div>
            <TableContainer className="mt-3 max-h-[26rem] overflow-y-auto">
              <Table>
                <THead className="sticky top-0 z-10 bg-ink-50">
                  <TR>
                    <TH>Bag</TH>
                    <TH>Beat</TH>
                    <TH align="right">Shipments</TH>
                    <TH className="min-w-32">Scanned</TH>
                    <TH align="right">Weight</TH>
                    <TH>Status</TH>
                    <TH align="right">Received</TH>
                  </TR>
                </THead>
                <TBody>
                  {selectedBags.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <Mono className="font-medium text-ink-900">{b.id}</Mono>
                      </TD>
                      <TD>
                        <Mono className="text-ink-700">{b.beatCode}</Mono>
                      </TD>
                      <TD align="right">{b.shipments}</TD>
                      <TD>
                        <SegmentBar
                          size="sm"
                          className="w-24"
                          total={b.shipments}
                          segments={[{ value: b.scanned, tone: b.status === "short" ? "danger" : b.scanned >= b.shipments ? "success" : "brand", label: "Scanned" }]}
                        />
                      </TD>
                      <TD align="right" className="text-[13px]">
                        {b.weightKg} kg
                      </TD>
                      <TD>
                        <StatusBadge meta={BAG_STATUS[b.status]} size="sm" />
                      </TD>
                      <TD align="right" className="text-[13px] text-ink-500">
                        {b.scannedAt ? formatTime(b.scannedAt) : "Waiting"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Receiving now"
              description={`${getHub(receiving.originHubId)!.name}, ${receiving.dock}`}
              action={<StatusBadge meta={LINEHAUL_STATUS[receiving.status]} size="sm" />}
            />
            <div className="px-5 pt-4 pb-5">
              <ScanReceive
                lineHaulId={receiving.id}
                bags={receiving.bags}
                bagsReceived={receiving.bagsReceived}
                shipments={receiving.shipments}
                shipmentsScanned={receiving.shipmentsScanned}
                pendingBags={pendingBags}
              />
            </div>
          </Card>

          {atDock.map((l) => (
            <Note key={l.id} icon={ShieldAlert} tone={l.sealIntact ? "info" : "danger"}>
              <span className="font-medium">
                {l.vehicle} at {l.dock}: {l.sealIntact ? "seal intact" : "seal number does not match the manifest"}.
              </span>{" "}
              {l.sealIntact ? "Ready to unload." : "Unload under CCTV with the security lead and weigh every bag before debagging."}
            </Note>
          ))}

          <Card>
            <CardHeader title="Sort to beats" description={`${formatNumber(sorted)} of ${formatNumber(expected)} shipments sorted`} />
            <ul className="flex flex-col gap-3 px-5 pt-4 pb-5">
              {sortByBeat.map((s) => (
                <li key={s.beat.code}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-ink-700">
                      <Mono className="text-xs text-ink-500">{s.beat.code}</Mono> {s.beat.name}
                    </span>
                    <span className="shrink-0 text-ink-900 tabular-nums">
                      <span className="font-medium">{s.sorted}</span>
                      <span className="text-ink-400"> / {s.expected}</span>
                    </span>
                  </div>
                  <Progress value={s.sorted} max={s.expected} size="sm" tone={s.sorted / s.expected < 0.75 ? "warning" : "brand"} label={`${s.beat.name} sorted`} />
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
              Beats under 75% sorted are highlighted. {beats.length} beats served from this hub.
            </p>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Discrepancies"
          description="Short, excess, damaged and misrouted shipments against bag manifests"
          action={<Badge tone={open.length ? "warning" : "success"}>{open.length} open</Badge>}
        />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>AWB</TH>
                <TH>Type</TH>
                <TH>Line haul and bag</TH>
                <TH className="min-w-72">Note</TH>
                <TH align="right">Value</TH>
                <TH>Status</TH>
                <TH align="right">Raised</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {inboundDiscrepancies.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Mono className="font-medium text-ink-900">{d.awb}</Mono>
                    <p className="font-mono text-[11px] text-ink-500">{d.id}</p>
                  </TD>
                  <TD>
                    <StatusBadge meta={DISCREPANCY_KIND[d.kind]} size="sm" />
                  </TD>
                  <TD>
                    <Mono className="text-xs text-ink-700">{d.lineHaulId}</Mono>
                    <p className="font-mono text-[11px] text-ink-500">{d.bagId}</p>
                  </TD>
                  <TD className="text-[13px] whitespace-normal text-ink-600">{d.note}</TD>
                  <TD align="right" className="text-[13px]">
                    {formatINR(d.value)}
                  </TD>
                  <TD>
                    <Badge tone={d.status === "resolved" ? "success" : d.status === "investigating" ? "info" : "warning"} size="sm">
                      {d.status === "resolved" ? "Resolved" : d.status === "investigating" ? "Investigating" : "Open"}
                    </Badge>
                  </TD>
                  <TD align="right" className="text-[13px] text-ink-500">
                    {formatTime(d.raisedAt)}
                  </TD>
                  <TD align="right">
                    {d.status !== "resolved" && <ToastButton label="Escalate" size="xs" variant="ghost" message={`${d.id} escalated to the origin hub and Logistics Admin`} />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
          Damaged shipments are held for QC and auto-raise a courier claim. See the{" "}
          <Link href="/logistics/reverse?tab=rto" className="font-medium text-brand-700 hover:underline">
            RTO queue
          </Link>{" "}
          for shipments returning to origin.
        </p>
      </Card>
    </>
  );
}

