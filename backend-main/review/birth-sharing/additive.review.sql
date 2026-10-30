-- REVIEW ONLY. Apply only after target/backup/isolated rehearsal approval.
BEGIN;
CREATE TABLE public."ConsultationBirthSharing" (
  "consultationId" text PRIMARY KEY REFERENCES public."CallSession"("id") ON DELETE RESTRICT,
  "customerId" text NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "astrologerId" text NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "birthVersion" text NOT NULL CHECK (length("birthVersion") = 64),
  "policyVersion" text NOT NULL,
  "expiresAt" timestamp(3) NOT NULL,
  "revokedAt" timestamp(3),
  CHECK ("customerId" <> "astrologerId")
);
CREATE TABLE public."ConsultationBirthSharingAudit" (
  "id" text PRIMARY KEY,
  "consultationId" text NOT NULL REFERENCES public."CallSession"("id") ON DELETE RESTRICT,
  "actorId" text NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "action" text NOT NULL CHECK ("action" IN ('GRANT','REVOKE')),
  "policyVersion" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ConsultationBirthSharingAudit_consultationId_createdAt_idx"
  ON public."ConsultationBirthSharingAudit" ("consultationId","createdAt");
CREATE FUNCTION public.reject_birth_sharing_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Birth sharing audit is append only'; END;
$$;
CREATE TRIGGER "ConsultationBirthSharingAudit_immutable" BEFORE UPDATE OR DELETE
  ON public."ConsultationBirthSharingAudit" FOR EACH ROW EXECUTE FUNCTION public.reject_birth_sharing_audit_mutation();
CREATE TRIGGER "ConsultationBirthSharingAudit_no_truncate" BEFORE TRUNCATE
  ON public."ConsultationBirthSharingAudit" FOR EACH STATEMENT EXECUTE FUNCTION public.reject_birth_sharing_audit_mutation();
COMMIT;
