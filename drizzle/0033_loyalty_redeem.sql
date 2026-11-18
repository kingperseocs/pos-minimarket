ALTER TYPE "public"."loyalty_movement_type" ADD VALUE 'redeem';--> statement-breakpoint
ALTER TABLE "loyalty_ledger" DROP CONSTRAINT "loyalty_ledger_id_sale_unique";--> statement-breakpoint
ALTER TABLE "discount_policies" ADD COLUMN "redeem_points_per_sol" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_policies" ADD COLUMN "min_redeem_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_redeemed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "redeem_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_ledger_sale_type_unique" ON "loyalty_ledger" USING btree ("id_sale","type");