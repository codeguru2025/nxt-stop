-- Migration: drop_email
-- Remove email from User and guestEmail from Order
-- Email is no longer used; phone is the sole identifier.

-- Drop unique index on email before dropping the column
DROP INDEX IF EXISTS "User_email_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "guestEmail";
