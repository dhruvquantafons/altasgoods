"use client";

import Form from "next/form";
import type { ReactNode } from "react";
import {
  Banknote,
  Check,
  Download,
  Flag,
  MessageSquare,
  Phone,
  Printer,
  RefreshCw,
  ScanLine,
  Send,
  Truck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/interactive";

/**
 * GET form that navigates client side and submits as soon as a select changes,
 * so filter rows feel instant while staying URL driven and server rendered.
 */
export function AutoSubmitForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  return (
    <Form
      action={action}
      scroll={false}
      className={className}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}

const ICONS = {
  check: Check,
  send: Send,
  phone: Phone,
  printer: Printer,
  download: Download,
  refresh: RefreshCw,
  truck: Truck,
  scan: ScanLine,
  banknote: Banknote,
  flag: Flag,
  user: UserPlus,
  message: MessageSquare,
} as const;

export type ActionIcon = keyof typeof ICONS;

/** A mock action button: shows a confirmation toast. Icons are passed by name so server pages can use it. */
export function ToastButton({
  label,
  message,
  variant = "secondary",
  size = "sm",
  icon,
  className,
  ariaLabel,
}: {
  label?: string;
  message: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft" | "danger" | "dark";
  size?: "xs" | "sm" | "md" | "icon-sm";
  icon?: ActionIcon;
  className?: string;
  ariaLabel?: string;
}) {
  const { show, node } = useToast();
  return (
    <>
      <Button variant={variant} size={size} icon={icon ? ICONS[icon] : undefined} className={className} aria-label={ariaLabel} onClick={() => show(message)}>
        {label}
      </Button>
      {node}
    </>
  );
}
