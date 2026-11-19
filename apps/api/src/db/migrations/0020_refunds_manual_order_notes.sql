CREATE TABLE "order_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_notes_body_ck" CHECK (char_length("order_notes"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "method" text DEFAULT 'SOURCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_notes_order_idx" ON "order_notes" USING btree ("order_id","created_at");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_method_ck" CHECK (method in ('SOURCE', 'MANUAL'));