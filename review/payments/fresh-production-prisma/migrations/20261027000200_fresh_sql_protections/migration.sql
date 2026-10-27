-- REVIEW ONLY: fresh empty database companion, never historical replay.

-- Apply only after separately approved composition review/rehearsal.

BEGIN;

-- Source: 20261018000100_marketplace_case_review SHA256 3dd1fe338139082d72356c15fadbbc52ce9fe0f87bb9263472d2fa7f3e351cd0

ALTER TABLE public."MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_kind_check" CHECK ("kind" IN ('REFUND','DISPUTE'));

ALTER TABLE public."MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','RESOLVED'));

ALTER TABLE public."MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_amount_check" CHECK (("kind"='REFUND' AND "amountMinor" IS NOT NULL AND "amountMinor">0 AND "currency"='INR') OR ("kind"='DISPUTE' AND "amountMinor" IS NULL));

CREATE FUNCTION marketplace_preserve_case_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketplace review events are immutable'; END; $$;

CREATE TRIGGER "MarketplaceCaseEvent_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCaseEvent"
FOR EACH ROW EXECUTE FUNCTION marketplace_preserve_case_event();

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

-- Source: 20261018000200_marketplace_component_journal SHA256 e90597f76b39f8cf6532840e749006ca62387b8d6f79a1c1838bf2d0199793ea

ALTER TABLE public."MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_currency_check" CHECK ("currency" = 'INR');

ALTER TABLE public."MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_kind_check" CHECK ("kind" IN ('CAPTURE','REFUND','SETTLEMENT'));

ALTER TABLE public."MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_nonnegative_check" CHECK (LEAST("productMinor","discountMinor","shippingMinor","taxMinor","feeMinor","sellerMinor","platformMinor") >= 0);

ALTER TABLE public."MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_discount_check" CHECK ("kind"='CAPTURE' OR "discountMinor"=0);

ALTER TABLE public."MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_components_check" CHECK (
    ("kind" IN ('CAPTURE','REFUND') AND "productMinor" = "sellerMinor" + "platformMinor") OR
    ("kind" = 'SETTLEMENT' AND "productMinor"=0 AND "shippingMinor"=0 AND "taxMinor"=0 AND "feeMinor"=0 AND "platformMinor"=0)
  );

CREATE UNIQUE INDEX "MarketplaceFinancialEntry_one_capture" ON "MarketplaceFinancialEntry"("sellerOrderId") WHERE "kind"='CAPTURE';

CREATE FUNCTION marketplace_financial_entry_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketplace financial entries are immutable'; END $$;

CREATE TRIGGER "MarketplaceFinancialEntry_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceFinancialEntry" FOR EACH ROW EXECUTE FUNCTION marketplace_financial_entry_immutable();

-- Source: 20261021190000_add_durable_horoscope_reminders SHA256 f93c296ac05632cfa9948f840f9d29ea75e361077f1fd65f47de932c58fbd23e

