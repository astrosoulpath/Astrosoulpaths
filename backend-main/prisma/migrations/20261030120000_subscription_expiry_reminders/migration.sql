-- Additive only. Review/rehearse before deployment; never applied by application startup.
BEGIN;
ALTER TABLE "PushDevice" ADD COLUMN "subscriptionRole" TEXT;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_subscriptionRole_check" CHECK ("subscriptionRole" IN ('CUSTOMER','ASTROLOGER'));
CREATE UNIQUE INDEX "Subscription_id_userId_key" ON "Subscription"("id","userId");
CREATE TABLE "SubscriptionReminderPreference" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "roleContext" TEXT NOT NULL CHECK ("roleContext" IN ('CUSTOMER','ASTROLOGER')),
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "quietStart" INTEGER NOT NULL DEFAULT 22 CHECK ("quietStart" BETWEEN 0 AND 23),
  "quietEnd" INTEGER NOT NULL DEFAULT 8 CHECK ("quietEnd" BETWEEN 0 AND 23),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId","roleContext")
);
CREATE TABLE "SubscriptionExpiryReminder" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleContext" TEXT NOT NULL CHECK ("roleContext" IN ('CUSTOMER','ASTROLOGER')),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "milestone" INTEGER NOT NULL CHECK ("milestone" BETWEEN 0 AND 7),
  "channel" TEXT NOT NULL CHECK ("channel" IN ('INBOX','PUSH')),
  "deviceId" TEXT NOT NULL DEFAULT '',
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','SENDING','ACCEPTED','UNKNOWN','FAILED','CANCELLED','INBOX')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMPTZ,
  "lastCode" TEXT,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionExpiryReminder_subscription_owner_fkey" FOREIGN KEY ("subscriptionId","userId") REFERENCES "Subscription"("id","userId") ON DELETE CASCADE,
  CONSTRAINT "SubscriptionExpiryReminder_channel_device_check" CHECK (("channel"='INBOX' AND "deviceId"='') OR ("channel"='PUSH' AND "deviceId"<>'')),
  CONSTRAINT "SubscriptionExpiryReminder_dedupe_key" UNIQUE ("subscriptionId","expiresAt","roleContext","milestone","channel","deviceId")
);
CREATE INDEX "SubscriptionExpiryReminder_owner_idx" ON "SubscriptionExpiryReminder"("userId","roleContext","createdAt");
CREATE INDEX "SubscriptionExpiryReminder_claim_idx" ON "SubscriptionExpiryReminder"("state","nextAttemptAt");
CREATE TABLE "SubscriptionReminderAudit" (
  "id" BIGSERIAL PRIMARY KEY,
  "reminderId" TEXT NOT NULL REFERENCES "SubscriptionExpiryReminder"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
