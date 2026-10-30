-- REVIEW ONLY: execution is NOT authorized. Current application history is BLOCKED.
-- New tables/functions only; never use blanket migrate deploy for this package.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF current_database() IS DISTINCT FROM 'astro_soul_path'
 OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1'
 OR inet_server_port() IS DISTINCT FROM 5432
 OR current_schema() IS DISTINCT FROM 'public' THEN
  RAISE EXCEPTION 'Exact approved loopback application target required';
 END IF;
 IF current_setting('asp.kundli_migration_approval',true) IS DISTINCT FROM 'APPROVED_ONE_LOCAL_KUNDLI_MIGRATION' THEN
  RAISE EXCEPTION 'Separate migration approval gate required';
 END IF;
 IF EXISTS(SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'Resolve reviewed historical blockers before new application migration';
 END IF;
END $$;
CREATE TABLE public."KundliGenerationConsent" (
  "id" TEXT PRIMARY KEY,
  "consultationId" TEXT NOT NULL REFERENCES public."CallSession"("id") ON DELETE RESTRICT,
  "customerUserId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "astrologerUserId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "grantedByUserId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "birthDataVersion" TEXT NOT NULL CHECK (length("birthDataVersion") BETWEEN 1 AND 128),
  "purpose" TEXT NOT NULL CHECK ("purpose" = 'LOCAL_KUNDLI_CALCULATION'),
  "policyVersion" TEXT NOT NULL CHECK ("policyVersion" = 'kundli-local-v1'),
  "fieldScope" TEXT[] NOT NULL CHECK (
    cardinality("fieldScope") = 6 AND "fieldScope" @>
      ARRAY['dob','timeOfBirth','latitude','longitude','timezone','birthPlace']::TEXT[]),
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  CHECK ("grantedByUserId" = "customerUserId"),
  CHECK ("customerUserId" <> "astrologerUserId"),
  CHECK ("expiresAt" > "grantedAt"),
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "grantedAt")
);
CREATE UNIQUE INDEX "KundliGenerationConsent_current_scope_key"
  ON public."KundliGenerationConsent" ("consultationId","birthDataVersion","policyVersion")
  WHERE "revokedAt" IS NULL;
CREATE INDEX "KundliGenerationConsent_customer_idx" ON public."KundliGenerationConsent" ("customerUserId","grantedAt");
CREATE INDEX "KundliGenerationConsent_astrologer_idx" ON public."KundliGenerationConsent" ("astrologerUserId","expiresAt");

CREATE FUNCTION public.kundli_consent_guard_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
    OR c."status" <> 'ACTIVE' OR c."endedAt" IS NOT NULL OR c."expiresAt" <= clock_timestamp() THEN
    RAISE EXCEPTION 'Authorized active consultation required';
  END IF;
  NEW."grantedAt" := clock_timestamp();
  IF NEW."expiresAt" > c."expiresAt" OR NEW."expiresAt" <= NEW."grantedAt" OR NEW."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid consent period';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KundliGenerationConsent_guard" BEFORE INSERT OR UPDATE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_guard_v1();

CREATE TABLE public."KundliGenerationConsentAudit" (
  "id" BIGSERIAL PRIMARY KEY,
  "consentId" TEXT NOT NULL REFERENCES public."KundliGenerationConsent"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL CHECK ("action" IN ('GRANTED','REVOKED')),
  "actorUserId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("consentId","action")
);
CREATE FUNCTION public.kundli_consent_audit_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public."KundliGenerationConsentAudit" ("consentId","action","actorUserId")
    VALUES (NEW."id", CASE WHEN TG_OP='INSERT' THEN 'GRANTED' ELSE 'REVOKED' END, NEW."customerUserId");
  RETURN NEW;
END $$;
CREATE TRIGGER "KundliGenerationConsent_audit" AFTER INSERT OR UPDATE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_audit_v1();
CREATE FUNCTION public.kundli_consent_no_mutation_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Consent evidence cannot be deleted or audit rewritten'; END $$;
CREATE TRIGGER "KundliGenerationConsent_no_delete" BEFORE DELETE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_no_mutation_v1();
CREATE TRIGGER "KundliGenerationConsentAudit_immutable" BEFORE UPDATE OR DELETE ON public."KundliGenerationConsentAudit"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_no_mutation_v1();
-- Append to consent-v1.synthetic.review.sql BEFORE its COMMIT in the synthetic rehearsal.
-- No active Prisma migration directory; no application execution authorization.
CREATE TABLE public."KundliGenerationRequest" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "consultationId" TEXT NOT NULL REFERENCES public."CallSession"("id") ON DELETE RESTRICT,
  "requestKey" TEXT NOT NULL CHECK (length("requestKey") = 36),
  "consentId" TEXT NOT NULL REFERENCES public."KundliGenerationConsent"("id") ON DELETE RESTRICT,
  "lang" TEXT NOT NULL CHECK ("lang" IN ('en','hi')),
  "leaseToken" TEXT NOT NULL,
  "leaseExpiresAt" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('RESERVED','PUBLISHED')),
  "savedRecordId" TEXT REFERENCES public.kundli_saved_records("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("actorUserId","consultationId","requestKey"),
  CHECK (("status"='RESERVED' AND "savedRecordId" IS NULL) OR
         ("status"='PUBLISHED' AND "savedRecordId" IS NOT NULL))
);
CREATE INDEX "KundliGenerationRequest_lease_idx" ON public."KundliGenerationRequest" ("actorUserId","status","leaseExpiresAt");

CREATE FUNCTION public.kundli_generation_publication_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  IF c."status"<>'ACTIVE' OR c."endedAt" IS NOT NULL OR c."expiresAt"<=clock_timestamp()
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
      AND s."amount"=3500 AND s."currency"='INR' AND s."startDate"<=clock_timestamp() AND s."endDate">clock_timestamp()
      AND p."name"='ASTROLOGER_KUNDLI_YEARLY' AND p."price"=3500 AND p."currency"='INR' AND p."durationDays"=365 AND p."isActive"
      AND a."isApproved" AND a."isVerified" AND u."isActive" AND NOT u."isBlocked"
  ) THEN RAISE EXCEPTION 'Current professional entitlement required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KundliGenerationRequest_publication" BEFORE INSERT OR UPDATE ON public."KundliGenerationRequest"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_generation_publication_v1();

COMMIT;