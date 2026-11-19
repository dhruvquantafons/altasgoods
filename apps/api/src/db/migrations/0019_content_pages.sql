CREATE TABLE "about_content" (
	"id" text PRIMARY KEY NOT NULL,
	"doc" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "brand_spotlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"product_id" text,
	"tone" text DEFAULT '#f1efea' NOT NULL,
	"image" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'policy' NOT NULL,
	"title" text NOT NULL,
	"nav" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related" text[] DEFAULT '{}'::text[] NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "help_faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"group" text NOT NULL,
	"q" text NOT NULL,
	"a" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"icon" text NOT NULL,
	"href" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_roles" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"team" text NOT NULL,
	"location" text NOT NULL,
	"type" text DEFAULT 'Full time' NOT NULL,
	"experience" text DEFAULT '' NOT NULL,
	"posted" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"responsibilities" text[] DEFAULT '{}'::text[] NOT NULL,
	"requirements" text[] DEFAULT '{}'::text[] NOT NULL,
	"nice_to_have" text[] DEFAULT '{}'::text[] NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "press_releases" (
	"slug" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "about_content" ADD CONSTRAINT "about_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_spotlights" ADD CONSTRAINT "brand_spotlights_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;