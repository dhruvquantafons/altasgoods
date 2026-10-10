ALTER TABLE "kyc_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seller_application_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seller_applications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "kyc_documents" CASCADE;--> statement-breakpoint
DROP TABLE "seller_application_events" CASCADE;--> statement-breakpoint
DROP TABLE "seller_applications" CASCADE;--> statement-breakpoint
ALTER TABLE "returns" DROP CONSTRAINT "returns_status_ck";--> statement-breakpoint
UPDATE "returns" SET "status" = 'PENDING_REVIEW' WHERE "status" = 'PENDING_SELLER_REVIEW';--> statement-breakpoint
UPDATE "return_events" SET "from_status" = 'PENDING_REVIEW' WHERE "from_status" = 'PENDING_SELLER_REVIEW';--> statement-breakpoint
UPDATE "return_events" SET "to_status" = 'PENDING_REVIEW' WHERE "to_status" = 'PENDING_SELLER_REVIEW';--> statement-breakpoint
UPDATE "return_events" SET "actor" = 'STAFF' WHERE "actor" = 'SELLER';--> statement-breakpoint
UPDATE "returns" SET "fault" = 'STORE' WHERE "fault" = 'SELLER';--> statement-breakpoint
DROP INDEX "order_items_seller_idx";--> statement-breakpoint
DROP INDEX "returns_seller_idx";--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "funded_by" SET DEFAULT 'STORE';--> statement-breakpoint
CREATE INDEX "order_items_status_idx" ON "order_items" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "returns_status_idx" ON "returns" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "commission_bps";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "fulfilled_by";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "fees";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "net_settlement_paise";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "featured_seller_id";--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_status_ck" CHECK (status in ('REQUESTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'OUT_FOR_PICKUP', 'PICKUP_FAILED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED', 'QC_PASSED', 'QC_FAILED', 'COMPLETED', 'CANCELLED', 'LOST'));--> statement-breakpoint
DROP SEQUENCE "public"."seller_application_seq";--> statement-breakpoint
-- AltasGoods sells everything itself: one built-in store record (HOUSE_SELLER_ID) owns every offer, order line and return
INSERT INTO "sellers" ("id", "slug", "display_name", "legal_name", "owner_name", "email", "phone", "city", "state", "pincode") VALUES ('s-altasgoods', 'altasgoods', 'AltasGoods', 'AltasGoods', 'AltasGoods', 'support@altasgoods.in', '', 'Bengaluru', 'Karnataka', '560001') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
DELETE FROM "offers" o USING "offers" h WHERE h."product_id" = o."product_id" AND h."seller_id" = 's-altasgoods' AND o."seller_id" <> 's-altasgoods' AND NOT EXISTS (SELECT 1 FROM "order_items" i WHERE i."offer_id" = o."id") AND NOT EXISTS (SELECT 1 FROM "cart_items" c WHERE c."offer_id" = o."id");--> statement-breakpoint
UPDATE "offers" SET "seller_id" = 's-altasgoods' WHERE "id" IN (SELECT DISTINCT ON ("product_id") "id" FROM "offers" WHERE NOT EXISTS (SELECT 1 FROM "offers" h WHERE h."product_id" = "offers"."product_id" AND h."seller_id" = 's-altasgoods') ORDER BY "product_id", ("stock" > 0) DESC, "price_paise");--> statement-breakpoint
UPDATE "offers" SET "status" = 'PAUSED' WHERE "seller_id" <> 's-altasgoods';--> statement-breakpoint
UPDATE "order_items" SET "seller_id" = 's-altasgoods';--> statement-breakpoint
UPDATE "returns" SET "seller_id" = 's-altasgoods';--> statement-breakpoint
UPDATE "order_events" SET "actor" = 'STAFF' WHERE "actor" = 'SELLER';--> statement-breakpoint
DELETE FROM "seller_members";--> statement-breakpoint
DELETE FROM "sellers" s WHERE s."id" <> 's-altasgoods' AND NOT EXISTS (SELECT 1 FROM "offers" o WHERE o."seller_id" = s."id");--> statement-breakpoint
UPDATE "coupons" SET "funded_by" = 'STORE' WHERE "funded_by" IN ('BLUBUY', 'SELLER');--> statement-breakpoint
UPDATE "users" SET "staff_roles" = array_remove(array_replace("staff_roles", 'SELLER_VERIFIER', 'CATALOG_MANAGER'), 'RISK_ANALYST');--> statement-breakpoint
UPDATE "support_tickets" SET "category" = 'Other' WHERE "category" = 'Seller dispute';--> statement-breakpoint
DELETE FROM "support_actions" WHERE "kind" = 'SELLER_ESCALATION';
