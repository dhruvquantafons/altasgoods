ALTER TABLE "order_items" ADD COLUMN "shipping_provider" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "courier" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "carrier_order_ref" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "shipment_ref" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "label_url" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tracking_status" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tracked_at" timestamp with time zone;