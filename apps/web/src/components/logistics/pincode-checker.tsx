"use client";

import { useState } from "react";
import { CircleCheck, CircleX, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import type { PincodeEntry } from "@/lib/mock/ops-extra";
import { addDays, cn, NOW } from "@/lib/utils";

export interface OriginOption {
  id: string;
  code: string;
  name: string;
  /** first three pincode digits that count as the same city */
  cityPrefixes: string[];
  region: "South" | "West" | "North" | "East";
}

const CIRCLES: [string, string][] = [
  ["11", "Delhi"], ["12", "Haryana"], ["13", "Haryana"], ["14", "Punjab"], ["15", "Punjab"], ["16", "Chandigarh and Punjab"], ["17", "Himachal Pradesh"],
  ["18", "Jammu and Kashmir"], ["19", "Jammu and Kashmir"], ["20", "Uttar Pradesh"], ["21", "Uttar Pradesh"], ["22", "Uttar Pradesh"], ["23", "Uttar Pradesh"],
  ["24", "Uttarakhand"], ["25", "Uttar Pradesh"], ["26", "Uttar Pradesh"], ["27", "Uttar Pradesh"], ["28", "Uttar Pradesh"], ["30", "Rajasthan"], ["31", "Rajasthan"],
  ["32", "Rajasthan"], ["33", "Rajasthan"], ["34", "Rajasthan"], ["36", "Gujarat"], ["37", "Gujarat"], ["38", "Gujarat"], ["39", "Gujarat"], ["40", "Maharashtra"],
  ["41", "Maharashtra"], ["42", "Maharashtra"], ["43", "Maharashtra"], ["44", "Maharashtra"], ["45", "Madhya Pradesh"], ["46", "Madhya Pradesh"], ["47", "Madhya Pradesh"],
  ["48", "Madhya Pradesh"], ["49", "Chhattisgarh"], ["50", "Telangana"], ["51", "Andhra Pradesh"], ["52", "Andhra Pradesh"], ["53", "Andhra Pradesh"], ["56", "Karnataka"],
  ["57", "Karnataka"], ["58", "Karnataka"], ["59", "Karnataka"], ["60", "Tamil Nadu"], ["61", "Tamil Nadu"], ["62", "Tamil Nadu"], ["63", "Tamil Nadu"], ["64", "Tamil Nadu"],
  ["67", "Kerala"], ["68", "Kerala"], ["69", "Kerala"], ["70", "West Bengal"], ["71", "West Bengal"], ["72", "West Bengal"], ["73", "West Bengal"], ["74", "West Bengal"],
  ["75", "Odisha"], ["76", "Odisha"], ["77", "Odisha"], ["78", "Assam"], ["79", "North-East"], ["80", "Bihar"], ["81", "Bihar"], ["82", "Jharkhand"], ["83", "Jharkhand"],
  ["84", "Bihar"], ["85", "Bihar"],
];

function region(pin: string): OriginOption["region"] {
  const d = Number(pin.slice(0, 2));
  if ((d >= 50 && d <= 53) || (d >= 56 && d <= 69)) return "South";
  if (d >= 36 && d <= 49) return "West";
  if (d >= 70) return "East";
  return "North";
}

const METRO = ["110", "400", "560", "600", "700", "500", "411", "380", "122", "201"];
const SPECIAL = (pin: string) => /^(18|19|78|79)/.test(pin) || pin.startsWith("744") || pin.startsWith("6825");

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

interface Result {
  pin: string;
  place: string;
  serviceable: boolean;
  zone: string;
  days: [number, number];
  cod: boolean;
  codNote?: string;
  reverse: boolean;
  heavy: boolean;
  hub: string;
  plus: boolean;
  known: boolean;
}

function evaluate(p: string, o: OriginOption, directory: PincodeEntry[], hubNames: Record<string, string>): Result | string {
  if (!/^\d{6}$/.test(p) || p.startsWith("0")) return "Enter a valid 6 digit pincode";
  const entry = directory.find((e) => e.pincode === p);
  const circle = CIRCLES.find(([pre]) => p.startsWith(pre))?.[1];
  const serviceable = entry ? entry.serviceable : Boolean(circle) && !p.startsWith("9");
  const special = SPECIAL(p);
  let zone: string;
  let days: [number, number];
  if (special) {
    zone = "Special zone";
    days = [6, 9];
  } else if (o.cityPrefixes.some((c) => p.startsWith(c))) {
    zone = "Local";
    days = [1, 1];
  } else if (region(p) === o.region) {
    zone = "Regional";
    days = [2, 3];
  } else if (METRO.some((m) => p.startsWith(m))) {
    zone = "National, metro";
    days = [3, 4];
  } else {
    zone = "National";
    days = [4, 6];
  }
  return {
    pin: p,
    place: entry ? `${entry.area}, ${entry.city}, ${entry.state}` : circle ? `${circle} postal circle` : "Unknown postal circle",
    serviceable,
    zone,
    days,
    cod: serviceable && (entry ? entry.cod : !special),
    codNote: entry?.codNote ?? (special ? "COD unavailable in special zones" : undefined),
    reverse: serviceable && (entry ? entry.reverse : !special),
    heavy: serviceable && (entry ? entry.heavy : !special && zone !== "National"),
    hub: entry?.hubId ? (hubNames[entry.hubId] ?? "BluBuy hub") : serviceable ? "Partner delivery hub" : "Not mapped",
    plus: zone === "Local",
    known: Boolean(entry),
  };
}

/** Pincode serviceability and delivery promise from a chosen fulfilment centre (section 5.2 and 10.3). */
export function PincodeChecker({ directory, origins, hubNames }: { directory: PincodeEntry[]; origins: OriginOption[]; hubNames: Record<string, string> }) {
  // no result until a check runs, so Check and the sample chips always visibly produce one
  const [pin, setPin] = useState("560066");
  const [origin, setOrigin] = useState(origins[0]?.id ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState("");
  // bumps on every check so the result panel replays its entrance even when the answer is unchanged
  const [runs, setRuns] = useState(0);

  function check(value = pin, from = origin) {
    const out = evaluate(value.trim(), origins.find((x) => x.id === from)!, directory, hubNames);
    setRuns((n) => n + 1);
    if (typeof out === "string") {
      setError(value.trim() ? out : "Enter a 6 digit pincode to check");
      setRes(null);
    } else {
      setError("");
      setRes(out);
    }
  }

  const promise = res ? (res.days[0] === res.days[1] ? dayFmt.format(addDays(NOW, res.days[0])) : `${dayFmt.format(addDays(NOW, res.days[0]))} to ${dayFmt.format(addDays(NOW, res.days[1]))}`) : "";

  return (
    <div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <Field label="Ship from" htmlFor="pc-origin">
          <Select
            id="pc-origin"
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              if (res) check(res.pin, e.target.value);
            }}
          >
            {origins.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Delivery pincode" htmlFor="pc-pin" error={error || undefined}>
          <div className="flex gap-2">
            <Input id="pc-pin" icon={MapPin} inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="560066" className="flex-1" aria-invalid={error ? true : undefined} />
            <Button type="submit" icon={Search}>
              Check
            </Button>
          </div>
        </Field>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["560066", "560067", "400053", "110017", "781001", "682555"].map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`Check ${p}`}
            onClick={() => {
              setPin(p);
              check(p);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-xs",
              res?.pin === p ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-line-strong hover:text-ink-900",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {!res && !error && <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-500">Check a pincode, or pick one above, to see serviceability and the delivery promise.</p>}
      {res && (
        <div key={runs} className="mt-5 rounded-xl border border-line bg-ink-50/50 p-4 animate-fade-in" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-base font-semibold text-ink-900">{res.pin}</p>
              <p className="text-[13px] text-ink-600">{res.place}</p>
            </div>
            <Badge tone={res.serviceable ? "success" : "danger"} dot>
              {res.serviceable ? "Serviceable" : "Not serviceable"}
            </Badge>
          </div>
          {res.serviceable ? (
            <>
              <div className="mt-4 rounded-lg border border-line bg-white px-3.5 py-3">
                <p className="text-xs text-ink-500">Delivery promise if ordered now</p>
                <p className="mt-0.5 text-lg font-semibold text-ink-900">{promise}</p>
                <p className="text-xs text-ink-500">
                  {res.zone}, {res.days[0] === res.days[1] ? `${res.days[0]} day` : `${res.days[0]} to ${res.days[1]} days`} transit. Before the 2:00 pm cut-off.
                  {res.plus && " Plus one-day eligible for BluBuy Fulfilled items."}
                </p>
              </div>
              <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                {[
                  { ok: res.cod, label: "Cash on delivery", note: res.cod ? "Up to ₹50,000 per order" : res.codNote },
                  { ok: res.reverse, label: "Return pickup", note: res.reverse ? "Doorstep QC available" : "Returns by self-ship only" },
                  { ok: res.heavy, label: "Heavy and bulky", note: res.heavy ? "Van delivery with two associates" : "Not available" },
                ].map((r) => (
                  <li key={r.label} className="flex items-start gap-2">
                    {r.ok ? <CircleCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <CircleX size={16} className="mt-px shrink-0 text-danger-600" aria-hidden="true" />}
                    <span>
                      <span className={cn("font-medium", r.ok ? "text-ink-900" : "text-ink-700")}>
                        {r.label}: {r.ok ? "available" : "unavailable"}
                      </span>
                      {r.note && <span className="block text-xs text-ink-500">{r.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-500">
                Served by {res.hub}
                {!res.known && ". Estimated from postal circle rules; not in the pincode master excerpt."}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-ink-600">{res.codNote ?? "No BluBuy Logistics or partner coverage for this pincode yet."}</p>
          )}
        </div>
      )}
    </div>
  );
}
