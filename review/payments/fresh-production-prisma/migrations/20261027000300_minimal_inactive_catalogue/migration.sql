-- Reviewed configuration only. No users, wallets, orders, entitlements or identity mappings.
-- Execute only on a separately approved fresh target after schema/protections.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "User") OR EXISTS(SELECT 1 FROM wallets) OR EXISTS(SELECT 1 FROM payment_orders) OR EXISTS(SELECT 1 FROM "Subscription")
 THEN RAISE EXCEPTION 'Fresh empty application database required'; END IF;
END $$;
INSERT INTO "Role"(id,name,"updatedAt") VALUES
 ('asp-role-customer','CUSTOMER',now()),('asp-role-astrologer','ASTROLOGER',now()),('asp-role-admin','ADMIN',now())
 ON CONFLICT(name) DO NOTHING;
-- FREE values match the already verified canonical catalogue contract; no paid features.
INSERT INTO "SubscriptionPlan"(id,name,"displayName",price,currency,"durationDays",features,"isActive","isFeatured","updatedAt") VALUES
 ('asp-plan-free','FREE','Free Plan',0,'INR',3650,'{"liveChat":false,"chatLimitPerDay":3,"basicAstrologyTools":true,"personalizedPredictions":false}',true,false,now()),
 ('asp-plan-kundli','ASTROLOGER_KUNDLI_YEARLY','Professional Kundli',3500,'INR',365,NULL,false,false,now()),
 ('asp-plan-horoscope','DAILY_HOROSCOPE_MONTHLY','Personalized Daily Horoscope',1,'USD',30,NULL,false,false,now())
 ON CONFLICT(name) DO NOTHING;
INSERT INTO app_languages(id,code,"englishName","nativeName","isActive","sortOrder","updatedAt") VALUES
 ('asp-language-en','en','English','English',true,1,now()),('asp-language-hi','hi','Hindi','हिन्दी',true,2,now())
 ON CONFLICT(code) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM "SubscriptionPlan" WHERE
  (name='FREE' AND price=0 AND currency='INR' AND "durationDays"=3650 AND "isActive" AND features->>'liveChat'='false' AND features->>'personalizedPredictions'='false') OR
  (name='ASTROLOGER_KUNDLI_YEARLY' AND price=3500 AND currency='INR' AND "durationDays"=365 AND NOT "isActive") OR
  (name='DAILY_HOROSCOPE_MONTHLY' AND price=1 AND currency='USD' AND "durationDays"=30 AND NOT "isActive"))<>3
 THEN RAISE EXCEPTION 'Canonical catalogue drift; do not overwrite'; END IF;
 IF (SELECT count(*) FROM app_languages WHERE (code='en' AND "nativeName"='English' AND "isActive") OR (code='hi' AND "nativeName"='हिन्दी' AND "isActive"))<>2
 THEN RAISE EXCEPTION 'Language catalogue drift; do not overwrite'; END IF;
END $$;
COMMIT;
