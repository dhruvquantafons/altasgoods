"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ShieldCheck, ShieldX, Truck, X } from "lucide-react";
import { decideStoreReturn, gradeStoreReturn, simulateReturnScan } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { ApiReturnStatus, ReturnRequest } from "@/lib/api/types";

type Dialog = { kind: "reject" | "fail" } | null;
type Result = { ok: true; data: ReturnRequest } | { ok: false; error: string };

/** Decide an out-of-policy return, or grade a returned item, as the store. */
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
  if (!reviewing && !grading) return null;

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
      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "reject" ? "Reject this return" : "Fail the quality check"}
        description={dialog?.kind === "reject" ? "The customer sees this reason and keeps the item." : "Describe what is wrong; the refund is held until this is resolved."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={busy || note.trim().length < 5}
              onClick={() =>
                dialog?.kind === "reject" ? run(() => decideStoreReturn(id, false, note.trim()), "Return rejected.") : run(() => gradeStoreReturn(id, false, note.trim()), "Check failed and recorded.")
              }
            >
              {dialog?.kind === "reject" ? "Reject return" : "Record failed check"}
            </Button>
          </>
        }
      >
        <Field label={dialog?.kind === "reject" ? "Reason for the customer" : "What is wrong with the item"} hint="At least 5 characters" htmlFor="return-note">
          <Textarea id="return-note" rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </div>
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
