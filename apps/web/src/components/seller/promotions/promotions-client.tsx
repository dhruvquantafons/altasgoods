"use client";

import { useState } from "react";
import { BadgePercent, Plus, Ticket } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

export interface NominationCandidate {
  id: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
  low30: number;
  fcStock: number;
}

/** Diwali Dhamaka nomination: deal price must be at least the event minimum below the 30-day low and never above M.R.P. */
export function NominateDeals({ candidates, minDiscount, eventName, deadline }: { candidates: NominationCandidate[]; minDiscount: number; eventName: string; deadline: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, { price: string; units: string }>>({});
  const toast = useToast();

  const rows = Object.entries(picked);
  const errorOf = (c: NominationCandidate, v: { price: string; units: string }) => {
    const price = Number(v.price);
    const max = Math.floor(c.low30 * (1 - minDiscount / 100));
    if (!price) return "Enter a deal price";
    if (price > c.mrp) return "Above M.R.P.";
    if (price > max) return `Must be ${formatINR(max)} or less (${minDiscount}% below the 30-day low)`;
    if (Number(v.units) < 50) return "Commit at least 50 units";
    if (c.fcStock < Number(v.units)) return `Only ${c.fcStock} units in fulfilment centres`;
    return null;
  };
  const invalid = rows.some(([id, v]) => errorOf(candidates.find((c) => c.id === id)!, v));

  return (
    <>
      <Button icon={BadgePercent} onClick={() => setOpen(true)}>
        Nominate for {eventName}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        size="lg"
        title={`Nominate products for ${eventName}`}
        description={`Deals need a price at least ${minDiscount}% below the lowest price of the last 30 days. Nominations close ${deadline}.`}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs text-ink-500">
              {rows.length} {rows.length === 1 ? "product" : "products"} selected
            </span>
            <Button
              disabled={rows.length === 0 || invalid}
              onClick={() => {
                setOpen(false);
                setPicked({});
                toast.show(`${rows.length} ${rows.length === 1 ? "deal" : "deals"} submitted for ${eventName}. The category team reviews them within 3 days.`);
              }}
            >
              Submit nominations
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => {
            const v = picked[c.id];
            const err = v ? errorOf(c, v) : null;
            return (
              <li key={c.id} className={cn("rounded-xl border px-4 py-3", v ? "border-brand-200 bg-brand-50/30" : "border-line")}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    checked={Boolean(v)}
                    onChange={() =>
                      setPicked((p) => {
                        const n = { ...p };
                        if (n[c.id]) delete n[c.id];
                        else n[c.id] = { price: String(Math.floor((c.low30 * (1 - minDiscount / 100)) / 10) * 10 - 1), units: String(Math.min(100, c.fcStock)) };
                        return n;
                      })
                    }
                  />
                  <ProductImage src={c.image} alt="" size={40} rounded="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{c.title}</span>
                    <span className="block text-xs text-ink-500">
                      Now {formatINR(c.price)}, 30-day low {formatINR(c.low30)}, {c.fcStock} units in fulfilment centres
                    </span>
                  </span>
                </label>
                {v && (
                  <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                    <Field label="Deal price" htmlFor={`dp-${c.id}`} error={err ?? undefined} hint={!err ? `${Math.round((1 - Number(v.price) / c.low30) * 100)}% below the 30-day low` : undefined}>
                      <Input id={`dp-${c.id}`} inputSize="sm" inputMode="numeric" value={v.price} onChange={(e) => setPicked({ ...picked, [c.id]: { ...v, price: e.target.value.replace(/\D/g, "") } })} aria-invalid={Boolean(err)} />
                    </Field>
                    <Field label="Units committed" htmlFor={`du-${c.id}`}>
                      <Input id={`du-${c.id}`} inputSize="sm" inputMode="numeric" value={v.units} onChange={(e) => setPicked({ ...picked, [c.id]: { ...v, units: e.target.value.replace(/\D/g, "") } })} />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Modal>
      {toast.node}
    </>
  );
}

export function CreateCoupon() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("percent");
  const [code, setCode] = useState("APEXDIWALI");
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" icon={Plus} onClick={() => setOpen(true)}>
        Create coupon
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Create a seller coupon"
        description="Funded by you. Coupons that pass automatic checks are approved immediately and end when the budget runs out."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              icon={Ticket}
              disabled={code.length < 4}
              onClick={() => {
                setOpen(false);
                toast.show(`${code} submitted and approved. It goes live on the start date.`);
              }}
            >
              Create coupon
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" htmlFor="cp-code" hint="4 to 15 letters or numbers">
            <Input id="cp-code" value={code} maxLength={15} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="font-mono" />
          </Field>
          <Field label="Discount type" htmlFor="cp-type">
            <Select id="cp-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="percent">Percentage off</option>
              <option value="flat">Flat amount off</option>
            </Select>
          </Field>
          <Field label={type === "percent" ? "Discount (%)" : "Discount (₹)"} htmlFor="cp-value">
            <Input id="cp-value" inputMode="numeric" defaultValue={type === "percent" ? "10" : "300"} />
          </Field>
          {type === "percent" && (
            <Field label="Maximum discount (₹)" htmlFor="cp-max">
              <Input id="cp-max" inputMode="numeric" defaultValue="1500" />
            </Field>
          )}
          <Field label="Minimum order (₹)" htmlFor="cp-min">
            <Input id="cp-min" inputMode="numeric" defaultValue="2999" />
          </Field>
          <Field label="Total budget (₹)" htmlFor="cp-budget" hint="The coupon ends automatically when spent">
            <Input id="cp-budget" inputMode="numeric" defaultValue="100000" />
          </Field>
          <Field label="Uses per customer" htmlFor="cp-per">
            <Select id="cp-per" defaultValue="1">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </Select>
          </Field>
          <Field label="Audience" htmlFor="cp-aud">
            <Select id="cp-aud" defaultValue="all">
              <option value="all">All customers</option>
              <option value="plus">BluBuy Plus members</option>
              <option value="new">New to your store</option>
            </Select>
          </Field>
          <Field label="Starts" htmlFor="cp-start">
            <Input id="cp-start" type="date" defaultValue="2026-10-28" />
          </Field>
          <Field label="Ends" htmlFor="cp-end">
            <Input id="cp-end" type="date" defaultValue="2026-11-09" />
          </Field>
          <p className="rounded-xl bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-600 sm:col-span-2">
            Coupon fee: 1% of coupon-attributed sales, capped at ₹2,000 per coupon per month. Customers can use one coupon per item, applied after any deal price.
          </p>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
