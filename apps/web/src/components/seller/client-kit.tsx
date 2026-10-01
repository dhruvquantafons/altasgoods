"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import {
  Ban,
  Check,
  Copy,
  Download,
  FileText,
  Pause,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Truck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/**
 * Small client widgets used across Seller Hub pages. Icons are chosen by a
 * string key so server components never pass a component across the boundary.
 */
const ICONS = {
  ban: Ban,
  check: Check,
  copy: Copy,
  download: Download,
  file: FileText,
  pause: Pause,
  play: Play,
  plus: Plus,
  printer: Printer,
  refresh: RefreshCw,
  send: Send,
  truck: Truck,
  upload: Upload,
} satisfies Record<string, LucideIcon>;

export type KitIcon = keyof typeof ICONS;

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

/** A button whose mock action confirms with a toast. */
export function ToastButton({
  children,
  message,
  icon,
  variant = "secondary",
  size = "md",
  className,
  ariaLabel,
}: {
  children?: ReactNode;
  message: string;
  icon?: KitIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
}) {
  const toast = useToast();
  return (
    <>
      <Button variant={variant} size={size} icon={icon ? ICONS[icon] : undefined} className={className} onClick={() => toast.show(message)} aria-label={ariaLabel}>
        {children}
      </Button>
      {toast.node}
    </>
  );
}

/** Native select that submits its parent GET form on change, so URL filters apply instantly. */
export function AutoSubmitSelect({ className, children, ...props }: ComponentProps<typeof Select>) {
  return (
    <Select
      {...props}
      className={className}
      onChange={(e) => {
        e.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </Select>
  );
}

/** Copies an identifier to the clipboard with a brief confirmation. */
export function CopyId({ value, className }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn("inline-flex size-6 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700", className)}
      aria-label={done ? "Copied" : `Copy ${value}`}
    >
      {done ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={2} />}
    </button>
  );
}
