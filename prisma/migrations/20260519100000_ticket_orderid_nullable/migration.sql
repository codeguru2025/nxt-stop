-- Make orderId nullable on Ticket so physical (pre-activation) tickets can exist without an order
ALTER TABLE "Ticket" ALTER COLUMN "orderId" DROP NOT NULL;
