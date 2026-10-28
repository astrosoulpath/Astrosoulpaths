# Step 3 — local Razorpay release

**PARTIAL; LIVE NO-GO; verified milestone remains 50%.** Parent release `44d4339178642b935fa3f1b239df297a4a9e21dd`, branch `integration/latest-approved-20261028`. The immutable resulting SHA is recorded separately after commit creation. No push, deployment, database creation/connection/migration, financial change, APK replacement, device registration or LIVE activation is authorized/performed here.

## Release scope

The parent retains the integrated Flutter Android/iOS, website/Admin and backend implementation. This continuation changes only four payment source/test files, the payment CI workflow, and reviewed readiness documents/package. It does not stage the entire existing checkout. Current checkout is on `auth/firebase-google-linking`; a separate index and compare-and-swap branch update preserve that checkout, its index, unrelated edits and untracked files while creating a commit on the requested integration branch.

- Production-runtime and LIVE order creation require both durable schema/command gates; missing prerequisites fail before provider creation/storage. Supplying a preclaimed command cannot bypass validation.
- LIVE creation additionally requires `RAZORPAY_LIVE_PAYMENTS_ENABLED=true` and nonempty `RAZORPAY_WEBHOOK_SECRET`. This checks configuration presence, not genuine webhook delivery. Existing SDK key/secret validation still applies. Recovery/refund paths are not unnecessarily disabled by this creation-specific check.
- Local nonproduction TEST compatibility remains; it is not an operational production/LIVE fallback. Existing LIVE SDK disabling also affects provider reconciliation; a future incident-pause procedure must account for this.
- CI now includes creation-gate and service regressions.
- Authenticated `/payments/checkout-config` exists in the parent controller/module and returns public key ID/mode only. Staging 404 is a deployed-contract gap; no duplicate route or auth bypass was introduced. Exact deployed SHA/build selection remains inaccessible. Deploy the complete reviewed source with verified commands to resolve it, then check unauthenticated rejection and authenticated 200.

## Executed verification

| Check | Evidence |
|---|---|
| Backend payment/security/refund/Admin | **177 tests,13 suites passed** |
| Website payment contracts | **49 passed** |
| Flutter proof/recovery/account isolation | **31 passed** |
| Backend TypeScript | **PASS**, noEmit |
| Website TypeScript | **PASS**, noEmit |
| Node22 backend production compilation | **PASS**, private output config |
| Prisma fresh-kit validation | **PASS**, CLI validation only; no DB connection |
| Schema + four fresh migration checksum pins | **PASS** |

Tests are synthetic/mocked, not native SDK/provider or real database E2E. They cover server-owned order/payment binding; amount/currency mismatch; checkout HMAC; webhook raw-byte HMAC, invalid/missing signatures and signed-payload parsing; duplicate wallet fulfillment; TEST/LIVE boundaries; pending/reconciliation recovery; subscription recovery; refund reservations/idempotency/permissions. Order-level transactions/unique references protect financial effects in fixtures. There is no universal event-ID replay inbox; duplicate-event acceptance does not imply duplicate financial credit. No fabricated event is described as genuine HTTPS delivery.

Fresh website production build and scoped Flutter analysis outcomes are recorded in the post-commit execution receipt. Initial isolated build failed because sandbox access to Google Fonts was denied; an approved-network isolated retry was requested. No running website build output was overwritten. No Android APK build or iOS build/device checkout is claimed. Native Android/iOS use existing Flutter Razorpay integration; iOS requires Mac/Xcode, signing, physical-device app-switch/UPI and callback verification. User-facing payment methods require merchant capability evidence, not URL schemes alone.

## Environment / merchant boundary

Required private backend names: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; LIVE approval `RAZORPAY_LIVE_PAYMENTS_ENABLED`; durable gates `PAYMENT_CREATION_SCHEMA_READY`, `PAYMENT_CREATION_COMMANDS_ENABLED`. Refunds additionally require separately approved schema/policy/execution and SDK refund gates documented in the Step 2 package. Keep LIVE/refunds and notification generation/delivery off during initial TEST deployment. Frontend/mobile receive only a public checkout key and server-owned order; never API/webhook secrets.

