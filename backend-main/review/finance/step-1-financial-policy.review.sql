-- REVIEW ONLY: supersedes attempt-2-additive.review.sql; DO NOT apply both.
-- No database execution authorized. Confirm target, backup, ownership and privileges first.
BEGIN;
CREATE TABLE public."ConsultationFinancialPolicy" (
  "callSessionId" TEXT PRIMARY KEY REFERENCES public."CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "platformPercent" DECIMAL(5,2) NOT NULL CHECK ("platformPercent" BETWEEN 0 AND 100),
  "policyVersion" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lifecycle" TEXT NOT NULL CHECK ("lifecycle" = 'CONSULTATION_V2')
);
CREATE TABLE public."CommissionPolicyAudit" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "previousPercent" DECIMAL(5,2) NOT NULL CHECK ("previousPercent" BETWEEN 0 AND 100),
  "newPercent" DECIMAL(5,2) NOT NULL CHECK ("newPercent" BETWEEN 0 AND 100),
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommissionPolicyAudit_effectiveAt_idx" ON public."CommissionPolicyAudit"("effectiveAt");
CREATE FUNCTION public.asp_reject_financial_policy_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial policy records are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "ConsultationFinancialPolicy_immutable" BEFORE UPDATE OR DELETE ON public."ConsultationFinancialPolicy"
  FOR EACH ROW EXECUTE FUNCTION public.asp_reject_financial_policy_mutation();
CREATE TRIGGER "CommissionPolicyAudit_immutable" BEFORE UPDATE OR DELETE ON public."CommissionPolicyAudit"
  FOR EACH ROW EXECUTE FUNCTION public.asp_reject_financial_policy_mutation();
COMMIT;
-- Existing tables/rows are not modified. No backfill or uniqueness change on existing data.
-- Superuser/owner can bypass DDL protections: runtime roles must lack ALTER/TRUNCATE privileges.
