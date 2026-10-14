"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, PackageCheck, ShieldCheck, ShieldX, Truck, Undo2, X } from "lucide-react";
import { decideStoreReturn, gradeStoreReturn, recordReturnPickup, settleStoreReturn, simulateReturnScan } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { ApiReturnStatus, ReturnRequest } from "@/lib/api/types";

type Dialog = { kind: "reject" | "fail" | "accept" | "send-back" } | null;
type Result = { ok: true; data: ReturnRequest } | { ok: false; error: string };

const DIALOG = {
  reject: { title: "Reject this return", description: "The customer sees this reason and keeps the item.", field: "Reason for the customer", confirm: "Reject return" },
  fail: { title: "Fail the quality check", description: "Describe what is wrong; the refund is held until this is resolved.", field: "What is wrong with the item", confirm: "Record failed check" },
  accept: { title: "Accept the return anyway", description: "The refund or replacement goes out as if the check had passed.", field: "Why it is accepted", confirm: "Accept return" },
  "send-back": { title: "Reject and send the item back", description: "The return is closed, the customer sees this reason, and the item goes back to them.", field: "Reason for the customer", confirm: "Reject and send back" },
} as const;

/** Decide an out-of-policy return, grade a returned item, or settle a failed check, as the store. */
export function ReturnActions({ id, status }: { id: string; status: ApiReturnStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState("");

  async function run(call: () => Promise<Result>, done: string) {
    setBusy(true);
    const r = await call();
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    setDialog(null);
    setNote("");
    toast.show(done);
    router.refresh();
  }

  const reviewing = status === "PENDING_REVIEW";
  const grading = status === "RECEIVED";
  const settling = status === "QC_FAILED";
  if (!reviewing && !grading && !settling) return null;
  const copy = dialog ? DIALOG[dialog.kind] : DIALOG.reject;

  function confirm() {
    const text = note.trim();
    if (dialog?.kind === "reject") return run(() => decideStoreReturn(id, false, text), "Return rejected.");
    if (dialog?.kind === "fail") return run(() => gradeStoreReturn(id, false, text), "Check failed and recorded.");
    if (dialog?.kind === "accept") return run(() => settleStoreReturn(id, true, text), "Accepted. The refund or replacement is on its way.");
    return run(() => settleStoreReturn(id, false, text), "Return rejected. Send the item back to the customer.");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reviewing && (
        <>
          <Button icon={Check} disabled={busy} onClick={() => run(() => decideStoreReturn(id, true), "Approved. The pickup has been booked.")}>
            Approve return
          </Button>
          <Button variant="secondary" icon={X} disabled={busy} onClick={() => setDialog({ kind: "reject" })}>
            Reject
          </Button>
        </>
      )}
      {grading && (
        <>
          <Button icon={ShieldCheck} disabled={busy} onClick={() => run(() => gradeStoreReturn(id, true), "Check passed. The refund or replacement is on its way.")}>
            Pass check
          </Button>
          <Button variant="secondary" icon={ShieldX} disabled={busy} onClick={() => setDialog({ kind: "fail" })}>
            Fail check
          </Button>
        </>
      )}
      {settling && (
        <>
          <Button icon={Check} disabled={busy} onClick={() => setDialog({ kind: "accept" })}>
            Accept anyway
          </Button>
          <Button variant="secondary" icon={Undo2} disabled={busy} onClick={() => setDialog({ kind: "send-back" })}>
            Reject and send back
          </Button>
        </>
      )}
      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={copy.title}
        description={copy.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button variant={dialog?.kind === "accept" ? "primary" : "danger"} disabled={busy || note.trim().length < 5} onClick={confirm}>
              {copy.confirm}
            </Button>
          </>
        }
      >
        <Field label={copy.field} hint="At least 5 characters" htmlFor="return-note">
          <Textarea id="return-note" rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </div>
  );
}

