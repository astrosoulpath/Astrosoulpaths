-- REVIEW ONLY. Do not apply to an existing application database without approval.
BEGIN;
CREATE TABLE "AdminModerationSubject" (
 "kind" TEXT NOT NULL CHECK ("kind" IN ('CUSTOMER','ASTROLOGER')),
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "state" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("kind","userId"),
 CHECK (("kind"='CUSTOMER' AND "state" IN ('ACTIVE','BLOCKED')) OR ("kind"='ASTROLOGER' AND "state" IN ('UNREVIEWED','REVIEWED','APPROVED','REJECTED','SUSPENDED')))
);
CREATE TABLE "AdminModerationAudit" (
 "requestId" TEXT PRIMARY KEY,
 "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "userId" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "action" TEXT NOT NULL CHECK ("action" IN ('BLOCK','UNBLOCK','VERIFY','APPROVE','REJECT','SUSPEND')),
 "reason" TEXT NOT NULL CHECK (char_length(btrim("reason")) BETWEEN 10 AND 1000),
 "previousState" TEXT NOT NULL,
 "nextState" TEXT NOT NULL,
 "version" INTEGER NOT NULL CHECK ("version">0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("kind","userId") REFERENCES "AdminModerationSubject"("kind","userId") ON DELETE RESTRICT,
 CONSTRAINT "AdminModerationAudit_kind_userId_version_key" UNIQUE ("kind","userId","version"),
 CHECK ("actorId" <> "userId"),
 CHECK (("kind"='CUSTOMER' AND (("action"='BLOCK' AND "previousState"='ACTIVE' AND "nextState"='BLOCKED') OR ("action"='UNBLOCK' AND "previousState"='BLOCKED' AND "nextState"='ACTIVE'))) OR
 ("kind"='ASTROLOGER' AND (("action"='VERIFY' AND "previousState" IN ('UNREVIEWED','REJECTED') AND "nextState"='REVIEWED') OR ("action"='APPROVE' AND "previousState" IN ('REVIEWED','SUSPENDED') AND "nextState"='APPROVED') OR ("action"='REJECT' AND "previousState" IN ('UNREVIEWED','REVIEWED') AND "nextState"='REJECTED') OR ("action"='SUSPEND' AND "previousState"='APPROVED' AND "nextState"='SUSPENDED'))))
);
CREATE INDEX "AdminModerationAudit_kind_userId_createdAt_idx" ON "AdminModerationAudit"("kind","userId","createdAt");
CREATE FUNCTION moderation_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Moderation audit is append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER moderation_audit_immutable BEFORE UPDATE OR DELETE ON "AdminModerationAudit" FOR EACH ROW EXECUTE FUNCTION moderation_audit_append_only();
CREATE TRIGGER moderation_audit_no_truncate BEFORE TRUNCATE ON "AdminModerationAudit" FOR EACH STATEMENT EXECUTE FUNCTION moderation_audit_append_only();
REVOKE ALL ON "AdminModerationSubject", "AdminModerationAudit" FROM PUBLIC;
COMMIT;
