# Step 5 — final Render resource verification

**PARTIAL. Resource identity and actual quote remain unverified; purchase/deployment NO-GO.** No purchase, resource/configuration/database change, push, deployment, LIVE activation or transaction occurred. Unchanged code tests were not repeated.

## Release and available access

Local integration ref still equals `a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1`. Step 3's nine-file release, credential-pattern scan and preserved checkout/index evidence remain applicable. No source changed in this step.

No authenticated Render inventory or Razorpay/browser tool is exposed in this session. Therefore exact current deployments, inherited environment values, database expiry and account billing cannot be verified. No service identities are inferred from public health or Git branch names.

| Resource | Recorded evidence | What remains unverified |
|---|---|---|
| Staging backend | `astro-soul-path-backend-staging`, `srv-db3799l9fdbs73a7d2qg`, Oregon | Current deployed SHA, plan, commands, branch and env groups |
| Old staging database | `astro-soul-path-db-staging`, `dpg-datmq8favr4c73e64m4g-a`, PG18, Oregon | Current status/expiry; recorded expiry29October2026 |
| Website/Admin | No service ID available | Whether an existing compatible TEST service can be reused |
| Render Redis | No service ID available | Existence, TEST isolation, persistence, region and cost |
| Fresh TEST targets | IDs remain null in Step4 specification | Must not create proposed duplicates before inventory |

The old staging database has historical user/wallet/payment records. Preserve it; do not initialize it, import its records into fresh TEST/production or silently repoint existing workloads. The original INR2010.25 wallet and24 UNKNOWN pending orders were not accessed.

## Plan and costs

Published prices rechecked through official Render sources; these are **not an authenticated account quote**:

| Proposed component | Plan | Monthly compute |
|---|---|---:|
| Fresh PostgreSQL18 | `0.5c-1g`,1GiBRAM | USD19 |
| Backend | `0.5c-512mb` | USD7 |
| Persistent dedicated Redis | `256mb` | USD10 |
| Next.js website + Admin | `0.5c-512mb` | USD7 |
| Total | Hobby workspace assumed | **USD43** |

