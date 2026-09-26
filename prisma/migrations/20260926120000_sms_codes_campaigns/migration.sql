-- SMS login/phone-change codes, promotional SMS campaigns, and the promotional opt-out.
-- New tables plus one nullable column — nothing existing changes. Safely re-runnable.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsOptOutAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SmsMessage_purpose_reference_idx" ON "SmsMessage"("purpose", "reference");

CREATE TABLE IF NOT EXISTS "SmsCode" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsCode_phone_purpose_createdAt_idx" ON "SmsCode"("phone", "purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsCode_userId_purpose_createdAt_idx" ON "SmsCode"("userId", "purpose", "createdAt");

CREATE TABLE IF NOT EXISTS "SmsCampaign" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "eventId" TEXT,
    "params" JSONB NOT NULL,
    "preview" TEXT NOT NULL,
    "audience" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "stopReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");
