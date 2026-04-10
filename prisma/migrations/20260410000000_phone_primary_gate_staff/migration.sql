-- Migration: phone_primary_gate_staff
-- Makes phone the primary login identifier (required + unique)
-- Makes email optional (nullable, still unique when provided)
-- Adds guestPhone to Order for guest checkout
-- Adds GateStaff model (uses existing User with role='gate_staff')

-- Step 1: Add guestPhone to Order
ALTER TABLE "Order" ADD COLUMN "guestPhone" TEXT;

-- Step 2: Make email nullable on User
-- (existing emails are kept; new users don't need one)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Step 3: Populate phone for existing users that have none
-- Uses a stable placeholder derived from the row id so it satisfies NOT NULL + UNIQUE
UPDATE "User"
SET "phone" = CONCAT('+000', SUBSTRING("id", 1, 12))
WHERE "phone" IS NULL;

-- Step 4: Make phone required and add unique index
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- Drop old email unique index and recreate as partial (only when not null)
-- Prisma @unique on nullable field uses a standard unique index in Postgres;
-- NULLs are excluded from uniqueness automatically so no change needed there.
-- Just ensure phone has its unique index:
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