ALTER TABLE public."PersonalizedHoroscopeReading" ADD CONSTRAINT "fresh_check_4e2b8be3e400d0a1c37cc562" CHECK ("locale" IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru'));

ALTER TABLE public."PersonalizedHoroscopeReading" ADD CONSTRAINT "fresh_check_8125d07be4e76a25df503bc1" CHECK ("state" IN ('GENERATING','READY','FAILED'));

ALTER TABLE public."PersonalizedHoroscopeReading" ADD CONSTRAINT "fresh_check_bdb91743333a91df53a4fc7e" CHECK ("attempts" BETWEEN 1 AND 3);

ALTER TABLE public."PersonalizedHoroscopeReading" ADD CONSTRAINT "PersonalizedHoroscopeReading_ready_response" CHECK ("state" <> 'READY' OR "response" IS NOT NULL);

ALTER TABLE public."HoroscopeNotificationOutbox" ADD CONSTRAINT "fresh_check_47138cbdd357f60857f55c86" CHECK ("locale" IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru'));

ALTER TABLE public."HoroscopeNotificationOutbox" ADD CONSTRAINT "fresh_check_4c534b82604f9ec400159222" CHECK ("state" IN ('QUEUED','PROCESSING','SENDING','RETRY','ACCEPTED','FAILED','CANCELLED','UNKNOWN'));

ALTER TABLE public."HoroscopeNotificationOutbox" ADD CONSTRAINT "fresh_check_1d97f414e968799ff79e5dd2" CHECK ("attempts" BETWEEN 0 AND 5);

ALTER TABLE public."HoroscopeSubscriptionControl" ADD CONSTRAINT "fresh_check_e15fa1db5f2500c44b031881" CHECK ("renewalMode"='MANUAL');

CREATE FUNCTION public.asp_horoscope_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Subscription audit is immutable' USING ERRCODE='23514'; END; $$;

CREATE TRIGGER "HoroscopeSubscriptionAudit_immutable" BEFORE UPDATE OR DELETE ON public."HoroscopeSubscriptionAudit"
 FOR EACH ROW EXECUTE FUNCTION public.asp_horoscope_audit_immutable();

-- Source: 20261022110000_payment_reference_integrity SHA256 89daf3893901b7605a7c52b979f7111edafcd3f97c40dea3c4d56ab6f2e115bd

CREATE UNIQUE INDEX wallet_recharge_reference_key ON wallet_ledger("referenceId") WHERE type='RECHARGE' AND "referenceType"='WALLET_RECHARGE' AND "referenceId" IS NOT NULL;

-- Source: 20261022111500_marketplace_refund_workflow SHA256 92528cf0219ea3de1620e1f58757faff72c4bda149fce702bbce88584bda8468

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT "fresh_check_22549463aabe8cca9e7b7062" CHECK ("amountMinor">0);

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT "fresh_check_add1d01abcc9e066217c6aff" CHECK (currency='INR');

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT "fresh_check_73b4f54f29429d4b1074998f" CHECK (length("policyRevision")>0);

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT refund_workflow_state CHECK (state IN ('PREPARED','SUBMITTING','UNKNOWN','PROVIDER_CONFIRMED','FAILED'));

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT refund_workflow_lease CHECK (state NOT IN ('SUBMITTING','UNKNOWN') OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL));

ALTER TABLE public."MarketplaceRefundAttempt" ADD CONSTRAINT refund_workflow_confirmation CHECK (state<>'PROVIDER_CONFIRMED' OR "providerRefundId" IS NOT NULL);

CREATE FUNCTION marketplace_refund_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund attempts cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.state<>'PREPARED' OR NEW."leaseToken" IS NOT NULL OR NEW."leaseUntil" IS NOT NULL OR NEW."providerRefundId" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "MarketplaceOrderCase" c JOIN "MarketplaceOrder" o ON o.id=c."orderId" WHERE c.id=NEW."caseId" AND c.kind='REFUND' AND c.status='APPROVED' AND c."customerUserId"=o."customerUserId" AND c."amountMinor"=NEW."amountMinor" AND NEW."amountMinor"<=round(o."grandTotal"*100) AND c.currency=NEW.currency AND o."razorpayPaymentId"=NEW."providerPaymentId" AND o."paymentVerifiedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Approved paid refund case required'; END IF;
 ELSE
   IF (NEW.id,NEW."caseId",NEW."providerPaymentId",NEW."amountMinor",NEW.currency,NEW."policyRevision",NEW."componentSnapshot",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."caseId",OLD."providerPaymentId",OLD."amountMinor",OLD.currency,OLD."policyRevision",OLD."componentSnapshot",OLD."createdAt") THEN RAISE EXCEPTION 'Refund intent is immutable'; END IF;
   IF NOT ((OLD.state='PREPARED' AND NEW.state='SUBMITTING') OR (OLD.state='SUBMITTING' AND NEW.state IN ('UNKNOWN','PROVIDER_CONFIRMED','FAILED')) OR (OLD.state='UNKNOWN' AND NEW.state IN ('PROVIDER_CONFIRMED','FAILED'))) THEN RAISE EXCEPTION 'Invalid refund transition'; END IF;
   IF OLD.state<>'PREPARED' AND NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken" THEN RAISE EXCEPTION 'Refund fence is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER marketplace_refund_transition BEFORE INSERT OR UPDATE OR DELETE ON "MarketplaceRefundAttempt" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_transition();

CREATE FUNCTION marketplace_refund_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO "MarketplaceRefundAttemptEvent"("attemptId",state) VALUES(NEW.id,NEW.state); RETURN NEW; END $$;

CREATE TRIGGER marketplace_refund_audit AFTER INSERT OR UPDATE ON "MarketplaceRefundAttempt" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_audit();

CREATE FUNCTION marketplace_refund_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Refund audit is immutable'; END $$;

CREATE TRIGGER marketplace_refund_audit_immutable BEFORE UPDATE OR DELETE ON "MarketplaceRefundAttemptEvent" FOR EACH ROW EXECUTE FUNCTION marketplace_refund_audit_immutable();

-- Source: 20261022130000_marketplace_checkout_snapshots SHA256 dddcafb8f7f0c1a4282f8d9522b2e398252222a219eb7db09a6f2cf2fe687552

ALTER TABLE public."MarketplaceCheckoutSnapshot" ADD CONSTRAINT "fresh_check_568d7973f83d8598de29ca9c" CHECK (currency='INR');

ALTER TABLE public."MarketplaceCheckoutSnapshot" ADD CONSTRAINT "fresh_check_57493daea790ea6a662a070e" CHECK ("amountMinor">0 AND "amountMinor"<=9007199254740991);

ALTER TABLE public."MarketplaceCheckoutSnapshot" ADD CONSTRAINT "fresh_check_f894b0abe15d777ee47181a3" CHECK (jsonb_typeof(payload)='array' AND jsonb_array_length(payload)>0);

ALTER TABLE public."MarketplaceCheckoutSnapshot" ADD CONSTRAINT "fresh_check_8477affe3c4085eb462b343e" CHECK ("sha256" ~ '^[a-f0-9]{64}$');

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

ALTER TABLE public."MarketplacePaymentCommand" ADD CONSTRAINT "fresh_check_202afe84212eebad307cc0c7" CHECK (state IN ('CREATING','READY','UNKNOWN'));

ALTER TABLE public."MarketplacePaymentCommand" ADD CONSTRAINT "fresh_check_753892f9406e05caa64b670f" CHECK ((state='READY')=("providerOrderId" IS NOT NULL));

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

-- Source: 20261022160000_add_smart_notification_storage SHA256 df8b0c751885ac95cbb44a373c24f71f6211e2e1cd884cb6e3a0cd7340b87c99

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_1e43556c4becd430439b7aff" CHECK ("entitlement" IN ('UNAPPROVED','FREE_APPROVED'));

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_64aa309a7d007554ea363027" CHECK ("revision">0);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_120d74296de2b9f1f9982265" CHECK ("dailyLimit" BETWEEN 1 AND 10);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_66375df8e292a8e251ee6376" CHECK ("minimumIntervalMs">=3600000);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_a25c990b7d2bd30f9ad0f741" CHECK ("quietStart" BETWEEN 0 AND 1439);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_b83459a38de37761dc4b9aad" CHECK ("quietEnd" BETWEEN 0 AND 1439);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "fresh_check_15a1fe8be27fa7d1d05e2c15" CHECK ("quietStart"<>"quietEnd");

ALTER TABLE public."SmartNotificationConsent" ADD CONSTRAINT "fresh_check_17fb75eb6259e2e56a1ca0a1" CHECK ("version">0);

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "fresh_check_7b3373824e0f5b844fe7d03a" CHECK ("provenance"='ADMIN_EDITORIAL');

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "fresh_check_3896db76b6a9615948bb5661" CHECK ("state" IN ('DRAFT','APPROVED','SCHEDULED','PAUSED'));

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "fresh_check_7d90aaf6b3adf559b2bdd402" CHECK (length("title") BETWEEN 1 AND 120 AND length("body") BETWEEN 1 AND 3000);

ALTER TABLE public."SmartNotificationInsight" ADD CONSTRAINT "fresh_check_d183c225ba53a4f7d9d894ae" CHECK ("provenance" IN ('ADMIN_EDITORIAL','LOCAL_COMPUTED'));

ALTER TABLE public."SmartNotificationDelivery" ADD CONSTRAINT "fresh_check_13705955aec480e46a77c7e0" CHECK ("state" IN ('QUEUED','PROCESSING','SENDING','ACCEPTED','CANCELLED','UNKNOWN','FAILED'));

ALTER TABLE public."SmartNotificationDelivery" ADD CONSTRAINT "fresh_check_e8252781b67a9c6557234a96" CHECK ("attempts" BETWEEN 0 AND 5);

CREATE FUNCTION public.smart_notification_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Smart notification record is immutable'; END $$;

CREATE TRIGGER "SmartNotificationAudit_immutable" BEFORE UPDATE OR DELETE ON public."SmartNotificationAudit"
FOR EACH ROW EXECUTE FUNCTION public.smart_notification_immutable();

CREATE TRIGGER "SmartNotificationInsight_immutable" BEFORE UPDATE OR DELETE ON public."SmartNotificationInsight"
FOR EACH ROW EXECUTE FUNCTION public.smart_notification_immutable();

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "SmartPolicy_control_version_check" CHECK ("controlVersion">0);

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "SmartPolicy_schedule_minute_check" CHECK ("scheduleMinute" BETWEEN 0 AND 1439);

CREATE FUNCTION public.smart_notification_languages_valid(value text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
 SELECT CASE WHEN array_ndims(value)>1 THEN false ELSE
 value <@ ARRAY['en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru']::text[]
 AND cardinality(value)=(SELECT count(DISTINCT item) FROM unnest(value) AS item)
 AND NOT EXISTS(SELECT 1 FROM unnest(value) AS item WHERE item IS NULL) END;
$$;

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "SmartPolicy_category_check" CHECK ("category" IN ('love','career','prosperity','marriage','yoga','education','growth','daily','family','cosmic')) NOT VALID;

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "SmartPolicy_languages_check" CHECK (public.smart_notification_languages_valid("languages")) NOT VALID;

ALTER TABLE public."SmartNotificationPolicy" ADD CONSTRAINT "SmartPolicy_interval_max_check" CHECK ("minimumIntervalMs"<=2147483647) NOT VALID;

ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_category_check";

ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_languages_check";

ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_interval_max_check";

ALTER TABLE public."SmartNotificationConsent" ADD CONSTRAINT "SmartConsent_purpose_check" CHECK ("granted" OR (NOT "birthUse" AND NOT "engagementGranted")) NOT VALID;

ALTER TABLE public."SmartNotificationConsent" VALIDATE CONSTRAINT "SmartConsent_purpose_check";

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "SmartCampaign_revision_check" CHECK ("revision">0) NOT VALID;

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "SmartCampaign_locale_check" CHECK (public.smart_notification_languages_valid(ARRAY["locale"])) NOT VALID;

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "SmartCampaign_approval_check" CHECK ("state" NOT IN ('APPROVED','SCHEDULED') OR "approvedBy" IS NOT NULL) NOT VALID;

ALTER TABLE public."SmartNotificationCampaign" ADD CONSTRAINT "SmartCampaign_schedule_check" CHECK ("state"<>'SCHEDULED' OR ("scheduledAt" IS NOT NULL AND "scheduledAt"<"expiresAt")) NOT VALID;

ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_revision_check";

ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_locale_check";

ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_approval_check";

ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_schedule_check";

ALTER TABLE public."SmartNotificationInsight" ADD CONSTRAINT "SmartInsight_versions_check" CHECK ("consentVersion">0 AND "policyRevision">0) NOT VALID;

ALTER TABLE public."SmartNotificationInsight" ADD CONSTRAINT "SmartInsight_locale_check" CHECK (public.smart_notification_languages_valid(ARRAY["locale"])) NOT VALID;

ALTER TABLE public."SmartNotificationInsight" VALIDATE CONSTRAINT "SmartInsight_versions_check";

ALTER TABLE public."SmartNotificationInsight" VALIDATE CONSTRAINT "SmartInsight_locale_check";

INSERT INTO public."SmartNotificationPolicy" ("category") VALUES
('love'),
('career'),
('prosperity'),
('marriage'),
('yoga'),
('education'),
('growth'),
('daily'),
('family'),
('cosmic');

-- Source: 20261024200000_add_consultation_kundli_consent_v1 SHA256 65fdb9a58cd833c935d896456b67ffafa9bdd0dd872322e02b33356e7e698dc9

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_eca7361c4f1b956485ef315c" CHECK (length("birthDataVersion") BETWEEN 1 AND 128);

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_b4f946dadc80517143247eee" CHECK ("purpose" = 'LOCAL_KUNDLI_CALCULATION');

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_1904322ded055e8a063816c3" CHECK ("policyVersion" = 'kundli-local-v1');

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_d6b1e1fd7b3b85841cad25b7" CHECK (
    cardinality("fieldScope") = 6 AND "fieldScope" @>
      ARRAY['dob','timeOfBirth','latitude','longitude','timezone','birthPlace']::TEXT[]);

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_af801567ae36a82f7b68deda" CHECK ("grantedByUserId" = "customerUserId");

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_5a4a0d2360941aab6562b1dc" CHECK ("customerUserId" <> "astrologerUserId");

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_f4af6d0b6aadfba1133e0c14" CHECK ("expiresAt" > "grantedAt");

ALTER TABLE public."KundliGenerationConsent" ADD CONSTRAINT "fresh_check_154b6ba15c8d6b14c4dc54e9" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "grantedAt");

