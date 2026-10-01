CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1;--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"landmark" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"type" text DEFAULT 'HOME' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"saved_for_later" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_qty_range" CHECK ("cart_items"."qty" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"icon" text,
	"image" text,
	"commission_bps" integer DEFAULT 800 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"max_discount_paise" bigint,
	"min_order_paise" bigint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"funded_by" text DEFAULT 'BLUBUY' NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"price_paise" bigint NOT NULL,
	"mrp_paise" bigint NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"fulfilled_by" text DEFAULT 'SELLER' NOT NULL,
	"handling_days" integer DEFAULT 1 NOT NULL,
	"delivery_days" integer DEFAULT 3 NOT NULL,
	"cod_available" boolean DEFAULT true NOT NULL,
	"return_window_days" integer DEFAULT 7 NOT NULL,
	"weight_grams" integer DEFAULT 800 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_stock_nonneg" CHECK ("offers"."stock" >= 0),
	CONSTRAINT "offers_price_le_mrp" CHECK ("offers"."price_paise" <= "offers"."mrp_paise")
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"actor_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"offer_id" uuid NOT NULL,
	"seller_id" text NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"mrp_paise" bigint NOT NULL,
	"status" text NOT NULL,
	"fees" jsonb,
	"net_settlement_paise" bigint,
	"dispatch_by" timestamp with time zone,
	"promised_by" timestamp with time zone NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"awb" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_qty_ck" CHECK ("order_items"."qty" between 1 and 10),
	CONSTRAINT "order_items_status_ck" CHECK (status in ('PENDING', 'NEW', 'ACCEPTED', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'RTO_IN_TRANSIT', 'RTO_RECEIVED', 'LOST', 'RETURN_REQUESTED', 'RETURN_IN_PROGRESS', 'RETURNED', 'REPLACED', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text NOT NULL,
	"address" jsonb NOT NULL,
	"mrp_total_paise" bigint NOT NULL,
	"subtotal_paise" bigint NOT NULL,
	"coupon_discount_paise" bigint DEFAULT 0 NOT NULL,
	"delivery_fee_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"coupon_code" text,
	"idempotency_key" text NOT NULL,
	"channel" text DEFAULT 'WEB' NOT NULL,
	"payment_due_by" timestamp with time zone,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_ck" CHECK (status in ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'ABANDONED', 'CONFIRMED', 'IN_PROGRESS', 'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"method" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" text NOT NULL,
	"provider_ref" text,
	"failure_reason" text,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_status_ck" CHECK (status in ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'EXPIRED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'COD_PENDING', 'COD_COLLECTED'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"brand_id" text NOT NULL,
	"category_id" text NOT NULL,
	"subcategory" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"assured" boolean DEFAULT false NOT NULL,
	"featured_seller_id" text,
	"listing_status" text DEFAULT 'LIVE' NOT NULL,
	"sold_last_30d" integer DEFAULT 0 NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" uuid,
	"amount_paise" bigint NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_members" (
	"seller_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'OWNER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_members_seller_id_user_id_pk" PRIMARY KEY("seller_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"gstin" text,
	"pan" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"tier" text DEFAULT 'Bronze' NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"email" text,
	"is_plus" boolean DEFAULT false NOT NULL,
	"plus_renews_at" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_line_uq" ON "cart_items" USING btree ("user_id","offer_id","variant");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_product_seller_uq" ON "offers" USING btree ("product_id","seller_id");--> statement-breakpoint
CREATE INDEX "offers_seller_idx" ON "offers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_seller_idx" ON "order_items" USING btree ("seller_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_uq" ON "orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","placed_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_members_user_idx" ON "seller_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_uq" ON "sessions" USING btree ("refresh_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone");