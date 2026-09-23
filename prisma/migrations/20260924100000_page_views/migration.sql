-- Site visits (page views + referral link clicks). Safely re-runnable.

CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "userId" TEXT,
    "visitorId" TEXT NOT NULL,
    "referralCode" TEXT,
    "source" TEXT,
    "device" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX IF NOT EXISTS "PageView_referralCode_createdAt_idx" ON "PageView"("referralCode", "createdAt");
CREATE INDEX IF NOT EXISTS "PageView_userId_createdAt_idx" ON "PageView"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PageView_path_createdAt_idx" ON "PageView"("path", "createdAt");
