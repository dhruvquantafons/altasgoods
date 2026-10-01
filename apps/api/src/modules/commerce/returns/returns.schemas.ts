import { z } from "zod";
import { RETURN_STATUSES } from "../../../db/schema.js";

const status = z.enum(RETURN_STATUSES);

export const createReturnBody = z.object({
  orderItemId: z.uuid(),
  qty: z.number().int().min(1).max(10).default(1),
  reasonCode: z.string().regex(/^[A-Z_]{3,40}$/),
  reasonLabel: z.string().trim().min(3).max(120),
  fault: z.enum(["SELLER", "LOGISTICS", "CUSTOMER"]),
  comments: z.string().trim().max(1000).optional(),
  photoIds: z.array(z.uuid()).max(6).default([]),
  resolution: z.enum(["REFUND", "REPLACEMENT", "EXCHANGE"]),
  exchangeSize: z.string().trim().max(20).optional(),
  refundTo: z.enum(["SOURCE", "CREDITS", "BANK"]).optional(),
  refundUpi: z
    .string()
    .regex(/^[\w.-]{2,}@[a-z]{2,}$/i, "Enter a valid UPI ID, for example name@bank")
    .optional(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupSlot: z.string().trim().min(3).max(40),
  addressId: z.uuid().optional().describe("Defaults to the order's delivery address"),
});

export const rescheduleBody = z.object({ pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), pickupSlot: z.string().trim().min(3).max(40) });

export const refundSchema = z.object({
  id: z.uuid(),
  orderId: z.string(),
  returnId: z.string().nullable(),
  source: z.enum(["RETURN", "CANCELLATION", "SUPPORT"]),
  title: z.string(),
  image: z.string().nullable(),
  amountPaise: z.number().int(),
  method: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const decisionBody = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() });
export const qcBody = z.object({ pass: z.boolean(), note: z.string().trim().max(500).optional() });
export const advanceBody = z.object({ to: z.enum(["OUT_FOR_PICKUP", "PICKED_UP", "PICKUP_FAILED", "IN_TRANSIT", "RECEIVED"]) });
export const sellerListQuery = z.object({ status: z.string().max(200).optional() });

export const returnSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderItemId: z.uuid(),
  sellerId: z.string(),
  item: z.object({ title: z.string(), image: z.string(), variant: z.string(), unitPricePaise: z.number().int(), productId: z.string() }),
  customerName: z.string(),
  qty: z.number().int(),
  reasonCode: z.string(),
  reasonLabel: z.string(),
  fault: z.enum(["SELLER", "LOGISTICS", "CUSTOMER"]),
  comments: z.string().nullable(),
  photos: z.array(z.object({ id: z.string(), name: z.string() })),
  resolution: z.enum(["REFUND", "REPLACEMENT", "EXCHANGE"]),
  exchangeSize: z.string().nullable(),
  refundTo: z.enum(["SOURCE", "CREDITS", "BANK"]).nullable(),
  refundAmountPaise: z.number().int(),
  instantRefund: z.boolean(),
  refundStatus: z.string().nullable(),
  status,
  pickupDate: z.string().nullable(),
  pickupSlot: z.string().nullable(),
  address: z.object({ name: z.string(), city: z.string(), pincode: z.string(), line1: z.string() }),
  awb: z.string().nullable(),
  qcNote: z.string().nullable(),
  sellerNote: z.string().nullable(),
  cancellable: z.boolean(),
  events: z.array(z.object({ fromStatus: status.nullable(), toStatus: status, actor: z.string(), note: z.string().nullable(), at: z.iso.datetime() })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const uploadSchema = z.object({ id: z.uuid(), name: z.string(), mimeType: z.string(), sizeBytes: z.number().int() });
