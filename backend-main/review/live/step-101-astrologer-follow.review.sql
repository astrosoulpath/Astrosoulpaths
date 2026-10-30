-- REVIEWED REHEARSAL-ONLY PROPOSAL. NOT EXECUTED.
-- Append after the immutable 100-step replay. No IF NOT EXISTS: fail on drift.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public;

DO $$
BEGIN
  IF current_database() IS DISTINCT FROM 'asp_live_v2_rehearsal_20261014_01'
     OR inet_server_addr() IS DISTINCT FROM inet '127.0.0.1'
     OR inet_server_port() IS DISTINCT FROM 5432
     OR current_user IS DISTINCT FROM 'postgres'
  THEN
    RAISE EXCEPTION 'Approved rehearsal identity required';
  END IF;
  IF to_regclass('public."AstrologerFollow"') IS NOT NULL THEN
    RAISE EXCEPTION 'AstrologerFollow already exists; inspect before retry';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid IN (to_regclass('public."User"'), to_regclass('public."Astrologer"'))
        AND attname = 'id' AND atttypid = 'text'::regtype
        AND attnotnull AND NOT attisdropped) <> 2
  THEN
    RAISE EXCEPTION 'Expected text parent primary-key columns required';
  END IF;
END $$;

CREATE TABLE public."AstrologerFollow" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "astrologerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AstrologerFollow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AstrologerFollow_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AstrologerFollow_astrologerId_fkey"
    FOREIGN KEY ("astrologerId") REFERENCES public."Astrologer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AstrologerFollow_followerId_idx"
  ON public."AstrologerFollow"("followerId");
CREATE INDEX "AstrologerFollow_astrologerId_idx"
  ON public."AstrologerFollow"("astrologerId");
CREATE UNIQUE INDEX "AstrologerFollow_followerId_astrologerId_key"
  ON public."AstrologerFollow"("followerId", "astrologerId");

COMMIT;
