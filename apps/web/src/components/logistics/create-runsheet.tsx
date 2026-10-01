"use client";

import { useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

export interface ReadyShipment {
  id: string;
  pincode: string;
  customer: string;
  locality: string;
  cod: boolean;
  codAmount: number;
  weightKg: number;
  dueToday: boolean;
}

export interface RunAssociate {
  id: string;
  name: string;
  vehicle: string;
  maxStops: number;
  maxKg: number;
  note: string;
}

/** RS-WFD-261001-16 plus n gives RS-WFD-261001-(16 + n). */
function bumpId(id: string, n: number) {
  const m = /^(.*-)(\d+)$/.exec(id);
  return m ? `${m[1]}${Number(m[2]) + n}` : `${id}-${n + 1}`;
}

/** Create runsheet: pick a beat, choose shipments ready for last mile, assign an associate and a start time. */
export function CreateRunsheet({
  nextId,
  beats,
  shipments,
  associates,
}: {
  nextId: string;
  beats: { code: string; name: string; pincode: string }[];
  shipments: ReadyShipment[];
  associates: RunAssociate[];
}) {
  const [open, setOpen] = useState(false);
  const [beat, setBeat] = useState(beats[0]?.code ?? "");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [da, setDa] = useState("");
  const [start, setStart] = useState("13:00");
  // runsheets made in this session: each takes the next id, and its shipments leave the ready pool
  const [made, setMade] = useState(0);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const { show, node } = useToast();
  const runId = bumpId(nextId, made);

  const beatObj = beats.find((b) => b.code === beat);
  const pool = useMemo(() => shipments.filter((s) => s.pincode === beatObj?.pincode && !assigned.has(s.id)), [shipments, beatObj, assigned]);
  const selected = picked ?? new Set(pool.map((s) => s.id));
  const chosen = pool.filter((s) => selected.has(s.id));
  const cod = chosen.reduce((a, s) => a + (s.cod ? s.codAmount : 0), 0);
  const kg = Math.round(chosen.reduce((a, s) => a + s.weightKg, 0) * 10) / 10;
  const assoc = associates.find((a) => a.id === da);
  const over = assoc && (chosen.length > assoc.maxStops || kg > assoc.maxKg);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Create runsheet
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Create runsheet ${runId}`}
        description="Shipments at hub and sorted to a beat are ready for the last mile. Promised-today shipments are listed first."
        footer={
          <>
            <span className="mr-auto text-[13px] text-ink-500 tabular-nums">
              {chosen.length} stops, {kg} kg, COD {formatINR(cod)}
            </span>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!assoc || chosen.length === 0}
              onClick={() => {
                setOpen(false);
                show(`${runId} created for ${assoc?.name} with ${chosen.length} stops, dispatch at ${start === "11:00" ? "11:00 am" : start === "13:00" ? "1:00 pm" : "3:00 pm"}`);
                setMade((n) => n + 1);
                setAssigned((prev) => new Set([...prev, ...chosen.map((s) => s.id)]));
                setPicked(null);
                setDa("");
              }}
            >
              Create and assign
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Beat" htmlFor="rs-beat">
            <Select
              id="rs-beat"
              value={beat}
              onChange={(e) => {
                setBeat(e.target.value);
                setPicked(null);
              }}
            >
              {beats.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Associate" htmlFor="rs-da">
            <Select id="rs-da" value={da} onChange={(e) => setDa(e.target.value)}>
              <option value="" disabled>
                Choose an associate
              </option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}, {a.vehicle}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dispatch" htmlFor="rs-start">
            <Select id="rs-start" value={start} onChange={(e) => setStart(e.target.value)}>
              <option value="11:00">11:00 am</option>
              <option value="13:00">1:00 pm, wave 2</option>
              <option value="15:00">3:00 pm</option>
            </Select>
          </Field>
        </div>
        {assoc && (
          <p className={cn("mt-3 flex items-start gap-2 text-[13px]", over ? "text-warning-700" : "text-ink-500")}>
            {over && <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
            {over
              ? `Over capacity for a ${assoc.vehicle.toLowerCase()}: up to ${assoc.maxStops} stops and ${assoc.maxKg} kg. Split the beat or pick a van.`
              : `${assoc.note}. Capacity ${assoc.maxStops} stops, ${assoc.maxKg} kg.`}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line bg-ink-50/70 px-4 py-2.5 text-xs font-medium text-ink-500">
            <span>
              Ready at hub for <span className="font-mono">{beatObj?.pincode}</span>
            </span>
            <span>
              {chosen.length} of {pool.length} selected
            </span>
          </div>
          {pool.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-500">No shipments waiting for this beat. Pick another beat.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto scrollbar-thin">
              {pool.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-ink-50/60">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-medium text-ink-900">{s.id}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {s.customer}, {s.locality}, {s.weightKg} kg
                      </span>
                    </span>
                    {s.dueToday && <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 ring-1 ring-warning-100 ring-inset">Due today</span>}
                    <span className="w-20 text-right text-[13px] tabular-nums">{s.cod ? <span className="font-medium text-ink-900">{formatINR(s.codAmount)}</span> : <span className="text-ink-500">Prepaid</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
      {node}
    </>
  );
}
