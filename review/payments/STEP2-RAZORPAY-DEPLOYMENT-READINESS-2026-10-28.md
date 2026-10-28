# Step 2 — Razorpay deployment readiness

Date: 2026-10-28. **Overall PARTIAL; LIVE NO-GO.** Base release: `44d4339178642b935fa3f1b239df297a4a9e21dd`. This continuation adds uncommitted local fixes; that SHA does not include them. Existing worktree changes were preserved. No push, deployment, service restart, database connection/mutation, payment, refund, device registration or emulator change was performed.

## Actual staging and access evidence

- Existing HTTPS backend `/health`: HTTP 200 on final bounded read-only check. Earlier checks timed out; health is not proof of deployment identity or sustained availability.
- `/payments/checkout-config`: HTTP 404 with `Cannot GET /payments/checkout-config`. The authenticated controller route exists locally. This is a deployed API compatibility gap, not evidence to remove authentication or use the legacy public configuration route as a substitute.
- `/app-config/public`: HTTP 404; final error detail unavailable. The local route/module exists. Local service also deliberately returns 404 when approved active `PUBLIC_APP_CONFIG` is absent. Missing route versus absent approved data remains unconfirmed; do not invent content or seed records to hide it.
- Read-only connector discovery found Render available but not installed in this session; no workspace inventory or private environment tools were accessible. Actual deployed SHA, effective environment presence, database identity/isolation and Redis configuration remain UNVERIFIED. Known historical target: `astro-soul-path-backend-staging`, `srv-db3799l9fdbs73a7d2qg`, Oregon. Do not silently repurpose it as production.
- Operator evidence required: Render service **Events/Deploys** exact deployed SHA, **Settings** repository/branch/build/start/pre-deploy/region/plan; **Environment** presence-only confirmation; database and Key Value **Info/Connections** target identities and isolation, without sharing credentials. Compare deployed SHA with the base release and the subsequently reviewed patch commit.

## Confirmed local fix

`backend-main/src/module/payments/payment-creation-command.ts`: production or LIVE order creation now requires both `PAYMENT_CREATION_SCHEMA_READY=true` and `PAYMENT_CREATION_COMMANDS_ENABLED=true`. Missing schema with commands requested still fails closed. Local non-production TEST compatibility remains available. Existing provider reconciliation/refund paths are not intentionally disabled by this creation guard.

`backend-main/src/module/payments/payments.service.ts`: validate that gate even for a supplied pre-reserved creation command, before provider or persistence calls. This closes the shortcut around the guard. Existing staging with both gates off will intentionally refuse new orders after this patch; schema/grants/gate activation require separate verification and approval.

Regression additions in `payment-creation-command.spec.ts` and `payments.service.spec.ts` cover production TEST, LIVE, incomplete flags, preclaimed commands, and zero provider/storage calls on rejection. Before-edit copies are retained in ignored `.local-backups/step2-payment-guard-before-20261028/`.

The deployed route gap cannot be fixed remotely without deployment approval. The local checkout route returns only the configured public key and mode under authenticated, no-store handling. No duplicate API or auth bypass was added.

## Security verification

Executed suites cover checkout HMAC invalid/missing/mismatch rejection, captured payment/order binding, environment separation, duplicate fulfillment, wallet recovery, subscription recovery, refund reservation/idempotency and Admin permissions. Nest enables raw-body capture; webhook HMAC uses original bytes and timing-safe comparison with the distinct webhook secret. Signed bytes are parsed as the event. Supported payment processing includes `payment.captured`, `payment.failed`, `order.paid` with the required payment/order mapping.

Order transactions and unique provider references prevent duplicate financial effects in tested fixtures. This is not a claim of universal event replay rejection: there is no general receiver event-ID inbox. Ignored/unmatched HTTP 200 responses alone do not prove fulfillment. Checkout callback proof, provider reconciliation and genuine HTTPS webhook delivery remain distinct evidence.

Prior local presence-only audit found TEST configuration and webhook secret present, LIVE/refund activation off; this is not effective Render evidence or proof of a matching provider key pair. **Genuine provider HTTPS delivery remains UNVERIFIED.** The completed INR100 transaction was not repeated or altered; historical missing signature evidence was not backfilled.

## Fresh PostgreSQL 18 package

New inert specification: `review/payments/STEP2-FRESH-POSTGRES18-TEST-PACKAGE.review.json`. It updates the base branch/SHA and explicitly records the uncommitted patch requirement; it is not a deployable Render Blueprint or execution authorization. Existing resources may not be modified.

