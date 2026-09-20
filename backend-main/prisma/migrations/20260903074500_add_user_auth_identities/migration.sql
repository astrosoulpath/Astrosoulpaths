CREATE TABLE "user_auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'supabase',
    "providerUserId" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_identities_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"user_auth_identities_provider_providerUserId_key"
ON "user_auth_identities"("provider", "providerUserId");

CREATE INDEX
"user_auth_identities_userId_idx"
ON "user_auth_identities"("userId");

CREATE INDEX
"user_auth_identities_email_idx"
ON "user_auth_identities"("email");

CREATE INDEX
"user_auth_identities_phone_idx"
ON "user_auth_identities"("phone");

ALTER TABLE "user_auth_identities"
ADD CONSTRAINT "user_auth_identities_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;