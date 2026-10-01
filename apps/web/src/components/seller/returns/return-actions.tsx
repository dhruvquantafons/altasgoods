"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Check, CircleCheck, FileVideo, FlaskConical, Loader2, PackageCheck, ShieldCheck, Truck, Upload, X } from "lucide-react";
import { decideReturn, gradeReturn, simulateReturnScan } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

/* ----------------------------- Approve / reject ---------------------------- */

const REJECT_REASONS = ["Outside the return window", "Item is non-returnable once opened (hygiene)", "Customer-caused damage visible in photos", "Not the item we shipped"];

/** Decision on an out-of-policy return request (48 hours, then BluBuy decides). */
export function ReturnDecision({ returnId, size = "md" }: { returnId: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [message, setMessage] = useState("");
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  const toast = useToast();

  const decide = async (approve: boolean) => {
    setBusy(approve ? "approve" : "reject");
    setError(null);
    const note = approve ? undefined : [reason, message.trim()].filter(Boolean).join(". ");
    const r = await decideReturn(returnId, approve, note);
    setBusy(null);
    if (!r.ok) return approve ? toast.show(r.error) : setError(r.error);
    setOpen(false);
    setDecided(approve ? "approved" : "rejected");
    toast.show(approve ? `${returnId} approved. The pickup is booked and the customer has been told.` : `${returnId} rejected. The customer has been told why.`);
    // let the confirmation show before the list moves the return on
    setTimeout(() => router.refresh(), 1500);
  };

  if (decided)
    return (
      <>
        <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", decided === "approved" ? "text-success-700" : "text-ink-600")}>
          <CircleCheck size={15} aria-hidden="true" /> {decided === "approved" ? "Approved, pickup booked" : "Rejected"}
        </span>
        {toast.node}
      </>
    );

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size={size === "sm" ? "xs" : "md"} variant="secondary" icon={X} disabled={!!busy} onClick={() => setOpen(true)}>
          Reject
        </Button>
        <Button size={size === "sm" ? "xs" : "md"} icon={Check} disabled={!!busy} onClick={() => decide(true)}>
          {busy === "approve" ? "Approving" : "Approve"}
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
            <Button variant="danger" disabled={!!busy} onClick={() => decide(false)}>
              {busy === "reject" ? "Rejecting" : "Reject return"}
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
            <Textarea id={`rej-msg-${returnId}`} className="min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} />
          </Field>
          {error && (
            <p role="alert" className="text-[13px] text-danger-700">
              {error}
            </p>
          )}
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

/** Grades where the customer's return stands and they are refunded; the rest go to BluBuy for review. */
const ACCEPTS = ["SELLABLE", "DEFECTIVE", "CARRIER_DAMAGED"];

/** Receipt quality check: the grade and notes are saved with the return and decide what happens to the refund. */
export function QcCapture({ returnId, grades, dueAt }: { returnId: string; grades: GradeOption[]; dueAt?: string }) {
  const router = useRouter();
  const [grade, setGrade] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const chosen = grades.find((g) => g.key === grade);
  const pass = ACCEPTS.includes(grade);
  const needsNotes = Boolean(chosen && !pass && notes.trim().length < 5);

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const r = await gradeReturn(returnId, pass, [chosen.label, notes.trim()].filter(Boolean).join(". "));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.show(pass ? "Check recorded. The customer's refund is released." : "Check recorded. BluBuy reviews it before the refund is released.");
    router.refresh();
  };

  return (
    <Card className="border-brand-100">
      <CardHeader title="Record the quality check" description={`Grade within 48 hours of receipt${dueAt ? `, by ${dueAt}` : ""}. Ungraded returns pass automatically.`} />
      <div className="flex flex-col gap-5 p-5">
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
        {chosen && (
          <p className={cn("rounded-lg px-3 py-2 text-[13px]", pass ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700")}>
            {pass ? "The return passes the check and the customer is refunded." : "The return fails the check. BluBuy reviews your notes before the customer is refunded."}
          </p>
        )}
        <Field label="Notes" htmlFor="qc-notes" required={Boolean(chosen && !pass)} hint={chosen && !pass ? "Describe what is wrong; BluBuy reads this" : undefined}>
          <Textarea id="qc-notes" className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Serial number, visible damage, missing parts" />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] text-danger-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {!grade && <p className="text-xs text-ink-500">Choose a grade to continue</p>}
          {needsNotes && <p className="text-xs text-warning-700">Add a note for a failed check</p>}
          <Button disabled={!grade || needsNotes || busy} onClick={save}>
            {busy ? "Saving" : "Save check"}
          </Button>
        </div>
      </div>
      {toast.node}
    </Card>
  );
}

/* ----------------------------- Pickup simulator ---------------------------- */

type Scan = "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED";
const SCANS: Record<string, { to: Scan; label: string }[] | undefined> = {
  PICKUP_SCHEDULED: [{ to: "OUT_FOR_PICKUP", label: "Scan out for pickup" }],
  OUT_FOR_PICKUP: [
    { to: "PICKED_UP", label: "Scan picked up" },
    { to: "PICKUP_FAILED", label: "Pickup failed" },
  ],
  PICKUP_FAILED: [{ to: "OUT_FOR_PICKUP", label: "Re-attempt pickup" }],
  PICKED_UP: [{ to: "IN_TRANSIT", label: "Scan in transit" }],
  IN_TRANSIT: [{ to: "RECEIVED", label: "Scan received" }],
};

/** Development only: stands in for BluBuy Logistics reverse pickup scans until that integration is live. */
export function PickupSimulator({ returnId, status }: { returnId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scans = SCANS[status];
  if (!scans) return null;

  const scan = async (to: Scan) => {
    setBusy(to);
    setError(null);
    const r = await simulateReturnScan(returnId, to);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-accent-300 bg-accent-50/60 px-5 py-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-800">
        <FlaskConical size={15} aria-hidden="true" /> Pickup simulator (development only)
      </p>
      <p className="mt-0.5 text-xs text-ink-600">Stands in for BluBuy Logistics reverse pickup scans.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {scans.map((s) => (
          <Button key={s.to} size="sm" variant="secondary" icon={s.to === "RECEIVED" ? PackageCheck : Truck} disabled={!!busy} onClick={() => scan(s.to)}>
            {busy === s.to ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {s.label}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger-700">{error}</p>}
    </div>
  );
}