CREATE UNIQUE INDEX "KundliGenerationConsent_current_scope_key"
  ON public."KundliGenerationConsent" ("consultationId","birthDataVersion","policyVersion")
  WHERE "revokedAt" IS NULL;

CREATE FUNCTION public.kundli_consent_guard_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'revokedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'revokedAt')
      OR OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN
      RAISE EXCEPTION 'Consent evidence is immutable except first revocation';
    END IF;
    NEW."revokedAt" := clock_timestamp();
    RETURN NEW;
  END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  IF NOT FOUND OR c."userId" <> NEW."customerUserId" OR c."astrologerId" <> NEW."astrologerUserId"
    OR c."status" <> 'ACTIVE' OR c."endedAt" IS NOT NULL OR c."expiresAt" <= clock_timestamp() THEN
    RAISE EXCEPTION 'Authorized active consultation required';
  END IF;
  NEW."grantedAt" := clock_timestamp();
  IF NEW."expiresAt" > c."expiresAt" OR NEW."expiresAt" <= NEW."grantedAt" OR NEW."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid consent period';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "KundliGenerationConsent_guard" BEFORE INSERT OR UPDATE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_guard_v1();

ALTER TABLE public."KundliGenerationConsentAudit" ADD CONSTRAINT "fresh_check_62bfd48c161f52637935fd93" CHECK ("action" IN ('GRANTED','REVOKED'));

