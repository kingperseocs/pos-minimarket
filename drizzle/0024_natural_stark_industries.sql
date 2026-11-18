ALTER TABLE "suppliers" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "claims_contact_name" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "claims_phone" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "order_days" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "order_time_from" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "order_time_to" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "catalog_url" text;