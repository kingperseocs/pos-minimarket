-- Rollback of 0037_e_invoicing: drops electronic invoicing (documents, notes,
-- settings) and products.igv_affectation. Not a drizzle migration; run by hand:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0037_down.sql
-- then revert the code and drop the 0037 entry from drizzle/meta/_journal.json.
-- Issued documents still exist in the motor: this only forgets the POS side.
DROP TABLE IF EXISTS "sale_document_notes";
DROP TABLE IF EXISTS "sale_documents";
DROP TABLE IF EXISTS "e_invoicing_settings";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_igv_affectation_valid";
ALTER TABLE "products" DROP COLUMN IF EXISTS "igv_affectation";
DROP TYPE IF EXISTS "sale_document_note_kind";
DROP TYPE IF EXISTS "sale_document_status";
DROP TYPE IF EXISTS "sale_document_type";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1795377865400;
