-- REVIEW ONLY. NOT an active Prisma migration. Do not execute automatically.
-- Nullable columns preserve historical sessions without guessing their origin.
-- Deploy schema before code that selects these columns. No backfill is proposed.
BEGIN;
ALTER TABLE public."CallSession"
  ADD COLUMN "financialLifecycle" TEXT,
  ADD COLUMN "commissionPercentSnapshot" DECIMAL(5,2),
  ADD COLUMN "commissionPolicyVersion" TEXT,
  ADD COLUMN "commissionLockedAt" TIMESTAMP(3);
ALTER TABLE public."CallSession"
  ADD CONSTRAINT "CallSession_commission_snapshot_range"
  CHECK ("commissionPercentSnapshot" IS NULL OR "commissionPercentSnapshot" BETWEEN 0 AND 100),
  ADD CONSTRAINT "CallSession_financial_lifecycle"
  CHECK ("financialLifecycle" IS NULL OR "financialLifecycle" IN ('CONSULTATION_V2', 'LEGACY'));

-- Append-only in application code; runtime role must lack UPDATE/DELETE rights.
-- Actor ID is retained as an audit identifier without cascading user deletion.
CREATE TABLE public."CommissionPolicyAudit" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "previousPercent" DECIMAL(5,2) NOT NULL CHECK ("previousPercent" BETWEEN 0 AND 100),
  "newPercent" DECIMAL(5,2) NOT NULL CHECK ("newPercent" BETWEEN 0 AND 100),
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommissionPolicyAudit_effectiveAt_idx" ON public."CommissionPolicyAudit" ("effectiveAt");
COMMIT;

-- Future Prisma additions (review together with SQL):
-- CallSession: financialLifecycle String?; commissionPercentSnapshot Decimal? @db.Decimal(5,2)
-- commissionPolicyVersion String?; commissionLockedAt DateTime?
-- CommissionPolicyAudit: matching fields, Decimal(5,2), effectiveAt index.
-- Do not enable dependent code until schema deployment and synthetic integration pass.
