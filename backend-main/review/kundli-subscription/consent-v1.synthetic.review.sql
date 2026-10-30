-- REVIEW ONLY. Proposed policy is NOT approved for activation.
-- Restricted to a newly created isolated synthetic database by the test runner.
-- Not a runnable application migration; never copy into prisma/migrations blindly.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'asp_kundli_consent_synthetic' THEN
    RAISE EXCEPTION 'Synthetic Kundli consent target required';
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
COMMIT;
