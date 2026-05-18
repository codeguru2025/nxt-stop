sted sources-- Migration: decimal_cleanup
-- 1. Convert Float currency fields to DECIMAL(10,2) for financial precision
-- 2. Make Product.eventId optional (brand merchandise not tied to events)
-- 3. Drop unused Session table

-- ─── Float → Decimal conversions ─────────────────────────────────────────────

-- Event
ALTER TABLE "Event" ALTER COLUMN "virtualPrice" TYPE DECIMAL(10,2);
ALTER TABLE "Event" ALTER COLUMN "platformFee" TYPE DECIMAL(10,2);

-- TicketType
ALTER TABLE "TicketType" ALTER COLUMN "price" TYPE DECIMAL(10,2);

-- Order
ALTER TABLE "Order" ALTER COLUMN "subtotal" TYPE DECIMAL(10,2);
ALTER TABLE "Order" ALTER COLUMN "platformFees" TYPE DECIMAL(10,2);
ALTER TABLE "Order" ALTER COLUMN "total" TYPE DECIMAL(10,2);

-- OrderItem
ALTER TABLE "OrderItem" ALTER COLUMN "price" TYPE DECIMAL(10,2);

-- Partner
ALTER TABLE "Partner" ALTER COLUMN "commissionRate" TYPE DECIMAL(5,2);
ALTER TABLE "Partner" ALTER COLUMN "totalEarned" TYPE DECIMAL(12,2);

-- EventPartner
ALTER TABLE "EventPartner" ALTER COLUMN "customCommission" TYPE DECIMAL(10,2);

-- Commission
ALTER TABLE "Commission" ALTER COLUMN "amount" TYPE DECIMAL(10,2);

-- Product
ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(10,2);

-- ─── Make Product.eventId optional ───────────────────────────────────────────

ALTER TABLE "Product" ALTER COLUMN "eventId" DROP NOT NULL;

-- ─── Drop unused Session table ───────────────────────────────────────────────

DROP TABLE IF EXISTS "Session";
