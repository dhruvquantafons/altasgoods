"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, ClipboardList, PackageCheck, Truck } from "lucide-react";
import { simulateCourierScan, transitionOrderItems } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { ApiOrderItemStatus } from "@/lib/api/types";

type Step = "ACCEPTED" | "PACKED" | "READY_TO_SHIP";

/** The next fulfilment step for a line, with its button. */
export const NEXT_STEP: Partial<Record<ApiOrderItemStatus, { to: Step; label: string; done: string; icon: typeof Check }>> = {
  NEW: { to: "ACCEPTED", label: "Accept", done: "Accepted. Pack it before the dispatch by time.", icon: Check },
  ACCEPTED: { to: "PACKED", label: "Mark packed", done: "Packed. Mark it ready once the label is on.", icon: PackageCheck },
  PACKED: { to: "READY_TO_SHIP", label: "Ready to ship", done: "Ready to ship. The courier collects it on the next pickup.", icon: ClipboardList },
};

const CANCEL_REASONS = ["Out of stock", "Pricing error on the product page", "Damaged in the warehouse", "Cannot deliver to this pincode", "Other"];

/** Fulfilment buttons for one or more lines that share a status, limited to what the API allows. */
export function LineActions({ orderId, itemIds, status, allowed, size = "sm" }: { orderId?: string; itemIds: string[]; status: ApiOrderItemStatus; allowed: ApiOrderItemStatus[]; size?: "xs" | "sm" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const [other, setOther] = useState("");
  const step = NEXT_STEP[status];

  async function run(to: Step | "CANCELLED", done: string, note?: string) {
    setBusy(true);
    const r = await transitionOrderItems(itemIds, to, note, orderId);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    if (r.data.failed.length) return toast.show(r.data.failed[0]!.error);
    setCancelling(false);
    toast.show(done);
    router.refresh();
  }

  const note = reason === "Other" ? other.trim() : reason;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {step && allowed.includes(step.to) && (
        <Button size={size} icon={step.icon} disabled={busy} onClick={() => run(step.to, step.done)}>
          {step.label}
        </Button>
      )}
      {allowed.includes("CANCELLED") && (
        <Button size={size} variant="ghost" icon={Ban} disabled={busy} onClick={() => setCancelling(true)}>
          Cancel
        </Button>
      )}
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={itemIds.length > 1 ? `Cancel ${itemIds.length} items` : "Cancel this item"}
        description="The customer is told why and refunded to the original payment method."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              Keep
            </Button>
            <Button variant="danger" disabled={busy || note.length < 3} onClick={() => run("CANCELLED", "Cancelled. The customer has been refunded.", note)}>
              Cancel and refund
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reason" htmlFor="cancel-reason">
            <Select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          {reason === "Other" && (
            <Field label="Tell the customer why" htmlFor="cancel-other">
              <Textarea id="cancel-other" rows={3} value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} />
            </Field>
          )}
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}

const SCANS: Partial<Record<ApiOrderItemStatus, { to: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED"; label: string }>> = {
  READY_TO_SHIP: { to: "SHIPPED", label: "Picked up" },
  SHIPPED: { to: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Delivered" },
};

/** Development only: stands in for courier scans until a courier partner is connected. */
export function CourierSimulator({ orderId, itemId, status }: { orderId: string; itemId: string; status: ApiOrderItemStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const scan = SCANS[status];
  if (!scan || process.env.NODE_ENV === "production") return null;
  return (
    <>
      <Button
        size="xs"
        variant="soft"
        icon={Truck}
        disabled={busy}
        title="Development only: simulates the courier's scan"
        onClick={async () => {
          setBusy(true);
          const r = await simulateCourierScan(itemId, scan.to, orderId);
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
