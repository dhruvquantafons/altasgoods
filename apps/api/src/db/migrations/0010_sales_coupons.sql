CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount_percent" integer NOT NULL,
	"scope" text NOT NULL,
	"category_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"product_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"banner_image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_percent_ck" CHECK ("sales"."discount_percent" between 1 and 90),
	CONSTRAINT "sales_window_ck" CHECK ("sales"."ends_at" > "sales"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "show_on_storefront" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_slug_uq" ON "sales" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sales_window_idx" ON "sales" USING btree ("status","starts_at","ends_at");