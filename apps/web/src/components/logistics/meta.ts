/**
 * Status maps for Hub Console entities that are not yet in lib/status.ts
 * (runsheet, line haul, bag, NDR case, cash deposit, FC tasks). They follow the
 * canonical machines in docs/research/01-marketplace-workflows.md section 11
 * and should move to lib/status.ts when the backend enums land.
 */
import type { StatusMeta } from "@/lib/status";
import type { NdrReason } from "@/lib/status";
import type { DeliveryAssociate } from "@/lib/types";
import type {
  AppointmentStatus,
  BagStatus,
  CashDepositStatus,
  DiscrepancyKind,
  FcOutbound,
  FcPackStation,
  LineHaulStatus,
  NdrCaseStatus,
  NdrResponse,
  PickListStatus,
  Remittance,
  ReversePickupStatus,
  RtoStatus,
  RunsheetStatus,
  StopStatus,
} from "@/lib/mock/ops-extra";

export const RUNSHEET_STATUS: Record<RunsheetStatus, StatusMeta> = {
  created: { label: "Created", tone: "neutral" },
  assigned: { label: "Assigned", tone: "info" },
  dispatched: { label: "Dispatched", tone: "brand" },
  returned_to_hub: { label: "Back at hub", tone: "warning" },
  closed: { label: "Closed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const ASSOCIATE_STATUS: Record<DeliveryAssociate["status"], StatusMeta> = {
  on_route: { label: "On route", tone: "brand" },
  available: { label: "At hub", tone: "success" },
  on_break: { label: "On break", tone: "warning" },
  off_duty: { label: "Off duty", tone: "neutral" },
};

export const VEHICLE: Record<DeliveryAssociate["vehicle"], string> = {
  bike: "Motorbike",
  scooter: "Scooter",
  ev: "EV scooter",
  van: "Van",
};

export const LINEHAUL_STATUS: Record<LineHaulStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  in_transit: { label: "In transit", tone: "info" },
  delayed: { label: "Delayed", tone: "warning" },
  arrived: { label: "At dock", tone: "brand" },
  unloading: { label: "Unloading", tone: "brand" },
  received: { label: "Received", tone: "success" },
};

export const BAG_STATUS: Record<BagStatus, StatusMeta> = {
  pending: { label: "Not scanned", tone: "neutral" },
  received: { label: "Received", tone: "info" },
  debagged: { label: "Debagged", tone: "success" },
  short: { label: "Short", tone: "danger" },
  damaged: { label: "Damaged", tone: "danger" },
};

export const DISCREPANCY_KIND: Record<DiscrepancyKind, StatusMeta> = {
  short: { label: "Short", tone: "danger" },
  excess: { label: "Excess", tone: "warning" },
  damaged: { label: "Damaged", tone: "danger" },
  misrouted: { label: "Misrouted", tone: "warning" },
};

export const NDR_CASE_STATUS: Record<NdrCaseStatus, StatusMeta> = {
  open: { label: "Open", tone: "warning" },
  awaiting_customer: { label: "Awaiting customer", tone: "neutral" },
  disputed: { label: "Disputed", tone: "danger" },
  reattempt_scheduled: { label: "Re-attempt scheduled", tone: "info" },
  reattempt_in_progress: { label: "Re-attempt on run", tone: "brand" },
  resolved_delivered: { label: "Delivered", tone: "success" },
  rto_approved: { label: "RTO approved", tone: "danger" },
};

export const NDR_RESPONSE: Record<NdrResponse["kind"], string> = {
  reattempt: "Re-attempt requested",
  address_update: "Address updated",
  cancel: "Asked to cancel",
  disputed: "Says they were available",
  cod_to_prepaid: "Paid online",
  none: "No response yet",
};

/** Every reason code the Rider app offers (section 11.7); the first seven match lib/status NDR_REASON. */
export const NDR_REASON_ALL: Record<NdrReason | "otp_not_provided" | "entry_restricted" | "open_box_rejected" | "address_not_found" | "da_unable_to_reach", string> = {
  customer_unavailable: "Customer not available",
  address_incomplete: "Incomplete address",
  customer_refused: "Refused by customer",
  cod_not_ready: "COD amount not ready",
  reschedule_requested: "Customer asked to reschedule",
  premises_closed: "Premises closed",
  out_of_delivery_area: "Outside delivery area",
  otp_not_provided: "OTP not provided",
  entry_restricted: "Entry restricted at gate",
  open_box_rejected: "Rejected at open box check",
  address_not_found: "Address not found",
  da_unable_to_reach: "Unable to reach (weather, vehicle)",
};

export const REVERSE_STATUS: Record<ReversePickupStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  out_for_pickup: { label: "Out for pickup", tone: "brand" },
  picked_up: { label: "Picked up", tone: "success" },
  qc_failed: { label: "QC failed", tone: "danger" },
  customer_unavailable: { label: "Customer unavailable", tone: "warning" },
};

export const RTO_STATUS: Record<RtoStatus, StatusMeta> = {
  rto_initiated: { label: "RTO initiated", tone: "warning" },
  bagged: { label: "Bagged for return", tone: "info" },
  rto_in_transit: { label: "RTO in transit", tone: "brand" },
  rto_delivered: { label: "Returned to origin", tone: "neutral" },
};

export const CASH_STATUS: Record<CashDepositStatus, StatusMeta> = {
  not_declared: { label: "Not declared", tone: "warning" },
  declared: { label: "Declared", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  short: { label: "Short", tone: "danger" },
  banked: { label: "Banked", tone: "brand" },
  reconciled: { label: "Reconciled", tone: "success" },
};

export const REMITTANCE_STATUS: Record<Remittance["status"], StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  processing: { label: "Processing", tone: "info" },
  remitted: { label: "Remitted", tone: "brand" },
  reconciled: { label: "Reconciled", tone: "success" },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  checked_in: { label: "Checked in", tone: "info" },
  receiving: { label: "Receiving", tone: "brand" },
  grn_posted: { label: "GRN posted", tone: "success" },
  no_show: { label: "No show", tone: "danger" },
};

export const PICKLIST_STATUS: Record<PickListStatus, StatusMeta> = {
  planned: { label: "Planned", tone: "neutral" },
  released: { label: "Released", tone: "info" },
  picking: { label: "Picking", tone: "brand" },
  picked: { label: "Picked", tone: "success" },
  short_pick: { label: "Short pick", tone: "warning" },
};

export const PACK_STATION_STATUS: Record<FcPackStation["status"], StatusMeta> = {
  active: { label: "Packing", tone: "success" },
  idle: { label: "Idle", tone: "warning" },
  offline: { label: "Offline", tone: "neutral" },
};

export const OUTBOUND_STATUS: Record<FcOutbound["status"], StatusMeta> = {
  planned: { label: "Planned", tone: "neutral" },
  loading: { label: "Loading", tone: "brand" },
  closed: { label: "Closed", tone: "info" },
  departed: { label: "Departed", tone: "success" },
};

export const STOP_STATUS: Record<StopStatus, StatusMeta> = {
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed", tone: "warning" },
  pending: { label: "Pending", tone: "neutral" },
  picked_up: { label: "Picked up", tone: "success" },
};

export const HUB_TYPE: Record<"fulfillment_center" | "sort_center" | "delivery_hub", string> = {
  fulfillment_center: "Fulfilment centre",
  sort_center: "Sort centre",
  delivery_hub: "Delivery hub",
};
