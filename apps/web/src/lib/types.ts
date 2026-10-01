/**
 * BluBuy domain model. These shapes mirror the planned REST API so the web app,
 * the backend and the future Flutter app share one vocabulary.
 * Money is always in whole rupees (INR) unless a field says otherwise.
 */

import type {
  CampaignStatus,
  CouponStatus,
  ListingStatus,
  NdrReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReturnStatus,
  SellerStatus,
  SettlementStatus,
  ShipmentStatus,
  TicketPriority,
  TicketStatus,
} from "./status";

export type ID = string;

/* ----------------------------- Catalog ----------------------------- */

export interface Category {
  id: ID;
  slug: string;
  name: string;
  parentId?: ID;
  /** lucide icon name used in navigation */
  icon: string;
  image?: string;
  /** commission percent charged to sellers (example rate card) */
  commission: number;
  children?: Category[];
}

export interface Brand {
  id: ID;
  name: string;
  slug: string;
  verified: boolean;
}

export interface VariantOption {
  name: string; // "Colour", "Size", "Storage"
  values: { label: string; swatch?: string; available: boolean }[];
}

export interface ProductSpec {
  group: string;
  items: { label: string; value: string }[];
}

/** A seller-specific offer on a product (price, stock, fulfillment). Many offers can exist per product. */
export interface Offer {
  sellerId: ID;
  price: number;
  mrp: number;
  stock: number;
  fulfilledBy: "blubuy" | "seller";
  deliveryDays: number;
  codAvailable: boolean;
  returnWindowDays: number;
}

export interface Product {
  id: ID;
  slug: string;
  sku: string;
  title: string;
  brandId: ID;
  categoryId: ID;
  subcategory: string;
  image: string;
  gallery: string[];
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  reviewCount: number;
  highlights: string[];
  description: string;
  specs: ProductSpec[];
  variants: VariantOption[];
  offers: Offer[];
  /** seller id currently winning the featured offer (buy box) */
  featuredSellerId: ID;
  assured: boolean;
  tags: ("bestseller" | "new" | "deal" | "limited" | "plus")[];
  stock: number;
  soldLast30d: number;
  listingStatus: ListingStatus;
  createdAt: string;
}

/* ----------------------------- People ------------------------------ */

export interface Address {
  id: ID;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
  isDefault?: boolean;
}

export interface Customer {
  id: ID;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  joinedAt: string;
  orders: number;
  lifetimeValue: number;
  plusMember: boolean;
  bluCoins: number;
  status: "active" | "blocked" | "flagged";
  riskScore: number; // 0-100, higher is riskier (COD and return abuse signals)
}

export interface Seller {
  id: ID;
  slug: string;
  displayName: string;
  legalName: string;
  ownerName: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  city: string;
  state: string;
  pincode: string;
  joinedAt: string;
  status: SellerStatus;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  rating: number;
  ratingCount: number;
  categories: ID[];
  liveListings: number;
  gmv30d: number;
  orders30d: number;
  fulfillment: ("blubuy_fulfilled" | "easy_ship" | "self_ship")[];
  health: AccountHealth;
}

export interface AccountHealth {
  /** Order Defect Rate percent, target under 1 */
  odr: number;
  /** Pre-fulfilment cancellation rate percent, target under 2.5 */
  cancellationRate: number;
  /** Late dispatch rate percent, target under 4 */
  lateDispatchRate: number;
  /** Valid tracking rate percent, target over 95 */
  validTrackingRate: number;
  /** Return rate percent (informational) */
  returnRate: number;
  policyViolations: number;
  /** 0-1000 composite score */
  score: number;
}

/* ------------------------------ Orders ----------------------------- */

export interface OrderItem {
  id: ID;
  productId: ID;
  title: string;
  image: string;
  variant?: string;
  sellerId: ID;
  quantity: number;
  price: number;
  mrp: number;
  status: OrderStatus;
  shipmentId?: ID;
}

export interface OrderEvent {
  status: OrderStatus | ShipmentStatus | string;
  label: string;
  at: string;
  location?: string;
  note?: string;
}

export interface Order {
  id: ID; // e.g. "BB-405-2316794"
  customerId: ID;
  customerName: string;
  placedAt: string;
  items: OrderItem[];
  status: OrderStatus;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    txnId: string;
  };
  address: Address;
  subtotal: number;
  discount: number;
  couponCode?: string;
  shippingFee: number;
  platformFee: number;
  total: number;
  promisedBy: string;
  deliveredAt?: string;
  timeline: OrderEvent[];
  channel: "web" | "android" | "ios";
}

