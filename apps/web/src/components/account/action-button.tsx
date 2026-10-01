"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  Check,
  Copy,
  CreditCard,
  Download,
  Gift,
  Headset,
  KeyRound,
  LogOut,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Star,
  Ticket,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

const ICONS = {
  bell: Bell,
  check: Check,
  copy: Copy,
  card: CreditCard,
  download: Download,
  gift: Gift,
  headset: Headset,
  key: KeyRound,
  logout: LogOut,
  message: MessageSquareText,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  refresh: RefreshCcw,
  send: Send,
  shield: ShieldCheck,
  star: Star,
  ticket: Ticket,
  trash: Trash2,
  wallet: Wallet,
} as const;

export type ActionIcon = keyof typeof ICONS;

/**
 * A button for mock actions that can be rendered from Server Components:
 * icons are passed by name, and the result is a toast (optionally after a confirm dialog).
 */
export function ActionButton({
  label,
  icon,
  variant = "secondary",
  size = "sm",
  toast: message,
  confirm,
  className,
  doneLabel,
}: {
  label: string;
  icon?: ActionIcon;
  variant?: "primary" | "secondary" | "ghost" | "soft" | "outline" | "link" | "danger" | "dark" | "accent";
  size?: "xs" | "sm" | "md" | "lg";
  toast: string;
  confirm?: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean };
  className?: string;
  /** label shown after the action ran once (e.g. "Removed") */
  doneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const t = useToast();
  const run = () => {
    setOpen(false);
    setDone(true);
    t.show(message);
  };
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={done && doneLabel ? Check : icon ? ICONS[icon] : undefined}
        className={cn(className)}
        disabled={done && Boolean(doneLabel)}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {done && doneLabel ? doneLabel : label}
      </Button>
      {confirm && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="sm"
          title={confirm.title}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Not now
              </Button>
              <Button variant={confirm.danger ? "danger" : "primary"} onClick={run}>
                {confirm.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="text-sm text-ink-600">{confirm.body}</div>
        </Modal>
      )}
      {t.node}
    </>
  );
}
