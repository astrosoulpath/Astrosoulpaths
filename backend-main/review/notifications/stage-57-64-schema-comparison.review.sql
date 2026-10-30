-- CreateTable
CREATE TABLE "ConsultationBirthSharing" (
    "profileRef" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "consultationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "birthVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultationBirthSharing_pkey" PRIMARY KEY ("consultationId")
);

-- CreateTable
CREATE TABLE "ConsultationBirthSharingAudit" (
    "profileRef" TEXT NOT NULL,
    "birthVersion" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationBirthSharingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrderCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrderCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceFinancialEntry" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "productMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "shippingMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "sellerMinor" BIGINT NOT NULL,
    "platformMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceFinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationBirthSharingAudit_consultationId_createdAt_idx" ON "ConsultationBirthSharingAudit"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrderCase_orderId_status_idx" ON "MarketplaceOrderCase"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrderCase_customerUserId_idempotencyKey_key" ON "MarketplaceOrderCase"("customerUserId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceCaseEvent_caseId_createdAt_idx" ON "MarketplaceCaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFinancialEntry_eventKey_key" ON "MarketplaceFinancialEntry"("eventKey");

-- CreateIndex
CREATE INDEX "MarketplaceFinancialEntry_sellerOrderId_createdAt_idx" ON "MarketplaceFinancialEntry"("sellerOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharingAudit" ADD CONSTRAINT "ConsultationBirthSharingAudit_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharingAudit" ADD CONSTRAINT "ConsultationBirthSharingAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCaseEvent" ADD CONSTRAINT "MarketplaceCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MarketplaceOrderCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCaseEvent" ADD CONSTRAINT "MarketplaceCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