export interface ReturnRequest {
  id: ID;
  orderId: ID;
  itemId: ID;
  productTitle: string;
  image: string;
  customerName: string;
  sellerId: ID;
  reason: string;
  type: "refund" | "replacement";
  status: ReturnStatus;
  amount: number;
  requestedAt: string;
  updatedAt: string;
}

export interface Refund {
  id: ID;
  orderId: ID;
  returnId?: ID;
  customerName: string;
  amount: number;
  method: PaymentMethod | "bluwallet";
  status: RefundStatus;
  initiatedAt: string;
}

/* --------------------------- Money flows --------------------------- */

export interface FeeLine {
  label: string; // "Commission", "Fixed closing fee", "Shipping fee", "Collection fee", "GST on fees", "TCS", "TDS"
  amount: number; // negative = deduction
}

export interface Settlement {
  id: ID;
  sellerId: ID;
  periodStart: string;
  periodEnd: string;
  scheduledFor: string;
  orders: number;
  grossSales: number;
  fees: FeeLine[];
  refunds: number;
  netPayout: number;
  status: SettlementStatus;
  utr?: string;
}

/* --------------------------- Marketing ----------------------------- */

export interface Coupon {
  id: ID;
  code: string;
  description: string;
  type: "percent" | "flat";
  value: number;
  maxDiscount?: number;
  minOrder: number;
  usage: number;
  limit: number;
  startsAt: string;
  endsAt: string;
  status: CouponStatus;
  fundedBy: "blubuy" | "seller" | "bank";
}

export interface Campaign {
  id: ID;
  name: string;
  type: "sponsored_products" | "sponsored_brands" | "display";
  status: CampaignStatus;
  dailyBudget: number;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  sales: number;
  startedAt: string;
}

/* --------------------------- Engagement ---------------------------- */

export interface Review {
  id: ID;
  productId: ID;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  verified: boolean;
  helpful: number;
  status: "published" | "pending" | "flagged" | "removed";
}

export interface Ticket {
  id: ID;
  subject: string;
  customerName: string;
  orderId?: ID;
  category: "Delivery" | "Return and refund" | "Payment" | "Product quality" | "Account" | "Seller dispute" | "Other";
  channel: "chat" | "email" | "phone" | "app";
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string;
  messages: { from: "customer" | "agent" | "system"; author: string; body: string; at: string }[];
}

/* ---------------------------- Logistics ---------------------------- */

export interface Hub {
  id: ID;
  code: string; // "BLR-HSR-01"
  name: string;
  type: "fulfillment_center" | "sort_center" | "delivery_hub";
  city: string;
  capacity: number;
  utilisation: number; // percent
  manager: string;
}

export interface DeliveryAssociate {
  id: ID;
  name: string;
  phone: string;
  hubId: ID;
  vehicle: "bike" | "scooter" | "van" | "ev";
  status: "on_route" | "available" | "off_duty" | "on_break";
  assigned: number;
  delivered: number;
  failed: number;
  codCollected: number;
  rating: number;
}

export interface Shipment {
  id: ID; // AWB number
  orderId: ID;
  sellerId: ID;
  customerName: string;
  city: string;
  pincode: string;
  originHubId: ID;
  destinationHubId: ID;
  status: ShipmentStatus;
  weightKg: number;
  cod: boolean;
  codAmount: number;
  promisedBy: string;
  attempts: number;
  ndrReason?: NdrReason;
  associateId?: ID;
  lastUpdate: string;
}

/* ---------------------------- Platform ----------------------------- */

export interface StaffMember {
  id: ID;
  name: string;
  email: string;
  role: string;
  team: string;
  lastActive: string;
  status: "active" | "invited" | "disabled";
}

export interface AuditEvent {
  id: ID;
  actor: string;
  action: string;
  target: string;
  at: string;
  ip: string;
}

export interface Notification {
  id: ID;
  title: string;
  body: string;
  at: string;
  read: boolean;
  kind: "order" | "payment" | "account" | "promo" | "system" | "alert";
  href?: string;
}

/** A single point on a time series chart. */
export interface SeriesPoint {
  date: string;
  [key: string]: number | string;
}
