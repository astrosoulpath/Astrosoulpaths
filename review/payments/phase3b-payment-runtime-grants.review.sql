-- Review-only finance scope. NOT the complete monolithic backend permission set.
-- No LOGIN/password, global grants, PUBLIC revokes or existing target changes.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^asp_phase3b_' OR EXISTS(SELECT 1 FROM "User") OR
  EXISTS(SELECT 1 FROM wallets) OR EXISTS(SELECT 1 FROM payment_orders)
 THEN RAISE EXCEPTION 'New empty designated phase3b TEST database required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='asp_phase3b_payment_runtime')
 THEN RAISE EXCEPTION 'Unexpected existing runtime role; stop for drift review'; END IF;
END $$;
CREATE ROLE asp_phase3b_payment_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO asp_phase3b_payment_runtime;
GRANT SELECT ON "User","Role","UserProfile","SubscriptionPlan","Subscription",
 wallets,payment_orders,wallet_ledger,"PaymentCreationCommand","AdminFinanceAction","SmartNotificationPolicy"
 TO asp_phase3b_payment_runtime;
GRANT INSERT ON wallets,payment_orders,wallet_ledger,"Subscription","PaymentCreationCommand","AdminFinanceAction"
 TO asp_phase3b_payment_runtime;
GRANT UPDATE(balance,"paidBalance","freeBalance","lockedBalance","updatedAt") ON wallets TO asp_phase3b_payment_runtime;
GRANT UPDATE(status,"razorpayPaymentId","razorpaySignature","paymentMethod","rawWebhook",metadata,"updatedAt")
 ON payment_orders TO asp_phase3b_payment_runtime;
GRANT UPDATE("subscriptionStatus",amount,currency,"razorpayPaymentId","razorpayOrderId","razorpaySubscriptionId",
 "razorpayCustomerId","startDate","endDate","nextBillingAt","cancelledAt","expiredAt","updatedAt")
 ON "Subscription" TO asp_phase3b_payment_runtime;
GRANT UPDATE(state,"providerOrderId","updatedAt") ON "PaymentCreationCommand" TO asp_phase3b_payment_runtime;
GRANT UPDATE(state,result,"updatedAt") ON "AdminFinanceAction" TO asp_phase3b_payment_runtime;
COMMIT;
