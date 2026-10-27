# Isolated HTTPS Razorpay TEST deployment approval package

2026-10-27. Proposal only; nothing provisioned, deployed, charged or configured. Progress50%. Existing Oregon staging backend/database must remain unchanged. The expiring staging database is not the target and no existing customer/wallet/order records may be imported.

## Verified public prices and budget

| Proposed component | Published monthly compute price |
|---|---:|
| Dedicated always-on backend, 0.5c-512mb | USD7 |
| Fresh PostgreSQL18, 0.1c-256mb | USD6 |
| Dedicated persistent Redis-compatible Key Value, 256mb | USD10 |
| Core TEST stack subtotal | **USD23/month** |
| Optional isolated Next.js/Admin web service, 0.5c-512mb | USD7 additional |
| With optional website | **USD30/month** |

Prices checked on the [official Render pricing page](https://render.com/pricing) on2026-10-27. Pricing lists1GB Postgres storage included and additional storage atUSD0.30/GB/month. Example: if Dashboard offers5GB total with1GB included, compute+extra storage isUSD24.20/month (orUSD31.20 with website). This is a calculation, **not a verified workspace invoice or resource quote**. Confirm actual storage minimum, included allowance, workspace fees, tax, bandwidth/build overages, region and available plans in the create-resource review screen before approval. No account-specific pricing/access is asserted. The earlier USD15 ceiling does not cover the USD23 persistent core; do not provision under the earlier budget.

One fresh Free Postgres cannot be assumed available: Render permits only one active Free Postgres per workspace, and the existing staging DB occupies it. Free backend sleeps and free Key Value loses data on restart, so this package does not present them as durable payment-webhook infrastructure. See [Free limits](https://render.com/docs/free). Region must match across the three new TEST resources; Singapore preferred only if actually available. Oregon is the known existing staging region, not proof of a new target.

## Resource identity and isolation review

Before creating anything, inventory the existing AstroSoulPath project once to avoid duplicates. Reuse an already dedicated disposable TEST service only if its DB/Redis configuration is proven isolated. Otherwise request new TEST-scoped resources under the existing workspace; proposed labels are not existing resource IDs. Record assigned IDs, exact DB name/host/port/TLS, Node22 runtime, chosen region, full billed quote and final Git SHA.

Fresh DB: empty PostgreSQL18 only. No dump/import of old users, wallets, subscriptions or pending orders. Use the separately pinned four-migration fresh kit and verify an empty target before application. Maintain a separate migration identity and restricted runtime role; runtime must not be superuser/owner. Verify schema/catalog/index checks and grants before enabling schema gates. New wallet defaults must be0 and payment history empty. Do not use broad seed scripts. Create only approved disposable Google/Firebase test identities through normal registration; any Admin mapping needs separate exact authorization. Do not copy existing identity records silently.

Redis: dedicated TEST datastore in the same region, internal authenticated connection, no public ingress; `noeviction` for queues and paid persistence. Existing local/staging queues must not be reused. See [Render Key Value](https://render.com/docs/key-value). Verify `/health` reports DB and Redis UP before any checkout/event.

## Exact source/deployment procedure after separate approval

1. Review the final phase3 release receipt, frozen lockfiles, Node22 build/test receipts and manifest. Push only its exact approved ref/SHA; no force push or merge of unrelated working-tree changes. Verify Render automatic deployment is disabled before the push.
2. Create/verify only the approved TEST resources and quote. Keep original/staging services and DBs unchanged. No custom DNS or production hostname required.
3. Supply private TEST-scoped environment settings in Render secret controls. Do not put credentials in Git, browser code, command output or Markdown.
4. Apply only `review/payments/fresh-production-prisma`'s four pinned fresh migrations to the newly verified empty TEST DB, after explicit migration approval. Migration CLI registration/runtime grants must be verified before accepting traffic. This is a manual reviewed action, not preDeploy or startup. No historical109-chain deployment.
5. Backend root `backend-main`; Node22; build `corepack pnpm@11.25.0 install --frozen-lockfile && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build`; start `corepack pnpm@11.25.0 run start:prod`; health `/health`. No blanket migration command. Deploy the approved SHA only.
6. Obtain the **actual assigned HTTPS hostname** from the deployed service. Webhook route is `/payments/webhook`. No fresh webhook URL exists yet and none is invented here. Do not use the old staging URL as evidence of new isolation.
7. Verify non-secret effective modeTEST, correct DB identity and gates, HMAC invalid-request rejection, DB/Redis health and fresh wallet/account scope. Only then request provider Dashboard webhook registration/one bounded TEST event approval.

## Environment contracts (names only)

Private: `DATABASE_URL`, `DIRECT_URL`; existing Redis contract (`REDIS_URL` or the verified host/port/password/TLS fields); `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; `AUTH_CONTEXT_SESSION_KEY`; required existing legacy auth validation fields; `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Verify matching `rzp_test_` key+secret using provider evidence; never infer the secret mode from its name. No LIVE key may be loaded into TEST. Approved Admin UID/allowlist and CORS/frontend origin remain explicitly configured, not bypassed.

Keep `RAZORPAY_LIVE_PAYMENTS_ENABLED=false`, international/horoscope/Kundli purchase gatesOFF unless an exact TEST flow is separately approved. Payment-creation schema/command gates may be enabled only after schema verification. Product-refund gates remainOFF until policy, reservation constraint/index, runtime permissions and exact test action approval pass: `PRODUCT_REFUND_SCHEMA_READY`, `PRODUCT_REFUND_EXECUTION_ENABLED`, `PRODUCT_REFUND_POLICY_APPROVED`, `RAZORPAY_REFUNDS_ENABLED`, `RAZORPAY_REFUND_POLICY_REVISION=full-unspent-principal-and-subscription-v1`. No automatic refunds. No notification/horoscope jobs/sends, paid AI, payout workers or unrelated scheduled actions may be activated by this deployment. Verify every worker's actual default before deployment; do not assume isolation from naming alone.

## Genuine provider TEST HTTPS evidence

After separate approval, configure Razorpay Dashboard in **TEST mode**, URL from the actual service plus `/payments/webhook`, dedicated TEST webhook secret, events `payment.captured`, `order.paid`, `payment.failed`. Configure supported retry/alert behavior and access-controlled logs. General refund webhooks are not claimed implemented. Follow [Razorpay validation/test guidance](https://razorpay.com/docs/webhooks/validate-test/).

Authorize one exact disposable identity/product/maxamount and one new TEST order (not the old INR100 recharge or refunded INR3500 transaction). User uses official TEST instruments. Evidence must include provider event/delivery attempt ID, delivered HTTPS URL, HTTP acceptance, matching raw-body HMAC, mode/order/payment/owner/amount/currency, provider capture, exactly-one wallet credit or entitlement, immutable audit and Admin history. Resend that provider event once to verify idempotency without another payment. Missed callback must recover by authenticated provider reconciliation without duplicate fulfillment. A curl/local synthetic event or mocked provider is not genuine delivery. Refund requires separate exact TEST refund authorization.

## Rollback and approvals required

Rollback code to the prior compatible SHA with financial records preserved. Disable only the approved TEST initiation gates if unsafe; retain a compatible authenticated webhook/reconciliation receiver for in-flight events. UNKNOWN refunds keep holds and never auto-resubmit. Back up the new TEST DB privately before risky deployment changes; verify restoration only into another approved empty target. Never reset/drop or restore over newer financial writes. Unregister/disable the TEST webhook and stop TEST resources only after reconciling in-flight provider operations; resource deletion is not authorized here.

Required approvals: (1) exact Git SHA/ref push; (2) resource IDs/region and explicit revised budget, at leastUSD23 base plus quoted extras; (3) fresh TEST migration/runtime grants; (4) private TEST secret and auth/CORS settings; (5) exact TEST deployment SHA; (6) provider TEST webhook registration; (7) one bounded disposable TEST payment/event and optional separately scoped refund. Production creation, LIVE setup, DNS and any real-money charge are excluded.
