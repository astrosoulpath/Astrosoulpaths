# Existing Render inventory and execution review

This file authorizes no deployment, purchase, migration, secret or DNS change.

## Connection and inventory

Plugin discovery on2026-10-30 found Render available but **not installed/connected in this session**. To enable inventory, connect Render through ChatGPT Settings > Apps and choose the existing authorized workspace. Do not create a second workspace. Until that connection is verified, use the existing Render Dashboard > AstroSoulPath project and record the following non-secret fields. Do not paste connection strings, secret values, private keys, emails or UIDs into the report.

| Resource | Previously supplied identity | Current evidence needed |
| --- | --- | --- |
| Backend | `astro-soul-path-backend-staging`, `srv-db3799l9fdbs73a7d2qg`, Oregon | Overview/status, Settings repository/branch/root, deployed SHA, build/start/pre-deploy commands, health path, Auto-Deploy/previews, plan/memory and region |
| PostgreSQL | `astro-soul-path-db-staging`, `dpg-datmq8favr4c73e64m4g-a`, Oregon | Availability/expiry, PostgreSQL major, plan/storage, database isolation, access controls, backup/PITR and restore evidence; old reported Free expiry was October29 |
| Website/Admin | No verified service ID | Existing service ID/name if present; do not create a duplicate. Check root `website`, branch/SHA, build/start, domains and plan |
| Redis | No verified service ID | Existing ID/name, region, persistence, eviction policy, memory, TLS/auth and private network scope; never reuse production Redis for TEST |

Resource costs/actual monthly quote remain **UNVERIFIED** until the Dashboard confirms them. Do not apply the differently named Singapore resources in `backend-main/render.yaml` to the existing Oregon workspace.

## Target configuration to review

- Repository `https://github.com/astrosoulpath/Astrosoulpaths.git`.
- Branch `integration/staging-monorepo-20261030`; deploy only the final Phase2 report's exact reviewed SHA, not a moving branch tip.
- Backend root `backend-main`, Node22 (tested22.23.4), pnpm11.25.0. Build/start are in `STAGING-HANDOFF.md`; pre-deploy empty; health `/health` must return200 and database/Redis up.
- Website/Admin root `website`, Node22; `npm ci && npm run build -- --webpack`; start `npm run start -- --hostname 0.0.0.0 --port "$PORT"` on Render Linux. Admin is inside the same web service and remains protected server-side. Health: public `GET /login/choose` must return200 and protected Admin pages must reject unauthenticated access. Do not remove guards to make a health check pass.
- Use dedicated TEST PostgreSQL18 and Redis with exact approved IDs, no imported real users/wallets/orders. Staging and production must have separate database/Redis credentials and context-session keys. No fresh hosted database has been created by this work.
- Disable automatic deploy/preview actions before connecting any release branch. No PR, merge or Render branch setting was changed here.
- Phase2 source commits carry `[skip render]`, Render's documented native auto-deploy skip phrase. No PR is created. After connecting, verify the service Events/deploy history; external custom deploy hooks are not inventoried. A later approved manual deployment must select the exact reviewed SHA.

## Secrets and public configuration (names only)

Configure values only after separate approval, in approved hosting secret storage. Do not put private values in Git or client bundles.

- Backend: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `AUTH_CONTEXT_SESSION_KEY` **or** `AUTH_CONTEXT_SESSION_KEY_FILE`, `JWT_SECRET`, `ADMIN_ALLOWED_FIREBASE_UID`, `CORS_ALLOWED_ORIGINS` / existing `FRONTEND_URL` contract. Migration owner and application role are separate; do not run the application as a PostgreSQL superuser.
- Firebase backend: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; use the approved nonproduction project/identities. Authentication configuration does not authorize push sends.
- Firebase website public config: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- Website: `NEXT_PUBLIC_API_BASE_URL` is the exact approved HTTPS TEST backend, fixed at build time. Keep `NEXT_PUBLIC_ASP_ISOLATED_E2E=false` and `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` absent on Render. Keep `PUBLIC_WEBSITE_LAUNCH_APPROVED=false` until public-content/launch approval.
- Optional legacy public compatibility: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-side compatibility variables are listed in the main handoff; service-role/JWT secrets never become public variables.
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, **TEST only**. Merchant activation/LIVE credentials are not verified by this code audit. All payment-execution/LIVE/refund gates stay disabled in the supplied baseline; do not create an order merely to test connectivity.
- FCM deny: `FCM_SENDS_DISABLED=true`; additionally keep all smart-notification, engagement, horoscope and subscription-expiry scheduler/delivery gates disabled. Keep unfinished Kundli execution gates disabled. See `staging-gates.env.example`.

Check variable **presence/mode only** in the Dashboard. A green deployment cannot prove a matching key pair, database isolation, Firebase project ownership or provider delivery.

## Firebase, API origins and TLS

1. Select the intended TEST Firebase project; check Google provider enabled, correct client app registrations and SHA certificate fingerprints for the intended Android build. iOS needs its own bundle/signing/APNs verification on Mac/device.
2. In Firebase Authentication > Settings > Authorized domains, verify the exact staging website hostname. Do not add domains or change production OAuth settings without approval. Verify `authDomain` and callback routing for that project; no synthetic session is acceptable as proof of Google login.
3. Use HTTPS for the backend and website. CORS must list exact approved website origins, no wildcard, credentials in URLs or URL paths. Browser API configuration is baked in during the website build. Flutter release builds require an explicit public HTTPS `API_BASE_URL`; local Android debug defaults are not deployment settings.
4. Admin cookies remain HttpOnly, Secure in production and SameSite=Strict. Validate Origin on session writes and backend canonical ADMIN/allowed-UID authorization, including finance. Do not use unsigned role descriptors as authority.

## DNS and SSL (instructions only)

After separate approval, add the intended **staging** hostname under the chosen Render service's Settings > Custom Domains. Copy the exact CNAME/ALIAS/A details shown for that verified service to the domain provider. Do not invent an IP or point the production apex at incomplete staging. Check existing A/AAAA/CNAME conflicts and preserve production/MX/TXT records. Complete Render domain verification and certificate provisioning, then verify HTTPS, API origins, Firebase domains and Secure cookies. No DNS records or custom domains were changed here.

Primary references: [Render deploys and skip phrases](https://render.com/docs/deploys), [Render custom domains](https://render.com/docs/custom-domains), [Firebase Google authentication](https://firebase.google.com/docs/auth/web/google-signin).

## Approval and execution order

1. Obtain the exact resource inventory, quote, database isolation and backup/restore evidence. Keep existing resources unchanged.
2. Approve the specific hosted empty TEST database and least-privilege grants. Rehearsal success is not authorization to migrate an existing database. Apply only the six-migration fresh kit to a separately approved verified empty target; never blanket-replay historical migrations.
3. Approve secure TEST environment configuration with deny gates, then backend deployment at the pinned SHA. Verify health and negative auth before website deployment.
4. Approve website/Admin deployment at the same SHA and exact HTTPS API origin. Verify server-side RBAC, login entry pages, CORS/cookies and content; keep paid and sending features disabled.
5. Separately approve designated-account Google E2E, controlled provider webhook/payment/device verification and any domain changes. No genuine LIVE readiness is implied.

Rollback code to a recorded previously verified deployment and leave execution gates disabled. Preserve schema/audit records. Restore only into a separately approved empty recovery target first; never automatically drop/reset or overwrite a financial database.