type PickupScan = "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED";
const PICKUP_LABEL: Record<PickupScan, string> = {
  OUT_FOR_PICKUP: "Out for pickup",
  PICKED_UP: "Picked up from the customer",
  PICKUP_FAILED: "Pickup failed",
  IN_TRANSIT: "In transit to the warehouse",
  RECEIVED: "Received at the warehouse",
};
/** What can happen next from each pickup state; later steps record the ones in between. */
const PICKUP_NEXT: Partial<Record<ApiReturnStatus, PickupScan[]>> = {
  PICKUP_SCHEDULED: ["OUT_FOR_PICKUP", "PICKED_UP", "PICKUP_FAILED", "IN_TRANSIT", "RECEIVED"],
  PICKUP_FAILED: ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"],
  OUT_FOR_PICKUP: ["PICKED_UP", "PICKUP_FAILED", "IN_TRANSIT", "RECEIVED"],
  PICKED_UP: ["IN_TRANSIT", "RECEIVED"],
  IN_TRANSIT: ["RECEIVED"],
};

/**
 * Records the reverse pickup by hand while courier return pickups are not
 * connected: the store books it with the courier and notes each step here.
 */
export function ReturnPickupUpdate({ id, status, awb }: { id: string; status: ApiReturnStatus; awb: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const options = PICKUP_NEXT[status];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState<PickupScan>(options?.[0] ?? "RECEIVED");
  const [awbInput, setAwbInput] = useState(awb ?? "");
  const [note, setNote] = useState("");
  if (!options) return null;

  const failing = to === "PICKUP_FAILED";
  const awbChanged = awbInput.trim() && awbInput.trim() !== awb;
  async function save() {
    setBusy(true);
    const r = await recordReturnPickup(id, to, awbChanged ? awbInput.trim() : undefined, note.trim() || undefined);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    setOpen(false);
    setNote("");
    toast.show(failing ? "Pickup failure recorded." : `Marked ${PICKUP_LABEL[to].toLowerCase()}.`);
    router.refresh();
  }

  return (
    <>
      <Button
        icon={PackageCheck}
        onClick={() => {
          setTo(options[0]!);
          setOpen(true);
        }}
      >
        Update pickup
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Update the pickup"
        description="Book the reverse pickup with your courier, then record each step here. The customer sees the progress on their return."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button variant={failing ? "danger" : "primary"} disabled={busy || (failing && note.trim().length < 5)} onClick={save}>
              {failing ? "Record failed pickup" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What happened" htmlFor="pickup-to">
            <Select id="pickup-to" value={to} onChange={(e) => setTo(e.target.value as PickupScan)}>
              {options.map((o) => (
                <option key={o} value={o}>
                  {PICKUP_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Courier AWB" hint="Optional, as printed on the pickup label" htmlFor="pickup-awb">
            <Input id="pickup-awb" value={awbInput} maxLength={40} onChange={(e) => setAwbInput(e.target.value)} className="font-mono" />
          </Field>
          <Field label={failing ? "Why the pickup failed" : "Note"} hint={failing ? "At least 5 characters. The customer can rebook the pickup." : "Optional"} htmlFor="pickup-note">
            <Textarea id="pickup-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

const SCANS: Partial<Record<ApiReturnStatus, { to: "OUT_FOR_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "RECEIVED"; label: string }>> = {
  PICKUP_SCHEDULED: { to: "OUT_FOR_PICKUP", label: "Out for pickup" },
  OUT_FOR_PICKUP: { to: "PICKED_UP", label: "Picked up" },
  PICKED_UP: { to: "IN_TRANSIT", label: "In transit" },
  IN_TRANSIT: { to: "RECEIVED", label: "Received at the warehouse" },
};

/** Development only: stands in for reverse pickup scans. */
export function ReturnScanSimulator({ id, status }: { id: string; status: ApiReturnStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const scan = SCANS[status];
  if (!scan || process.env.NODE_ENV === "production") return null;
  return (
    <>
      <Button
        size="sm"
        variant="soft"
        icon={Truck}
        disabled={busy}
        title="Development only: simulates the courier's scan"
        onClick={async () => {
          setBusy(true);
          const r = await simulateReturnScan(id, scan.to);
          setBusy(false);
          if (!r.ok) return toast.show(r.error);
          router.refresh();
        }}
      >
        Simulate: {scan.label}
      </Button>
      {toast.node}
    </>
  );
}
