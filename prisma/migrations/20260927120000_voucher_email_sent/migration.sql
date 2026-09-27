-- When the voucher/merch email for an order was accepted by the email service, so admins can
-- see which buyers never got theirs. One nullable column — nothing existing changes, and code
-- from before this migration ignores it, so run it before deploying. Safely re-runnable.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "voucherEmailSentAt" TIMESTAMP(3);