CREATE FUNCTION public.kundli_consent_audit_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public."KundliGenerationConsentAudit" ("consentId","action","actorUserId")
    VALUES (NEW."id", CASE WHEN TG_OP='INSERT' THEN 'GRANTED' ELSE 'REVOKED' END, NEW."customerUserId");
  RETURN NEW;
END $$;

CREATE TRIGGER "KundliGenerationConsent_audit" AFTER INSERT OR UPDATE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_audit_v1();

CREATE FUNCTION public.kundli_consent_no_mutation_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Consent evidence cannot be deleted or audit rewritten'; END $$;

CREATE TRIGGER "KundliGenerationConsent_no_delete" BEFORE DELETE ON public."KundliGenerationConsent"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_no_mutation_v1();

CREATE TRIGGER "KundliGenerationConsentAudit_immutable" BEFORE UPDATE OR DELETE ON public."KundliGenerationConsentAudit"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_consent_no_mutation_v1();

ALTER TABLE public."KundliGenerationRequest" ADD CONSTRAINT "fresh_check_df28c7eb282ec05e23a871aa" CHECK (length("requestKey") = 36);

ALTER TABLE public."KundliGenerationRequest" ADD CONSTRAINT "fresh_check_801e60de646f2183e35e4602" CHECK ("lang" IN ('en','hi'));

