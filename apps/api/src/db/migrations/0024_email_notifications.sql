CREATE TABLE "email_log" (
	"dedupe_key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_message_id" text
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_open_uq" ON "jobs" USING btree ("dedupe_key") WHERE status in ('QUEUED', 'RUNNING');