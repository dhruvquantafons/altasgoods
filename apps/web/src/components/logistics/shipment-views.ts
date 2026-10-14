import type { LucideIcon } from "lucide-react";
import { CircleAlert, PackageCheck, PackageOpen, Truck, Undo2, Warehouse } from "lucide-react";
import type { ApiOrderItemStatus } from "@/lib/api/types";
import type { Tone } from "@/lib/status";

/** Shipping stages, each a set of order line statuses. A line becomes a shipment once it is handed to the courier. */
export const SHIPMENT_VIEWS: { key: string; label: string; statuses: ApiOrderItemStatus[]; icon: LucideIcon; tone: Tone; hint: string }[] = [
  { key: "pickup", label: "Awaiting pickup", statuses: ["READY_TO_SHIP"], icon: Warehouse, tone: "warning", hint: "Booked, waiting for the courier" },
  { key: "transit", label: "In transit", statuses: ["SHIPPED"], icon: Truck, tone: "brand", hint: "Picked up, on the way" },
  { key: "out", label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"], icon: PackageOpen, tone: "info", hint: "With the delivery agent today" },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"], icon: PackageCheck, tone: "success", hint: "Handed to the customer" },
  { key: "rto", label: "Returned to origin", statuses: ["RTO_IN_TRANSIT", "RTO_RECEIVED"], icon: Undo2, tone: "danger", hint: "Could not be delivered" },
  { key: "lost", label: "Lost", statuses: ["LOST"], icon: CircleAlert, tone: "danger", hint: "Marked lost by the courier" },
];

export const ALL_SHIPMENT_STATUSES = SHIPMENT_VIEWS.flatMap((v) => v.statuses);

export const countOf = (counts: Record<string, number>, statuses: ApiOrderItemStatus[]) => statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);
