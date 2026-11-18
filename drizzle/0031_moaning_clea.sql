CREATE TYPE "public"."receipt_invoice_status" AS ENUM('pending', 'registered');--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ALTER COLUMN "line_total" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ALTER COLUMN "unit_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipts" ALTER COLUMN "total" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "invoice_status" "receipt_invoice_status" DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "invoiced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "id_invoiced_by" integer;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD COLUMN "invoice_photo_url" text;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_id_invoiced_by_users_id_user_fk" FOREIGN KEY ("id_invoiced_by") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;