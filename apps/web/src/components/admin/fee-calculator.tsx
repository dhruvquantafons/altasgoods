"use client";

import { useId, useState } from "react";
import { ShareBar } from "@/components/admin/share-bar";
import { Field, Input, Select } from "@/components/ui/input";
import { cn, formatINR } from "@/lib/utils";

type Tier = "Platinum" | "Gold" | "Silver" | "Bronze";
type Zone = "local" | "regional" | "national" | "special";

export interface FeeCalcConfig {
  categories: { id: string; name: string; commission: number; gstRate: number }[];
  fixedSlabs: { upTo: number | null; fee: number }[];
  tierFixed: Record<Tier, number>;
  shipping: { weight: string; local: number; regional: number; national: number; special: number }[];
  tierShipDiscount: Record<Tier, number>;
  freeUpto: number;
  gstOnFees: number;
  tcs: number;
  tds: number;
}

const ZONES: { key: Zone; label: string }[] = [
  { key: "local", label: "Local, same city" },
  { key: "regional", label: "Regional, same zone" },
  { key: "national", label: "National" },
  { key: "special", label: "Special zone (North-East, J&K)" },
];

const rupees = (paise: number) => formatINR(paise / 100, { paise: true });

/** Days after delivery before a sale is eligible for payout (spec 13.9, same as PAYOUT_HOLD_DAYS in the mock rate card). */
const HOLD_DAYS: Record<Tier, number> = { Platinum: 2, Gold: 3, Silver: 5, Bronze: 7 };

/**
 * Seller net proceeds for one item under the live rate card (spec 13 and 14.1).
 * Every line is computed in paise and rounded per line, never on the total.
 */
