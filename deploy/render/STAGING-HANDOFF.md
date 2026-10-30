# Staging deployment handoff (no deployment authorized)

GitHub sync is a source checkpoint only. Do not create resources, deploy, change secrets/DNS, seed or migrate databases, enable paid generation, charges, refunds, payouts or push delivery as part of it.

## Existing resources: verify before any execution

User-reported identities, **not a fresh authenticated inventory**:

- Backend `astro-soul-path-backend-staging`, `srv-db3799l9fdbs73a7d2qg`, Oregon, previously tracking `staging`.
- Database `astro-soul-path-db-staging`, `dpg-datmq8favr4c73e64m4g-a`, Oregon; previously Free with October 29, 2026 expiry. Availability/isolation must be rechecked before use.
- Previously supplied backend hostname: `astro-soul-path-backend-staging.onrender.com`. Verify current ownership/health before configuration.

Do **not** apply `backend-main/render.yaml` as a Blueprint to the existing workspace. It describes differently named Singapore resources and could create duplicate paid infrastructure. Its source settings are reference only; existing Dashboard settings are not changed by this handoff.

Before later approval, record existing backend/website/Redis/database IDs, region, branch, deployed SHA, Auto-Deploy/previews/hooks, plan, storage, backup/restore status and actual monthly quote. No new resource or hosting cost is approved now. Never import original users, wallets or payment orders into a fresh TEST database.

## Backend

- Repository: `https://github.com/astrosoulpath/Astrosoulpaths.git`; select only the final reviewed integration commit.
- Root: `backend-main`; Node22 (locally verified 22.23.4), repository-pinned pnpm11.25.0.
- Build: `corepack enable && corepack pnpm@11.25.0 install --frozen-lockfile && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build`.
- Start: `corepack pnpm@11.25.0 run start:prod`.
- Health: `/health`; require HTTP200, database `up`, Redis `up`.
- Existing source binds `0.0.0.0` and Render-provided `PORT`.
- Pre-deploy: **none**. No blanket `migrate deploy`, `db push`, reset or seed. Prisma client generation does not migrate a database.

Existing migration history must be preserved. A pre-existing local deletion of a historical migration is not permission to delete its approved release copy. Fresh initialization/additive migrations require separate target-specific review and approval. New generated Prisma clients must not run against schemas missing required columns.

**Current schema blocker:** the four-migration fresh-install kit predates subscription-expiry reminders and the latest moderation fields. An offline Prisma datamodel diff confirmed this without connecting to a database. See `SOURCE-MIGRATION-INVENTORY.json` for reviewed source hashes; do not deploy this backend onto the four-migration kit alone. Compose and rehearse the exact additional reviewed migrations on a separately authorized empty target, including SQL-only protections and runtime grants, before approving deployment. A successful client build is not proof of database compatibility.

## Next.js website and Admin

- Separate Node web service, root `website`; Admin is inside the same Next application.
- Build: `npm ci && npm run build -- --webpack`.
- Start on Render Linux: `npm run start -- --hostname 0.0.0.0 --port "$PORT"`.
- Use committed `package-lock.json`, Node22, and the exact reviewed integration commit.
- Set `NEXT_PUBLIC_API_BASE_URL` to the approved HTTPS TEST backend **before build**. Browser variables are embedded and require a rebuild when changed.
- Use `website/.env.example`; never put private keys, service-role credentials or webhook secrets in `NEXT_PUBLIC_*`.
- Retained legacy recovery may require the public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; an anon/publishable key is not a service-role key. Verify database RLS and API-key restrictions separately.
- Keep demo/emulator authentication disabled on shared/deployed services. Keep `PUBLIC_WEBSITE_LAUNCH_APPROVED=false` until public content/launch scope is approved.

## Secure environment checklist (names only)

Store actual values only in approved Render secret/environment storage:

- `NODE_ENV=production`; `PORT` supplied by Render.
- `DATABASE_URL`, `DIRECT_URL`: dedicated approved TEST target; TLS and least-privilege runtime role. Migration owner is separate.
- `REDIS_URL`: dedicated approved TEST Redis, actual TLS/auth/port configuration; never production Redis.
- `CORS_ALLOWED_ORIGINS`: exact approved HTTPS origins, comma-separated; no `*`, credentials or URL paths. Existing fallback: `FRONTEND_URL`.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: backend only; verify correct client/Auth project and permissions.
- `AUTH_CONTEXT_SESSION_KEY` (64 hex characters) **or** protected absolute `AUTH_CONTEXT_SESSION_KEY_FILE`, never both; do not reuse between isolated environments.
- `ADMIN_ALLOWED_FIREBASE_UID`: privately configured designated operator; do not promote/create an Admin by broad startup seed.
- Existing Supabase compatibility variables if required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWT_AUDIENCE`; private values server-only.
- `JWT_SECRET` where required by existing modules.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: TEST only, only after configuration approval. A TEST key alone does not authorize an order/payment.
- Do not add paid AI/provider credentials merely to make unavailable features appear active.

Review `staging-gates.env.example`. Every execution/delivery gate remains disabled initially. Do not set schema readiness without verifying the exact schema and grants. No running environment is changed by these templates.

## Server-side Admin and operator-only finance

- `website/src/proxy.ts` verifies HttpOnly `asp_admin_session` with the backend before protected Admin routes; unsigned role/navigation cookies are not authority.
- Production cookie: Secure, HttpOnly, SameSite=Strict, path `/`, maximum15 minutes. Session POST/DELETE reject foreign Origin.
- Backend Admin middleware/guards require the single configured allowed Firebase UID and active canonical ADMIN mapping. `requireAdminRequest` requires request-bound verified proof, not a caller-supplied role.
- Finance mutations require that designated operator and explicit schema/operation/policy gates. Do not broaden allowlists, roles or account mappings to make tests pass.
- Validate anonymous, CUSTOMER, ASTROLOGER, forged-context and unauthorized-Admin rejection. Missing auth service/configuration must fail closed.

## Firebase, HTTPS and domains

After separate approval, add only the exact chosen staging hostname to the correct Firebase project's Authorized Domains, then verify normal Google login/callbacks with designated test accounts. No Firebase Console change is authorized today.

Use a separate staging hostname. Do not point `astrosoulpath.com` at incomplete work. Obtain actual DNS/custom-domain records from the selected existing Render service's Dashboard; do not invent records. Recheck API URL, CORS, cookies and HTTPS after hostname selection. No DNS change is authorized now.

## Later approved execution and rollback

1. Confirm reviewed SHA, resource IDs/quotes, isolation and backup/restore evidence. Keep Auto-Deploy off and review previews/hooks.
2. Approve the exact fresh initialization/additive migration on disposable data first; verify runtime grants. Do not blanket-replay history against an existing database.
3. Configure approved server secrets and disabled gates, then manually deploy the approved backend commit only. Verify health, auth rejection and sanitized logs.
4. Deploy website/Admin at the same reviewed SHA and approved API URL. Verify RBAC, CORS, cookies, responsive/read-only pages.
5. Separately approve designated-account Google login and controlled TEST webhook/device verification. No original INR100 repeat, financial mutation or LIVE activation is implied.
6. Android: use a private TEST define file based on `astro-soul-path-app/dart_defines.example.json`. Preserve installation/session unless update approval is given. iOS native/device verification requires Mac/Xcode, signing and APNs; Dart tests are not iOS certification.

The Android wrapper retains Gradle9.1.0 and uses its official portable HTTPS distribution URL. Wrapper scripts/JAR are release inputs; `android/local.properties` and private signing files are not. Debug configuration no longer requires release credentials. Release tasks require private signing configuration; do not use debug signing for a published application.

Rollback code to the last verified deployment and keep gates disabled. Preserve additive schema/audit data. Do not automatically DROP/reset/restore over an existing database; restore into a different disposable target first and obtain explicit approval.

## Parallel development

Keep feature branches and reviewed PRs separate. The integration snapshot does not replace development branches. The existing CI workflow is pull-request/manual-only and does not deploy or run production migrations. Do not merge into `main`/`staging` or create automatic preview deployments as part of this sync.
