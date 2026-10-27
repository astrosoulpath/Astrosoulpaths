-- Additive only. No legacy ledger/earning/wallet rows are updated or backfilled.
CREATE TABLE "MarketplaceFinancialEntry" (
  "id" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "productMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL,
  "shippingMinor" BIGINT NOT NULL,
  "taxMinor" BIGINT NOT NULL,
  "feeMinor" BIGINT NOT NULL,
  "sellerMinor" BIGINT NOT NULL,
  "platformMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceFinancialEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceFinancialEntry_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceFinancialEntry_currency_check" CHECK ("currency" = 'INR'),
  CONSTRAINT "MarketplaceFinancialEntry_kind_check" CHECK ("kind" IN ('CAPTURE','REFUND','SETTLEMENT')),
  CONSTRAINT "MarketplaceFinancialEntry_nonnegative_check" CHECK (LEAST("productMinor","discountMinor","shippingMinor","taxMinor","feeMinor","sellerMinor","platformMinor") >= 0),
  CONSTRAINT "MarketplaceFinancialEntry_discount_check" CHECK ("kind"='CAPTURE' OR "discountMinor"=0),
  CONSTRAINT "MarketplaceFinancialEntry_components_check" CHECK (
    ("kind" IN ('CAPTURE','REFUND') AND "productMinor" = "sellerMinor" + "platformMinor") OR
    ("kind" = 'SETTLEMENT' AND "productMinor"=0 AND "shippingMinor"=0 AND "taxMinor"=0 AND "feeMinor"=0 AND "platformMinor"=0)
  )
);
CREATE UNIQUE INDEX "MarketplaceFinancialEntry_eventKey_key" ON "MarketplaceFinancialEntry"("eventKey");
CREATE UNIQUE INDEX "MarketplaceFinancialEntry_one_capture" ON "MarketplaceFinancialEntry"("sellerOrderId") WHERE "kind"='CAPTURE';
CREATE INDEX "MarketplaceFinancialEntry_sellerOrderId_createdAt_idx" ON "MarketplaceFinancialEntry"("sellerOrderId","createdAt");
CREATE FUNCTION marketplace_financial_entry_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketplace financial entries are immutable'; END $$;
CREATE TRIGGER "MarketplaceFinancialEntry_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceFinancialEntry" FOR EACH ROW EXECUTE FUNCTION marketplace_financial_entry_immutable();