Schema checksum verified against `fresh-prisma-release-manifest.review.json`: `9d0dadab3a51e761f0475cb71d1118f54c43faafd3ddb25f0993164f5653dcc3`.

All four migration file checksums matched the manifest, in this order:

1. `20261027000100_fresh_model_baseline`
2. `20261027000200_fresh_sql_protections`
3. `20261027000300_minimal_inactive_catalogue`
4. `20261027000400_product_refund_reservation_guards`

No SQL was executed. Earlier isolated PostgreSQL 18.6 SQL rehearsal is historical evidence, not a new run. Prisma CLI history registration and full auth/profile/runtime grants remain release blockers; the finance-only restricted role is insufficient for the entire application. Do not use owner credentials to mask gaps. No old users, wallets or orders may be imported. Verify empty financial tables and zero-balance new-account provisioning after separately approved initialization.

Proposed build/start are retained in the JSON: Node 22, dependency install + Prisma generate + Nest build; start:prod only; pre-deploy blank, auto-deploy off, `/health`. No blanket historical migration deployment or automatic seed. Dedicated fresh PG18 and Redis targets must be verified before configuration. Current Render quote is inaccessible; the prior USD23 backend/database/Redis estimate (USD30 with separate website) is not a verified current quote and exceeds the earlier USD15 ceiling. No cost is authorized here.

Rollback: retain exact previous application SHA/config and private backup with archive/checksum and isolated restore evidence before approved target changes. Roll back only to schema-compatible code; do not run destructive down migrations, reset balances or rewrite journals. Pause new creation while preserving an explicitly verified recovery path; LIVE SDK disabling also affects reconciliation. Never automatically retry an uncertain financial outcome. Restores require a separately approved recovery target.

## Tests executed in this continuation

| Check | Actual result |
|---|---|
| Backend payment/security/Admin | **176 passed, 13 suites** |
| Website payment contracts | **49 passed** |
| Flutter payment proof/recovery | **31 passed** |
| Node22 Nest production compilation | **PASS**, exit 0; private output directory |
| Fresh schema + four migration pins | **PASS**, static checksum verification only |
| Render environment/deployed SHA | **UNVERIFIED** |
| Native checkout / real webhook / LIVE merchant | **UNVERIFIED**, not attempted |

All executed tests use isolated synthetic/mocked fixtures, not provider transactions or existing databases. Logs: `backend-main/.local-backups/step2-security-tests-20261028.log`, `step2-website-tests-20261028.log`, `step2-flutter-tests-20261028.log`, `step2-backend-build-20261028.log`. Flutter source/UI and website source were not changed; no new APK or iOS build was performed. Existing wallet INR2010.25 and 24 historical UNKNOWN pending orders were not accessed or modified in this continuation.

## Merchant status and exact approvals

**Razorpay merchant LIVE activation UNVERIFIED.** In the merchant Dashboard, select LIVE and inspect activation/KYC status, website approval, settlement-bank status and enabled payment methods. Confirm only status and whether LIVE Key ID/Secret and an environment-specific webhook secret are available; do not paste values. UPI/PhonePe/GPay, domestic cards and international/USD eligibility require merchant evidence and device verification, not SDK configuration inference.

Required configuration names: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_LIVE_PAYMENTS_ENABLED`; database/Redis/auth environment names are enumerated in the inert package. Keep LIVE false and TEST credentials isolated. Both durable creation gates need separate schema/grant verification before approval. Refund policy/schema/execution gates remain separately controlled and off. Secrets belong in approved Render environment storage, never frontend variables or Git.

Next approvals, in dependency order:

1. After obtaining the non-secret Render inventory, approve an exact reviewed commit/branch push containing this patch; no new commit SHA is claimed today.
2. Approve exact fresh TEST service/database/Redis identities, region and current total cost. Separately approve pinned initialization/grants only after full runtime-role review and target/backup checks.
3. Approve TEST-only secret configuration and exact-SHA deployment, with no automatic migrations. Recheck health, authenticated checkout route and approved app-config availability.
4. Approve Razorpay TEST webhook configuration at the verified service HTTPS `/payments/webhook` and one designated disposable TEST transaction/event. Inspect genuine provider delivery signature/response and exactly one ledger effect, then duplicate delivery without another credit. Do not repeat the original INR100 transaction.
5. Only after those checks and merchant approval, separately approve production infrastructure/LIVE configuration and a bounded real-money verification. Neither is authorized now.

**Progress remains 50%; LIVE NO-GO.** Safe local code/test work is complete for this step; actual deployment, fresh target permissions and genuine provider delivery remain approval/access boundaries.
