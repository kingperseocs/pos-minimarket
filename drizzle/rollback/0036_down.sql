-- Rollback of 0036_work_shifts: drops the staff calendar (work_schedules is
-- untouched). Not a drizzle migration; run by hand:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0036_down.sql
-- then revert the code and drop the 0036 entry from drizzle/meta/_journal.json.
DROP TABLE IF EXISTS "work_shifts";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1795013403471;
