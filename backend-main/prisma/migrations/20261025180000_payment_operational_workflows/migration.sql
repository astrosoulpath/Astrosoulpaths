-- Additive. No historical financial mutations or provider calls.
BEGIN;
CREATE TABLE "PaymentCreationCommand" (
  id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "scopeKey" TEXT NOT NULL, "quoteHash" TEXT NOT NULL,
  "providerMode" TEXT NOT NULL CHECK ("providerMode" IN ('TEST','LIVE')),
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0 AND "amountMinor"<=9007199254740991),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  state TEXT NOT NULL CHECK (state IN ('SUBMITTING','UNKNOWN','READY','COMPLETE')),
  "providerOrderId" TEXT UNIQUE REFERENCES payment_orders("razorpayOrderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PaymentCreationCommand_active_scope_key" ON "PaymentCreationCommand"("scopeKey") WHERE state<>'COMPLETE';
CREATE INDEX "PaymentCreationCommand_userId_state_idx" ON "PaymentCreationCommand"("userId",state);
CREATE TABLE "AdminFinanceAction" (
  id TEXT PRIMARY KEY, "actorUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('RECONCILE','REFUND_RECONCILE','REFUND_SUBMIT')),
  "referenceId" TEXT NOT NULL, "providerMode" TEXT NOT NULL CHECK ("providerMode" IN ('TEST','LIVE','UNKNOWN')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
  "requestKey" TEXT NOT NULL UNIQUE, state TEXT NOT NULL CHECK (state IN ('STARTED','SUCCEEDED','FAILED','UNKNOWN')),
  result JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AdminFinanceAction_referenceId_createdAt_idx" ON "AdminFinanceAction"("referenceId","createdAt");
CREATE FUNCTION asp_guard_payment_creation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Creation commands cannot be deleted'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'SUBMITTING' OR NEW."providerOrderId" IS NOT NULL THEN RAISE EXCEPTION 'Creation command must start unbound'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(OLD.id,OLD."userId",OLD."scopeKey",OLD."quoteHash",OLD."providerMode",OLD."amountMinor",OLD.currency,OLD."createdAt")
     IS DISTINCT FROM ROW(NEW.id,NEW."userId",NEW."scopeKey",NEW."quoteHash",NEW."providerMode",NEW."amountMinor",NEW.currency,NEW."createdAt")
     OR (OLD."providerOrderId" IS NOT NULL AND NEW."providerOrderId" IS DISTINCT FROM OLD."providerOrderId") THEN
    RAISE EXCEPTION 'Creation quote and provider binding are immutable';
  END IF;
  IF NOT ((OLD.state='SUBMITTING' AND NEW.state IN ('UNKNOWN','READY')) OR (OLD.state='READY' AND NEW.state='COMPLETE')) THEN
    RAISE EXCEPTION 'Invalid creation command transition';
  END IF;
  IF NEW.state IN ('READY','COMPLETE') AND NOT EXISTS (
    SELECT 1 FROM payment_orders p WHERE p."razorpayOrderId"=NEW."providerOrderId"
      AND p."userId"=NEW."userId" AND p.currency=NEW.currency AND p.amount*100=NEW."amountMinor"
      AND (NEW.state<>'COMPLETE' OR p.status='SUCCESS')
  ) THEN RAISE EXCEPTION 'Owned provider binding required'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "PaymentCreationCommand_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PaymentCreationCommand"
  FOR EACH ROW EXECUTE FUNCTION asp_guard_payment_creation();
CREATE FUNCTION asp_complete_payment_creation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='SUCCESS' THEN UPDATE "PaymentCreationCommand" SET state='COMPLETE',"updatedAt"=CURRENT_TIMESTAMP
    WHERE "providerOrderId"=NEW."razorpayOrderId" AND state='READY'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "payment_orders_complete_creation" AFTER UPDATE OF status ON payment_orders
  FOR EACH ROW EXECUTE FUNCTION asp_complete_payment_creation();
CREATE FUNCTION asp_guard_finance_action() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Financial action audit cannot be deleted'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'STARTED' OR NEW.result IS NOT NULL THEN RAISE EXCEPTION 'Financial action must start without a result'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.state<>'STARTED' OR NEW.state NOT IN ('SUCCEEDED','FAILED','UNKNOWN') OR
     ROW(OLD.id,OLD."actorUserId",OLD.action,OLD."referenceId",OLD."providerMode",OLD.reason,OLD."requestKey",OLD."createdAt")
     IS DISTINCT FROM ROW(NEW.id,NEW."actorUserId",NEW.action,NEW."referenceId",NEW."providerMode",NEW.reason,NEW."requestKey",NEW."createdAt")
  THEN RAISE EXCEPTION 'Financial action audit is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "AdminFinanceAction_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AdminFinanceAction"
  FOR EACH ROW EXECUTE FUNCTION asp_guard_finance_action();
COMMIT;
