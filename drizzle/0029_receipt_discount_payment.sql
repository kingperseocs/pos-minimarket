CREATE TYPE "public"."receipt_payment_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."supplier_payment_method" AS ENUM('cash', 'yape', 'transfer');--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD COLUMN "list_total" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "payment_status" "receipt_payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "paid_method" "supplier_payment_method";--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "id_paid_by" integer;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "payment_note" text;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_id_paid_by_users_id_user_fk" FOREIGN KEY ("id_paid_by") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Receipts entered before payments were tracked are taken as paid, so the
-- "Por pagar" list starts with the new invoices only.
UPDATE "goods_receipts" SET "payment_status" = 'paid', "payment_note" = 'Registrado antes del control de pagos';
