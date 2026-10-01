"use client";

import { useState } from "react";
import { CalendarClock, Undo2, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

export interface AssigneeOption {
  id: string;
  name: string;
  vehicle: string;
  remaining: number;
  status: string;
  runsheetId?: string;
}

type Dialog = "reassign" | "reschedule" | "rto" | null;

const REASSIGN_REASONS = { rebalance: "Beat rebalancing", vehicle: "Vehicle breakdown", unwell: "Associate unwell", customer: "Customer asked for a later slot" } as const;
const SLOTS = { am: "9 AM to 1 PM", pm: "1 PM to 5 PM", eve: "5 PM to 9 PM" } as const;
const RESCHEDULE_REASONS = { customer: "Customer requested by call", address: "Address details awaited", prepaid: "COD to prepaid link sent", hub: "Hub capacity" } as const;
const RTO_REASONS = { refused: "Customer refused (confirmed on IVR)", exhausted: "Attempts exhausted", cancelled: "Customer cancelled", oda: "Outside delivery area", damaged: "Damaged in network" } as const;

/** Reassign, reschedule and mark RTO for one shipment (mock actions with confirmation). */
export function ShipmentActions({
  awb,
  canAct,
  canRto,
  currentAssociateId,
  options,
  dates,
  originLane,
}: {
  awb: string;
  canAct: boolean;
  canRto: boolean;
  currentAssociateId?: string;
  options: AssigneeOption[];
  dates: { value: string; label: string; hint: string }[];
  originLane: string;
}) {
  const [open, setOpen] = useState<Dialog>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [reassignReason, setReassignReason] = useState<keyof typeof REASSIGN_REASONS>("rebalance");
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [slot, setSlot] = useState<keyof typeof SLOTS>("am");
  const [rescheduleReason, setRescheduleReason] = useState<keyof typeof RESCHEDULE_REASONS>("customer");
  const [notify, setNotify] = useState(true);
  const [rtoReason, setRtoReason] = useState<keyof typeof RTO_REASONS | "">("");
  const [rtoNote, setRtoNote] = useState("");
  // what has been done here, shown under the buttons (mock: local state only)
  const [reassigned, setReassigned] = useState<{ id: string; name: string; runsheetId?: string; reason: string } | null>(null);
  const [rescheduled, setRescheduled] = useState<{ day: string; slot: string; reason: string; notified: boolean } | null>(null);
  const [rto, setRto] = useState<string | null>(null);
  const { show, node } = useToast();
  const close = () => setOpen(null);
  const currentId = reassigned?.id ?? currentAssociateId;

  return (
    <>
      <Button variant="secondary" icon={UserRoundCog} disabled={!canAct || !!rto} onClick={() => setOpen("reassign")}>
        Reassign
      </Button>
      <Button variant="secondary" icon={CalendarClock} disabled={!canAct || !!rto} onClick={() => setOpen("reschedule")}>
        Reschedule
      </Button>
      <Button variant="secondary" icon={Undo2} disabled={!canRto || !!rto} onClick={() => setOpen("rto")} className="text-danger-700 hover:bg-danger-50">
        {rto ? "RTO requested" : "Mark RTO"}
      </Button>
      {(reassigned || rescheduled || rto) && (
        <ul className="w-full max-w-sm basis-full space-y-1 text-xs leading-relaxed text-ink-600 sm:text-right" aria-live="polite">
          {reassigned && (
            <li>
              Reassigned to <span className="font-medium text-ink-900">{reassigned.name}</span>
              {reassigned.runsheetId ? ` on ${reassigned.runsheetId}` : ""}. Reason: {reassigned.reason}.
            </li>
          )}
          {rescheduled && (
            <li>
              Rescheduled to{" "}
              <span className="font-medium text-ink-900">
                {rescheduled.day}, {rescheduled.slot}
              </span>
              . Reason: {rescheduled.reason}. {rescheduled.notified ? "Customer notified by SMS and WhatsApp." : "Customer not notified."}
            </li>
          )}
          {rto && (
            <li className="text-danger-700">
              Marked for RTO on {originLane}. Reason: {rto}.
            </li>
          )}
        </ul>
      )}

      <Modal
        open={open === "reassign"}
        onClose={close}
        title="Reassign shipment"
        description={`Move ${awb} to another associate's runsheet. The customer's delivery slot stays the same.`}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={!assignee}
              onClick={() => {
                const a = options.find((o) => o.id === assignee);
                if (!a) return;
                const reason = REASSIGN_REASONS[reassignReason];
                close();
                setReassigned({ id: a.id, name: a.name, runsheetId: a.runsheetId, reason });
                setAssignee("");
                show(`${awb} moved to ${a.name}${a.runsheetId ? ` on ${a.runsheetId}` : ""}. Reason: ${reason}.`);
              }}
            >
              Reassign
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-700">Associate</legend>
          <div className="flex flex-col gap-2">
            {options.map((o) => {
              const current = o.id === currentId;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors",
                    assignee === o.id ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-100" : "border-line hover:bg-ink-50",
                    current && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input type="radio" name="assignee" value={o.id} disabled={current} checked={assignee === o.id} onChange={() => setAssignee(o.id)} className="size-4 accent-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900">
                      {o.name}
                      {current && <span className="ml-1.5 text-xs font-normal text-ink-500">(current)</span>}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {o.vehicle}, {o.status}
                    </span>
                  </span>
                  <span className="text-right text-xs text-ink-500 tabular-nums">
                    <span className="block text-[13px] font-medium text-ink-900">{o.remaining}</span>
                    stops left
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Reason" htmlFor="reassign-reason" className="mt-4">
          <Select id="reassign-reason" value={reassignReason} onChange={(e) => setReassignReason(e.target.value as keyof typeof REASSIGN_REASONS)}>
            {Object.entries(REASSIGN_REASONS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={open === "reschedule"}
        onClose={close}
        title="Reschedule delivery"
        description="Pick a new date and slot. The customer is notified and the shipment moves to that day's runsheet planning."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={!date}
              onClick={() => {
                const day = dates.find((d) => d.value === date)?.label ?? date;
                const next = { day, slot: SLOTS[slot], reason: RESCHEDULE_REASONS[rescheduleReason], notified: notify };
                close();
                setRescheduled(next);
                show(`Delivery for ${awb} rescheduled to ${next.day}, ${next.slot}. Reason: ${next.reason}. ${next.notified ? "The customer has been sent the new slot by SMS and WhatsApp." : "The customer was not notified."}`);
              }}
            >
              Reschedule
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-700">Date</legend>
          <div className="grid grid-cols-3 gap-2">
            {dates.map((d) => (
              <label
                key={d.value}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2.5 text-center transition-colors",
                  date === d.value ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-100" : "border-line hover:bg-ink-50",
                )}
              >
                <input type="radio" name="date" value={d.value} checked={date === d.value} onChange={() => setDate(d.value)} className="sr-only" />
                <span className="block text-sm font-medium text-ink-900">{d.label}</span>
                <span className="block text-xs text-ink-500">{d.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Slot" htmlFor="slot">
            <Select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as keyof typeof SLOTS)}>
              {Object.entries(SLOTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="resched-reason">
            <Select id="resched-reason" value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value as keyof typeof RESCHEDULE_REASONS)}>
              {Object.entries(RESCHEDULE_REASONS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Checkbox
          className="mt-4"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          label="Notify the customer by SMS and WhatsApp"
          description="Includes the new date, slot and a link to change it again."
        />
      </Modal>

      <Modal
        open={open === "rto"}
        onClose={close}
        title="Mark for return to origin"
        description={`${awb} will be closed for delivery and bagged on the return lane ${originLane}.`}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rtoReason || rtoNote.trim().length < 8}
              onClick={() => {
                if (!rtoReason) return;
                close();
                setRto(RTO_REASONS[rtoReason]);
                show(`RTO initiated for ${awb}. Reason: ${RTO_REASONS[rtoReason]}. Seller and customer notified.`);
              }}
            >
              Mark RTO
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="rto-reason" required>
            <Select id="rto-reason" value={rtoReason} onChange={(e) => setRtoReason(e.target.value as keyof typeof RTO_REASONS)}>
              <option value="" disabled>
                Choose a reason
              </option>
              {Object.entries(RTO_REASONS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note for the audit log" htmlFor="rto-note" required hint="At least 8 characters. Visible to the seller and Care Desk.">
            <Textarea id="rto-note" value={rtoNote} onChange={(e) => setRtoNote(e.target.value)} placeholder="For example: customer confirmed cancellation on IVR at 10:12 am" />
          </Field>
          <p className="rounded-lg border border-line bg-ink-50 px-3 py-2.5 text-[13px] leading-relaxed text-ink-600">
            Customer-caused RTO charges the seller forward shipping only. COD refusals count toward the customer&apos;s COD risk.
          </p>
        </div>
      </Modal>
      {node}
    </>
  );
}
