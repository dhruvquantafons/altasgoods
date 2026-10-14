/**
 * Care Desk helpers: channel labels and icons, and the SLA badge.
 * Server-safe (no client hooks), so pages can render them directly.
 */
import { Mail, MessageCircle, Phone, Smartphone, Timer } from "lucide-react";
import { durationLabel, formatDayTime } from "@/components/logistics/ops-ui";
import { Badge } from "@/components/ui/badge";
import type { TicketSla } from "@/lib/care-policy";
import type { Tone } from "@/lib/status";
import type { Ticket } from "@/lib/types";

export const CHANNEL: Record<Ticket["channel"], { label: string; icon: typeof Mail }> = {
  chat: { label: "Chat", icon: MessageCircle },
  email: { label: "Email", icon: Mail },
  phone: { label: "Phone", icon: Phone },
  app: { label: "App", icon: Smartphone },
};

export const CATEGORIES: Ticket["category"][] = ["Delivery", "Return and refund", "Payment", "Product quality", "Account", "Other"];

/** Words for the SLA state, used by badges and plain-text cells. */
export function slaText(sla: TicketSla) {
  if (sla.state === "met") return "SLA met";
  if (sla.state === "paused") return "Paused, awaiting customer";
  if (sla.state === "breached") return `Reply overdue ${durationLabel(-sla.minsLeft)}`;
  return `Reply in ${durationLabel(sla.minsLeft)}`;
}

export function slaTone(sla: TicketSla): Tone {
  return sla.state === "breached" ? "danger" : sla.state === "at_risk" ? "warning" : sla.state === "met" ? "success" : "neutral";
}

/** Countdown badge for the next reply due (warning under one hour, danger once breached). */
export function SlaBadge({ sla, size = "sm" }: { sla: TicketSla; size?: "sm" | "md" }) {
  return (
    <Badge tone={slaTone(sla)} size={size} icon={sla.state === "met" || sla.state === "paused" ? undefined : Timer}>
      {slaText(sla)}
    </Badge>
  );
}

export function slaTitle(sla: TicketSla) {
  return `${sla.code}: next reply due ${formatDayTime(sla.dueAt)}, resolution due ${formatDayTime(sla.resolutionDueAt)}`;
}