ALTER TABLE public."KundliGenerationRequest" ADD CONSTRAINT "fresh_check_d8a95b64f0c5f1ff09371dc8" CHECK ("status" IN ('RESERVED','PUBLISHED'));

ALTER TABLE public."KundliGenerationRequest" ADD CONSTRAINT "fresh_check_3f72de19dd6a4268f7ba05bf" CHECK (("status"='RESERVED' AND "savedRecordId" IS NULL) OR
         ("status"='PUBLISHED' AND "savedRecordId" IS NOT NULL));

CREATE FUNCTION public.kundli_generation_publication_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD; g RECORD;
BEGIN
  IF TG_OP='UPDATE' AND OLD."status"='PUBLISHED' THEN
    RAISE EXCEPTION 'Published request is immutable';
  END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId']) THEN
    RAISE EXCEPTION 'Reservation ownership is immutable';
  END IF;
  -- A failed/revoked worker may release its own lease without reauthorizing data access.
  IF TG_OP='UPDATE' AND NEW."status"='RESERVED' AND OLD."status"='RESERVED'
    AND (to_jsonb(NEW)-'leaseExpiresAt')=(to_jsonb(OLD)-'leaseExpiresAt')
    AND NEW."leaseExpiresAt"<=OLD."leaseExpiresAt" THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  SELECT * INTO g FROM public."KundliGenerationConsent" WHERE "id"=NEW."consentId" FOR UPDATE;
  IF c."status"<>'ACTIVE' OR c."endedAt" IS NOT NULL OR c."expiresAt"<=clock_timestamp()
    OR g."id" IS NULL OR g."consultationId"<>c."id" OR g."astrologerUserId"<>NEW."actorUserId"
    OR g."customerUserId"<>c."userId" OR g."astrologerUserId"<>c."astrologerId"
    OR g."revokedAt" IS NOT NULL OR g."expiresAt"<=clock_timestamp() THEN
    RAISE EXCEPTION 'Current consultation-bound customer consent required';
  END IF;
  IF NEW."leaseExpiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Reservation lease expired'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."Subscription" s JOIN public."SubscriptionPlan" p ON p."id"=s."subscriptionPlanId"
      JOIN public."Astrologer" a ON a."userId"=s."userId"
      JOIN public."User" u ON u."id"=s."userId"
    WHERE s."userId"=NEW."actorUserId" AND s."subscriptionStatus"='ACTIVE'
      AND s."amount"=3500 AND s."currency"='INR' AND s."startDate"<=clock_timestamp() AND s."endDate">clock_timestamp()
      AND p."name"='ASTROLOGER_KUNDLI_YEARLY' AND p."price"=3500 AND p."currency"='INR' AND p."durationDays"=365 AND p."isActive"
      AND a."isApproved" AND a."isVerified" AND u."isActive" AND NOT u."isBlocked"
  ) THEN RAISE EXCEPTION 'Current professional entitlement required'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "KundliGenerationRequest_publication" BEFORE INSERT OR UPDATE ON public."KundliGenerationRequest"
  FOR EACH ROW EXECUTE FUNCTION public.kundli_generation_publication_v1();

