-- Additive only. Review/apply only after target-specific backup and approval.
CREATE TABLE "MarketplaceOrderCase" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "amountMinor" INTEGER,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceOrderCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceOrderCase_kind_check" CHECK ("kind" IN ('REFUND','DISPUTE')),
  CONSTRAINT "MarketplaceOrderCase_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','RESOLVED')),
  CONSTRAINT "MarketplaceOrderCase_amount_check" CHECK (("kind"='REFUND' AND "amountMinor" IS NOT NULL AND "amountMinor">0 AND "currency"='INR') OR ("kind"='DISPUTE' AND "amountMinor" IS NULL)),
  CONSTRAINT "MarketplaceOrderCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceOrderCase_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MarketplaceOrderCase_customerUserId_idempotencyKey_key" ON "MarketplaceOrderCase"("customerUserId","idempotencyKey");
CREATE INDEX "MarketplaceOrderCase_orderId_status_idx" ON "MarketplaceOrderCase"("orderId","status");
CREATE TABLE "MarketplaceCaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCaseEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MarketplaceOrderCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceCaseEvent_caseId_createdAt_idx" ON "MarketplaceCaseEvent"("caseId","createdAt");
CREATE FUNCTION marketplace_preserve_case_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketplace review events are immutable'; END; $$;
CREATE TRIGGER "MarketplaceCaseEvent_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCaseEvent"
FOR EACH ROW EXECUTE FUNCTION marketplace_preserve_case_event();
-- Freeze financial snapshot columns, while preserving existing status/release transitions.
CREATE FUNCTION marketplace_preserve_commission_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."sellerOrderId",NEW."astrologerId",NEW."currency",NEW."grossAmount",NEW."platformFeePercent",NEW."platformFeeAmount",NEW."netAmount")
     IS DISTINCT FROM ROW(OLD."sellerOrderId",OLD."astrologerId",OLD."currency",OLD."grossAmount",OLD."platformFeePercent",OLD."platformFeeAmount",OLD."netAmount") THEN
    RAISE EXCEPTION 'Marketplace commission snapshots are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "MarketplaceSellerEarning_snapshot_immutable" BEFORE UPDATE ON "MarketplaceSellerEarning"
FOR EACH ROW EXECUTE FUNCTION marketplace_preserve_commission_snapshot();
