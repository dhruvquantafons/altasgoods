/**
 * AltasGoods database schema: identity, catalog, cart, checkout, orders,
 * payments, returns and support. Follows docs/research/01-marketplace-workflows.md section 12:
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

/** PENDING is internal: the line exists while payment is outstanding and is not ready to fulfil. */
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

export type Actor = "CUSTOMER" | "SYSTEM" | "PAYMENT" | "LOGISTICS" | "STAFF";

/** AltasGoods Control roles. SUPER_ADMIN passes every staff check. */
export const STAFF_ROLES = ["SUPER_ADMIN", "OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR", "SUPPORT_AGENT", "SUPPORT_SPECIALIST", "SUPPORT_SUPERVISOR"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Returns, spec section 11.3. */
export const RETURN_STATUSES = [
  "REQUESTED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "PICKUP_SCHEDULED",
  "OUT_FOR_PICKUP",
  "PICKUP_FAILED",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_PASSED",
  "QC_FAILED",
  "COMPLETED",
  "CANCELLED",
  "LOST",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Support tickets, spec section 11.11. */
export const TICKET_STATUSES = ["NEW", "OPEN", "PENDING_CUSTOMER", "PENDING_INTERNAL", "ESCALATED", "RESOLVED", "REOPENED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_CHANNELS = ["CHAT", "EMAIL", "PHONE", "APP"] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];
export const TICKET_CATEGORIES = ["Delivery", "Return and refund", "Payment", "Product quality", "Account", "Other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_ACTION_KINDS = ["REFUND", "REPLACEMENT", "GUARANTEE_CLAIM"] as const;
export type TicketActionKind = (typeof TICKET_ACTION_KINDS)[number];

/** What a ticket knows about its order, so actions can be checked even for imported history. */
export interface OrderSnapshot {
  total: number;
  paymentLabel: string;
  cod: boolean;
  items: { id: string; title: string; price: number; quantity: number }[];
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
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
    /** AltasGoods Control access; empty for shoppers */
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

/* -------------------------------- Catalog -------------------------------- */

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  icon: text("icon"),
  image: text("image"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  verified: boolean("verified").notNull().default(false),
});

/** Kept for the single built-in store record (HOUSE_SELLER_ID) that offers, order lines and returns point at. */
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
  fundedBy: text("funded_by").notNull().default("STORE").$type<"STORE" | "BANK">(),
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
    index("order_items_status_idx").on(t.status, t.createdAt),
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

/* ---------------------------------- Files --------------------------------- */

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/**
 * Uploaded file bytes. Kept apart from the metadata so the storage can move to
 * object storage (S3 with KMS) without touching the tables that reference it.
 */
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  content: bytea("content").notNull(),
  createdAt: createdAt(),
});

/** Public images, such as product photos. Only files listed here are served without sign in; every other file stays private. */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id),
  kind: text("kind").notNull().default("PRODUCT_IMAGE").$type<"PRODUCT_IMAGE">(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdById: uuid("created_by_id"),
  createdAt: createdAt(),
});

/* --------------------------------- Support -------------------------------- */

/** Ticket numbers continue after the imported history: TK-60001, TK-60002, ... */
export const supportTicketSeq = pgSequence("support_ticket_seq", { startWith: 60001 });

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    category: text("category").notNull().$type<TicketCategory>(),
    channel: text("channel").notNull().$type<TicketChannel>(),
    priority: text("priority").notNull().default("NORMAL").$type<TicketPriority>(),
    status: text("status").notNull().default("NEW").$type<TicketStatus>(),
    /** the customer; userId is set for customers with a BluBuy account in this database */
    customerName: text("customer_name").notNull(),
    customerRef: text("customer_ref"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** an order in this database, or a reference to an order from the imported history */
    orderId: text("order_id"),
    orderSnapshot: jsonb("order_snapshot").$type<OrderSnapshot>(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    firstResponseAt: ts("first_response_at"),
    lastCustomerAt: ts("last_customer_at"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("support_tickets_status_idx").on(t.status, t.priority),
    index("support_tickets_user_idx").on(t.userId),
    index("support_tickets_assignee_idx").on(t.assigneeId),
    check("support_tickets_status_ck", inList("status", TICKET_STATUSES)),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<"CUSTOMER" | "AGENT" | "SYSTEM" | "NOTE">(),
    author: text("author").notNull(),
    authorId: uuid("author_id"),
    body: text("body").notNull(),
    attachments: jsonb("attachments").notNull().$type<Attachment[]>().default([]),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId, t.at)],
);

