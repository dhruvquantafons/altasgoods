"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, ClipboardList, PackageCheck, PackageSearch, PackageX, RefreshCw, Truck } from "lucide-react";
import { refreshTracking, simulateCourierScan, transitionOrderItems } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { ApiOrderItemStatus } from "@/lib/api/types";

type Step = "ACCEPTED" | "PACKED" | "READY_TO_SHIP";

/** The next fulfilment step for a line, with its button. */
export const NEXT_STEP: Partial<Record<ApiOrderItemStatus, { to: Step; label: string; done: string; icon: typeof Check }>> = {
  NEW: { to: "ACCEPTED", label: "Accept", done: "Accepted. Pack it before the dispatch by time.", icon: Check },
  ACCEPTED: { to: "PACKED", label: "Mark packed", done: "Packed. Mark it ready once the label is on.", icon: PackageCheck },
  PACKED: { to: "READY_TO_SHIP", label: "Ready to ship", done: "Booked with the courier. Print the label; the courier collects it on the next pickup.", icon: ClipboardList },
};

/** Ends for a parcel that never reached the customer; both need a note for the history. */
const END = {
  LOST: {
    label: "Mark lost",
    icon: PackageX,
    title: "Mark this parcel lost",
    description: "Use this once the courier confirms the parcel is lost. It is not restocked. A prepaid line is refunded to the payment method; cash on delivery was never collected.",
    field: "What the courier said",
    confirm: "Mark lost",
    done: "Marked lost. A prepaid line is being refunded.",
  },
  RTO_RECEIVED: {
    label: "Received back",
    icon: PackageSearch,
    title: "Record the parcel back at the store",
    description: "The item goes back into stock. A prepaid line is refunded to the payment method; cash on delivery was never collected.",
    field: "The state it came back in",
    confirm: "Received back",
    done: "Received back and restocked. A prepaid line is being refunded.",
  },
} as const;

const CANCEL_REASONS = ["Out of stock", "Pricing error on the product page", "Damaged in the warehouse", "Cannot deliver to this pincode", "Other"];

/** Fulfilment buttons for one or more lines that share a status, limited to what the API allows. */
export function LineActions({ orderId, itemIds, status, allowed, size = "sm" }: { orderId?: string; itemIds: string[]; status: ApiOrderItemStatus; allowed: ApiOrderItemStatus[]; size?: "xs" | "sm" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const [other, setOther] = useState("");
  const [ending, setEnding] = useState<keyof typeof END | null>(null);
  const [endNote, setEndNote] = useState("");
  const step = NEXT_STEP[status];
  const end = ending ? END[ending] : null;

  async function run(to: Step | "CANCELLED" | keyof typeof END, done: string, note?: string) {
    setBusy(true);
    const r = await transitionOrderItems(itemIds, to, note, orderId);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    if (r.data.failed.length) return toast.show(r.data.failed[0]!.error);
    setCancelling(false);
    setEnding(null);
    setEndNote("");
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
      {(["LOST", "RTO_RECEIVED"] as const)
        .filter((to) => allowed.includes(to))
        .map((to) => (
          <Button key={to} size={size} variant="secondary" icon={END[to].icon} disabled={busy} onClick={() => setEnding(to)}>
            {END[to].label}
          </Button>
        ))}
      <Modal
        open={!!end}
        onClose={() => setEnding(null)}
        title={itemIds.length > 1 && end ? `${end.title} (${itemIds.length} items)` : (end?.title ?? "")}
        description={end?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnding(null)}>
              Back
            </Button>
            <Button disabled={busy || endNote.trim().length < 3} onClick={() => ending && end && run(ending, end.done, endNote.trim())}>
              {end?.confirm}
            </Button>
          </>
        }
      >
        <Field label={end?.field ?? "Note"} htmlFor="end-note" required hint="Kept in the order's history, 3 to 500 characters">
          <Textarea id="end-note" rows={3} maxLength={500} value={endNote} onChange={(e) => setEndNote(e.target.value)} />
        </Field>
      </Modal>
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

/** Asks the courier for the latest scan of a line it carries; tracking also updates on its own every 10 minutes. */
export function TrackingRefresh({ orderId, itemId }: { orderId: string; itemId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        size="xs"
        variant="soft"
        icon={RefreshCw}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await refreshTracking(itemId, orderId);
          setBusy(false);
          if (!r.ok) return toast.show(r.error);
          toast.show(r.data.trackingStatus ? `Courier: ${r.data.trackingStatus}` : "No scans from the courier yet");
          router.refresh();
        }}
      >
        Refresh tracking
      </Button>
      {toast.node}
    </>
  );
}
