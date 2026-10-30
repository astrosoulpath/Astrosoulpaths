-- REVIEW ONLY. Target must be pinned isolated PostgreSQL16432/asp_payment_operations_a3f6cdbf8d86.
-- Never run against original DB. Runner must check baseline/fingerprints and backup first.
BEGIN;
LOCK TABLE app_languages IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO app_languages(id,code,"englishName","nativeName","imageUrl","isActive","sortOrder","createdAt","updatedAt") VALUES('asp-test-language-en','en','English','English',NULL,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(code) DO NOTHING;
INSERT INTO app_languages(id,code,"englishName","nativeName","imageUrl","isActive","sortOrder","createdAt","updatedAt") VALUES('asp-test-language-hi','hi','Hindi','हिन्दी',NULL,true,2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(code) DO NOTHING;
-- Verify exactly two reviewed codes/labels; no conflicting existing rows or other-table changes.
COMMIT;
