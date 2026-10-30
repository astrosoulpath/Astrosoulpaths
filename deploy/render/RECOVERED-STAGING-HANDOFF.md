# Recovered staging source handoff

Source branch: `integration/latest-recovery-20261030`. The exact commit and remote-verification receipt are recorded in `review/launch/FINAL-LATEST-CODE-GITHUB-PUSH.md` in the originating workspace. This branch is a source checkpoint, not a deployment or LIVE activation approval.

## Preserve environments

Do not point TEST code at an existing customer database or production Redis. Do not import historical users, wallets, payment orders or KYC files into a fresh target. Reuse verified existing Render resources only after read-only inventory; do not create duplicate services or silently convert staging to production.

Historically supplied staging backend: `astro-soul-path-backend-staging` / `srv-db3799l9fdbs73a7d2qg`, Oregon. Current service settings, deployed SHA, PostgreSQL availability, Redis, website service IDs and actual costs require operator verification. Do not rely on the old free PostgreSQL expiry/status.

## Build and start

Backend root: `backend-main`, Node 22. Use the pinned pnpm version/lockfile. Build with frozen install, Prisma client generation and `pnpm run build`; start with `pnpm run start:prod`; health path `/health`. Never add blanket migrations to build/start commands.

Website/Admin root: `website`; `npm ci`, `npm run build`, `npm run start -- -p $PORT`. Pin the same reviewed Git SHA for backend and website. Review Auto-Deploy, preview environments and hooks before changing any Render branch. Existing GitHub CI runs on manual dispatch/PR, not automatic production deployment from this recovery branch.

## Database and recovery

`review/payments/fresh-production-prisma/` is for a **new verified empty PostgreSQL18 target only**. The manifest pins six reviewed migrations. Git attributes preserve their exact reviewed bytes; published application migration history remains unchanged and LF-stable. Confirm file hashes before the separately approved migration step.

Use a migration-owner role separately from the runtime role. Review exact table-specific permissions and append-only audit protections. No global runtime DDL or unrelated DELETE grants. Rehearse backup/restore and record target identity before activation. Existing databases require their own additive-only migration review; never run this fresh baseline against them.

Rollback is to the previous exact application SHA/configuration with execution gates disabled. Preserve journals and uncertain provider states. Do not delete/recreate databases or rewrite financial entries to roll back a release. Restoring a backup requires explicit approval and verification.

## Secure environment configuration

Keep database URLs, Redis authentication/TLS configuration, Firebase server private credentials, Supabase server-only credentials, context-session encryption key and designated Admin mapping in approved hosting secrets only. Clients receive public Firebase configuration and the public Razorpay checkout key, never private keys.

Use source-supported Redis settings (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`, or the reviewed URL contract), backend `FRONTEND_URL`/CORS configuration and website `NEXT_PUBLIC_API_BASE_URL`. Verify exact allowed origins, HTTPS and Secure/HttpOnly/SameSite session cookies. Verify Firebase authorized domains; never deploy local Auth Emulator overrides.

Use `staging-gates.env.example` as a disabled baseline: global FCM deny, LIVE payments, refunds, automatic jobs and unfinished Kundli execution remain off. Schema flags are not permission to approve policies, send pushes or charge users. Moderation/support require schema/grant review before their write gates. The public production homepage remains gated until its separate launch/content approval.

## Payment and native checks

Razorpay secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, backend only. Start with isolated TEST keys and a separately approved HTTPS `/payments/webhook` configuration. Verify exact raw-body HMAC, event/order ownership, duplicate handling and fulfillment. Source tests and provider mocks are not genuine HTTPS delivery or merchant activation proof.

Human consultations and marketplace allocations remain 70/30. Professional Kundli remains INR3500/365 days; horoscope USD1/30 days under existing rules. Gross allocation is not gateway-fee, tax, FX or bank-settlement proof. No automatic seller payout is established by a payable ledger.

Flutter release builds require an approved public HTTPS `API_BASE_URL`; keep local define files and signing keys out of Git. Run the existing release-config guard, then separately approve Android build/device verification and Mac/Xcode/iPhone iOS verification. Do not infer native payment/FCM success from website tests.

## Verification commands

After dependency installation and backend build, run `node test/isolated-integration/pg18.cjs --full-tests` from `backend-main` using Node22, Docker and the cached `postgres:18-alpine` image. It owns a fresh tmpfs database with a nonce, rejects existing account-link targets, uses synthetic identities/fake providers, and verifies data preservation on repeat migration.

Run website Node tests, TypeScript, lint and build. `node tool/verify-anonymous-routes.cjs` uses a fresh Chrome profile, blocks browser writes/external requests and checks anonymous routes at 320/390/768/1440px. It is not authenticated Google E2E. Set `CHROME_PATH` if Chrome is not at the platform default.

Run full Flutter tests and analysis. Known unused private helpers may be reported; do not delete intended UI or rewrite golden artwork to conceal findings.

## Separate approvals still required

Verified Render service/database/Redis targets and costs; resource purchases; secret changes; new empty database migration/grants; actual deployment; genuine TEST checkout/webhook/device tests; policy/content activation; DNS; merchant LIVE activation; real charges/refunds/payouts/push. None is authorized by a GitHub source push.
