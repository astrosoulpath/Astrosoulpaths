-- Prisma legacy DateTime columns contain UTC wall time.
-- Compare explicitly with timestamptz independent of database/session timezone.
-- No row updates, table changes or historical migration edits.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.kundli_consent_guard_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'revokedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'revokedAt')
      OR OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN
      RAISE EXCEPTION 'Consent evidence is immutable except first revocation';
    END IF;
    NEW."revokedAt" := clock_timestamp();
    RETURN NEW;
  END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  IF NOT FOUND OR c."userId" <> NEW."customerUserId" OR c."astrologerId" <> NEW."astrologerUserId"
    OR c."status" <> 'ACTIVE' OR c."endedAt" IS NOT NULL OR (c."expiresAt" AT TIME ZONE 'UTC') <= clock_timestamp() THEN
    RAISE EXCEPTION 'Authorized active consultation required';
  END IF;
  NEW."grantedAt" := clock_timestamp();
  IF NEW."expiresAt" > (c."expiresAt" AT TIME ZONE 'UTC') OR NEW."expiresAt" <= NEW."grantedAt" OR NEW."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid consent period';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kundli_generation_publication_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD; g RECORD;
BEGIN
  IF TG_OP='UPDATE' AND OLD."status"='PUBLISHED' THEN
    RAISE EXCEPTION 'Published request is immutable';
  END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId']) THEN
    RAISE EXCEPTION 'Reservation ownership is immutable';
  END IF;
  -- A failed/revoked worker may release its own lease without reauthorizing data access.
  IF TG_OP='UPDATE' AND NEW."status"='RESERVED' AND OLD."status"='RESERVED'
    AND (to_jsonb(NEW)-'leaseExpiresAt')=(to_jsonb(OLD)-'leaseExpiresAt')
    AND NEW."leaseExpiresAt"<=OLD."leaseExpiresAt" THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  SELECT * INTO g FROM public."KundliGenerationConsent" WHERE "id"=NEW."consentId" FOR UPDATE;
  IF c."status"<>'ACTIVE' OR c."endedAt" IS NOT NULL OR (c."expiresAt" AT TIME ZONE 'UTC')<=clock_timestamp()
    OR g."id" IS NULL OR g."consultationId"<>c."id" OR g."astrologerUserId"<>NEW."actorUserId"
    OR g."customerUserId"<>c."userId" OR g."astrologerUserId"<>c."astrologerId"
    OR g."revokedAt" IS NOT NULL OR g."expiresAt"<=clock_timestamp() THEN
    RAISE EXCEPTION 'Current consultation-bound customer consent required';
  END IF;
  IF NEW."leaseExpiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Reservation lease expired'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."Subscription" s JOIN public."SubscriptionPlan" p ON p."id"=s."subscriptionPlanId"
      JOIN public."Astrologer" a ON a."userId"=s."userId"
      JOIN public."User" u ON u."id"=s."userId"
    WHERE s."userId"=NEW."actorUserId" AND s."subscriptionStatus"='ACTIVE'
      AND s."amount"=3500 AND s."currency"='INR' AND (s."startDate" AT TIME ZONE 'UTC')<=clock_timestamp() AND (s."endDate" AT TIME ZONE 'UTC')>clock_timestamp()
      AND p."name"='ASTROLOGER_KUNDLI_YEARLY' AND p."price"=3500 AND p."currency"='INR' AND p."durationDays"=365 AND p."isActive"
      AND a."isApproved" AND a."isVerified" AND u."isActive" AND NOT u."isBlocked"
  ) THEN RAISE EXCEPTION 'Current professional entitlement required'; END IF;
  RETURN NEW;
END $$;

COMMIT;
