-- CreateEnum
CREATE TYPE "MarketplacePaymentExceptionStatus" AS ENUM ('REFUND_REQUIRED', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "marketplace_payment_exceptions" (
    "id" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT NOT NULL,
    "status" "MarketplacePaymentExceptionStatus" NOT NULL DEFAULT 'REFUND_REQUIRED',
    "razorpayRefundId" TEXT,
    "refundFailureReason" TEXT,
    "refundRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_payment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payment_exceptions_razorpayPaymentId_key" ON "marketplace_payment_exceptions"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payment_exceptions_razorpayRefundId_key" ON "marketplace_payment_exceptions"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_marketplaceOrderId_idx" ON "marketplace_payment_exceptions"("marketplaceOrderId");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_status_idx" ON "marketplace_payment_exceptions"("status");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_createdAt_idx" ON "marketplace_payment_exceptions"("createdAt");

-- AddForeignKey
ALTER TABLE "marketplace_payment_exceptions" ADD CONSTRAINT "marketplace_payment_exceptions_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
