# Render + Razorpay release evidence

2026-10-28 — **PARTIAL; progress 50%; LIVE NO-GO.** Read-only remote checks, local tests and this report only. No push/deploy, secrets/configuration changes, database access, payment or refund.

## Verified evidence

| Item | Result |
|---|---|
| Origin | `https://github.com/astrosoulpath/Astrosoulpaths.git` |
| Remote `integration/latest-approved-20261028` | `44d4339178642b935fa3f1b239df297a4a9e21dd` — verified with `git ls-remote` |
| Remote `staging` | `72b6257a4e0f9f174df5baeaf58e594587051424` — this is NOT proof of Render's deployed SHA |
| Render `/health` | HTTP 200 |
| Render `/payments/razorpay-public-config` | HTTP 200, TEST public-key prefix; key value withheld |
| Render `/payments/checkout-config` | HTTP 404, still incompatible with the secured website contract |
| Actual Render deployed SHA | **UNVERIFIED**, authenticated service inventory unavailable |
| Effective Render secret presence / matching pair | **UNVERIFIED**, not inferred from local `.env` |
| Merchant LIVE activation | **UNVERIFIED**, no authorized merchant Dashboard tool/session available |

No Render or Razorpay inventory/browser tool is exposed in this session. Do not supply API tokens or secret values in chat. Render service page: `https://dashboard.render.com/web/srv-db3799l9fdbs73a7d2qg`. On **Deploys/Events**, open the current successful deployment and record its complete commit SHA. On **Settings**, verify linked repo, branch, root/build/start/pre-deploy and auto-deploy state. On **Environment**, include inherited environment groups in presence-only inspection. Database and Redis target identity/isolation must be separately confirmed.

## 404 diagnosis and SHA comparison

The approved `44d4339` commit itself includes `@Get('checkout-config')`, `SupabaseAuthGuard`, private/no-store response headers and public-key/mode-only output. The old staging ref differs in 30 payment/config files (1701 insertions, 102 deletions). The earlier Step 2 check explicitly observed `Cannot GET /payments/checkout-config`; today's repeat still returns 404, but its body was not available through the bounded probe. A missing route is consistent with older deployed code or an incorrect build/entrypoint. Exact cause cannot be attributed to a particular deployed commit without the service deployment record. A missing Razorpay secret would not normally remove this registered route; do not fix 404 by weakening authentication or restoring the legacy order fallback.

The Step 2 production/LIVE durable-creation guard is a **local uncommitted patch**, not included in `44d4339`. It must be reviewed and included in a subsequent immutable release before claiming the safety fix is deployed. Do not deploy the whole dirty checkout or stage all changes; hundreds of unrelated prior changes remain preserved.

## Presence-only configuration checklist

For the actual service and inherited groups, record present/absent and mode, never values:

