-- Isolated TEST-only additive rehearsal. Not a production migration approval.
BEGIN;
CREATE TABLE "SubscriptionTestRefund" (
 id TEXT PRIMARY KEY, "paymentOrderId" TEXT NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
 "subscriptionId" TEXT NOT NULL UNIQUE REFERENCES "Subscription"(id) ON DELETE RESTRICT,
 "providerPaymentId" TEXT NOT NULL UNIQUE, "providerRefundId" TEXT UNIQUE,
 "amountMinor" BIGINT NOT NULL CHECK ("amountMinor"=350000), currency TEXT NOT NULL CHECK(currency='INR'),
 "policyRevision" TEXT NOT NULL CHECK("policyRevision"='operator-test-full-refund-v1'),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','SUBMITTING','UNKNOWN','PENDING','FAILED','PROCESSED')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SubscriptionTestRefundEvent" (
 id TEXT PRIMARY KEY, "refundId" TEXT NOT NULL REFERENCES "SubscriptionTestRefund"(id) ON DELETE RESTRICT,
 action TEXT NOT NULL, "authority" TEXT NOT NULL CHECK(authority='LOCAL_OPERATOR_EXPLICIT_APPROVAL'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SubscriptionTestRefundAllocation" (
 "refundId" TEXT PRIMARY KEY REFERENCES "SubscriptionTestRefund"(id) ON DELETE RESTRICT,
 "platformGrossReversalMinor" BIGINT NOT NULL CHECK("platformGrossReversalMinor"=350000),
 "astrologerReversalMinor" BIGINT NOT NULL CHECK("astrologerReversalMinor"=0),
 currency TEXT NOT NULL CHECK(currency='INR'), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION asp_subscription_test_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund evidence cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'PREPARED' OR NEW."providerRefundId" IS NOT NULL THEN RAISE EXCEPTION 'Initial refund must be PREPARED'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(OLD.id,OLD."paymentOrderId",OLD."subscriptionId",OLD."providerPaymentId",OLD."amountMinor",OLD.currency,OLD."policyRevision",OLD."createdAt") IS DISTINCT FROM
    ROW(NEW.id,NEW."paymentOrderId",NEW."subscriptionId",NEW."providerPaymentId",NEW."amountMinor",NEW.currency,NEW."policyRevision",NEW."createdAt") OR
    (OLD."providerRefundId" IS NOT NULL AND OLD."providerRefundId" IS DISTINCT FROM NEW."providerRefundId") THEN RAISE EXCEPTION 'Refund intent immutable'; END IF;
 IF NOT ((OLD.state='PREPARED' AND NEW.state='SUBMITTING') OR
   (OLD.state='SUBMITTING' AND NEW.state IN ('UNKNOWN','PENDING')) OR
   (OLD.state IN ('UNKNOWN','PENDING') AND NEW.state IN ('PENDING','FAILED','PROCESSED'))) THEN RAISE EXCEPTION 'Unsafe refund transition'; END IF;
 IF NEW.state IN ('PENDING','PROCESSED') AND NEW."providerRefundId" IS NULL THEN RAISE EXCEPTION 'Provider reference required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "SubscriptionTestRefund_guard" BEFORE INSERT OR UPDATE OR DELETE ON "SubscriptionTestRefund" FOR EACH ROW EXECUTE FUNCTION asp_subscription_test_refund_guard();
CREATE FUNCTION asp_subscription_test_refund_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Refund audit and allocations are append-only'; END; $$;
CREATE TRIGGER "SubscriptionTestRefundEvent_guard" BEFORE UPDATE OR DELETE ON "SubscriptionTestRefundEvent" FOR EACH ROW EXECUTE FUNCTION asp_subscription_test_refund_append_only();
CREATE TRIGGER "SubscriptionTestRefundAllocation_guard" BEFORE UPDATE OR DELETE ON "SubscriptionTestRefundAllocation" FOR EACH ROW EXECUTE FUNCTION asp_subscription_test_refund_append_only();
COMMIT;
