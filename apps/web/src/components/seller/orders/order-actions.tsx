"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { transitionSellerItems } from "@/app/actions/seller";
import { Ban, Check, ClipboardList, MapPin, MessageSquare, Printer, Star, Truck, Undo2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { OrderStatus } from "@/lib/status";

type Dialog = "cancel" | "rts" | "pickup" | null;

const CANCEL_REASONS = ["Item out of stock at the pickup location", "Pricing error on the listing", "Item damaged during packing", "Cannot ship to this pincode"];

/**
 * Header actions for an order, limited to the transitions the order item state
 * machine allows from the current status (seller-packed lines only).
 */
export function OrderActions({
  status,
  sellerPacked,
  orderId,
  returnId,
  daysSinceDelivery,
  weightKg,
  dims,
  itemIds,
}: {
  itemIds: string[];
  status: OrderStatus;
  sellerPacked: boolean;
  orderId: string;
  returnId?: string;
  daysSinceDelivery?: number;
  weightKg: number;
  dims: [number, number, number];
}) {
  const [current, setCurrent] = useState<OrderStatus>(status);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const toast = useToast();

  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const API_TO: Partial<Record<OrderStatus, "ACCEPTED" | "PACKED" | "READY_TO_SHIP" | "CANCELLED">> = {
    confirmed: "ACCEPTED",
    packed: "PACKED",
    ready_to_ship: "READY_TO_SHIP",
    cancelled: "CANCELLED",
  };

  /** Moves this order's lines forward in the API, then reloads the page data. */
  async function move(to: OrderStatus, message: string) {
    setDialog(null);
    // requesting a pickup does not change the item status; logistics picks it up
    if (to === current) return toast.show(message);
    const apiTo = API_TO[to];
    if (!apiTo) return;
    setBusy(true);
    const r = await transitionSellerItems(itemIds, apiTo, to === "cancelled" ? reason : undefined);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    if (r.data.failed.length) return toast.show(r.data.failed[0]!.error);
    setCurrent(to);
    toast.show(message);
    router.refresh();
  }

  const canCancel = sellerPacked && ["placed", "confirmed", "packed", "ready_to_ship"].includes(current);
  const message = (
    <ButtonLink href={`/seller/messages?order=${orderId}`} variant="secondary" icon={MessageSquare}>
      Message buyer
    </ButtonLink>
  );

  let primary: React.ReactNode = null;
  const secondary: React.ReactNode = null;

  if (!sellerPacked) {
    primary = (
      <Button variant="secondary" icon={MapPin} onClick={() => toast.show("Tracking opens in BluBuy Logistics. The fulfilment centre handles this order.")}>
        Track shipment
      </Button>
    );
  } else if (current === "placed") {
    primary = (
      <Button icon={Check} disabled={busy} onClick={() => move("confirmed", "Order confirmed. Pack it and generate the label before the dispatch by time.")}>
        Confirm order
      </Button>
    );
  } else if (current === "confirmed") {
    primary = (
      <Button icon={Printer} disabled={busy} onClick={() => move("packed", "Invoice and shipping label generated. The PDF has been downloaded.")}>
        Generate label and invoice
      </Button>
    );
  } else if (current === "packed") {
    primary = (
      <Button icon={ClipboardList} onClick={() => setDialog("rts")}>
        Mark ready to ship
      </Button>
    );
  } else if (current === "ready_to_ship") {
    primary = (
      <Button icon={Truck} onClick={() => setDialog("pickup")}>
        Request pickup
      </Button>
    );
  } else if (["shipped", "in_transit", "out_for_delivery", "undelivered"].includes(current)) {
    primary = (
      <Button variant="secondary" icon={MapPin} onClick={() => toast.show("Live tracking shows the latest BluBuy Logistics scan for this AWB.")}>
        Track shipment
      </Button>
    );
  } else if (current === "delivered") {
    const d = daysSinceDelivery ?? 0;
    const allowed = d >= 5 && d <= 30;
    primary = (
      <Button
        variant="secondary"
        icon={Star}
        disabled={!allowed}
        title={allowed ? undefined : d < 5 ? `Available ${5 - d} days from now (5 to 30 days after delivery)` : "Only within 30 days of delivery"}
        onClick={() => toast.show("A neutral review request was sent through BluBuy. You can send it once per order.")}
      >
        Request a review
      </Button>
    );
  } else if (["return_requested", "returned", "rto_in_transit", "returned_to_seller"].includes(current) && returnId) {
    primary = (
      <ButtonLink href={`/seller/returns/${returnId}`} icon={Undo2}>
        View return
      </ButtonLink>
    );
  }

  return (
    <>
      {message}
      {canCancel && (
        <Button variant="ghost" icon={Ban} className="text-danger-700 hover:bg-danger-50" onClick={() => setDialog("cancel")}>
          Cancel order
        </Button>
      )}
      {secondary}
      {primary}

      <Modal
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Cancel this order"
        description="The customer is refunded in full. This counts toward your pre-fulfilment cancel rate."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep order
            </Button>
            <Button variant="danger" onClick={() => move("cancelled", "Order cancelled. The customer has been notified and refunded.")}>
              Cancel order
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="od-cancel-reason" required>
            <Select id="od-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)" htmlFor="od-cancel-note">
            <Textarea id="od-cancel-note" className="min-h-20" placeholder="Visible to BluBuy support only" />
          </Field>
          <p className="rounded-lg bg-warning-50 px-3 py-2.5 text-[13px] text-warning-700">A ₹60 penalty applies per item (1% above ₹10,000, capped at ₹1,000).</p>
        </div>
      </Modal>

      <Modal
        open={dialog === "rts"}
        onClose={() => setDialog(null)}
        title="Confirm package weight and size"
        description="Chargeable weight is the higher of actual and volumetric weight (L x W x H / 5000)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button icon={Check} onClick={() => move("ready_to_ship", "Marked ready to ship and added to today's manifest for the 4:00 to 6:00 PM pickup.")}>
              Mark ready to ship
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Weight (kg)" htmlFor="rts-w">
            <Input id="rts-w" type="number" step="0.1" defaultValue={weightKg} />
          </Field>
          <Field label="Length (cm)" htmlFor="rts-l">
            <Input id="rts-l" type="number" defaultValue={dims[0]} />
          </Field>
          <Field label="Width (cm)" htmlFor="rts-b">
            <Input id="rts-b" type="number" defaultValue={dims[1]} />
          </Field>
          <Field label="Height (cm)" htmlFor="rts-h">
            <Input id="rts-h" type="number" defaultValue={dims[2]} />
          </Field>
        </div>
        <p className="mt-4 text-[13px] text-ink-600">
          Volumetric weight: <span className="font-medium text-ink-900 tabular-nums">{((dims[0] * dims[1] * dims[2]) / 5000).toFixed(2)} kg</span>. If the hub measures a higher slab, the
          difference plus ₹10 is recovered from your payout.
        </p>
      </Modal>

      <Modal
        open={dialog === "pickup"}
        onClose={() => setDialog(null)}
        title="Request pickup"
        description="This package is on manifest for your Andheri warehouse."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button icon={Truck} onClick={() => move("ready_to_ship", "Pickup confirmed for today, 4:00 to 6:00 PM. Hand over against the associate's scan.")}>
              Confirm pickup
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Today, 4:00 to 6:00 PM at Unit 14, Marol Industrial Estate, Andheri East. The associate scans every package on the manifest; keep the label facing up.
        </p>
        <p className="mt-3 text-[13px] text-ink-500">
          Need a different slot? <Link href="/seller/settings?tab=pickup" className="font-medium text-brand-700 hover:underline">Change pickup preferences</Link>
        </p>
      </Modal>
      {toast.node}
    </>
  );
}
