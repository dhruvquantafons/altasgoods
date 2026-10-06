import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, CircleCheck, CircleDot, MapPin, PackageCheck, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { ASSOCIATE_STATUS, VEHICLE } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { durationLabel, formatDay, formatDayTime, formatRelativeDay, KeyRow, maskPhone, Mono, Note, shortName } from "@/components/logistics/ops-ui";
import { ShipmentActions, type AssigneeOption } from "@/components/logistics/shipment-actions";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { associates, CURRENT_HUB_ID, getOrder, sellerName, shipments } from "@/lib/mock";
import { runsheetFor, shipmentJourney, type RouteNode } from "@/lib/mock/ops-extra";
import { NDR_REASON, SHIPMENT_STATUS, type ShipmentStatus } from "@/lib/status";
import { addDays, cn, formatINR, NOW, timeAgo } from "@/lib/utils";

export function generateStaticParams() {
  return shipments.map((s) => ({ awb: s.id }));
}

export async function generateMetadata(props: PageProps<"/logistics/shipments/[awb]">) {
  const { awb } = await props.params;
  return { title: `Shipment ${awb}` };
}

const ACTIONABLE: ShipmentStatus[] = ["at_destination_hub", "out_for_delivery", "ndr"];
const RTO_ABLE: ShipmentStatus[] = ["in_transit", "at_destination_hub", "out_for_delivery", "ndr"];

