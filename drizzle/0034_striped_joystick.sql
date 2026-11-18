ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_id_order_purchase_orders_id_order_fk";--> statement-breakpoint
ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "id_order";--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_order_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_orders" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."purchase_order_status";
