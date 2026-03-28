-- Add performance indexes for common query patterns
-- These cover FK lookups, status filters, and date-ordered list queries

-- Session: lookup by userId
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Event: status filter + date ordering (used on home page and admin)
CREATE INDEX IF NOT EXISTS "Event_status_date_idx" ON "Event"("status", "date");

-- EventMedia: FK lookup
CREATE INDEX IF NOT EXISTS "EventMedia_eventId_idx" ON "EventMedia"("eventId");

-- TicketType: FK lookup
CREATE INDEX IF NOT EXISTS "TicketType_eventId_idx" ON "TicketType"("eventId");

-- Ticket: user lookup, event+status filter, order FK
CREATE INDEX IF NOT EXISTS "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX IF NOT EXISTS "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");
CREATE INDEX IF NOT EXISTS "Ticket_orderId_idx" ON "Ticket"("orderId");

-- ScanLog: ticket FK, event+date for stats
CREATE INDEX IF NOT EXISTS "ScanLog_ticketId_idx" ON "ScanLog"("ticketId");
CREATE INDEX IF NOT EXISTS "ScanLog_eventId_createdAt_idx" ON "ScanLog"("eventId", "createdAt");

-- Order: user+status lookup, status+date for admin lists
CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- OrderItem: FK lookups
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_ticketTypeId_idx" ON "OrderItem"("ticketTypeId");

-- Commission: partner FK
CREATE INDEX IF NOT EXISTS "Commission_partnerId_idx" ON "Commission"("partnerId");

-- Referral: both user FKs
CREATE INDEX IF NOT EXISTS "Referral_sourceUserId_idx" ON "Referral"("sourceUserId");
CREATE INDEX IF NOT EXISTS "Referral_targetUserId_idx" ON "Referral"("targetUserId");

-- Redemption: FK lookups
CREATE INDEX IF NOT EXISTS "Redemption_userId_idx" ON "Redemption"("userId");
CREATE INDEX IF NOT EXISTS "Redemption_rewardId_idx" ON "Redemption"("rewardId");

-- Product: event FK
CREATE INDEX IF NOT EXISTS "Product_eventId_idx" ON "Product"("eventId");

-- SocialPost: FK lookups
CREATE INDEX IF NOT EXISTS "SocialPost_eventId_idx" ON "SocialPost"("eventId");
CREATE INDEX IF NOT EXISTS "SocialPost_userId_idx" ON "SocialPost"("userId");
