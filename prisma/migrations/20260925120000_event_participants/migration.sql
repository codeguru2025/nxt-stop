-- Line-up members given an account (and so a share link) without buying a ticket.
-- Safely re-runnable, like 20260924090000_change_requests.

CREATE TABLE IF NOT EXISTS "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventParticipant_userId_idx" ON "EventParticipant"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

DO $$ BEGIN
  ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
