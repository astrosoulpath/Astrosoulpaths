# Fresh production Prisma migration kit — separate approval required

This directory contains four fresh-install migrations, not the historical109-file chain. It must never target an existing customer/staging database. No credentials, accounts, wallets, financial orders or paid entitlements are imported. Paid product catalogue rows are initially inactive. The fourth migration adds a wallet reservation bound and exactly-once principal-refund ledger index; historical migrations remain unchanged.

Before any future approved application: verify the exact new production DB identity, PostgreSQL18, private connection/TLS, runtime isolation and approved costs. Confirm no public application tables and no application records. Pin `fresh-prisma-release-manifest.review.json` and schema hashes. Preserve the existing histories unchanged; never resolve or replay old failed migrations to use this kit.

The first migration is transactional and refuses any pre-existing public application table (Prisma's own migration history table is permitted). The second adds the reviewed SQL protections; the third validates minimal FREE/roles/languages and inactive paid catalogues and refuses existing users/wallets/payments/subscriptions. No Admin identity or allowlist is seeded. Roles are definitions, not account grants.

After separate target-specific approval, run the existing pinned Prisma6 CLI from backend-main with the approved fresh target's private DATABASE_URL/DIRECT_URL supplied only to that child process:

`pnpm prisma migrate deploy --schema ../review/payments/fresh-production-prisma/schema.prisma`

This explicitly selects only this fresh-install directory. It is NOT a preDeploy/start command and must not be replaced with a blanket migration command. Do not execute from an inherited local/staging environment. Verify all four history checksums and catalogs afterward, generate the application client from backend-main/prisma/schema.prisma, apply separately reviewed least-privilege runtime grants and verify health with payment/sending gates OFF. The new product-refund schema/execution/policy gates stay OFF until separate approval and schema verification.

Current evidence: PostgreSQL18.6 synthetic SQL rehearsal, zero initial wallets/history, protected indexes/constraints/triggers, inactive catalogues and synthetic dump/restore. Prisma's own migration-history registration and production runtime grants still need verification in a separately authorized full deployment rehearsal. No existing database was contacted. Recovery uses private verified backups/forward fixes, not financial-row rollback or importing expired staging data.
