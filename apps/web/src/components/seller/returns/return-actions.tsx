"use client";

import { useState } from "react";
import { Camera, Check, CircleCheck, FileVideo, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

/* ----------------------------- Approve / reject ---------------------------- */

const REJECT_REASONS = ["Outside the return window", "Item is non-returnable once opened (hygiene)", "Customer-caused damage visible in photos", "Not the item we shipped"];

/** Decision on an out-of-policy return request (48 hours, then BluBuy decides). */
export function ReturnDecision({ returnId, size = "md" }: { returnId: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const toast = useToast();
  if (decided)
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", decided === "approved" ? "text-success-700" : "text-ink-600")}>
        <CircleCheck size={15} aria-hidden="true" /> {decided === "approved" ? "Approved" : "Rejected"}
      </span>
    );
  return (
    <>
      <div className="flex items-center gap-2">
        <Button size={size === "sm" ? "xs" : "md"} variant="secondary" icon={X} onClick={() => setOpen(true)}>
          Reject
        </Button>
        <Button
          size={size === "sm" ? "xs" : "md"}
          icon={Check}
          onClick={() => {
            setDecided("approved");
            toast.show(`${returnId} approved. BluBuy schedules the pickup and tells the customer.`);
          }}
        >
          Approve
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Reject ${returnId}`}
        description="The customer can still file a BluBuy Guarantee claim, so give a clear, specific reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                setDecided("rejected");
                toast.show(`${returnId} rejected. The customer has been told why.`);
              }}
            >
              Reject return
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor={`rej-${returnId}`} required>
            <Select id={`rej-${returnId}`} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REJECT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Message to the customer" htmlFor={`rej-msg-${returnId}`} hint="Shown with the decision. No links, phone numbers or emails.">
            <Textarea id={`rej-msg-${returnId}`} className="min-h-20" />
          </Field>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

/* --------------------------------- SafeClaim ------------------------------- */

const EVIDENCE = [
  { key: "package", label: "Photos of the package from all sides", icon: Camera },
  { key: "label", label: "Photo of the shipping label", icon: Camera },
  { key: "product", label: "Product photos from every side", icon: Camera },
  { key: "video", label: "Unboxing video recorded at receipt", icon: FileVideo },
];

export function SafeClaimForm({ amount, gradeLabel, deadline, onDone }: { amount: number; gradeLabel: string; deadline: string; onDone?: () => void }) {
  const [claimed, setClaimed] = useState(String(amount));
  const [files, setFiles] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();
  const needVideo = amount > 5000;
  const missing = EVIDENCE.filter((e) => (e.key !== "video" || needVideo) && !files[e.key]);
  const value = Number(claimed);
  const valueError = !value || value <= 0 ? "Enter the amount you are claiming" : value > amount ? `Up to the item value, ${formatINR(amount)}` : undefined;

  if (submitted)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50/70 px-4 py-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
        <div className="text-[13px]">
          <p className="font-semibold text-success-700">SafeClaim submitted for {formatINR(value)}</p>
          <p className="mt-0.5 text-ink-700">BluBuy decides within 7 business days. An approved amount is added to your next payout as a SafeClaim reimbursement line.</p>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Claim amount" htmlFor="sc-amount" required error={valueError} hint={!valueError ? `Item value ${formatINR(amount)}` : undefined}>
          <Input id="sc-amount" inputMode="numeric" value={claimed} onChange={(e) => setClaimed(e.target.value.replace(/\D/g, ""))} suffix="INR" aria-invalid={Boolean(valueError)} />
        </Field>
        <Field label="Reason" htmlFor="sc-reason" hint={`File by ${deadline}`}>
          <Input id="sc-reason" value={gradeLabel} readOnly />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-700">Evidence</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EVIDENCE.map((e) => {
            const required = e.key !== "video" || needVideo;
            const done = files[e.key];
            return (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => setFiles((f) => ({ ...f, [e.key]: !f[e.key] }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                    done ? "border-success-100 bg-success-50/60" : "border-dashed border-line-strong hover:border-brand-300 hover:bg-brand-50/40",
                  )}
                >
                  {done ? <CircleCheck size={17} className="shrink-0 text-success-600" aria-hidden="true" /> : <Upload size={17} className="shrink-0 text-ink-400" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink-900">{e.label}</span>
                    <span className="block text-xs text-ink-500">{done ? "Added, tap to remove" : required ? "Required" : "Optional below ₹5,000"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <Field label="What happened" htmlFor="sc-note">
        <Textarea id="sc-note" className="min-h-20" placeholder="For example: the grille is cracked and the charging port is bent. The outer box was intact." />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-500">{missing.length ? `Add ${missing.length} more ${missing.length === 1 ? "item" : "items"} of evidence to submit.` : "All required evidence added."}</p>
        <Button
          icon={ShieldCheck}
          disabled={missing.length > 0 || Boolean(valueError)}
          onClick={() => {
            setSubmitted(true);
            toast.show("SafeClaim submitted. Decision within 7 business days.");
            onDone?.();
          }}
        >
          Submit SafeClaim
        </Button>
      </div>
      {toast.node}
    </div>
  );
}

/* -------------------------------- QC capture ------------------------------- */

export interface GradeOption {
  key: string;
  label: string;
  description: string;
  claimable: boolean;
}

/** Receipt quality check: grade, notes and photos; claimable grades open the SafeClaim form. */
export function QcCapture({ grades, amount, claimDeadline }: { grades: GradeOption[]; amount: number; claimDeadline: string }) {
  const [grade, setGrade] = useState<string>("");
  const [photos, setPhotos] = useState(0);
  const [saved, setSaved] = useState(false);
  const [restock, setRestock] = useState(true);
  const toast = useToast();
  const chosen = grades.find((g) => g.key === grade);

  return (
    <Card className="border-brand-100">
      <CardHeader
        title={saved ? "Quality check recorded" : "Record the quality check"}
        description={saved ? `Graded as ${chosen?.label.toLowerCase()}.` : "Grade within 48 hours of receipt. Ungraded returns pass QC automatically and you lose the right to claim."}
      />
      <div className="p-5">
        {!saved ? (
          <div className="flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-700">Condition on receipt</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {grades.map((g) => (
                  <label
                    key={g.key}
                    className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors", grade === g.key ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}
                  >
                    <input type="radio" name="qc-grade" checked={grade === g.key} onChange={() => setGrade(g.key)} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block text-[13px] font-medium text-ink-900">{g.label}</span>
                      <span className="block text-xs text-ink-500">{g.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-700">Photos at receipt</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: photos }, (_, i) => (
                  <span key={i} className="flex size-16 items-center justify-center rounded-lg bg-ink-100 text-[11px] text-ink-500">
                    IMG_{2041 + i}
                  </span>
                ))}
                <button type="button" onClick={() => setPhotos((p) => p + 1)} className="flex size-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-[11px] text-ink-500 hover:border-brand-300 hover:text-brand-700">
                  <Camera size={16} aria-hidden="true" />
                  Add
                </button>
              </div>
            </div>
            {grade === "SELLABLE" && <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} label="Add the unit back to sellable stock" description="Stock at Andheri warehouse goes up by one" />}
            <Field label="Notes" htmlFor="qc-notes">
              <Textarea id="qc-notes" className="min-h-16" placeholder="Serial number, visible damage, missing parts" />
            </Field>
            <div className="flex items-center justify-end gap-3">
              {!grade && <p className="text-xs text-ink-500">Choose a grade to continue</p>}
              <Button
                disabled={!grade || (chosen?.claimable && photos === 0)}
                onClick={() => {
                  setSaved(true);
                  toast.show(chosen?.claimable ? "Graded. You can now file a SafeClaim for this return." : "Graded as sellable. The refund is released to the customer.");
                }}
              >
                Save grade
              </Button>
            </div>
            {chosen?.claimable && photos === 0 && <p className="-mt-3 text-right text-xs text-warning-700">Add at least one photo for a claimable grade.</p>}
          </div>
        ) : chosen?.claimable ? (
          <div>
            <p className="mb-4 text-[13px] text-ink-600">This grade is eligible for BluBuy SafeClaim. File by {claimDeadline} with the evidence below.</p>
            <SafeClaimForm amount={amount} gradeLabel={chosen.label} deadline={claimDeadline} />
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-success-700">
            <CircleCheck size={16} aria-hidden="true" />
            Recorded{restock && grade === "SELLABLE" ? " and returned to stock" : ""}. No further action needed.
          </p>
        )}
      </div>
      {toast.node}
    </Card>
  );
}
