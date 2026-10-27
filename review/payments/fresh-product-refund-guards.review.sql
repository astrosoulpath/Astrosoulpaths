-- Fresh-install chain only. Separate target-specific approval before deployment.
BEGIN;
ALTER TABLE wallets ADD CONSTRAINT wallets_refund_reservation_bounds
 CHECK (balance >= 0 AND "paidBalance" >= 0 AND "freeBalance" >= 0 AND "lockedBalance" >= 0 AND balance >= "lockedBalance");
CREATE UNIQUE INDEX wallet_ledger_single_principal_refund
 ON wallet_ledger("referenceId") WHERE type='RECHARGE_REFUND' AND "referenceType"='REFUND' AND "referenceId" IS NOT NULL;
COMMIT;