-- Source: 20261025120000_fix_kundli_consent_utc_boundaries SHA256 84149cf03cdba3504063587f5160d5138694d946dae65ed8336981d1019f5b9e

CREATE OR REPLACE FUNCTION public.kundli_consent_guard_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'revokedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'revokedAt')
      OR OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN
      RAISE EXCEPTION 'Consent evidence is immutable except first revocation';
    END IF;
    NEW."revokedAt" := clock_timestamp();
    RETURN NEW;
  END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  IF NOT FOUND OR c."userId" <> NEW."customerUserId" OR c."astrologerId" <> NEW."astrologerUserId"
    OR c."status" <> 'ACTIVE' OR c."endedAt" IS NOT NULL OR (c."expiresAt" AT TIME ZONE 'UTC') <= clock_timestamp() THEN
    RAISE EXCEPTION 'Authorized active consultation required';
  END IF;
  NEW."grantedAt" := clock_timestamp();
  IF NEW."expiresAt" > (c."expiresAt" AT TIME ZONE 'UTC') OR NEW."expiresAt" <= NEW."grantedAt" OR NEW."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid consent period';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kundli_generation_publication_v1() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE c RECORD; g RECORD;
BEGIN
  IF TG_OP='UPDATE' AND OLD."status"='PUBLISHED' THEN
    RAISE EXCEPTION 'Published request is immutable';
  END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','leaseToken','leaseExpiresAt','savedRecordId']) THEN
    RAISE EXCEPTION 'Reservation ownership is immutable';
  END IF;
  -- A failed/revoked worker may release its own lease without reauthorizing data access.
  IF TG_OP='UPDATE' AND NEW."status"='RESERVED' AND OLD."status"='RESERVED'
    AND (to_jsonb(NEW)-'leaseExpiresAt')=(to_jsonb(OLD)-'leaseExpiresAt')
    AND NEW."leaseExpiresAt"<=OLD."leaseExpiresAt" THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public."CallSession" WHERE "id"=NEW."consultationId" FOR UPDATE;
  SELECT * INTO g FROM public."KundliGenerationConsent" WHERE "id"=NEW."consentId" FOR UPDATE;
  IF c."status"<>'ACTIVE' OR c."endedAt" IS NOT NULL OR (c."expiresAt" AT TIME ZONE 'UTC')<=clock_timestamp()
    OR g."id" IS NULL OR g."consultationId"<>c."id" OR g."astrologerUserId"<>NEW."actorUserId"
    OR g."customerUserId"<>c."userId" OR g."astrologerUserId"<>c."astrologerId"
    OR g."revokedAt" IS NOT NULL OR g."expiresAt"<=clock_timestamp() THEN
    RAISE EXCEPTION 'Current consultation-bound customer consent required';
  END IF;
  IF NEW."leaseExpiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Reservation lease expired'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."Subscription" s JOIN public."SubscriptionPlan" p ON p."id"=s."subscriptionPlanId"
      JOIN public."Astrologer" a ON a."userId"=s."userId"
      JOIN public."User" u ON u."id"=s."userId"
    WHERE s."userId"=NEW."actorUserId" AND s."subscriptionStatus"='ACTIVE'
      AND s."amount"=3500 AND s."currency"='INR' AND (s."startDate" AT TIME ZONE 'UTC')<=clock_timestamp() AND (s."endDate" AT TIME ZONE 'UTC')>clock_timestamp()
      AND p."name"='ASTROLOGER_KUNDLI_YEARLY' AND p."price"=3500 AND p."currency"='INR' AND p."durationDays"=365 AND p."isActive"
      AND a."isApproved" AND a."isVerified" AND u."isActive" AND NOT u."isBlocked"
  ) THEN RAISE EXCEPTION 'Current professional entitlement required'; END IF;
  RETURN NEW;
