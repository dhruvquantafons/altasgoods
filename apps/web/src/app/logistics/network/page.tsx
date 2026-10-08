import { ArrowRight, Building2, Plane, Route, Truck, Warehouse } from "lucide-react";
import { HUB_TYPE } from "@/components/logistics/meta";
import { MetricTile, Mono } from "@/components/logistics/ops-ui";
import { PincodeChecker, type OriginOption } from "@/components/logistics/pincode-checker";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CURRENT_HUB_ID, getHub, hubs } from "@/lib/mock";
import { hubThroughput, lanes, pincodeDirectory } from "@/lib/mock/ops-extra";
import type { Tone } from "@/lib/status";
import { cn, formatNumber, sum } from "@/lib/utils";

export const metadata = { title: "Hubs and line haul" };

function utilTone(u: number): Tone {
  return u >= 90 ? "danger" : u >= 85 ? "warning" : "brand";
}

export default function NetworkPage() {
  const origins: OriginOption[] = [
    { id: "h-blr-fc", code: "BLR-FC-01", name: "Hoskote FC, Bengaluru", cityPrefixes: ["560", "562"], region: "South" },
    { id: "h-bom-fc", code: "BOM-FC-02", name: "Bhiwandi FC, Mumbai", cityPrefixes: ["400", "401", "421"], region: "West" },
    { id: "h-del-fc", code: "DEL-FC-01", name: "Farukhnagar FC, Gurugram", cityPrefixes: ["110", "122", "201"], region: "North" },
  ];
  const hubNames = Object.fromEntries(hubs.map((h) => [h.id, `${h.name} (${h.code})`]));
  const order = { fulfillment_center: 0, sort_center: 1, delivery_hub: 2 } as const;
  const sorted = [...hubs].sort((a, b) => order[a.type] - order[b.type] || b.utilisation - a.utilisation);

  return (
    <>
      <PageHeader title="Hubs and line haul" description="The AltasGoods Logistics network: nodes, utilisation, lanes with transit times, and pincode serviceability." />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Fulfilment centres" value={hubs.filter((h) => h.type === "fulfillment_center").length} hint={`${formatNumber(sum(hubs.filter((h) => h.type === "fulfillment_center"), (h) => h.capacity))} units per day capacity`} icon={Warehouse} />
        <MetricTile label="Sort centres" value={hubs.filter((h) => h.type === "sort_center").length} hint="Primary sort for inter-region lanes" icon={Building2} />
        <MetricTile label="Delivery hubs" value={hubs.filter((h) => h.type === "delivery_hub").length} hint={`${hubs.filter((h) => h.type === "delivery_hub" && h.utilisation >= 85).length} above 85% utilisation`} icon={Truck} />
        <MetricTile label="Line haul lanes" value={lanes.length} hint={`${lanes.filter((l) => l.mode === "air").length} air, ${lanes.filter((l) => l.mode === "surface").length} surface`} icon={Route} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Nodes" description="Daily capacity in shipments (units for FCs), utilisation and today's volume" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Node</TH>
                  <TH align="right">Capacity</TH>
                  <TH className="min-w-36">Utilisation</TH>
                  <TH align="right">In / out today</TH>
                  <TH align="right">On-time</TH>
                </TR>
              </THead>
              <TBody>
                {sorted.map((h) => {
                  const t = hubThroughput[h.id];
                  const mine = h.id === CURRENT_HUB_ID;
                  return (
                    <TR key={h.id} className={cn(mine && "bg-brand-50/50 hover:bg-brand-50/60")}>
                      <TD className={cn(mine && "shadow-[inset_2px_0_0_var(--color-brand-600)]")}>
                        <p className="text-[13px] font-medium text-ink-900">
                          {h.name}
                          {mine && <span className="ml-2 text-xs font-normal text-brand-700">This hub</span>}
                        </p>
                        <p className="text-xs text-ink-500">
                          <Mono className="text-xs">{h.code}</Mono>, {HUB_TYPE[h.type].toLowerCase()}, {h.city}
                        </p>
                      </TD>
                      <TD align="right">{formatNumber(h.capacity)}</TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Progress value={h.utilisation} size="sm" tone={utilTone(h.utilisation)} className="w-20" label={`${h.name} utilisation`} />
                          <span className={cn("text-xs font-medium tabular-nums", h.utilisation >= 90 ? "text-danger-700" : h.utilisation >= 85 ? "text-warning-700" : "text-ink-600")}>{h.utilisation}%</span>
                        </div>
                      </TD>
                      <TD align="right" className="text-[13px]">
                        {t ? `${formatNumber(t.inbound)} / ${formatNumber(t.outbound)}` : "-"}
                      </TD>
                      <TD align="right" className={cn("text-[13px]", t && t.slaPct < 95 ? "text-warning-700" : "text-ink-700")}>
                        {t ? `${t.slaPct}%` : "-"}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Pincode serviceability" description="Promise days, COD and returns for any pincode" />
          <div className="px-5 pt-4 pb-5">
            <PincodeChecker directory={pincodeDirectory} origins={origins} hubNames={hubNames} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Line haul lanes" description="Scheduled hub-to-hub movements with transit time, departures and performance over the last 30 days" />
        <TableContainer className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Lane</TH>
                <TH>Mode</TH>
                <TH align="right">Distance</TH>
                <TH align="right">Transit</TH>
                <TH>Departures</TH>
                <TH>Cut-off</TH>
                <TH align="right">On-time</TH>
                <TH className="min-w-32">Load factor</TH>
              </TR>
            </THead>
            <TBody>
              {lanes.map((l) => {
                const from = getHub(l.from)!;
                const to = getHub(l.to)!;
                return (
                  <TR key={l.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Mono className="font-medium text-ink-900">{from.code}</Mono>
                        <ArrowRight size={14} className="text-ink-400" aria-hidden="true" />
                        <Mono className="font-medium text-ink-900">{to.code}</Mono>
                      </div>
                      <p className="text-xs text-ink-500">
                        {from.city} to {to.city}
                      </p>
                    </TD>
                    <TD>
                      {l.mode === "air" ? (
                        <Badge tone="info" size="sm" icon={Plane}>
                          Air
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm" icon={Truck}>
                          Surface
                        </Badge>
                      )}
                    </TD>
                    <TD align="right">{formatNumber(l.distanceKm)} km</TD>
                    <TD align="right">{l.transitHours} h</TD>
                    <TD className="text-[13px]">{l.departures.join(", ").toLowerCase()}</TD>
                    <TD className="text-[13px]">{l.cutoff.toLowerCase()}</TD>
                    <TD align="right" className={cn(l.onTimePct < 88 ? "font-medium text-warning-700" : "text-ink-700")}>
                      {l.onTimePct}%
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Progress value={l.loadFactor} size="sm" tone={l.loadFactor >= 90 ? "warning" : "brand"} className="w-20" label={`Load factor ${l.id}`} />
                        <span className="text-xs text-ink-600 tabular-nums">{l.loadFactor}%</span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
          Transit targets: local 1 day, regional 2 to 3, metro to metro 3 to 4, rest of India 4 to 6, special zones 6 to 9 days.
        </p>
      </Card>
    </>
  );
}
