import Link from "next/link";
import { ChevronRight, PackageSearch, Search } from "lucide-react";
import { AutoSubmitForm, ToastButton } from "@/components/logistics/ops-client";
import { AttemptPips, formatRelativeDay, isToday, minsUntil, Mono, one, Pager, qs } from "@/components/logistics/ops-ui";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { associates, CURRENT_HUB_ID, shipments } from "@/lib/mock";
import { beatForPincode } from "@/lib/mock/ops-extra";
import { SHIPMENT_STATUS, type ShipmentStatus } from "@/lib/status";
import type { Shipment } from "@/lib/types";
import { cn, formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Shipments" };

const TABS: { key: string; label: string; statuses: ShipmentStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "inbound", label: "Inbound", statuses: ["pickup_scheduled", "picked_up", "at_origin_hub", "in_transit"] },
  { key: "at_hub", label: "At hub", statuses: ["at_destination_hub"] },
  { key: "ofd", label: "Out for delivery", statuses: ["out_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "ndr", label: "NDR", statuses: ["ndr"] },
  { key: "rto", label: "RTO", statuses: ["rto_initiated", "rto_in_transit", "rto_delivered"] },
  { key: "exceptions", label: "Damaged or lost", statuses: ["damaged", "lost"] },
];

const PAGE_SIZE = 20;
const TERMINAL: ShipmentStatus[] = ["delivered", "rto_delivered", "lost", "damaged"];

export default async function ShipmentsPage(props: PageProps<"/logistics/shipments">) {
  const sp = await props.searchParams;
  const status = one(sp.status) ?? "all";
  const q = (one(sp.q) ?? "").trim();
  const pin = one(sp.pin) ?? "";
  const pay = one(sp.pay) ?? "";
  const da = one(sp.da) ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const mine = shipments.filter((s) => s.destinationHubId === CURRENT_HUB_ID);
  const pincodes = [...new Set(mine.map((s) => s.pincode))].sort();
  const hubDAs = associates.filter((a) => a.hubId === CURRENT_HUB_ID);
  const daOptions = associates.filter((a) => hubDAs.includes(a) || mine.some((s) => s.associateId === a.id));

  // filters other than the status tab, so tab counts reflect the current search
  const base = mine.filter(
    (s) =>
      (!q || s.id.toLowerCase().includes(q.toLowerCase()) || s.orderId.toLowerCase().includes(q.toLowerCase())) &&
      (!pin || s.pincode === pin) &&
      (!pay || (pay === "cod" ? s.cod : !s.cod)) &&
      (!da || s.associateId === da),
  );
  const tab = TABS.find((t) => t.key === status) ?? TABS[0]!;
  const rows = base
    .filter((s) => !tab.statuses || tab.statuses.includes(s.status))
    .sort((a, b) => +new Date(b.lastUpdate) - +new Date(a.lastUpdate));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const params = { status: status === "all" ? undefined : status, q: q || undefined, pin: pin || undefined, pay: pay || undefined, da: da || undefined };
  const daName = (id?: string) => associates.find((a) => a.id === id)?.name;
  const filtered = Boolean(q || pin || pay || da);

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Every forward shipment routed to Whitefield Delivery Hub, from line haul to doorstep."
        actions={
          <>
            <ToastButton label="Export" icon="download" message={`${rows.length} shipments exported as CSV`} size="md" />
            <ToastButton label="Print labels" icon="printer" variant="primary" message="Route labels sent to the sort station printer" size="md" />
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-5 pt-1">
          <TabLinks
            active={tab.key}
            items={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              href: `/logistics/shipments${qs({ ...params, status: t.key === "all" ? undefined : t.key })}`,
              count: base.filter((s) => !t.statuses || t.statuses.includes(s.status)).length,
            }))}
          />
        </div>

        <AutoSubmitForm action="/logistics/shipments" className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} icon={Search} inputSize="sm" placeholder="Search AWB or order ID" aria-label="Search AWB or order ID" className="w-full sm:w-64" />
          <Select name="pin" defaultValue={pin} selectSize="sm" aria-label="Pincode" className="w-[calc(50%-4px)] sm:w-40">
            <option value="">All pincodes</option>
            {pincodes.map((p) => (
              <option key={p} value={p}>
                {p} {beatForPincode(p)?.locality}
              </option>
            ))}
          </Select>
          <Select name="pay" defaultValue={pay} selectSize="sm" aria-label="Payment" className="w-[calc(50%-4px)] sm:w-36">
            <option value="">All payments</option>
            <option value="cod">COD only</option>
            <option value="prepaid">Prepaid only</option>
          </Select>
          <Select name="da" defaultValue={da} selectSize="sm" aria-label="Delivery associate" className="w-full sm:w-44">
            <option value="">All associates</option>
            {daOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Search
          </button>
          {filtered && (
            <Link href={`/logistics/shipments${qs({ status: params.status })}`} className="px-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Clear filters
            </Link>
          )}
        </AutoSubmitForm>

        {paged.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No shipments match"
            description={filtered ? "Try a different AWB, pincode or associate, or clear the filters." : "Nothing in this state right now."}
            className="border-t border-line"
          />
        ) : (
          <>
            {/* Desktop table */}
            <TableContainer className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>AWB</TH>
                    <TH>Customer</TH>
                    <TH>Pincode</TH>
                    <TH>Status</TH>
                    <TH>Associate</TH>
                    <TH align="right">Payment</TH>
                    <TH>Promised</TH>
                    <TH>Attempts</TH>
                    <TH align="right">Updated</TH>
                  </TR>
                </THead>
                <TBody>
                  {paged.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <Link href={`/logistics/shipments/${s.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {s.id}
                        </Link>
                        <p className="font-mono text-[11px] text-ink-500">{s.orderId}</p>
                      </TD>
                      <TD>
                        <p className="text-[13px] font-medium text-ink-900">{s.customerName}</p>
                        <p className="text-xs text-ink-500">{s.city.split(",")[0]}</p>
                      </TD>
                      <TD>
                        <Mono className="text-ink-700">{s.pincode}</Mono>
                      </TD>
                      <TD>
                        <StatusBadge meta={SHIPMENT_STATUS[s.status]} size="sm" />
                      </TD>
                      <TD className="text-[13px]">{daName(s.associateId) ?? <span className="text-ink-400">Not assigned</span>}</TD>
                      <TD align="right">
                        {s.cod ? (
                          <>
                            <span className="text-[13px] font-medium text-ink-900">{formatINR(s.codAmount)}</span>
                            <p className="text-[11px] font-medium text-warning-700">COD</p>
                          </>
                        ) : (
                          <span className="text-[13px] text-ink-500">Prepaid</span>
                        )}
                      </TD>
                      <TD>
                        <PromiseDate s={s} />
                      </TD>
                      <TD>
                        {s.status === "delivered" ? (
                          <span className="text-xs font-medium text-success-700">{s.attempts <= 1 ? "First attempt" : `Attempt ${s.attempts}`}</span>
                        ) : s.attempts > 0 ? (
                          <AttemptPips attempts={s.attempts} />
                        ) : (
                          <span className="text-xs text-ink-400">None yet</span>
                        )}
                      </TD>
                      <TD align="right" className="text-[13px] text-ink-500">
                        {timeAgo(s.lastUpdate)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>

            {/* Mobile list */}
            <ul className="divide-y divide-line border-t border-line md:hidden">
              {paged.map((s) => (
                <li key={s.id}>
                  <Link href={`/logistics/shipments/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-ink-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Mono className="font-medium text-ink-900">{s.id}</Mono>
                        <StatusBadge meta={SHIPMENT_STATUS[s.status]} size="sm" />
                      </div>
                      <p className="mt-1 truncate text-[13px] text-ink-700">
                        {s.customerName}, {s.city.split(",")[0]} <Mono className="text-xs text-ink-500">{s.pincode}</Mono>
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                        <span>{s.cod ? `COD ${formatINR(s.codAmount)}` : "Prepaid"}</span>
                        <PromiseDate s={s} />
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-ink-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} label="shipments" hrefFor={(p) => `/logistics/shipments${qs({ ...params, page: p > 1 ? p : undefined })}`} />
          </>
        )}
      </Card>
    </>
  );
}

function PromiseDate({ s }: { s: Shipment }) {
  const open = !TERMINAL.includes(s.status);
  const dueToday = open && isToday(s.promisedBy);
  const late = open && minsUntil(s.promisedBy) < 0 && !isToday(s.promisedBy);
  return (
    <span className={cn("text-[13px] whitespace-nowrap", late ? "font-medium text-danger-700" : dueToday ? "font-medium text-warning-700" : "text-ink-600")}>
      {formatRelativeDay(s.promisedBy)}
      {late && " (late)"}
    </span>
  );
}
