BEGIN;
CREATE TABLE "MarketplaceCheckoutSnapshot" (
  "orderId" TEXT PRIMARY KEY REFERENCES "MarketplaceOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  currency TEXT NOT NULL CHECK (currency='INR'),
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0 AND "amountMinor"<=9007199254740991),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='array' AND jsonb_array_length(payload)>0),
  "sha256" TEXT NOT NULL CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION marketplace_checkout_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT; order_currency TEXT; order_amount NUMERIC; order_state TEXT; provider_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Checkout snapshot is immutable'; END IF;
  SELECT "customerUserId",currency,"grandTotal"*100,status::text,"razorpayOrderId"
    INTO owner_id,order_currency,order_amount,order_state,provider_id
    FROM "MarketplaceOrder" WHERE id=NEW."orderId" FOR UPDATE;
  IF owner_id IS DISTINCT FROM NEW."customerUserId" OR order_currency IS DISTINCT FROM NEW.currency
    OR order_amount IS DISTINCT FROM NEW."amountMinor"::numeric OR order_state IS DISTINCT FROM 'PENDING_PAYMENT'
    OR provider_id IS NOT NULL OR NEW."expiresAt"<=CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Unbound owned pending checkout required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_checkout_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON "MarketplaceCheckoutSnapshot"
FOR EACH ROW EXECUTE FUNCTION marketplace_checkout_snapshot_guard();
CREATE TABLE "MarketplacePaymentCommand" (
  "orderId" TEXT PRIMARY KEY REFERENCES "MarketplaceCheckoutSnapshot"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  state TEXT NOT NULL DEFAULT 'CREATING' CHECK (state IN ('CREATING','READY','UNKNOWN')),
  "providerOrderId" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((state='READY')=("providerOrderId" IS NOT NULL))
);
CREATE FUNCTION marketplace_payment_command_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment command cannot be deleted'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'CREATING' OR NEW."providerOrderId" IS NOT NULL THEN RAISE EXCEPTION 'Invalid initial payment command'; END IF;
  ELSE
    IF NEW."orderId"<>OLD."orderId" OR NEW."createdAt"<>OLD."createdAt" OR OLD.state='READY'
      OR NEW.state NOT IN ('READY','UNKNOWN') THEN RAISE EXCEPTION 'Invalid payment command transition'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_payment_command_transition BEFORE INSERT OR UPDATE OR DELETE ON "MarketplacePaymentCommand"
FOR EACH ROW EXECUTE FUNCTION marketplace_payment_command_guard();
COMMIT;
