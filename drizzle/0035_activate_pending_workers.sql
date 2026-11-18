-- Registrations no longer wait for an admin: workers still pending become
-- active (nothing is deleted; the enum value stays for old records).
UPDATE "workers"
SET "status" = 'active', "pending_reason" = NULL, "approved_at" = COALESCE("approved_at", now()), "updated_at" = now()
WHERE "status" = 'pending';
