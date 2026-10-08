"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/** Create a platform coupon (spec 10.16): budget, per-customer limit, audience and dates. */
export function CreateCoupon() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("500");
  const [minOrder, setMinOrder] = useState("999");
  const [budget, setBudget] = useState("2500000");
  const [start, setStart] = useState("2026-10-28");
  const [end, setEnd] = useState("2026-11-09");
  const { show, node } = useToast();

  const v = Number(value);
  const errors = {
    code: code && !/^[A-Z0-9]{4,15}$/.test(code) ? "4 to 15 capital letters or digits" : undefined,
    value: type === "percent" && (v <= 0 || v > 80) ? "Between 1% and 80%" : type === "flat" && v <= 0 ? "Enter an amount" : undefined,
    dates: end < start ? "End date must be after the start date" : undefined,
  };
  const valid = code && !errors.code && !errors.value && !errors.dates && Number(budget) > 0;

  return (
    <>
      <Button icon={Plus} size="sm" onClick={() => setOpen(true)}>
        Create coupon
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a platform coupon"
        description="AltasGoods-funded discounts do not reduce the seller's item price; they are booked as promo expense."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!valid}
              onClick={() => {
                setOpen(false);
                show(`Coupon ${code} scheduled for ${start}`);
                setCode("");
              }}
            >
              Create coupon
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required htmlFor={`${id}-code`} error={errors.code} hint="Customers type this at checkout">
            <Input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DIWALI10" className="font-mono" aria-invalid={Boolean(errors.code)} />
          </Field>
          <Field label="Funding" htmlFor={`${id}-fund`}>
            <Select id={`${id}-fund`} defaultValue="blubuy">
              <option value="blubuy">AltasGoods funded</option>
              <option value="bank">Bank funded (recovered from issuer)</option>
              <option value="cofunded">Co-funded with brand</option>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2" htmlFor={`${id}-desc`}>
            <Textarea id={`${id}-desc`} className="min-h-16" placeholder="10% off home and kitchen during Diwali Dhamaka" />
          </Field>
          <Field label="Discount type" htmlFor={`${id}-type`}>
            <div id={`${id}-type`} role="radiogroup" aria-label="Discount type" className="grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1">
              {(["percent", "flat"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn("h-8 rounded-md text-[13px] font-medium", type === t ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}>
                  {t === "percent" ? "Percentage" : "Flat amount"}
                </button>
              ))}
            </div>
          </Field>
          <Field label={type === "percent" ? "Discount (%)" : "Discount (₹)"} required htmlFor={`${id}-val`} error={errors.value}>
            <Input id={`${id}-val`} type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(errors.value)} />
          </Field>
          {type === "percent" && (
            <Field label="Maximum discount (₹)" htmlFor={`${id}-max`}>
              <Input id={`${id}-max`} type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
            </Field>
          )}
          <Field label="Minimum order (₹)" htmlFor={`${id}-min`}>
            <Input id={`${id}-min`} type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </Field>
          <Field label="Total budget (₹)" required htmlFor={`${id}-budget`} hint="The coupon ends automatically when the budget is used">
            <Input id={`${id}-budget`} type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          <Field label="Uses per customer" htmlFor={`${id}-per`}>
            <Input id={`${id}-per`} type="number" defaultValue="1" />
          </Field>
          <Field label="Audience" htmlFor={`${id}-aud`}>
            <Select id={`${id}-aud`} defaultValue="all">
              <option value="all">Everyone</option>
              <option value="new">New customers, first order</option>
              <option value="plus">AltasGoods Plus members</option>
              <option value="lapsed">Lapsed, no order in 90 days</option>
            </Select>
          </Field>
          <Field label="Starts" htmlFor={`${id}-start`}>
            <Input id={`${id}-start`} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor={`${id}-end`} error={errors.dates}>
            <Input id={`${id}-end`} type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={Boolean(errors.dates)} />
          </Field>
          <p className="rounded-xl border border-line bg-ink-50/60 px-4 py-3 text-xs text-ink-600 sm:col-span-2">
            Stacking at checkout: deal price, then one coupon per item, then one bank offer per order, then AltasCoins, then AltasGoods Credits. Coupon codes are never pre-applied for customers who did not choose them.
          </p>
        </div>
      </Modal>
      {node}
    </>
  );
}