Effective Render environment presence, matching provider keypair, isolated DB/Redis and deployed SHA remain UNVERIFIED. Previously observed staging public config TEST prefix is not proof of private secret correctness. No credentials are displayed or requested. Merchant LIVE activation **BLOCKED by missing authorized Dashboard access**: operator must sign in normally, select LIVE, inspect activation/KYC, approved website/app, settlement bank, enabled payment methods and API-key availability. Report statuses only; do not share/generate/regenerate keys in chat. International/USD acceptance and Google Pay/PhonePe require explicit merchant/device evidence.

## Fresh PostgreSQL18 / deployment checklist

Use `STEP2-FRESH-POSTGRES18-TEST-PACKAGE.review.json` as an inert planning input. Its parent SHA must be replaced by the resulting complete release SHA during the approval review; it is not executable authorization. Never use the expiring staging database as LIVE or import old users/wallets/orders. Full auth/profile/runtime grants and Prisma migration-history registration still need verification; finance-only grants are not full application permissions.

After separate exact-target/cost approval: create a fresh empty PG18 target and isolated Redis; verify identities and empty financial state, preserve owner/runtime role separation, approve all four pinned fresh migrations/grants, take a protected baseline backup and verify archive/checksum plus restore into an approved disposable recovery target. Validate indexes/constraints/triggers and new-account zero wallet/no historical orders. No blanket historical migration deploy, broad seed or original database write.

Proposed Node22 backend settings, repository root:

```text
Build: cd backend-main && corepack pnpm@11.25.0 install --frozen-lockfile --prod=false && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build
Start: cd backend-main && corepack pnpm@11.25.0 run start:prod
Pre-deploy: blank
Health: /health
Auto-deploy: Off
```

Website root `website`: `npm ci && npm run build -- --webpack`; start `npm run start -- --hostname 0.0.0.0 --port $PORT`; configure only the approved HTTPS `NEXT_PUBLIC_API_BASE_URL` and public Firebase configuration. Keep backend auth/session/payment secrets backend-only. Verify CORS origins, Firebase authorized domains and platform signing registrations without changing production Console here.

After SHA/branch approval only, exact push template (resolve the receipt's SHA first; do not push a mutable branch implicitly):

```powershell
git -c push.followTags=false push --no-follow-tags origin <RECEIPT_SHA>:refs/heads/integration/latest-approved-20261028
git ls-remote origin refs/heads/integration/latest-approved-20261028
```

Then separately approve Render **Manual Deploy > Deploy a specific commit**, matching that exact SHA and verified TEST service. No resource IDs/costs are invented. Preserve existing staging/production resources. Before deploying verify secret absence scan, TEST-only keypair, fresh target, grants and durable gates. Backend health alone is insufficient.

Verify `/health`, authenticated checkout config, customer ownership, explicit no-paid-fallback behavior and server-confirmed fulfillment. After additional provider configuration/transaction approval, register TEST webhook `POST /payments/webhook` on the verified HTTPS service for `payment.captured`, `payment.failed`, `order.paid`. Use one designated disposable TEST order (not the original INR100 or refunded INR3500), verify genuine Razorpay delivery signature/status, one ledger effect and duplicate delivery without extra credit. Failed/cancelled/pending outcomes must not auto-retry uncertain provider operations. Refunds require explicit designated transaction/accounting scope.

Rollback: record actual prior deployed SHA/config/schema compatibility and protected backup/restore evidence before changes. Roll back app only to the verified compatible SHA. Do not run destructive down migrations, restore over captured financial effects, rewrite history or reset wallets. Preserve all uncertain outcomes and reconcile provider records. Any restore needs its own approved recovery target. The current remote staging ref is not proof of the previous deployed SHA.

## One next action

Review the resulting local release SHA and **one target-pinned fresh TEST database + deployment approval package**, including current Render inventory/cost, complete runtime grants, private secret setup and rollback. Push, resource creation/migrations/configuration, deployment and genuine TEST transaction/webhook actions remain explicit subscopes, not implied authorization. LIVE production and a real-money test follow only after those prerequisites and merchant approval. Original wallet INR2010.25 and all24 historical pending orders were not accessed or modified.
