-- SMS credits ledger (top-ups recorded by a platform owner) and a log of every SMS sent.
-- New tables only — nothing existing changes. Safely re-runnable, like 20260924090000_change_requests.

CREATE TABLE IF NOT EXISTS "SmsTopUp" (
    "id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "note" TEXT,
    "addedById" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsTopUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsTopUp_createdAt_idx" ON "SmsTopUp"("createdAt");

CREATE TABLE IF NOT EXISTS "SmsMessage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "reference" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "SmsMessage_status_createdAt_idx" ON "SmsMessage"("status", "createdAt");
