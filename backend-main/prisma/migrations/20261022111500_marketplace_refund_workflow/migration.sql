-- Additive default-off workflow preparation. No provider calls or legacy backfill.
BEGIN;
CREATE TABLE "MarketplaceRefundAttempt" (
 id TEXT PRIMARY KEY, "caseId" TEXT NOT NULL UNIQUE REFERENCES "MarketplaceOrderCase"(id) ON DELETE RESTRICT,
 "providerPaymentId" TEXT NOT NULL, "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0),
 currency TEXT NOT NULL CHECK(currency='INR'), "policyRevision" TEXT NOT NULL CHECK(length("policyRevision")>0),
 "componentSnapshot" JSONB NOT NULL, state TEXT NOT NULL DEFAULT 'PREPARED',
 "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "providerRefundId" TEXT UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
 CONSTRAINT refund_workflow_state CHECK(state IN ('PREPARED','SUBMITTING','UNKNOWN','PROVIDER_CONFIRMED','FAILED')),
 CONSTRAINT refund_workflow_lease CHECK(state NOT IN ('SUBMITTING','UNKNOWN') OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)),
 CONSTRAINT refund_workflow_confirmation CHECK(state<>'PROVIDER_CONFIRMED' OR "providerRefundId" IS NOT NULL)
);
CREATE INDEX "MarketplaceRefundAttempt_state_leaseUntil_idx" ON "MarketplaceRefundAttempt"(state,"leaseUntil");
CREATE TABLE "MarketplaceRefundAttemptEvent" (
 id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "attemptId" TEXT NOT NULL REFERENCES "MarketplaceRefundAttempt"(id) ON DELETE RESTRICT,
 state TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "MarketplaceRefundAttemptEvent_attemptId_createdAt_idx" ON "MarketplaceRefundAttemptEvent"("attemptId","createdAt");
CREATE FUNCTION marketplace_refund_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund attempts cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.state<>'PREPARED' OR NEW."leaseToken" IS NOT NULL OR NEW."leaseUntil" IS NOT NULL OR NEW."providerRefundId" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "MarketplaceOrderCase" c JOIN "MarketplaceOrder" o ON o.id=c."orderId" WHERE c.id=NEW."caseId" AND c.kind='REFUND' AND c.status='APPROVED' AND c."customerUserId"=o."customerUserId" AND c."amountMinor"=NEW."amountMinor" AND NEW."amountMinor"<=round(o."grandTotal"*100) AND c.currency=NEW.currency AND o."razorpayPaymentId"=NEW."providerPaymentId" AND o."paymentVerifiedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Approved paid refund case required'; END IF;
 ELSE
   IF (NEW.id,NEW."caseId",NEW."providerPaymentId",NEW."amountMinor",NEW.currency,NEW."policyRevision",NEW."componentSnapshot",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."caseId",OLD."providerPaymentId",OLD."amountMinor",OLD.currency,OLD."policyRevision",OLD."componentSnapshot",OLD."createdAt") THEN RAISE EXCEPTION 'Refund intent is immutable'; END IF;
   IF NOT ((OLD.state='PREPARED' AND NEW.state='SUBMITTING') OR (OLD.state='SUBMITTING' AND NEW.state IN ('UNKNOWN','PROVIDER_CONFIRMED','FAILED')) OR (OLD.state='UNKNOWN' AND NEW.state IN ('PROVIDER_CONFIRMED','FAILED'))) THEN RAISE EXCEPTION 'Invalid refund transition'; END IF;
   IF OLD.state<>'PREPARED' AND NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken" THEN RAISE EXCEPTION 'Refund fence is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER marketplace_refund_transition BEFORE INSERT OR UPDATE OR DELETE ON "MarketplaceRefundAttempt" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_transition();
CREATE FUNCTION marketplace_refund_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO "MarketplaceRefundAttemptEvent"("attemptId",state) VALUES(NEW.id,NEW.state); RETURN NEW; END $$;
CREATE TRIGGER marketplace_refund_audit AFTER INSERT OR UPDATE ON "MarketplaceRefundAttempt" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_audit();
CREATE FUNCTION marketplace_refund_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Refund audit is immutable'; END $$;
CREATE TRIGGER marketplace_refund_audit_immutable BEFORE UPDATE OR DELETE ON "MarketplaceRefundAttemptEvent" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_audit_immutable();
COMMIT;
