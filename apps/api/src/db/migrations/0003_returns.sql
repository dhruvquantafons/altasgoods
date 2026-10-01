CREATE SEQUENCE "public"."return_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 70001 CACHE 1;--> statement-breakpoint
CREATE TABLE "customer_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"return_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seller_id" text NOT NULL,
	"qty" integer NOT NULL,
	"reason_code" text NOT NULL,
	"reason_label" text NOT NULL,
	"fault" text NOT NULL,
	"comments" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution" text NOT NULL,
	"exchange_size" text,
	"refund_to" text,
	"refund_upi" text,
	"refund_amount_paise" bigint DEFAULT 0 NOT NULL,
	"instant_refund" boolean DEFAULT false NOT NULL,
	"refund_status" text,
	"refund_id" uuid,
	"status" text NOT NULL,
	"pickup_date" text,
	"pickup_slot" text,
	"address" jsonb NOT NULL,
	"awb" text,
	"qc_note" text,
	"seller_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_status_ck" CHECK (status in ('REQUESTED', 'PENDING_SELLER_REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'OUT_FOR_PICKUP', 'PICKUP_FAILED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED', 'QC_PASSED', 'QC_FAILED', 'COMPLETED', 'CANCELLED', 'LOST'))
);
--> statement-breakpoint
ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_events_return_idx" ON "return_events" USING btree ("return_id","at");--> statement-breakpoint
CREATE INDEX "returns_user_idx" ON "returns" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "returns_seller_idx" ON "returns" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "returns_item_idx" ON "returns" USING btree ("order_item_id");