/** Audit trail: every status, priority and assignment change and every action. */
export const supportEvents = pgTable(
  "support_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<"CREATED" | "STATUS" | "PRIORITY" | "ASSIGNEE" | "ACTION" | "APPROVAL">(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    actor: text("actor").notNull(),
    actorId: uuid("actor_id"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("support_events_ticket_idx").on(t.ticketId, t.at)],
);

/** Refunds, replacements and Guarantee claims raised from a ticket. */
export const supportActions = pgTable(
  "support_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<TicketActionKind>(),
    status: text("status").notNull(),
    orderId: text("order_id"),
    amountPaise: paise("amount_paise"),
    details: jsonb("details").notNull().$type<Record<string, unknown>>().default({}),
    createdBy: text("created_by").notNull(),
    createdById: uuid("created_by_id"),
    decidedBy: text("decided_by"),
    decidedById: uuid("decided_by_id"),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [index("support_actions_ticket_idx").on(t.ticketId)],
);

/** Files attached to ticket messages (bytes live in the file store). */
export const supportAttachments = pgTable(
  "support_attachments",
  {
    id: uuid("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedById: uuid("uploaded_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("support_attachments_ticket_idx").on(t.ticketId)],
);

/* --------------------------------- Returns -------------------------------- */

/** Return numbers: RT-70001, RT-70002, ... */
export const returnSeq = pgSequence("return_seq", { startWith: 70001 });

/** One return per order line (spec 11.3), from request through pickup, QC and the resolution. */
export const returns = pgTable(
  "returns",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    qty: integer("qty").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonLabel: text("reason_label").notNull(),
    /** STORE covers a defective, damaged or wrong item */
    fault: text("fault").notNull().$type<"STORE" | "LOGISTICS" | "CUSTOMER">(),
    comments: text("comments"),
    photos: jsonb("photos").notNull().$type<{ id: string; name: string }[]>().default([]),
    resolution: text("resolution").notNull().$type<"REFUND" | "REPLACEMENT" | "EXCHANGE">(),
    exchangeSize: text("exchange_size"),
    refundTo: text("refund_to").$type<"SOURCE" | "CREDITS" | "BANK">(),
    refundUpi: text("refund_upi"),
    refundAmountPaise: paise("refund_amount_paise").notNull().default(0),
    instantRefund: boolean("instant_refund").notNull().default(false),
    refundStatus: text("refund_status"),
    refundId: uuid("refund_id"),
    status: text("status").notNull().$type<ReturnStatus>(),
    pickupDate: text("pickup_date"),
    pickupSlot: text("pickup_slot"),
    address: jsonb("address").notNull().$type<AddressSnapshot>(),
    awb: text("awb"),
    qcNote: text("qc_note"),
    /** the store's note when it decides an out-of-policy return */
    decisionNote: text("seller_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("returns_user_idx").on(t.userId, t.createdAt),
    index("returns_status_idx").on(t.status, t.updatedAt),
    index("returns_item_idx").on(t.orderItemId),
    check("returns_status_ck", inList("status", RETURN_STATUSES)),
  ],
);

export const returnEvents = pgTable(
  "return_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    returnId: text("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<ReturnStatus>(),
    toStatus: text("to_status").notNull().$type<ReturnStatus>(),
    actor: text("actor").notNull().$type<Actor>(),
    note: text("note"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("return_events_return_idx").on(t.returnId, t.at)],
);

/** Files a shopper uploads (return photos), owned by them until attached. */
export const customerUploads = pgTable("customer_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
});
