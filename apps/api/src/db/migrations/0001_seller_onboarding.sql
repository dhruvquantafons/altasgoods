CREATE SEQUENCE "public"."seller_application_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 50001 CACHE 1;--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seller_application_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'KYC_IN_PROGRESS' NOT NULL,
	"constitution" text,
	"gst_exempt" boolean DEFAULT false NOT NULL,
	"gstin" text,
	"legal_name" text,
	"trade_name" text,
	"registered_address" text,
	"gst_state" text,
	"pan" text,
	"store_name" text,
	"store_description" text,
	"care_number" text,
	"grievance_contact" text,
	"pickup" jsonb,
	"bank_holder" text,
	"bank_account" text,
	"bank_ifsc" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"brand" jsonb,
	"gst_check" jsonb,
	"pan_check" jsonb,
	"bank_check" jsonb,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flagged_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewer_message" text,
	"staff_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejection_reason" text,
	"agreement_version" text,
	"agreement_accepted_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"sla_due_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"seller_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_applications_status_ck" CHECK (status in ('KYC_IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_application_id_seller_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_application_events" ADD CONSTRAINT "seller_application_events_application_id_seller_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_documents_app_kind_uq" ON "kyc_documents" USING btree ("application_id","kind");--> statement-breakpoint
CREATE INDEX "seller_application_events_app_idx" ON "seller_application_events" USING btree ("application_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_applications_user_uq" ON "seller_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "seller_applications_status_idx" ON "seller_applications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "seller_applications_pan_idx" ON "seller_applications" USING btree ("pan");