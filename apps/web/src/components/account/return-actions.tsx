"use client";

import { useState } from "react";
import { CalendarClock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/** Pickup reschedule and withdraw actions for an open return (before pickup). */
export function ReturnActions({
  returnId,
  canCancel,
  canReschedule,
  slots,
}: {
  returnId: string;
  canCancel: boolean;
  canReschedule: boolean;
  slots: { key: string; label: string; windows: string[] }[];
}) {
  const [open, setOpen] = useState<"cancel" | "reschedule" | null>(null);
  const [slot, setSlot] = useState(slots[0]?.key ?? "");
  const [win, setWin] = useState("");
  const toast = useToast();
  const chosen = slots.find((s) => s.key === slot);

  return (
    <>
      {canReschedule && (
        <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => setOpen("reschedule")}>
          Reschedule pickup
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setOpen("cancel")}>
          Cancel request
        </Button>
      )}

      <Modal
        open={open === "reschedule"}
        onClose={() => setOpen(null)}
        title="Reschedule pickup"
        description={`Return ${returnId}. Pickups are free and take about two minutes at your door.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Keep current slot
            </Button>
            <Button
              disabled={!win}
              onClick={() => {
                setOpen(null);
                toast.show(`Pickup moved to ${chosen?.label}, ${win}`);
              }}
            >
              Confirm new slot
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-semibold text-ink-900">Date</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={slot === s.key}
              onClick={() => {
                setSlot(s.key);
                setWin("");
              }}
              className={cn(
                "h-10 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
                slot === s.key ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-line-strong text-ink-700 hover:border-ink-400",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[13px] font-semibold text-ink-900">Time window</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {chosen?.windows.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={win === w}
              onClick={() => setWin(w)}
              className={cn(
                "h-10 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
                win === w ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-line-strong text-ink-700 hover:border-ink-400",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={open === "cancel"}
        onClose={() => setOpen(null)}
        title={`Cancel return ${returnId}?`}
        description="You will keep the item and the pickup will be called off."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Keep request
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(null);
                toast.show("Return request cancelled");
              }}
            >
              Cancel request
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">You can raise a new request any time while the return window is still open.</p>
      </Modal>
      {toast.node}
    </>
  );
}
