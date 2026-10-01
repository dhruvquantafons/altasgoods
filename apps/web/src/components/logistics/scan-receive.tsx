"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

interface Scan {
  code: string;
  ok: boolean;
  text: string;
}

/**
 * Scan-to-receive for the truck at the dock. Accepts a bag ID or an AWB from a
 * handheld (keyboard wedge) and updates the receive progress locally.
 */
export function ScanReceive({
  lineHaulId,
  bags,
  bagsReceived,
  shipments,
  shipmentsScanned,
  pendingBags,
}: {
  lineHaulId: string;
  bags: number;
  bagsReceived: number;
  shipments: number;
  shipmentsScanned: number;
  pendingBags: { id: string; shipments: number; beat: string }[];
}) {
  const [value, setValue] = useState("");
  const [received, setReceived] = useState<string[]>([]);
  const [extraShipments, setExtraShipments] = useState(0);
  const [log, setLog] = useState<Scan[]>([]);

  const bagCount = bagsReceived + received.length;
  const shipCount = Math.min(shipments, shipmentsScanned + extraShipments);

  function scan(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const bag = pendingBags.find((b) => b.id === code);
    let entry: Scan;
    if (bag && !received.includes(bag.id)) {
      setReceived((r) => [...r, bag.id]);
      setExtraShipments((n) => n + bag.shipments);
      entry = { code, ok: true, text: `Bag received, ${bag.shipments} shipments to beat ${bag.beat}` };
    } else if (bag) {
      entry = { code, ok: false, text: "Already received on this line haul" };
    } else if (/^BBL\d{10}$/.test(code)) {
      setExtraShipments((n) => n + 1);
      entry = { code, ok: true, text: "Shipment in-scanned, sorted to beat" };
    } else {
      entry = { code, ok: false, text: "Not on this manifest. Flag as excess or check the label." };
    }
    setLog((l) => [entry, ...l].slice(0, 5));
    setValue("");
  }

  const next = pendingBags.find((b) => !received.includes(b.id));

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-ink-600">Bags</span>
            <span className="font-semibold text-ink-900 tabular-nums">
              {bagCount} of {bags}
            </span>
          </div>
          <Progress value={bagCount} max={bags} tone={bagCount >= bags ? "success" : "brand"} size="sm" className="mt-1.5" label="Bags received" />
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-ink-600">Shipments</span>
            <span className="font-semibold text-ink-900 tabular-nums">
              {shipCount} of {shipments}
            </span>
          </div>
          <Progress value={shipCount} max={shipments} tone={shipCount >= shipments ? "success" : "brand"} size="sm" className="mt-1.5" label="Shipments scanned" />
        </div>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          scan(value);
        }}
      >
        <Input
          icon={ScanLine}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Scan bag ID or AWB"
          aria-label={`Scan bag ID or AWB for ${lineHaulId}`}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary">
          Receive
        </Button>
      </form>
      {next && (
        <button type="button" onClick={() => scan(next.id)} className="mt-2 text-xs font-medium text-brand-700 hover:text-brand-800">
          Simulate handheld scan of {next.id}
        </button>
      )}

      {log.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" aria-live="polite">
          {log.map((s, i) => (
            <li key={`${s.code}-${i}`} className={cn("flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs", s.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700")}>
              {s.ok ? <CircleCheck size={14} className="mt-px shrink-0" aria-hidden="true" /> : <CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />}
              <span>
                <span className="font-mono font-medium">{s.code}</span> {s.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
