-- GENERATED COMPARISON ONLY. DO NOT EXECUTE. Historical constraints/enum orders must not be force-aligned.
-- CreateTable
CREATE TABLE "ConsultationFinancialPolicy" (
    "callSessionId" TEXT NOT NULL,
    "platformPercent" DECIMAL(5,2) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycle" TEXT NOT NULL,

    CONSTRAINT "ConsultationFinancialPolicy_pkey" PRIMARY KEY ("callSessionId")
);

-- CreateTable
CREATE TABLE "CommissionPolicyAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "previousPercent" DECIMAL(5,2) NOT NULL,
    "newPercent" DECIMAL(5,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPolicyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizedHoroscopeReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "locale" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "profileFingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'GENERATING',
    "response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedHoroscopeReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoroscopeNotificationPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "HoroscopeNotificationOutbox" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "locale" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL DEFAULT 'horoscope',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "providerResponse" JSONB,
    "failureCode" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoroscopeSubscriptionControl" (
    "subscriptionId" TEXT NOT NULL,
    "renewalMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeSubscriptionControl_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateTable
CREATE TABLE "HoroscopeSubscriptionAudit" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeSubscriptionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionPolicyAudit_effectiveAt_idx" ON "CommissionPolicyAudit"("effectiveAt");

-- CreateIndex
CREATE INDEX "PersonalizedHoroscopeReading_state_nextAttemptAt_idx" ON "PersonalizedHoroscopeReading"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "horoscope_reading_identity_key" ON "PersonalizedHoroscopeReading"("userId", "localDate", "locale", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HoroscopeNotificationOutbox_idempotencyKey_key" ON "HoroscopeNotificationOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HoroscopeNotificationOutbox_state_nextAttemptAt_idx" ON "HoroscopeNotificationOutbox"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "HoroscopeSubscriptionAudit_subscriptionId_createdAt_idx" ON "HoroscopeSubscriptionAudit"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationFinancialPolicy" ADD CONSTRAINT "ConsultationFinancialPolicy_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedHoroscopeReading" ADD CONSTRAINT "PersonalizedHoroscopeReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedHoroscopeReading" ADD CONSTRAINT "PersonalizedHoroscopeReading_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationPreference" ADD CONSTRAINT "HoroscopeNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "PersonalizedHoroscopeReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeSubscriptionControl" ADD CONSTRAINT "HoroscopeSubscriptionControl_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeSubscriptionAudit" ADD CONSTRAINT "HoroscopeSubscriptionAudit_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
