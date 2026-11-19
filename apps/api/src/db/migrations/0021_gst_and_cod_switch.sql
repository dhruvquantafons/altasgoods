ALTER TABLE "categories" ADD COLUMN "gst_rate_bp" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "hsn" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "gst_rate_bp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "hsn" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gst_rate_bp" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hsn" text;