ALTER TABLE "products" ADD COLUMN "net_content" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "net_content_unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_code" text;