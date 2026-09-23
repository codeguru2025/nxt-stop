-- Two-admin approval for serious admin changes. Safely re-runnable.

CREATE TABLE IF NOT EXISTS "ChangeRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "capability" TEXT,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "params" JSONB,
    "bodyEnc" TEXT,
    "bodyHash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityVersion" TEXT,
    "title" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChangeRequest_status_createdAt_idx" ON "ChangeRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

DO $$ BEGIN
  ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