END $$;

-- Source: 20261025180000_payment_operational_workflows SHA256 58030b31ad795f88ea89406a7697d1251a1b61d802ccf02ea0c512b2dc2a9534

ALTER TABLE public."PaymentCreationCommand" ADD CONSTRAINT "fresh_check_dc6f99e554b151d3d7019428" CHECK ("providerMode" IN ('TEST','LIVE'));

ALTER TABLE public."PaymentCreationCommand" ADD CONSTRAINT "fresh_check_26a9921b0e68a0d103b2e4e5" CHECK ("amountMinor">0 AND "amountMinor"<=9007199254740991);

ALTER TABLE public."PaymentCreationCommand" ADD CONSTRAINT "fresh_check_13ec94b3e7bc826d56be6cf4" CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public."PaymentCreationCommand" ADD CONSTRAINT "fresh_check_1e1f5f9e5960a07b7f98332e" CHECK (state IN ('SUBMITTING','UNKNOWN','READY','COMPLETE'));

CREATE UNIQUE INDEX "PaymentCreationCommand_active_scope_key" ON "PaymentCreationCommand"("scopeKey") WHERE state<>'COMPLETE';

ALTER TABLE public."AdminFinanceAction" ADD CONSTRAINT "fresh_check_68d4ed67ee8c241c288c41bb" CHECK (action IN ('RECONCILE','REFUND_RECONCILE','REFUND_SUBMIT'));

