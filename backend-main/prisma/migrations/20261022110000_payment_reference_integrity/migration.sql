-- Forward-only preparation. Never repair historical rows or checksums here.
-- Abort on drift/duplicates; require backup and operator approval before deployment.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='payment_orders'::regclass AND conname='payment_orders_walletId_fkey' AND contype='f') THEN
    RAISE EXCEPTION 'Unexpected legacy wallet foreign key requires review';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_orders WHERE "razorpayPaymentId" IS NOT NULL GROUP BY "razorpayPaymentId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate provider payment references require review';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_orders p JOIN wallets w ON w.id=p."walletId" WHERE p."userId"<>w."userId") THEN
    RAISE EXCEPTION 'Payment wallet ownership requires review';
  END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE type='RECHARGE' AND "referenceType"='WALLET_RECHARGE' AND "referenceId" IS NOT NULL GROUP BY "referenceId" HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate recharge ledger references require review';
  END IF;
END $$;
CREATE UNIQUE INDEX payment_orders_provider_payment_key ON payment_orders("razorpayPaymentId");
CREATE UNIQUE INDEX wallets_id_owner_key ON wallets(id,"userId");
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_wallet_owner_fkey FOREIGN KEY("walletId","userId") REFERENCES wallets(id,"userId") ON DELETE CASCADE ON UPDATE RESTRICT;
-- Remove the now-redundant single-column FK only after the stronger FK validates.
ALTER TABLE payment_orders DROP CONSTRAINT "payment_orders_walletId_fkey";
CREATE UNIQUE INDEX wallet_recharge_reference_key ON wallet_ledger("referenceId") WHERE type='RECHARGE' AND "referenceType"='WALLET_RECHARGE' AND "referenceId" IS NOT NULL;
COMMIT;
