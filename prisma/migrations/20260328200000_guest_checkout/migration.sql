-- AlterTable Order: add guest checkout fields
ALTER TABLE "Order" ADD COLUMN "guestToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Order" ADD COLUMN "recipientName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_guestToken_key" ON "Order"("guestToken");

-- AlterTable OrderItem: add ticketTypeId
ALTER TABLE "OrderItem" ADD COLUMN "ticketTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