- `RAZORPAY_KEY_ID`: TEST prefix required for this deployment.
- `RAZORPAY_KEY_SECRET`: present, privately verify it belongs to the same TEST key; public config alone cannot prove that.
- `RAZORPAY_WEBHOOK_SECRET`: present, privately match the TEST Dashboard webhook; distinct from API secret.
- `RAZORPAY_LIVE_PAYMENTS_ENABLED`: false.
- `PAYMENT_CREATION_SCHEMA_READY` and `PAYMENT_CREATION_COMMANDS_ENABLED`: both required true for production-runtime creation **only after** schema/runtime grant verification and separate activation approval. Keep creation blocked until then.
- `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `PORT`, Firebase/auth/context configuration and approved CORS origins: isolated TEST targets, no original financial credentials. `DIRECT_URL` is for approved initialization operations, not permission to migrate on startup.
- Refund policy/schema/execution gates and notification/worker gates remain separately controlled; do not enable them as part of this release.

No configuration is confirmed missing remotely: presence is inaccessible. TEST mode is observed only from the existing public config response. LIVE merchant status cannot be inferred from that.

## Exact release operations — proposed, NOT executed

The approved base release is already pushed. After approval and rechecking no unexpected remote movement, the exact non-force/idempotent push for that base is:

```powershell
git -c push.followTags=false push --no-follow-tags origin 44d4339178642b935fa3f1b239df297a4a9e21dd:refs/heads/integration/latest-approved-20261028
git ls-remote origin refs/heads/integration/latest-approved-20261028
```

This cannot publish the Step 2 patch. A new reviewed commit must be prepared using an isolated index/worktree preserving the current working tree, with an explicit source-file allowlist, secret scan, immutable SHA and separate exact-branch push approval. No such SHA is invented here. Never merge into `staging` or force push as a shortcut.

After exact target/isolation/schema/grants/cost/environment approvals, use Render **Deploys > Manual Deploy > Deploy a specific commit** with the separately approved complete SHA, not “latest commit.” Render supports selecting a commit from the linked repository and disables automatic deployment when doing so. [Official deployment instructions](https://render.com/docs/deploys).

Proposed backend settings (repository root, keeping review migration kit accessible):

```text
Build: cd backend-main && corepack pnpm@11.25.0 install --frozen-lockfile --prod=false && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build
Start: cd backend-main && corepack pnpm@11.25.0 run start:prod
Node: 22.23.4
Health: /health
Pre-deploy: blank
Auto-deploy: Off
```

These are reviewed proposed settings, not confirmed current settings. Do not apply `backend-main/render.yaml` as a Blueprint: its resource definitions could create infrastructure. No blanket Prisma deployment or seeding in build/start. Fresh PostgreSQL18 package and checksum pins remain in `STEP2-FRESH-POSTGRES18-TEST-PACKAGE.review.json`; full runtime grants and Prisma history verification remain blockers. No existing database may be initialized using that package.

Rollback: capture the actual previously deployed SHA and effective configuration before release; it is currently unknown. After approval, select that exact schema-compatible SHA using the same specific-commit deployment control. Do not substitute `72b6257` merely because it is the Git staging ref. Do not downgrade schemas, reset wallets, restore over provider-confirmed effects or auto-retry uncertain outcomes. Preserve TEST ledger/provider records for reconciliation. App rollback does not roll back environment changes; record those separately. No executable exact rollback SHA can truthfully be supplied until inventory is obtained.

## Merchant verification and HTTPS webhook gate

Operator action: sign in normally to Razorpay Dashboard, select LIVE, inspect activation/KYC, approved website/app, bank/settlement status and enabled domestic/international payment methods. Under **Account & Settings > Website and app settings > API Keys**, report only LIVE key availability and mode; do not generate/regenerate keys or share secret values in this step. Razorpay documents the mode-specific API-key page and website prerequisites. [Official API-key instructions](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/).

After separately approved isolated deployment/configuration, verify authenticated checkout-config returns 200 with TEST mode and unauthenticated access is rejected. Existing webhook path: `https://astro-soul-path-backend-staging.onrender.com/payments/webhook`; its suitability for fresh isolated TEST data must first be proven. Do not register/change it today. Future approved TEST event subscriptions: `payment.captured`, `payment.failed`, `order.paid`. Genuine provider delivery must show signed-byte verification and exactly one isolated ledger effect; duplicate delivery must not add another credit. No original INR100 repeat and no locally fabricated event counted as provider delivery.

## Final tests and next approval

**99 tests passed across 7 backend suites** this continuation: service/controller, checkout proof, captured-order binding, webhook verification, durable creation and TEST/LIVE configuration. Log: ignored `backend-main/.local-backups/release-evidence-payment-tests-20261028.log`. The expected missing-webhook-secret error is a negative-test fixture, not evidence about Render. Synthetic/mocked tests made no provider/database calls. Step 2's 176 backend,49 website,31 Flutter passes and Node22 build remain prior evidence, not rerun claims here.

**Next required action is access/evidence, not deployment:** supply the complete current Render deployed SHA plus non-secret settings/presence/isolation results from the pages above, and merchant activation status. Then approve a complete patch release SHA/branch and a target-pinned TEST deployment package. Secret configuration, fresh database initialization/grants, hosting costs, webhook changes and a disposable TEST transaction each require their explicit scope. No LIVE configuration or real-money test is approved.

Original INR2010.25 wallet, 24 historical UNKNOWN pending orders, customer session and APK were not touched. Overall **PARTIAL; genuine HTTPS delivery and LIVE readiness remain unverified**.
