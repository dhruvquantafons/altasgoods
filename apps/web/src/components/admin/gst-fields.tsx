"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/input";
import { bpToPercent, GST_SLABS, gstLabel, isHsn, percentToBp } from "@/lib/gst";

/** The rate as typed (a percentage; empty means inherit) and the HSN code as typed. */
export type GstDraft = { rate: string; hsn: string };

export const gstDraft = (rateBp: number | null, hsn: string | null): GstDraft => ({ rate: rateBp === null ? "" : bpToPercent(rateBp), hsn: hsn ?? "" });

/** The draft as the API takes it, or the first thing wrong with it. */
export function gstFromDraft(d: GstDraft, { allowInherit }: { allowInherit: boolean }): { ok: true; gstRateBp: number | null; hsn: string | null } | { ok: false; error: string } {
  const rate = d.rate.trim();
  let gstRateBp: number | null = null;
  if (rate) {
    gstRateBp = percentToBp(rate);
    if (gstRateBp === null) return { ok: false, error: "Enter a GST rate from 0 to 40, with up to 2 decimals" };
  } else if (!allowInherit) return { ok: false, error: "Choose a GST rate" };
  const hsn = d.hsn.trim();
  if (hsn && !isHsn(hsn)) return { ok: false, error: "An HSN code has 4, 6 or 8 digits" };
  return { ok: true, gstRateBp, hsn: hsn || null };
}

const CUSTOM = "custom";
const INHERIT = "inherit";

/**
 * A GST rate (a select of the usual slabs, or a custom percentage) and an HSN code.
 * With `inherit` set, an empty rate or code means "use the one above"; `hint` says what that is.
 */
export function GstFields({
  idPrefix,
  value,
  onChange,
  inherit,
  rateError,
  hsnError,
}: {
  idPrefix: string;
  value: GstDraft;
  onChange: (next: GstDraft) => void;
  inherit?: { rate: string; hsn: string };
  rateError?: string;
  hsnError?: string;
}) {
  const bp = percentToBp(value.rate);
  const isSlab = bp !== null && (GST_SLABS as readonly number[]).includes(bp) && value.rate.trim() === bpToPercent(bp);
  // choosing "Custom %" keeps the box open while it is still empty
  const [custom, setCustom] = useState(() => value.rate.trim() !== "" && !isSlab);
  const selected = custom ? CUSTOM : value.rate.trim() === "" ? (inherit ? INHERIT : "") : isSlab ? value.rate.trim() : CUSTOM;

  return (
    <>
      <Field
        label="GST rate"
        htmlFor={`${idPrefix}-gst`}
        error={rateError}
        hint={selected === INHERIT && inherit ? inherit.rate : "Prices include GST; this is the share of the price that is tax"}
      >
        <div className="flex gap-2">
          <Select
            id={`${idPrefix}-gst`}
            className="min-w-0 flex-1"
            value={selected}
            aria-invalid={Boolean(rateError)}
            onChange={(e) => {
              const v = e.target.value;
              setCustom(v === CUSTOM);
              onChange({ ...value, rate: v === CUSTOM ? "" : v === INHERIT ? "" : v });
            }}
          >
            {inherit && <option value={INHERIT}>Inherit</option>}
            {!inherit && selected === "" && <option value="">Choose a rate</option>}
            {GST_SLABS.map((s) => (
              <option key={s} value={bpToPercent(s)}>
                {gstLabel(s)}
              </option>
            ))}
            <option value={CUSTOM}>Custom %</option>
          </Select>
          {selected === CUSTOM && (
            <Input
              id={`${idPrefix}-gst-custom`}
              aria-label="Custom GST rate in percent"
              inputMode="decimal"
              className="w-24"
              placeholder="e.g. 12.5"
              suffix="%"
              value={value.rate}
              onChange={(e) => onChange({ ...value, rate: e.target.value.replace(/[^\d.]/g, "") })}
              aria-invalid={Boolean(rateError)}
            />
          )}
        </div>
      </Field>
      <Field label="HSN code" htmlFor={`${idPrefix}-hsn`} error={hsnError} hint={inherit && !value.hsn.trim() ? inherit.hsn : "4, 6 or 8 digits. Optional."}>
        <Input id={`${idPrefix}-hsn`} inputMode="numeric" maxLength={8} value={value.hsn} onChange={(e) => onChange({ ...value, hsn: e.target.value.replace(/\D/g, "") })} placeholder={inherit ? "Inherit" : "Optional"} aria-invalid={Boolean(hsnError)} />
      </Field>
    </>
  );
}

/** "Inherits 18% from Electronics" and the HSN equivalent, from the API's inherited value. */
export function inheritHints(i: { gstRateBp: number; rateFrom: string; hsn: string | null; hsnFrom: string | null }) {
  return {
    rate: `Inherits ${gstLabel(i.gstRateBp)} from ${i.rateFrom}`,
    hsn: i.hsn ? `Inherits ${i.hsn} from ${i.hsnFrom}` : "No HSN code set above",
  };
}
