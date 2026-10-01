/**
 * BluBuy database schema (phase 2: identity, catalog, cart, checkout, orders,
 * payments, seller onboarding). Follows docs/research/01-marketplace-workflows.md section 12:
 * money is integer paise, statuses use the canonical UPPER_SNAKE_CASE names,
 * and every order change is recorded in order_events.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const paise = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/* ------------------------------ Status types ----------------------------- */

export const ORDER_STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "ABANDONED",
  "CONFIRMED",
  "IN_PROGRESS",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED",
  "CLOSED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** PENDING is internal: the line exists while payment is outstanding and is never shown to sellers. */
export const ORDER_ITEM_STATUSES = [
  "PENDING",
  "NEW",
  "ACCEPTED",
  "PACKED",
  "READY_TO_SHIP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "RTO_IN_TRANSIT",
  "RTO_RECEIVED",
  "LOST",
  "RETURN_REQUESTED",
  "RETURN_IN_PROGRESS",
  "RETURNED",
  "REPLACED",
  "CLOSED",
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "COD_PENDING",
  "COD_COLLECTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING", "EMI", "PAY_LATER", "COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REFUND_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export type Actor = "CUSTOMER" | "SELLER" | "SYSTEM" | "PAYMENT" | "LOGISTICS" | "STAFF";

/** BluBuy Control roles from spec section 8.1 that the API knows about so far. */
export const STAFF_ROLES = ["SUPER_ADMIN", "OPS_ADMIN", "SELLER_VERIFIER", "RISK_ANALYST", "AUDITOR"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Seller onboarding, spec section 11.8. The account exists (REGISTERED) once the mobile number is verified. */
export const APPLICATION_STATUSES = ["KYC_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const CONSTITUTIONS = ["PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "PUBLIC_LIMITED"] as const;
export type Constitution = (typeof CONSTITUTIONS)[number];

export const KYC_DOCUMENT_KINDS = [
  "SIGNATURE",
  "ID_PROOF",
  "ADDRESS_PROOF",
  "PARTNERSHIP_DEED",
  "LLP_CERTIFICATE",
  "INCORPORATION_CERTIFICATE",
  "BANK_PROOF",
  "TRADEMARK",
] as const;
export type KycDocumentKind = (typeof KYC_DOCUMENT_KINDS)[number];

export type CheckResult = "VERIFIED" | "PARTIAL" | "FAILED";

export interface GstCheck {
  result: CheckResult;
  gstin: string;
  portalStatus: "ACTIVE" | "CANCELLED" | "SUSPENDED";
  legalName: string;
  tradeName: string;
  constitution: Constitution;
  state: string;
  principalAddress: string;
  registeredOn: string;
  filing: string;
  checkedAt: string;
}

export interface PanCheck {
  result: CheckResult;
  pan: string;
  holderName: string;
  holderType: string;
  nameMatchScore: number;
  aadhaarLinked: boolean;
  checkedAt: string;
}

export interface BankCheck {
  result: CheckResult;
  bankName: string;
  branch: string;
  ifsc: string;
  accountLast4: string;
  beneficiaryName: string | null;
  nameMatchScore: number;
  reference: string;
  failureReason?: string;
  checkedAt: string;
}

export interface RiskFlag {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

export interface PickupAddress {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  slot: string;
}

export interface BrandDetails {
  ownBrand: boolean;
  brandName?: string;
  trademark?: string;
  trademarkClass?: string;
  reseller: boolean;
}

/** Internal reviewer note, never shown to the applicant. */
export interface StaffNote {
  byUserId: string;
  byName: string | null;
  at: string;
  body: string;
}

/** An item a verifier asked the applicant to fix (a wizard step or a document kind). */
export interface FlaggedItem {
  key: string;
  label: string;
}

export interface FeeLine {
  code: "COMMISSION" | "FIXED_FEE" | "SHIPPING_FEE" | "GST_ON_FEES" | "TCS" | "TDS";
  label: string;
  amountPaise: number;
}

export interface AddressSnapshot {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  type: string;
}

const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`);

/* -------------------------------- Identity ------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    name: text("name"),
    email: text("email"),
    emailVerifiedAt: ts("email_verified_at"),
    isPlus: boolean("is_plus").notNull().default(false),
    plusRenewsAt: ts("plus_renews_at"),
    status: text("status").notNull().default("ACTIVE").$type<"ACTIVE" | "BLOCKED">(),
    /** BluBuy Control access; empty for shoppers and sellers */
    staffRoles: text("staff_roles").array().notNull().$type<StaffRole[]>().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_phone_uq").on(t.phone)],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshHash: text("refresh_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    replacedBy: uuid("replaced_by"),
    lastUsedAt: ts("last_used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_refresh_uq").on(t.refreshHash), index("sessions_user_idx").on(t.userId)],
);

/* ---------------------------- Catalog & sellers -------------------------- */

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  icon: text("icon"),
  image: text("image"),
  commissionBps: integer("commission_bps").notNull().default(800),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  verified: boolean("verified").notNull().default(false),
});

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  legalName: text("legal_name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  tier: text("tier").notNull().default("Bronze").$type<"Bronze" | "Silver" | "Gold" | "Platinum">(),
  rating: real("rating").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  joinedAt: ts("joined_at").notNull().defaultNow(),
});

export const sellerMembers = pgTable(
  "seller_members",
  {
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("OWNER").$type<"OWNER" | "MANAGER" | "OPERATIONS" | "CATALOG" | "FINANCE" | "READ_ONLY">(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sellerId, t.userId] }), index("seller_members_user_idx").on(t.userId)],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    subcategory: text("subcategory").notNull(),
    description: text("description").notNull().default(""),
    highlights: jsonb("highlights").notNull().$type<string[]>().default([]),
    specs: jsonb("specs").notNull().$type<{ group: string; items: { label: string; value: string }[] }[]>().default([]),
    variants: jsonb("variants").notNull().$type<{ name: string; values: { label: string; swatch?: string; available: boolean }[] }[]>().default([]),
    images: jsonb("images").notNull().$type<string[]>().default([]),
    rating: real("rating").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    assured: boolean("assured").notNull().default(false),
    featuredSellerId: text("featured_seller_id"),
    listingStatus: text("listing_status").notNull().default("LIVE"),
    soldLast30d: integer("sold_last_30d").notNull().default(0),
    /** title, brand, category and subcategory, maintained by the catalog service */
    searchText: text("search_text").notNull().default(""),
    searchVector: tsvector("search_vector").generatedAlwaysAs(sql`to_tsvector('simple', search_text)`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_brand_idx").on(t.brandId),
    index("products_search_idx").using("gin", t.searchVector),
    index("products_search_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    pricePaise: paise("price_paise").notNull(),
    mrpPaise: paise("mrp_paise").notNull(),
    stock: integer("stock").notNull().default(0),
    fulfilledBy: text("fulfilled_by").notNull().default("SELLER").$type<"BLUBUY" | "SELLER">(),
    handlingDays: integer("handling_days").notNull().default(1),
    deliveryDays: integer("delivery_days").notNull().default(3),
    codAvailable: boolean("cod_available").notNull().default(true),
    returnWindowDays: integer("return_window_days").notNull().default(7),
    weightGrams: integer("weight_grams").notNull().default(800),
    status: text("status").notNull().default("ACTIVE").$type<"ACTIVE" | "PAUSED">(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("offers_product_seller_uq").on(t.productId, t.sellerId),
    index("offers_seller_idx").on(t.sellerId),
    check("offers_stock_nonneg", sql`${t.stock} >= 0`),
    check("offers_price_le_mrp", sql`${t.pricePaise} <= ${t.mrpPaise}`),
  ],
);

/* ---------------------------- Customer data ------------------------------ */

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    type: text("type").notNull().default("HOME").$type<"HOME" | "WORK" | "OTHER">(),
    isDefault: boolean("is_default").notNull().default(false),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    variant: text("variant").notNull().default(""),
    qty: integer("qty").notNull().default(1),
    savedForLater: boolean("saved_for_later").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("cart_items_line_uq").on(t.userId, t.offerId, t.variant), check("cart_qty_range", sql`${t.qty} between 1 and 10`)],
);

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  type: text("type").notNull().$type<"PERCENT" | "FLAT">(),
  /** percent for PERCENT, paise for FLAT */
  value: integer("value").notNull(),
  maxDiscountPaise: paise("max_discount_paise"),
  minOrderPaise: paise("min_order_paise").notNull().default(0),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  status: text("status").notNull().default("ACTIVE").$type<"ACTIVE" | "PAUSED">(),
  fundedBy: text("funded_by").notNull().default("BLUBUY").$type<"BLUBUY" | "SELLER" | "BANK">(),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
});

/* --------------------------------- Orders -------------------------------- */

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 10001 });

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().$type<OrderStatus>(),
    paymentMethod: text("payment_method").notNull().$type<PaymentMethod>(),
    paymentStatus: text("payment_status").notNull().$type<PaymentStatus>(),
    address: jsonb("address").notNull().$type<AddressSnapshot>(),
    mrpTotalPaise: paise("mrp_total_paise").notNull(),
    subtotalPaise: paise("subtotal_paise").notNull(),
    couponDiscountPaise: paise("coupon_discount_paise").notNull().default(0),
    deliveryFeePaise: paise("delivery_fee_paise").notNull().default(0),
    totalPaise: paise("total_paise").notNull(),
    couponCode: text("coupon_code"),
    idempotencyKey: text("idempotency_key").notNull(),
    channel: text("channel").notNull().default("WEB").$type<"WEB" | "ANDROID" | "IOS">(),
    paymentDueBy: ts("payment_due_by"),
    placedAt: ts("placed_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_idempotency_uq").on(t.userId, t.idempotencyKey),
    index("orders_user_idx").on(t.userId, t.placedAt),
    index("orders_status_idx").on(t.status),
    check("orders_status_ck", inList("status", ORDER_STATUSES)),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    title: text("title").notNull(),
    image: text("image").notNull(),
    variant: text("variant").notNull().default(""),
    qty: integer("qty").notNull(),
    unitPricePaise: paise("unit_price_paise").notNull(),
    mrpPaise: paise("mrp_paise").notNull(),
    status: text("status").notNull().$type<OrderItemStatus>(),
    fees: jsonb("fees").$type<FeeLine[]>(),
    netSettlementPaise: paise("net_settlement_paise"),
    dispatchBy: ts("dispatch_by"),
    promisedBy: ts("promised_by").notNull(),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    awb: text("awb"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_seller_idx").on(t.sellerId, t.status, t.createdAt),
    check("order_items_qty_ck", sql`${t.qty} between 1 and 10`),
    check("order_items_status_ck", inList("status", ORDER_ITEM_STATUSES)),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id"),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull().$type<Actor>(),
    actorId: text("actor_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

/* -------------------------------- Payments ------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().$type<"SANDBOX" | "COD">(),
    method: text("method").notNull().$type<PaymentMethod>(),
    amountPaise: paise("amount_paise").notNull(),
    status: text("status").notNull().$type<PaymentStatus>(),
    providerRef: text("provider_ref"),
    failureReason: text("failure_reason"),
    capturedAt: ts("captured_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), check("payments_status_ck", inList("status", PAYMENT_STATUSES))],
);

/** Every provider webhook, keyed by the provider's event id so redelivery is a no-op. */
export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(),
  paymentId: uuid("payment_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: createdAt(),
});

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemId: uuid("order_item_id"),
    amountPaise: paise("amount_paise").notNull(),
    status: text("status").notNull().$type<RefundStatus>(),
    reason: text("reason").notNull(),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

/* ---------------------------- Seller onboarding --------------------------- */

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/**
 * Uploaded file bytes. Kept apart from the metadata so the storage can move to
 * object storage (S3 with KMS) without touching the onboarding tables.
 */
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  content: bytea("content").notNull(),
  createdAt: createdAt(),
});

/** Readable application numbers: SA-50001, SA-50002, ... */
export const sellerApplicationSeq = pgSequence("seller_application_seq", { startWith: 50001 });

/** One application per user; it records the wizard, the automatic checks and the review. */
export const sellerApplications = pgTable(
  "seller_applications",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("KYC_IN_PROGRESS").$type<ApplicationStatus>(),
    constitution: text("constitution").$type<Constitution>(),
    gstExempt: boolean("gst_exempt").notNull().default(false),
    gstin: text("gstin"),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    registeredAddress: text("registered_address"),
    gstState: text("gst_state"),
    pan: text("pan"),
    storeName: text("store_name"),
    storeDescription: text("store_description"),
    careNumber: text("care_number"),
    grievanceContact: text("grievance_contact"),
    pickup: jsonb("pickup").$type<PickupAddress>(),
    bankHolder: text("bank_holder"),
    /** full number is needed for payouts; production encrypts this column with a KMS key */
    bankAccount: text("bank_account"),
    bankIfsc: text("bank_ifsc"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    brand: jsonb("brand").$type<BrandDetails>(),
    gstCheck: jsonb("gst_check").$type<GstCheck>(),
    panCheck: jsonb("pan_check").$type<PanCheck>(),
    bankCheck: jsonb("bank_check").$type<BankCheck>(),
    riskFlags: jsonb("risk_flags").notNull().$type<RiskFlag[]>().default([]),
    flaggedItems: jsonb("flagged_items").notNull().$type<FlaggedItem[]>().default([]),
    reviewerMessage: text("reviewer_message"),
    staffNotes: jsonb("staff_notes").notNull().$type<StaffNote[]>().default([]),
    rejectionReason: text("rejection_reason"),
    agreementVersion: text("agreement_version"),
    agreementAcceptedAt: ts("agreement_accepted_at"),
    submittedAt: ts("submitted_at"),
    slaDueAt: ts("sla_due_at"),
    decidedAt: ts("decided_at"),
    decidedBy: uuid("decided_by"),
    sellerId: text("seller_id").references(() => sellers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("seller_applications_user_uq").on(t.userId),
    index("seller_applications_status_idx").on(t.status, t.submittedAt),
    index("seller_applications_pan_idx").on(t.pan),
    check("seller_applications_status_ck", inList("status", APPLICATION_STATUSES)),
  ],
);

export const sellerApplicationEvents = pgTable(
  "seller_application_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => sellerApplications.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<ApplicationStatus>(),
    toStatus: text("to_status").notNull().$type<ApplicationStatus>(),
    actor: text("actor").notNull().$type<"SELLER" | "SYSTEM" | "STAFF">(),
    actorUserId: uuid("actor_user_id"),
    note: text("note"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("seller_application_events_app_idx").on(t.applicationId, t.at)],
);

export const kycDocuments = pgTable(
  "kyc_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: text("application_id")
      .notNull()
      .references(() => sellerApplications.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<KycDocumentKind>(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull().default("PENDING").$type<"PENDING" | "VERIFIED" | "REJECTED">(),
    note: text("note"),
    uploadedAt: ts("uploaded_at").notNull().defaultNow(),
    reviewedAt: ts("reviewed_at"),
  },
  (t) => [uniqueIndex("kyc_documents_app_kind_uq").on(t.applicationId, t.kind)],
);