Storage priceUSD0.30/GB/month; 5GB conservative allowanceUSD1.50 gives **USD44.50/month before extras**. Pricing also lists1GB included: creation-page storage quote must settle any inclusion adjustment. Existing bills, taxes, paid workspace, bandwidth/build overages, workers, external providers and object storage are additional. Pro workspace, if selected, addsUSD25/month; do not assume it is required or already active. This exceeds the historicalUSD15budget and is not a hard bill cap. [Official pricing](https://render.com/pricing).

The1GiBdatabase is a starting recommendation for about100registered/lightly-active users, not100concurrent users or a capacity guarantee. Validate pooled connections, memory/latency and workload before LIVE.512MiBbackend/website plans also need measurement. Prefer all fresh resources in Singapore if available; reuse Oregon only after isolated same-region inventory and explicit target approval. No region fallback or migration is automatic.

## Backup, migration and permission gates

- Old staging backup archive/checksum reverified in Step4:422,854bytes, SHA256 `1160353c74dd3da3ee2b1a2c9082ba17f2c1cb72c6b289abf921ed385f5ee9ed`,86tables in prior receipt. **No restore has been executed.** Do not describe archive validation as recovery proof.
- An approved disposable recovery target is needed for restore, row/schema comparison and runtime permission checks. Do not import old backup into the fresh application target. Protect private backup/password/service files outside Git.
- Schema and4fresh migration pins passed Step4 verification; no source changes since. Use `fresh-prisma-release-manifest.review.json` and the4ordered `fresh-production-prisma/migrations` files. No blanket historical replay or startup migrations.
- `phase3b-payment-runtime-grants.review.sql` is finance-only, NOLOGIN, and insufficient for the monolithic backend. **Complete auth/profile/runtime grants and Prisma history-registration rehearsal remain blockers.** Do not grant owner/globalALL to mask them. No migration approval should be considered executable until this review is complete.
- Fresh target must be empty, PG18, owner/runtime credentials separated, zero initial financial records, no old-user/wallet imports. Stop on identity/schema drift.
- Capture actual prior deployment SHA/config and compatible schema before application rollback. Use that exact deployment, not an assumed Git staging ref. No destructive down migrations, database reset or restore over captured provider effects. Unknown financial outcomes require reconciliation rather than automatic retry.

## Exact UI actions and approval order

**Read-only now:** Render projectAstroSoulPath > Services; inspect each backend/website's Settings, Deploys and Environment-group names; databaseInfo/Recovery; KeyValueInfo; Billing/current quote. Do not reveal connection strings or secret values. Check old database expiry on its actual page. In Razorpay, inspect merchant status only as below.

**After separately scoped approval, in this order:**

1. Approve exact release push. Preserve main/staging; do not force-push. Command already pinned in Step4:

```powershell
git -c push.followTags=false push --no-follow-tags origin a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1:refs/heads/integration/latest-approved-20261028
```

2. Following inventory, approve freshTEST resource names/region/plans/current quote, including recovery-test resource costs. Render **New > Postgres**: PG18,1GiBplan,5GBstorage, fresh name, no data import; **New > Key Value** only if no suitable isolated persistentTESTinstance exists. These create billable resources; no clicks performed.
3. Approve exact fresh-target migration/role/backup/restore operations only after full permission review. Do not point existing shared services at the new database yet. Verify schema/constraints/history and restricted-role auth/payment behavior.
4. Approve service-scoped private TEST environment setup. For backend/website create/reuse, note that creation or saving configuration can trigger deployment: **creation, env save and deployment must be scoped together or explicitly blocked until ready**. Avoid importing a resource-creating Blueprint. No automatic migrations or seeds.
5. After configuration/schema checks, Render **Manual Deploy > Deploy a specific commit**: select only `a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1` on the verifiedTESTservice. Pre-deploy blank, auto-deploy off. Backend commands and Node22 settings are in Step4. Deploy backend first, verify DB/Redis and route/auth health, then website using approvedHTTPSAPIorigin and CORS/Firebase session settings. Do not use “latest” or repoint sharedAdmin silently.
6. Verify health, actual deployed SHA, unauthenticated route rejection and authenticated `/payments/checkout-config`200/TEST. Fix missing approved public configuration only through a separately approved content workflow, not fabricated seed data. No device registration/customer write is implied by read-only verification.
7. Webhook registration, provider events/payments/refunds and LIVE setup are later explicit scopes. Genuine payment E2E remains reserved for the separately approved durable deployment; no repeat of originalINR100.

## Secure environment checklist

| Backend configuration | TEST deployment | Later LIVE production |
|---|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Matching TEST pair, private Render env | Matching LIVE pair, distinct approved production service |
| `RAZORPAY_WEBHOOK_SECRET` | Dedicated TEST secret matching approved Dashboard endpoint | Distinct production secret/verified HTTPS endpoint |
| `RAZORPAY_LIVE_PAYMENTS_ENABLED` | false | true only after separate activation approval |
| `PAYMENT_CREATION_SCHEMA_READY`, `PAYMENT_CREATION_COMMANDS_ENABLED` | Both required for production-runtime creation after schema/grant approval | Both required, same prerequisite |
| Refund schema/policy/execution/SDK gates | Off until separately approved | Off until policy/provider/recovery verification |
| DB,Redis,auth/session,Firebase,CORS | IsolatedTESTtargets, no original credentials | Separate production targets, no TEST data import |

Refund gates: `PRODUCT_REFUND_SCHEMA_READY`,`PRODUCT_REFUND_EXECUTION_ENABLED`,`PRODUCT_REFUND_POLICY_APPROVED`,`RAZORPAY_REFUNDS_ENABLED`; exact policy revision `RAZORPAY_REFUND_POLICY_REVISION=full-unspent-principal-and-subscription-v1`. International flags remain off pending explicit merchant capability evidence. Inventory inherited groups as well as service entries. Secrets never belong in Git, chat, Flutter defines or `NEXT_PUBLIC_*`; clients receive only public checkout keyID/mode and server-owned orders. Keep worker/notification gates disabled absent separate approval.

Code-side gates are already in the pinned release; presence does not prove matching keys or genuine HTTPSdelivery. No hardcoded keys or silent gate activation were added today.

## Merchant and one next action

**Merchant LIVE status UNVERIFIED.** No authorized Dashboard access is available. Operator: sign in normally, selectLIVE and inspect activation/KYC, approved website/app, settlement bank, enabled domestic/international methods and LIVE API-key availability. Report status/presence only, never values; do not generate/regenerate or activate anything for this check.

**ONE exact next action:** provide a non-secret Render inventory/quote record containing **backendID+deployedSHA, databaseID+expiry+plan, RedisID+region+persistence, websiteID+APIorigin, and the5GBPostgres creation-page monthly quote**. This is evidence collection, not purchase authorization. It lets the remaining exact target package be completed without inventing IDs or creating duplicates. Runtime grants and restore/history verification still must be resolved before executable migration/deployment approval.
