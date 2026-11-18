ALTER TABLE "categories" ADD COLUMN "id_parent_category" integer;--> statement-breakpoint
ALTER TABLE "product_presentations" ADD COLUMN "supplier_code" text;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_fk" FOREIGN KEY ("id_parent_category") REFERENCES "public"."categories"("id_category") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("id_parent_category");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "supplier_code";