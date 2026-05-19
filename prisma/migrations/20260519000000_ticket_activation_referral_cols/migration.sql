-- Add missing columns to Ticket table that were in schema but never migrated
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "referralCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "activationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "activatedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activatedById"  TEXT;

-- Unique constraint on activationCode
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_activationCode_key" ON "Ticket"("activationCode");

-- Index on activationCode
CREATE INDEX IF NOT EXISTS "Ticket_activationCode_idx" ON "Ticket"("activationCode");
