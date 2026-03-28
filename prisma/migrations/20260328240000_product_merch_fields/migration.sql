-- Add merchandise-specific fields to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "merchType" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "color" TEXT;

-- Index for category filter (merch page queries)
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");