export default async function ShipmentDetailPage(props: PageProps<"/logistics/shipments/[awb]">) {
  const { awb } = await props.params;
  const s = shipments.find((x) => x.id === awb);
  if (!s) notFound();

  const j = shipmentJourney(s);
  const order = getOrder(s.orderId);
  const da = associates.find((a) => a.id === s.associateId);
  const daRun = da ? runsheetFor(da.id) : undefined;
  const open = !["delivered", "rto_delivered", "lost", "damaged"].includes(s.status);

  const options: AssigneeOption[] = associates
    .filter((a) => a.hubId === CURRENT_HUB_ID && a.status !== "off_duty")
    .map((a) => {
      const r = runsheetFor(a.id);
      return {
        id: a.id,
        name: a.name,
        vehicle: VEHICLE[a.vehicle],
        status: ASSOCIATE_STATUS[a.status].label.toLowerCase(),
        remaining: r ? r.stops - r.delivered - r.failed - r.pickedUp : 0,
        runsheetId: r?.id,
      };
    })
    .sort((a, b) => a.remaining - b.remaining);

  const dates: { value: string; label: string; hint: string }[] = [];
  for (let d = 1; dates.length < 3 && d < 8; d++) {
    const day = addDays(NOW, d);
    if (day.getDay() === 0) continue;
    dates.push({ value: day.toISOString().slice(0, 10), label: formatDay(day), hint: d === 1 ? "Tomorrow" : `In ${d} days` });
  }

  const lane = `BLR-DH-WFD to ${j.route[0]!.code}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Shipments", href: "/logistics/shipments" }, { label: s.id }]}
        title={<span className="font-mono tracking-tight">{s.id}</span>}
        meta={
          <>
            <StatusBadge meta={SHIPMENT_STATUS[s.status]} />
            {j.secure && (
              <Badge tone="brand" icon={ShieldCheck}>
                Secure Delivery
              </Badge>
            )}
            {j.openBox && <Badge tone="info">Open Box</Badge>}
            {s.cod ? <Badge tone="warning">COD {formatINR(s.codAmount)}</Badge> : <Badge tone="neutral">Prepaid</Badge>}
            <span className="text-[13px] text-ink-500">
              Promised {formatRelativeDay(s.promisedBy)}, updated {timeAgo(s.lastUpdate)}
            </span>
          </>
        }
        actions={<ShipmentActions awb={s.id} canAct={ACTIONABLE.includes(s.status)} canRto={RTO_ABLE.includes(s.status)} currentAssociateId={s.associateId} options={options} dates={dates} originLane={lane} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Route" description={`${j.service}, ${s.weightKg} kg, ${j.dims}`} />
            <div className="px-5 pt-4 pb-5">
              <RouteStrip nodes={j.route} />
            </div>
          </Card>

          {s.status === "ndr" && j.ndr && (
            <Note icon={CircleDot} tone="warning">
              <span className="font-medium">NDR open: {NDR_REASON[j.ndr.reason]}.</span> Attempt {j.ndr.attempts} of 3.{" "}
              {j.ndr.response.kind === "none" ? "No customer response yet; auto re-attempt next working day." : `Customer response: ${j.ndr.response.kind.replace(/_/g, " ")}${j.ndr.response.note ? `, ${j.ndr.response.note}` : ""}.`}{" "}
              <Link href="/logistics/ndr" className="font-medium underline underline-offset-2">
                Open NDR queue
              </Link>
            </Note>
          )}

          <Card>
            <CardHeader title="Scan history" description="Newest first. Every scan is geo and device stamped." />
            <div className="px-5 pt-4 pb-5">
              <Timeline
                items={j.scans.map((e, i) => ({
                  title: e.title,
                  time: formatDayTime(e.at),
                  tone: e.tone === "info" ? "info" : e.tone,
                  done: true,
                  description: (
                    <span>
                      {e.location}
                      {e.detail && <span className="text-ink-400">{"  ·  "}</span>}
                      {e.detail && <span className={cn(i === 0 ? "text-ink-700" : undefined)}>{e.detail}</span>}
                    </span>
                  ),
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery attempts" description="Maximum 3 attempts within 5 days of the first attempt" />
            {j.attempts.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No attempts yet. {s.status === "out_for_delivery" ? `On ${da?.name ?? "an associate"}'s runsheet today.` : "The first attempt happens after the shipment is on a runsheet."}</p>
            ) : (
              <TableContainer className="mt-3">
                <Table>
                  <THead>
                    <TR>
                      <TH>Attempt</TH>
                      <TH>Time</TH>
                      <TH>Associate</TH>
                      <TH>Outcome</TH>
                      <TH align="right">Geo distance</TH>
                      <TH>Customer called</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {j.attempts.map((a) => (
                      <TR key={a.n}>
                        <TD className="font-medium text-ink-900">{a.n}</TD>
                        <TD className="text-[13px]">{formatDayTime(a.at)}</TD>
                        <TD className="text-[13px]">{associates.find((x) => x.id === a.associateId)?.name ?? "Associate"}</TD>
                        <TD>
                          {a.outcome === "delivered" ? (
                            <Badge tone="success" dot size="sm">
                              Delivered
                            </Badge>
                          ) : (
                            <div>
                              <Badge tone="warning" dot size="sm">
                                Failed
                              </Badge>
                              <p className="mt-1 text-xs text-ink-500">{a.reason ? NDR_REASON[a.reason] : "No reason"}</p>
                            </div>
                          )}
                        </TD>
                        <TD align="right" className={cn("text-[13px]", a.geoDistanceM > 500 ? "font-medium text-danger-700" : "text-ink-700")}>
                          {a.geoDistanceM} m{a.geoDistanceM > 500 && <p className="text-[11px] font-medium">Fake attempt flag</p>}
                        </TD>
                        <TD className="text-[13px]">{a.called ? "Yes, 2 calls" : <span className="font-medium text-danger-700">No call made</span>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Proof of delivery"
              action={
                j.pod?.otpVerified ? (
                  <Badge tone="success" icon={ShieldCheck}>
                    OTP verified
                  </Badge>
                ) : j.pod ? (
                  <Badge tone="neutral">Photo and signature</Badge>
                ) : undefined
              }
            />
            {j.pod ? (
              <div className="grid gap-5 px-5 pt-3 pb-5 sm:grid-cols-[180px_1fr]">
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-ink-50 text-ink-500">
                  <Camera size={22} strokeWidth={1.6} aria-hidden="true" />
                  <span className="text-xs">Doorstep photo</span>
                </div>
                <dl className="divide-y divide-line">
                  <KeyRow label="Delivered at">{formatDayTime(j.pod.at)}</KeyRow>
                  <KeyRow label="Received by">{j.pod.receiver}</KeyRow>
                  <KeyRow label="Verification">{j.pod.otpVerified ? "Secure Delivery OTP matched" : "Photo and receiver name"}</KeyRow>
                  <KeyRow label="Geo-tag">{j.pod.geoDistanceM} m from geocoded address</KeyRow>
                  <KeyRow label="Payment at door">{j.pod.method === "Prepaid" ? "Prepaid, nothing collected" : `${formatINR(s.codAmount)} by ${j.pod.method}`}</KeyRow>
                </dl>
              </div>
            ) : (
              <p className="px-5 pt-2 pb-5 text-[13px] leading-relaxed text-ink-500">
                Captured in AltasGoods Rider at the door: {j.secure ? "the customer's Secure Delivery OTP, " : ""}a doorstep photo, the receiver&apos;s name and a geo-tag. Nothing captured yet.
              </p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Customer"
              description="Contact details are masked by default"
              action={<ToastButton label="Reveal" size="xs" variant="ghost" message="Reveal requested. Logged to the audit trail with your role." />}
            />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Name">{shortName(s.customerName)}</KeyRow>
              <KeyRow label="Phone">
                <Mono>{maskPhone(j.phone)}</Mono>
              </KeyRow>
              <KeyRow label="Address">
                <span className="block font-normal text-ink-700">{j.addressLine}</span>
                <span className="block font-normal text-ink-700">{s.city}</span>
              </KeyRow>
              <KeyRow label="Pincode">
                <Mono>{s.pincode}</Mono>
              </KeyRow>
              <KeyRow label="Landmark">
                <span className="font-normal text-ink-700">{j.landmark}</span>
              </KeyRow>
              {j.beat && (
                <KeyRow label="Beat">
                  {j.beat.name} <Mono className="text-xs text-ink-500">{j.beat.code}</Mono>
                </KeyRow>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Mode">{s.cod ? "Cash on delivery" : "Prepaid"}</KeyRow>
              {s.cod && <KeyRow label="To collect">{formatINR(s.codAmount)}</KeyRow>}
              {s.cod && (
                <KeyRow label="Status">
                  {s.status === "delivered" ? (
                    <Badge tone="success" size="sm">
                      Collected
                    </Badge>
                  ) : open ? (
                    <Badge tone="warning" size="sm">
                      Due at door
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Not collected
                    </Badge>
                  )}
                </KeyRow>
              )}
              {order && <KeyRow label="Order value">{formatINR(order.total)}</KeyRow>}
              {s.cod && <p className="mt-2 text-xs leading-relaxed text-ink-500">Cash or dynamic UPI QR at the door. No COD surcharge. Deposited at the hub cashier at end of shift.</p>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Associate" />
            {da ? (
              <div className="px-5 pt-3 pb-5">
                <div className="flex items-center gap-3">
                  <Avatar name={da.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{da.name}</p>
                    <p className="text-xs text-ink-500">
                      {VEHICLE[da.vehicle]}, rated {da.rating.toFixed(1)}
                    </p>
                  </div>
                  <StatusBadge meta={ASSOCIATE_STATUS[da.status]} size="sm" />
                </div>
                <dl className="mt-3 border-t border-line pt-1">
                  <KeyRow label="Phone">
                    <Mono>{maskPhone(da.phone)}</Mono>
                  </KeyRow>
                  {daRun && (
                    <KeyRow label="Runsheet">
                      <Link href={`/logistics/runs?rs=${daRun.id}`} className="font-mono text-[13px] text-brand-700 hover:underline">
                        {daRun.id}
                      </Link>
                    </KeyRow>
                  )}
                  {daRun?.dispatchedAt && <KeyRow label="On road for">{durationLabel((NOW.getTime() - new Date(daRun.dispatchedAt).getTime()) / 60_000)}</KeyRow>}
                </dl>
                <ToastButton label="Call associate" icon="phone" message={`Calling ${da.name} through the masked bridge line`} className="mt-3 w-full" />
              </div>
            ) : (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">Not on a runsheet yet.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Shipment" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Order">
                <Mono>{s.orderId}</Mono>
              </KeyRow>
              <KeyRow label="Seller">{sellerName(s.sellerId)}</KeyRow>
              <KeyRow label="Service">{j.service}</KeyRow>
              <KeyRow label="Weight">{s.weightKg} kg</KeyRow>
              <KeyRow label="Promised by">{formatDay(s.promisedBy)}</KeyRow>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

const roleIcon = { Origin: Warehouse, "Sort centre": Truck, "Delivery hub": PackageCheck, Customer: MapPin } as const;

function RouteStrip({ nodes }: { nodes: RouteNode[] }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {nodes.map((n, i) => {
        const Icon = roleIcon[n.role];
        const last = i === nodes.length - 1;
        return (
          <li key={n.role + n.code} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-1 sm:flex-col sm:gap-2.5 sm:pb-0">
            {!last && (
              <span
                className={cn(
                  "absolute top-9 left-[17px] h-[calc(100%-36px)] w-0.5 sm:top-[17px] sm:left-9 sm:h-0.5 sm:w-[calc(100%-36px)]",
                  n.state === "done" ? "bg-brand-500" : "bg-ink-200",
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                n.state === "done" ? "bg-brand-600 text-white" : n.state === "current" ? "border-2 border-brand-600 bg-white text-brand-700" : "bg-ink-100 text-ink-400",
              )}
            >
              {n.state === "done" && last ? <CircleCheck size={17} aria-hidden="true" /> : <Icon size={16} strokeWidth={1.9} aria-hidden="true" />}
            </span>
            <div className="min-w-0 sm:pr-4">
              <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-400 uppercase">{n.role}</p>
              <p className={cn("text-[13px] leading-snug font-medium", n.state === "next" ? "text-ink-500" : "text-ink-900")}>{n.name}</p>
              <Mono className="text-xs text-ink-500">{n.code}</Mono>
              <p className="mt-0.5 text-xs text-ink-500">{n.at ? formatDayTime(n.at) : n.state === "current" ? "In progress" : "Pending"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

