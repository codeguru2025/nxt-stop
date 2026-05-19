-- Add commissionPerTicket to Partner — fixed per-ticket commission amount (alternative to % rate)
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "commissionPerTicket" DECIMAL(10,2) NOT NULL DEFAULT 0;
