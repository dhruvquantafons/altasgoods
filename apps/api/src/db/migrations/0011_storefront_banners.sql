CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"placement" text NOT NULL,
	"eyebrow" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"image" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"align" text DEFAULT 'left' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"position" text DEFAULT 'center' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "banners_placement_idx" ON "banners" USING btree ("placement","sort_order");