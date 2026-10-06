"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, PackagePlus, Printer } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { Stepper } from "@/components/ui/misc";
import { cn, formatINR, formatNumber } from "@/lib/utils";

export interface InboundCandidate {
  id: string;
  title: string;
  image: string;
  sku: string;
  recommended: number;
  daysOfCover: number;
}

export interface FcOption {
  code: string;
  name: string;
  city: string;
}

const STEPS = [{ label: "Products" }, { label: "Destination" }, { label: "Boxes" }, { label: "Review" }];

/** Four-step inbound shipment plan to an AltasGoods fulfilment centre. */
export function InboundWizard({ candidates, centres }: { candidates: InboundCandidate[]; centres: FcOption[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(candidates.filter((c) => c.recommended > 0).map((c) => [c.id, c.recommended])));
  const [fc, setFc] = useState(centres[0]!.code);
  const [boxes, setBoxes] = useState(0);
  const [slot, setSlot] = useState("Fri, 2 Oct, 10:30 AM");
  const toast = useToast();

  const lines = candidates.filter((c) => (qty[c.id] ?? 0) > 0);
  const units = lines.reduce((a, c) => a + (qty[c.id] ?? 0), 0);
  const autoBoxes = Math.max(1, Math.ceil(units / 24));
  const boxCount = boxes || autoBoxes;
  const placementFee = fc === centres[0]!.code ? 0 : units * 3;
  const valid = [units > 0, Boolean(fc), boxCount > 0, true][step];

  function reset() {
    setOpen(false);
    setStep(0);
  }

  return (
    <>
      <Button icon={PackagePlus} onClick={() => setOpen(true)}>
        Create inbound shipment
      </Button>
      <Modal
        open={open}
        onClose={reset}
        side="right"
        size="lg"
        title="Create inbound shipment"
        description="Send stock to an AltasGoods fulfilment centre so orders ship with the Assured badge."
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <span className="text-xs text-ink-500">{units ? `${formatNumber(units)} units selected` : "Choose products"}</span>
            )}
            {step < 3 ? (
              <Button iconRight={ArrowRight} disabled={!valid} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                icon={Check}
                onClick={() => {
                  reset();
                  toast.show(`Shipment IN-261001-02 confirmed: ${formatNumber(units)} units in ${boxCount} boxes to ${fc}. Box labels downloaded.`);
                }}
              >
                Confirm shipment
              </Button>
            )}
          </div>
        }
      >
        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 0 && (
          <div>
            <p className="mb-3 text-[13px] text-ink-600">Quantities start from the restock recommendation (45 days of cover). Adjust as needed.</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
                  <ProductImage src={c.image} alt="" size={40} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">{c.title}</p>
                    <p className="text-xs text-ink-500">
                      <span className="font-mono">{c.sku}</span>, {c.daysOfCover} days of cover
                      {c.recommended > 0 && <span className="text-warning-700">, restock {formatNumber(c.recommended)}</span>}
                    </p>
                  </div>
                  <Input
                    inputSize="sm"
                    inputMode="numeric"
                    aria-label={`Units of ${c.title}`}
                    value={qty[c.id] ?? 0}
                    onChange={(e) => setQty({ ...qty, [c.id]: Number(e.target.value.replace(/\D/g, "")) })}
                    className="w-20 text-right"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-[13px] text-ink-600">AltasGoods recommends the centre closest to your demand. Choosing another centre costs ₹3 per unit.</legend>
            {centres.map((c, i) => (
              <label key={c.code} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3", fc === c.code ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                <input type="radio" name="fc" checked={fc === c.code} onChange={() => setFc(c.code)} className="mt-1 accent-brand-600" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-ink-900">
                    {c.name} <span className="font-mono text-xs font-normal text-ink-500">{c.code}</span>
                  </span>
                  <span className="block text-xs text-ink-500">{i === 0 ? "Recommended, free placement. 41% of your orders ship to Maharashtra and Gujarat." : `${c.city}. Placement fee ${formatINR(units * 3)}.`}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of boxes" htmlFor="ib-boxes" hint={`Suggested ${autoBoxes} (24 units per box, max 23 kg each)`}>
              <Input id="ib-boxes" inputMode="numeric" value={boxCount} onChange={(e) => setBoxes(Number(e.target.value.replace(/\D/g, "")))} />
            </Field>
            <Field label="Delivery appointment" htmlFor="ib-slot" hint="Arrive within 30 minutes of the slot">
              <Select id="ib-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                {["Fri, 2 Oct, 10:30 AM", "Fri, 2 Oct, 3:00 PM", "Sat, 3 Oct, 11:00 AM", "Mon, 5 Oct, 10:00 AM"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <div className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600 sm:col-span-2">
              Every unit needs a scannable barcode (BSIN label or your own GTIN). Print one box label per carton and stick it on the side, not on a seam. Mixed-SKU boxes need a packing list inside.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-4 text-[13px]">
              <dt className="text-ink-500">Destination</dt>
              <dd className="text-right font-medium text-ink-900">{centres.find((c) => c.code === fc)?.name}</dd>
              <dt className="text-ink-500">Products</dt>
              <dd className="text-right text-ink-900">{lines.length}</dd>
              <dt className="text-ink-500">Units</dt>
              <dd className="text-right text-ink-900 tabular-nums">{formatNumber(units)}</dd>
              <dt className="text-ink-500">Boxes</dt>
              <dd className="text-right text-ink-900 tabular-nums">{boxCount}</dd>
              <dt className="text-ink-500">Appointment</dt>
              <dd className="text-right text-ink-900">{slot}</dd>
              <dt className="text-ink-500">Placement fee</dt>
              <dd className="text-right text-ink-900 tabular-nums">{placementFee ? formatINR(placementFee) : "Free"}</dd>
            </dl>
            <p className="flex items-center gap-2 text-xs text-ink-500">
              <Printer size={14} aria-hidden="true" /> Confirming downloads {boxCount} box labels and the packing list as one PDF.
            </p>
          </div>
        )}
      </Modal>
      {toast.node}
    </>
  );
}
