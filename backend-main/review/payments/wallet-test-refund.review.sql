-- Isolated TEST preparation only. Not approved for shared/production migration.
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'RECHARGE_REFUND';
BEGIN;
CREATE TABLE "WalletTestRefund" (
 id TEXT PRIMARY KEY, "paymentOrderId" TEXT NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
 "walletId" TEXT NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "providerPaymentId" TEXT NOT NULL UNIQUE, "providerRefundId" TEXT UNIQUE,
 "amountMinor" BIGINT NOT NULL CHECK("amountMinor"=10000),currency TEXT NOT NULL CHECK(currency='INR'),
 state TEXT NOT NULL CHECK(state IN ('HELD','SUBMITTING','UNKNOWN','PENDING','FAILED','PROCESSED')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "WalletTestRefundEvent" (
 id TEXT PRIMARY KEY,"refundId" TEXT NOT NULL REFERENCES "WalletTestRefund"(id) ON DELETE RESTRICT,
 action TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "wallet_test_refund_ledger_once" ON wallet_ledger("referenceId") WHERE type='RECHARGE_REFUND';
CREATE FUNCTION asp_wallet_test_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund audit cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'HELD' OR NEW."providerRefundId" IS NOT NULL THEN RAISE EXCEPTION 'Refund must begin held'; END IF; RETURN NEW;
 END IF;
 IF ROW(OLD.id,OLD."paymentOrderId",OLD."walletId",OLD."userId",OLD."providerPaymentId",OLD."amountMinor",OLD.currency,OLD."createdAt") IS DISTINCT FROM
 ROW(NEW.id,NEW."paymentOrderId",NEW."walletId",NEW."userId",NEW."providerPaymentId",NEW."amountMinor",NEW.currency,NEW."createdAt") OR
 (OLD."providerRefundId" IS NOT NULL AND NEW."providerRefundId" IS DISTINCT FROM OLD."providerRefundId") THEN RAISE EXCEPTION 'Immutable refund intent'; END IF;
 IF NOT ((OLD.state='HELD' AND NEW.state='SUBMITTING') OR
 (OLD.state='SUBMITTING' AND NEW.state IN ('PENDING','UNKNOWN')) OR
 (OLD.state IN ('PENDING','UNKNOWN') AND NEW.state IN ('PENDING','PROCESSED','FAILED'))) THEN RAISE EXCEPTION 'Invalid refund transition'; END IF;
 IF NEW.state IN ('PENDING','PROCESSED') AND NEW."providerRefundId" IS NULL THEN RAISE EXCEPTION 'Provider reference required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "WalletTestRefund_guard" BEFORE INSERT OR UPDATE OR DELETE ON "WalletTestRefund" FOR EACH ROW EXECUTE FUNCTION asp_wallet_test_refund_guard();
CREATE FUNCTION asp_wallet_refund_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Refund events append only'; END; $$;
CREATE TRIGGER "WalletTestRefundEvent_guard" BEFORE UPDATE OR DELETE ON "WalletTestRefundEvent" FOR EACH ROW EXECUTE FUNCTION asp_wallet_refund_event_guard();
COMMIT;