ALTER TABLE public."AdminFinanceAction" ADD CONSTRAINT "fresh_check_ee4303174c5fd9dd344ba590" CHECK ("providerMode" IN ('TEST','LIVE','UNKNOWN'));

ALTER TABLE public."AdminFinanceAction" ADD CONSTRAINT "fresh_check_69b3f3d1668833f638f5ac0d" CHECK (length(reason) BETWEEN 10 AND 500);

ALTER TABLE public."AdminFinanceAction" ADD CONSTRAINT "fresh_check_2a21b7ba34b5bbf87f3870ed" CHECK (state IN ('STARTED','SUCCEEDED','FAILED','UNKNOWN'));

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

-- Source: 20261025200000_add_commission_audit_foundation SHA256 328199143d2abf14f1ea5828bf22e8447c8da87a500d9d52f3e2aaf360afd0d2

ALTER TABLE public."ConsultationFinancialPolicy" ADD CONSTRAINT "fresh_check_3d90f2fbef458242b9f3b46e" CHECK ("platformPercent" BETWEEN 0 AND 100);

ALTER TABLE public."ConsultationFinancialPolicy" ADD CONSTRAINT "fresh_check_30c3e964c217bd26e7685393" CHECK ("lifecycle" = 'CONSULTATION_V2');

ALTER TABLE public."CommissionPolicyAudit" ADD CONSTRAINT "fresh_check_4d9b756dbb050f3373de14fa" CHECK ("previousPercent" BETWEEN 0 AND 100);

ALTER TABLE public."CommissionPolicyAudit" ADD CONSTRAINT "fresh_check_fb91170a5b8221b77caae760" CHECK ("newPercent" BETWEEN 0 AND 100);

CREATE FUNCTION public.asp_reject_financial_policy_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial policy records are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "ConsultationFinancialPolicy_immutable" BEFORE UPDATE OR DELETE ON public."ConsultationFinancialPolicy"
  FOR EACH ROW EXECUTE FUNCTION public.asp_reject_financial_policy_mutation();

CREATE TRIGGER "CommissionPolicyAudit_immutable" BEFORE UPDATE OR DELETE ON public."CommissionPolicyAudit"
  FOR EACH ROW EXECUTE FUNCTION public.asp_reject_financial_policy_mutation();

COMMIT;
