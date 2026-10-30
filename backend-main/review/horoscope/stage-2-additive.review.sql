-- REVIEW ONLY. No execution authorized on existing databases. No backfill.
-- Requires existing public.User and public.Subscription. Deploy all aware code with gates OFF first.
BEGIN;
CREATE TABLE public."PersonalizedHoroscopeReading" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "subscriptionId" TEXT NOT NULL REFERENCES public."Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "localDate" DATE NOT NULL,
 "locale" TEXT NOT NULL CHECK ("locale" IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru')),
 "contentVersion" TEXT NOT NULL,"timezone" TEXT NOT NULL,"profileFingerprint" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'GENERATING' CHECK ("state" IN ('GENERATING','READY','FAILED')),
 "response" JSONB,"attempts" INTEGER NOT NULL DEFAULT 1 CHECK ("attempts" BETWEEN 1 AND 3),
 "leaseToken" TEXT,"leaseUntil" TIMESTAMP(3),"nextAttemptAt" TIMESTAMP(3),"failureCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PersonalizedHoroscopeReading_ready_response" CHECK ("state" <> 'READY' OR "response" IS NOT NULL)
);
CREATE UNIQUE INDEX "horoscope_reading_identity_key" ON public."PersonalizedHoroscopeReading"("userId","localDate","locale","contentVersion");
CREATE INDEX "PersonalizedHoroscopeReading_state_nextAttemptAt_idx" ON public."PersonalizedHoroscopeReading"("state","nextAttemptAt");
CREATE TABLE public."HoroscopeNotificationPreference" (
 "userId" TEXT PRIMARY KEY REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "enabled" BOOLEAN NOT NULL DEFAULT false,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."HoroscopeNotificationOutbox" (
 "id" TEXT PRIMARY KEY,"idempotencyKey" TEXT NOT NULL,
 "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "subscriptionId" TEXT NOT NULL REFERENCES public."Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "readingId" TEXT NOT NULL REFERENCES public."PersonalizedHoroscopeReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "deviceId" TEXT NOT NULL,"localDate" DATE NOT NULL,"locale" TEXT NOT NULL CHECK ("locale" IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru')),
 "notificationType" TEXT NOT NULL DEFAULT 'horoscope',"scheduledAt" TIMESTAMP(3) NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("state" IN ('QUEUED','PROCESSING','SENDING','RETRY','ACCEPTED','FAILED','CANCELLED','UNKNOWN')),
 "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),"nextAttemptAt" TIMESTAMP(3) NOT NULL,
 "leaseToken" TEXT,"leaseUntil" TIMESTAMP(3),"providerResponse" JSONB,"failureCode" TEXT,"acceptedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "HoroscopeNotificationOutbox_idempotencyKey_key" ON public."HoroscopeNotificationOutbox"("idempotencyKey");
CREATE INDEX "HoroscopeNotificationOutbox_state_nextAttemptAt_idx" ON public."HoroscopeNotificationOutbox"("state","nextAttemptAt");
CREATE TABLE public."HoroscopeSubscriptionControl" (
 "subscriptionId" TEXT PRIMARY KEY REFERENCES public."Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "renewalMode" TEXT NOT NULL DEFAULT 'MANUAL' CHECK ("renewalMode"='MANUAL'),"cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."HoroscopeSubscriptionAudit" (
 "id" TEXT PRIMARY KEY,"subscriptionId" TEXT NOT NULL REFERENCES public."Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "action" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HoroscopeSubscriptionAudit_subscriptionId_createdAt_idx" ON public."HoroscopeSubscriptionAudit"("subscriptionId","createdAt");
CREATE FUNCTION public.asp_horoscope_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Subscription audit is immutable' USING ERRCODE='23514'; END; $$;
CREATE TRIGGER "HoroscopeSubscriptionAudit_immutable" BEFORE UPDATE OR DELETE ON public."HoroscopeSubscriptionAudit"
 FOR EACH ROW EXECUTE FUNCTION public.asp_horoscope_audit_immutable();
COMMIT;
-- Runtime roles must not own tables or have TRUNCATE/DDL rights. Claims need DML only.
-- Gate rollback is unsafe while SENDING/UNKNOWN jobs exist: freeze new enqueue and reconcile, never replay blindly.
