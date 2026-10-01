"use client";

import { useId, useState } from "react";
import {
  ArrowRight,
  Ban,
  Check,
  CirclePause,
  Copy,
  Download,
  Eye,
  FileText,
  Flag,
  Lock,
  LockOpen,
  Mail,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  StickyNote,
  Trash2,
  TriangleAlert,
  Truck,
  UserRoundCog,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/** Icons are referenced by name so server pages can configure client buttons. */
const ICONS = {
  arrow: ArrowRight,
  ban: Ban,
  check: Check,
  pause: CirclePause,
  copy: Copy,
  download: Download,
  eye: Eye,
  file: FileText,
  flag: Flag,
  lock: Lock,
  unlock: LockOpen,
  mail: Mail,
  edit: PencilLine,
  play: Play,
  plus: Plus,
  retry: RefreshCw,
  refund: RotateCcw,
  send: Send,
  shield: ShieldAlert,
  note: StickyNote,
  trash: Trash2,
  truck: Truck,
  user: UserRoundCog,
  wallet: Wallet,
  x: X,
} as const;

export type ActionIcon = keyof typeof ICONS;
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft" | "dark";
type Size = "xs" | "sm" | "md";

export interface ActionField {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "date";
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
}

/**
 * A button that opens a confirmation dialog with a reason code, optional
 * fields and a note, then confirms with a toast. Every admin write in the spec
 * needs a reason and lands in the audit log, so this is the standard pattern.
 */
export function ActionButton({
  label,
  icon,
  variant = "secondary",
  size = "sm",
  title,
  description,
  reasons,
  reasonLabel = "Reason",
  note = "optional",
  notePlaceholder = "Add context for the audit log",
  fields = [],
  summary = [],
  warning,
  confirmLabel,
  danger = false,
  toast,
  doneLabel,
  className,
  disabled,
}: {
  label: string;
  icon?: ActionIcon;
  variant?: Variant;
  size?: Size;
  title: string;
  description?: string;
  reasons?: string[];
  reasonLabel?: string;
  note?: "required" | "optional" | "none";
  notePlaceholder?: string;
  fields?: ActionField[];
  summary?: { label: string; value: string }[];
  warning?: string;
  confirmLabel?: string;
  danger?: boolean;
  toast: string;
  doneLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const id = useId();
  const { show, node } = useToast();
  const Icon = icon ? ICONS[icon] : undefined;
  const missing = (reasons?.length && !reason) || (note === "required" && text.trim().length < 3);

  function confirm() {
    setOpen(false);
    show(toast);
    if (doneLabel) setDone(true);
    setReason("");
    setText("");
  }

  return (
    <>
      <Button
        variant={done ? "ghost" : variant}
        size={size}
        icon={done ? Check : Icon}
        className={className}
        disabled={disabled || done}
        onClick={() => setOpen(true)}
      >
        {done ? doneLabel : label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={danger ? "danger" : "primary"} size="sm" disabled={Boolean(missing)} onClick={confirm}>
              {confirmLabel ?? label}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {summary.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-line bg-ink-50/60 p-3.5 text-[13px]">
              {summary.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="text-xs text-ink-500">{s.label}</dt>
                  <dd className="truncate font-medium text-ink-900">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {warning && (
            <p className={cn("flex gap-2 rounded-xl border px-3.5 py-3 text-[13px]", danger ? "border-danger-100 bg-danger-50 text-danger-700" : "border-warning-100 bg-warning-50 text-warning-700")}>
              <TriangleAlert size={16} className="mt-px shrink-0" aria-hidden="true" />
              {warning}
            </p>
          )}
          {reasons && reasons.length > 0 && (
            <Field label={reasonLabel} required htmlFor={`${id}-reason`}>
              <Select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="" disabled>
                  Choose a reason
                </option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {fields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint} htmlFor={`${id}-${f.name}`}>
              {f.type === "select" ? (
                <Select id={`${id}-${f.name}`} defaultValue={f.defaultValue ?? f.options?.[0]}>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id={`${id}-${f.name}`} type={f.type ?? "text"} defaultValue={f.defaultValue} placeholder={f.placeholder} />
              )}
            </Field>
          ))}
          {note !== "none" && (
            <Field label={note === "required" ? "Note" : "Note (optional)"} required={note === "required"} htmlFor={`${id}-note`} hint="Saved to the audit log with your name and IP address">
              <Textarea id={`${id}-note`} value={text} onChange={(e) => setText(e.target.value)} placeholder={notePlaceholder} className="min-h-20" />
            </Field>
          )}
        </div>
      </Modal>
      {node}
    </>
  );
}

/** Fire-and-confirm button for mock actions that need no dialog (export, retry, resend). */
export function ToastButton({
  label,
  icon,
  toast,
  variant = "secondary",
  size = "sm",
  doneLabel,
  className,
}: {
  label: string;
  icon?: ActionIcon;
  toast: string;
  variant?: Variant;
  size?: Size;
  doneLabel?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const { show, node } = useToast();
  const Icon = icon ? ICONS[icon] : undefined;
  return (
    <>
      <Button
        variant={done ? "ghost" : variant}
        size={size}
        icon={done ? Check : Icon}
        className={className}
        disabled={done}
        onClick={() => {
          show(toast);
          if (doneLabel) setDone(true);
        }}
      >
        {done ? doneLabel : label}
      </Button>
      {node}
    </>
  );
}
