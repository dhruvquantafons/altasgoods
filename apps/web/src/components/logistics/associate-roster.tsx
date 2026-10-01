"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Flag, Phone, Route, ShieldCheck, UserX } from "lucide-react";
import { Sparkline } from "@/components/charts/static";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";
import { Avatar, Progress } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { StatusMeta } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";

export interface RosterRow {
  id: string;
  name: string;
  phone: string;
  statusKey: string;
  status: StatusMeta;
  vehicle: string;
  vehicleNo: string;
  beat?: string;
  runsheetId?: string;
  assigned: number;
  delivered: number;
  failed: number;
  pickups: number;
  codCollected: number;
  codToCollect: number;
  rating: number;
  firstAttemptRate: number;
  fakeFlags: number;
  checkedIn?: string;
  dispatched?: string;
  joined: string;
  kyc: "verified" | "pending";
  languages: string[];
  employment: string;
  last7: number[];
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "on_route", label: "On route" },
  { key: "available", label: "At hub" },
  { key: "on_break", label: "On break" },
  { key: "off_duty", label: "Off duty" },
];

export function AssociateRoster({ rows }: { rows: RosterRow[] }) {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { show, node } = useToast();
  const list = rows.filter((r) => filter === "all" || r.statusKey === filter);
  const current = rows.find((r) => r.id === openId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 px-5 py-3.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const n = rows.filter((r) => f.key === "all" || r.statusKey === f.key).length;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                filter === f.key ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100",
              )}
            >
              {f.label}
              <span className={cn("text-xs tabular-nums", filter === f.key ? "text-white/70" : "text-ink-400")}>{n}</span>
            </button>
          );
        })}
      </div>

      <TableContainer className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Associate</TH>
              <TH>Status</TH>
              <TH>Vehicle</TH>
              <TH align="right">Assigned</TH>
              <TH align="right">Delivered</TH>
              <TH align="right">Failed</TH>
              <TH align="right">COD collected</TH>
              <TH align="right">First attempt</TH>
              <TH align="right">Rating</TH>
              <TH>
                <span className="sr-only">Open</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {list.map((r) => (
              <TR key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} size="sm" />
                    <div>
                      <button type="button" className="text-left text-[13px] font-medium text-ink-900 hover:text-brand-700" onClick={() => setOpenId(r.id)}>
                        {r.name}
                      </button>
                      <p className="text-xs text-ink-500">{r.beat ?? "No runsheet today"}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <StatusBadge meta={r.status} size="sm" />
                </TD>
                <TD>
                  <p className="text-[13px] text-ink-800">{r.vehicle}</p>
                  <p className="font-mono text-[11px] text-ink-500">{r.vehicleNo}</p>
                </TD>
                <TD align="right">{r.assigned || "-"}</TD>
                <TD align="right" className="font-medium text-ink-900">
                  {r.assigned ? r.delivered : "-"}
                </TD>
                <TD align="right" className={cn(r.failed > 1 && "text-warning-700")}>
                  {r.assigned ? r.failed : "-"}
                </TD>
                <TD align="right">{r.assigned ? formatINR(r.codCollected) : "-"}</TD>
                <TD align="right" className={cn(r.firstAttemptRate < 90 && "text-warning-700")}>
                  {r.firstAttemptRate.toFixed(1)}%
                </TD>
                <TD align="right">{r.rating.toFixed(1)}</TD>
                <TD align="right">
                  <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>

      <ul className="divide-y divide-line border-t border-line md:hidden">
        {list.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <Avatar name={r.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">{r.name}</span>
                  <StatusBadge meta={r.status} size="sm" />
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {r.assigned ? `${r.delivered} of ${r.assigned} delivered, ${formatINR(r.codCollected)} COD` : "No runsheet today"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={!!current}
        onClose={() => setOpenId(null)}
        side="right"
        title={current?.name ?? ""}
        description={current ? `${current.employment} associate, ${current.vehicle.toLowerCase()}` : undefined}
        footer={
          current && (
            <>
              <Button variant="ghost" icon={UserX} className="mr-auto text-danger-700 hover:bg-danger-50" onClick={() => show(`Deactivation request for ${current.name} sent to the Logistics Admin`)}>
                Deactivate
              </Button>
              <Button variant="secondary" icon={Phone} onClick={() => show(`Calling ${current.name} through the masked bridge line`)}>
                Call
              </Button>
              {current.runsheetId && (
                <Link href={`/logistics/runs?rs=${current.runsheetId}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                  <Route size={17} aria-hidden="true" />
                  Open runsheet
                </Link>
              )}
            </>
          )
        }
      >
        {current && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Avatar name={current.name} size="lg" />
              <div className="min-w-0 flex-1">
                <StatusBadge meta={current.status} />
                <p className="mt-1 text-[13px] text-ink-500">
                  {current.checkedIn ? `Checked in at ${current.checkedIn}` : "Not checked in today"}
                  {current.dispatched ? `, out since ${current.dispatched}` : ""}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                { label: "Delivered today", value: current.assigned ? `${current.delivered} of ${current.assigned}` : "-" },
                { label: "Failed (NDR)", value: current.assigned ? current.failed : "-" },
                { label: "COD collected", value: current.assigned ? formatINR(current.codCollected) : "-" },
                { label: "COD still to collect", value: current.assigned ? formatINR(current.codToCollect - current.codCollected) : "-" },
              ].map((k) => (
                <div key={k.label} className="bg-white px-4 py-3">
                  <dt className="text-xs text-ink-500">{k.label}</dt>
                  <dd className="mt-0.5 text-base font-semibold text-ink-900 tabular-nums">{k.value}</dd>
                </div>
              ))}
            </dl>

            {current.assigned > 0 && (
              <section>
                <h3 className="text-[13px] font-semibold text-ink-900">Today&apos;s run</h3>
                <p className="mt-1 text-[13px] text-ink-500">
                  {current.beat}, runsheet <span className="font-mono">{current.runsheetId}</span>
                  {current.pickups ? `, ${current.pickups} return pickups` : ""}
                </p>
                <Progress value={current.delivered + current.failed} max={current.assigned} className="mt-3" label="Run progress" />
              </section>
            )}

            <section>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-ink-900">Last 7 days</h3>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    {current.last7.reduce((a, v) => a + v, 0)} deliveries, first attempt rate {current.firstAttemptRate.toFixed(1)}%
                  </p>
                </div>
                <Sparkline values={current.last7} width={120} height={36} />
              </div>
            </section>

            <section>
              <h3 className="text-[13px] font-semibold text-ink-900">Profile</h3>
              <dl className="mt-2 divide-y divide-line text-[13px]">
                {[
                  ["Phone", <span key="p" className="font-mono">{current.phone}</span>],
                  ["Vehicle", `${current.vehicle}, ${current.vehicleNo}`],
                  ["Joined", current.joined],
                  [
                    "KYC",
                    current.kyc === "verified" ? (
                      <span key="k" className="inline-flex items-center gap-1 text-success-700">
                        <ShieldCheck size={14} aria-hidden="true" /> Verified
                      </span>
                    ) : (
                      <span key="k" className="text-warning-700">
                        Pending police verification
                      </span>
                    ),
                  ],
                  ["Languages", current.languages.join(", ")],
                  ["Customer rating", `${current.rating.toFixed(1)} of 5`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="text-right font-medium text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {current.fakeFlags > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
                <Flag size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {current.fakeFlags} fake attempt flag{current.fakeFlags > 1 ? "s" : ""} in the last 30 days (geo-tag over 500 m or no call made). Review open with the hub manager.
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
