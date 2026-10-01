"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Flag, Undo2, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { StatusMeta } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";

export interface NdrRow {
  id: string;
  awb: string;
  customer: string;
  locality: string;
  pincode: string;
  reason: string;
  attempts: number;
  status: StatusMeta;
  closed: boolean;
  responseKind: string;
  response: string;
  responseDetail?: string;
  due: string;
  dueTone: "danger" | "warning" | "neutral";
  cod: number;
  associate?: string;
  lastAttempt: string;
  flagged: boolean;
}

function Pips({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-full", i < n ? (n >= 3 ? "bg-danger-500" : "bg-warning-500") : "bg-ink-200")} />
        ))}
      </span>
      <span className="text-xs text-ink-600 tabular-nums">{n} of 3</span>
    </span>
  );
}

/** NDR cases with row selection and a batch bar for re-attempts and RTO approval. */
export function NdrQueue({ rows, dates }: { rows: NdrRow[]; dates: { value: string; label: string }[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [done, setDone] = useState<Record<string, string>>({});
  const { show, node } = useToast();
  const selectable = rows.filter((r) => !r.closed && !done[r.id]);
  const all = selectable.length > 0 && selectable.every((r) => sel.has(r.id));

  function toggle(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  }
  function apply(kind: "reattempt" | "rto") {
    const label = kind === "reattempt" ? `Re-attempt ${dates.find((d) => d.value === date)?.label}` : "RTO approved";
    const next = { ...done };
    sel.forEach((id) => (next[id] = label));
    setDone(next);
    show(kind === "reattempt" ? `${sel.size} re-attempts scheduled for ${dates.find((d) => d.value === date)?.label}. Customers notified.` : `${sel.size} shipments approved for RTO`);
    setSel(new Set());
  }

  return (
    <div>
      <div className={cn("flex min-h-14 flex-wrap items-center gap-2 border-y border-line px-5 py-2.5", sel.size ? "bg-brand-50/60" : "bg-white")}>
        {sel.size ? (
          <>
            <span className="mr-1 text-[13px] font-semibold text-ink-900">{sel.size} selected</span>
            <Select selectSize="sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Re-attempt date" className="w-40">
              {dates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Button size="sm" icon={CalendarClock} onClick={() => apply("reattempt")}>
              Schedule re-attempt
            </Button>
            <Button size="sm" variant="secondary" icon={Undo2} className="text-danger-700" onClick={() => apply("rto")}>
              Approve RTO
            </Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSel(new Set())} className="ml-auto">
              Clear
            </Button>
          </>
        ) : (
          <p className="text-[13px] text-ink-500">Select cases to schedule re-attempts in bulk or approve RTO. No response in 24 hours means an automatic re-attempt next working day.</p>
        )}
      </div>
      <TableContainer>
        <Table>
          <THead className="border-t-0">
            <TR>
              <TH className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all open cases"
                  className="size-4 accent-brand-600"
                  checked={all}
                  disabled={selectable.length === 0}
                  onChange={() => setSel(all ? new Set() : new Set(selectable.map((r) => r.id)))}
                />
              </TH>
              <TH>AWB</TH>
              <TH>Customer</TH>
              <TH>Reason and attempts</TH>
              <TH>Customer response</TH>
              <TH>Case</TH>
              <TH>Action due</TH>
              <TH align="right">COD</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const outcome = done[r.id];
              return (
                <TR key={r.id} className={cn(sel.has(r.id) && "bg-brand-50/50")}>
                  <TD>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.awb}`}
                      className="size-4 accent-brand-600"
                      disabled={r.closed || !!outcome}
                      checked={sel.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </TD>
                  <TD>
                    <Link href={`/logistics/shipments/${r.awb}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                      {r.awb}
                    </Link>
                    <p className="text-xs text-ink-500">{r.associate ? `Last by ${r.associate}` : r.lastAttempt}</p>
                  </TD>
                  <TD>
                    <p className="text-[13px] font-medium text-ink-900">{r.customer}</p>
                    <p className="text-xs text-ink-500">
                      {r.locality}, <span className="font-mono">{r.pincode}</span>
                    </p>
                  </TD>
                  <TD>
                    <p className="text-[13px] text-ink-900">{r.reason}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <Pips n={r.attempts} />
                      {r.flagged && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-700">
                          <Flag size={12} aria-hidden="true" /> Fake attempt flag
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD className="max-w-56 min-w-44 whitespace-normal">
                    <p className={cn("text-[13px] font-medium", r.responseKind === "none" ? "text-ink-500" : r.responseKind === "cancel" || r.responseKind === "disputed" ? "text-danger-700" : "text-ink-900")}>{r.response}</p>
                    {r.responseDetail && <p className="text-xs text-ink-500">{r.responseDetail}</p>}
                  </TD>
                  <TD>
                    {outcome ? (
                      <span className="text-xs font-medium text-success-700">{outcome}</span>
                    ) : (
                      <StatusBadge meta={r.status} size="sm" />
                    )}
                  </TD>
                  <TD className={cn("text-[13px] font-medium whitespace-nowrap", r.dueTone === "danger" ? "text-danger-700" : r.dueTone === "warning" ? "text-warning-700" : "text-ink-600")}>{r.due}</TD>
                  <TD align="right" className="text-[13px]">
                    {r.cod ? formatINR(r.cod) : <span className="text-ink-400">Prepaid</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
      {node}
    </div>
  );
}