export function FeeCalculator({ config, defaults }: { config: FeeCalcConfig; defaults: { price: number; categoryId: string; weight: number; zone: Zone; tier: Tier } }) {
  const id = useId();
  const [price, setPrice] = useState(String(defaults.price));
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [weight, setWeight] = useState(defaults.weight);
  const [extraKg, setExtraKg] = useState("1");
  const [zone, setZone] = useState<Zone>(defaults.zone);
  const [tier, setTier] = useState<Tier>(defaults.tier);
  const [payment, setPayment] = useState<"prepaid" | "cod">("prepaid");

  const cat = config.categories.find((c) => c.id === categoryId) ?? config.categories[0]!;
  const value = Math.max(0, Number(price) || 0);
  const P = Math.round(value * 100);
  const pct = value <= config.freeUpto ? 0 : cat.commission;
  const slab = config.fixedSlabs.find((s) => s.upTo === null || value <= s.upTo)!;
  const heavy = weight === 4;
  const shipBase = heavy ? config.shipping[3]![zone] + config.shipping[4]![zone] * Math.max(0, Math.ceil(Number(extraKg) || 0)) : config.shipping[weight]![zone];

  const commission = Math.round((P * pct) / 100);
  const fixed = (slab.fee + config.tierFixed[tier]) * 100;
  const shipping = Math.round(shipBase * 100 * (1 - config.tierShipDiscount[tier] / 100));
  const fees = commission + fixed + shipping;
  const gst = Math.round((fees * config.gstOnFees) / 100);
  const taxable = Math.round(P / (1 + cat.gstRate / 100));
  const tcs = Math.round((taxable * config.tcs) / 100);
  const tds = Math.round((taxable * config.tds) / 100);
  const net = P - fees - gst - tcs - tds;

  const lines = [
    { label: `Commission (${pct}%)`, hint: pct === 0 ? `0% band up to ${formatINR(config.freeUpto)}` : `${cat.name}, items above ${formatINR(config.freeUpto)}`, value: commission },
    { label: "Fixed fee", hint: `${slab.upTo === null ? "Above ₹5,000" : `Up to ${formatINR(slab.upTo)}`} slab ₹${slab.fee}${config.tierFixed[tier] ? ` + ${tier} ₹${config.tierFixed[tier]}` : ""}`, value: fixed },
    { label: "Shipping fee", hint: `₹${shipBase}${config.tierShipDiscount[tier] ? ` less ${config.tierShipDiscount[tier]}% ${tier} discount` : ""}`, value: shipping },
    // spec 13: no separate collection fee; gateway and COD costs are absorbed by BluBuy, so this line is always zero
    { label: payment === "cod" ? "COD collection fee" : "Payment gateway fee", hint: "Absorbed by BluBuy, never charged to sellers or customers", value: 0 },
  ];
  // what COD does change is timing: the item also waits for the cash to be remitted (spec 13.9 and 10.8)
  const hold = HOLD_DAYS[tier];
  const payout =
    payment === "cod"
      ? { when: `Delivered + ${hold} days, and the COD cash remitted`, hint: "BluBuy Logistics banks the cash and reconciles it to the order before the item becomes eligible. Then the next Monday, Wednesday or Friday payout run." }
      : { when: `Delivered + ${hold} days`, hint: `${tier} tier hold, then the next Monday, Wednesday or Friday payout run.` };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-4">
        <Field label="Selling price (inclusive of GST)" htmlFor={`${id}-price`}>
          <Input id={`${id}-price`} type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} suffix="INR" />
        </Field>
        <Field label="Category" htmlFor={`${id}-cat`} hint={`Product GST ${cat.gstRate}%, used for the TCS and TDS base`}>
          <Select id={`${id}-cat`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {config.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.commission}%)
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chargeable weight" htmlFor={`${id}-w`}>
            <Select id={`${id}-w`} value={weight} onChange={(e) => setWeight(Number(e.target.value))}>
              {config.shipping.slice(0, 4).map((s, i) => (
                <option key={s.weight} value={i}>
                  {s.weight}
                </option>
              ))}
              <option value={4}>Above 5 kg</option>
            </Select>
          </Field>
          {heavy ? (
            <Field label="Extra kg above 5" htmlFor={`${id}-kg`}>
              <Input id={`${id}-kg`} type="number" min={0} value={extraKg} onChange={(e) => setExtraKg(e.target.value)} />
            </Field>
          ) : (
            <Field label="Zone" htmlFor={`${id}-z`}>
              <Select id={`${id}-z`} value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
                {ZONES.map((z) => (
                  <option key={z.key} value={z.key}>
                    {z.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {heavy && (
          <Field label="Zone" htmlFor={`${id}-z2`}>
            <Select id={`${id}-z2`} value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
              {ZONES.map((z) => (
                <option key={z.key} value={z.key}>
                  {z.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Seller tier" htmlFor={`${id}-t`}>
          <div id={`${id}-t`} role="radiogroup" aria-label="Seller tier" className="grid grid-cols-4 gap-1 rounded-lg bg-ink-100 p-1">
            {(["Platinum", "Gold", "Silver", "Bronze"] as Tier[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tier === t} onClick={() => setTier(t)} className={cn("h-8 rounded-md text-[13px] font-medium transition-colors", tier === t ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Payment" htmlFor={`${id}-p`} hint={payment === "cod" ? "No COD fee for sellers or customers. COD changes only when the payout becomes eligible." : "Gateway costs are absorbed by BluBuy, so fees are the same for COD."}>
          <div id={`${id}-p`} role="radiogroup" aria-label="Payment" className="grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1">
            {(["prepaid", "cod"] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={payment === p} onClick={() => setPayment(p)} className={cn("h-8 rounded-md text-[13px] font-medium transition-colors", payment === p ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}>
                {p === "prepaid" ? "Prepaid" : "Cash on delivery"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="rounded-xl border border-line bg-ink-25 p-5" aria-live="polite">
        <p className="text-[13px] text-ink-500">Seller receives</p>
        <p className="mt-1 text-[34px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{rupees(net)}</p>
        <p className="mt-1.5 text-xs text-ink-500">{P ? `${((net / P) * 100).toFixed(1)}% of the selling price` : "Enter a price"}</p>

        <ShareBar
          className="mt-5"
          segments={[
            { label: "Seller receives", value: Math.max(0, net) },
            { label: "Commission", value: commission },
            { label: "Fixed fee and shipping", value: fixed + shipping },
            { label: "GST on fees", value: gst },
            { label: "TCS and TDS", value: tcs + tds },
          ]}
        />

        <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-700">Selling price</dt>
            <dd className="font-medium tabular-nums">{rupees(P)}</dd>
          </div>
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-4">
              <dt>
                <span className="block text-ink-700">{l.label}</span>
                <span className="block text-xs text-ink-500">{l.hint}</span>
              </dt>
              <dd className="tabular-nums text-ink-900">-{rupees(l.value)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt className="text-ink-700">Total fees</dt>
            <dd className="font-medium tabular-nums">-{rupees(fees)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-700">GST on fees ({config.gstOnFees}%)</dt>
            <dd className="tabular-nums">-{rupees(gst)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>
              <span className="block text-ink-700">TCS ({config.tcs}%)</span>
              <span className="block text-xs text-ink-500">on taxable value {rupees(taxable)}</span>
            </dt>
            <dd className="tabular-nums">-{rupees(tcs)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-700">TDS u/s 194-O ({config.tds}%)</dt>
            <dd className="tabular-nums">-{rupees(tds)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-sm">
            <dt className="font-semibold text-ink-900">Net settlement</dt>
            <dd className="font-semibold text-ink-900 tabular-nums">{rupees(net)}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-lg bg-white px-3.5 py-3 text-[13px] ring-1 ring-line">
          <p className="text-ink-500">{payment === "cod" ? "Cash on delivery" : "Prepaid"}: eligible for payout</p>
          <p className="mt-0.5 font-medium text-ink-900">{payout.when}</p>
          <p className="mt-0.5 text-xs text-ink-500">{payout.hint}</p>
        </div>
      </div>
    </div>
  );
}
