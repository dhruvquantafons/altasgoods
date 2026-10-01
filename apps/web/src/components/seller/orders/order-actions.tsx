"use client";

import Link from "next/link";
import { useState } from "react";
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
}: {
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

  function move(to: OrderStatus, message: string) {
    setCurrent(to);
    setDialog(null);
    toast.show(message);
  }

  const canCancel = sellerPacked && ["placed", "confirmed", "packed", "ready_to_ship"].includes(current);
  const message = (
    <ButtonLink href={`/seller/messages?order=${orderId}`} variant="secondary" icon={MessageSquare}>
      Message buyer
    </ButtonLink>
  );

  let primary: React.ReactNode = null;
  let secondary: React.ReactNode = null;

  if (!sellerPacked) {
    primary = (
      <Button variant="secondary" icon={MapPin} onClick={() => toast.show("Tracking opens in BluBuy Logistics. The fulfilment centre handles this order.")}>
        Track shipment
      </Button>
    );
  } else if (current === "placed") {
    primary = (
      <Button icon={Check} onClick={() => move("confirmed", "Order confirmed. Pack it and generate the label before the dispatch by time.")}>
        Confirm order
      </Button>
    );
  } else if (current === "confirmed") {
    primary = (
      <Button icon={Printer} onClick={() => move("packed", "Invoice and shipping label generated. The PDF has been downloaded.")}>
        Generate label and invoice
      </Button>
    );
  } else if (current === "packed") {
    secondary = (
      <Button variant="ghost" icon={Undo2} onClick={() => move("confirmed", "Label voided. Generate a new one after repacking.")}>
        Void label
      </Button>
    );
    primary = (
      <Button icon={ClipboardList} onClick={() => setDialog("rts")}>
        Mark ready to ship
      </Button>
    );
  } else if (current === "ready_to_ship") {
    secondary = (
      <Button variant="ghost" icon={Undo2} onClick={() => move("packed", "Removed from the manifest. Mark it ready again before the pickup slot.")}>
        Unmark ready to ship
      </Button>
    );
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
