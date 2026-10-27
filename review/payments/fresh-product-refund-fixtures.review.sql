-- Synthetic SQL semantics only; invoked by network-none PG18 rehearsal.
BEGIN;
UPDATE wallets SET "lockedBalance"=100 WHERE id='fixture-wallet';
DO $$ BEGIN
 BEGIN
  UPDATE wallets SET balance=99 WHERE id='fixture-wallet';
  RAISE EXCEPTION 'Reserved principal was spendable';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
-- Failed provider proof releases reservation with no debit.
UPDATE wallets SET "lockedBalance"=0 WHERE id='fixture-wallet';
DO $$ BEGIN IF (SELECT balance FROM wallets WHERE id='fixture-wallet')<>100 THEN RAISE EXCEPTION 'Failed proof debited principal'; END IF; END $$;
-- Fresh synthetic claim and independently processed provider proof.
UPDATE wallets SET "lockedBalance"=100 WHERE id='fixture-wallet';
UPDATE wallets SET balance=0,"paidBalance"=0,"lockedBalance"=0 WHERE id='fixture-wallet';
INSERT INTO wallet_ledger(id,"walletId","userId",type,amount,"balanceBefore","balanceAfter","referenceId","referenceType") VALUES
 ('fixture-refund','fixture-wallet','fixture-a','RECHARGE_REFUND',100,100,0,'fixture-full-refund','REFUND');
UPDATE payment_orders SET status='REFUNDED' WHERE id='fixture-order';
DO $$ BEGIN
 BEGIN
  INSERT INTO wallet_ledger(id,"walletId","userId",type,amount,"balanceBefore","balanceAfter","referenceId","referenceType") VALUES
   ('duplicate-refund','fixture-wallet','fixture-a','RECHARGE_REFUND',100,100,0,'fixture-full-refund','REFUND');
  RAISE EXCEPTION 'Duplicate principal reversal accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT balance FROM wallets WHERE id='fixture-wallet')<>0 OR
  (SELECT sum(CASE WHEN type='RECHARGE' THEN amount ELSE -amount END) FROM wallet_ledger WHERE "walletId"='fixture-wallet')<>0
 THEN RAISE EXCEPTION 'Refund ledger mismatch'; END IF;
END $$;
INSERT INTO "AdminFinanceAction"(id,"actorUserId",action,"referenceId","providerMode",reason,"requestKey",state,"updatedAt") VALUES
 ('fixture-refund-event','fixture-a','REFUND_RECONCILE','fixture-order','TEST','Synthetic fixture proof only','fixture-refund-final','STARTED',now());
UPDATE "AdminFinanceAction" SET state='SUCCEEDED',result='{"state":"PROCESSED","synthetic":true}' WHERE id='fixture-refund-event';
DO $$ BEGIN
 BEGIN
  UPDATE "AdminFinanceAction" SET result='{}' WHERE id='fixture-refund-event';
  RAISE EXCEPTION 'Final refund audit was mutable';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Final refund audit was mutable' THEN RAISE; END IF; END;
END $$;
COMMIT;
