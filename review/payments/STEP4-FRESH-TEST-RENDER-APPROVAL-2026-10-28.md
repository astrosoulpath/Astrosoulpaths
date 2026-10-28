# Step 4 — fresh TEST database and Render approval package

**PARTIAL. Planning/code verification PASS; resource execution BLOCKED pending inventory, runtime-role review and explicit approval. LIVE NO-GO; progress50%.** No resource creation/purchase, push/deploy, database connection/migration, secret changes, transaction, refund or LIVE activation occurred. Existing work was preserved.

Release: `a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1`, local `integration/latest-approved-20261028`, parent `44d4339178642b935fa3f1b239df297a4a9e21dd`. Verified branch ref, nine-file commit allowlist, whitespace check and secured checkout-config route. No code additions are needed for the already-tested Step3 configuration guards; do not modify this pinned release silently. This new approval document is outside that immutable commit.

## Resource identity: known versus verified

No Render inventory tool is exposed in this session. No service IDs, deployed SHA, current bill or account settings can be inferred from Git refs or public health. No new connector troubleshooting was repeated.

| Resource | Recorded identity | Current verification / action |
|---|---|---|
| Existing backend | `astro-soul-path-backend-staging`, `srv-db3799l9fdbs73a7d2qg`, Oregon | Historical Free plan; deployed SHA/private settings unverified. Do not repoint/redeploy without target approval. |
| Existing database | `astro-soul-path-db-staging`, `dpg-datmq8favr4c73e64m4g-a`, Oregon, PG18 | Recorded expiry29Oct2026; current expiry/status needs Dashboard confirmation. Do not reuse for LIVE or initialize. |
| Website/Admin | No authenticated service identity available | Do not assume nonexistent or create duplicates. Inventory services first; Next.js requires a dynamic web service. |
| Redis/Key Value | No verified Render ID available | Must prove dedicated TEST instance and same-region connectivity before reuse/creation. |

Open existing project **AstroSoulPath > Services**, then service **Deploys/Settings/Environment**, database **Info/Recovery**, Key Value **Info**, and workspace **Billing**. Record IDs, region, plan/quote, deployed complete SHA, linked branch/repo, root/build/start/pre-deploy, auto-deploy, environment-group inheritance, isolated connection identities and website origin. Share statuses/IDs only, never connection strings or tokens.

Prior private read-only database inspection found16users,11wallets,8payment orders,3subscriptions in old staging; it is not an empty disposable target. This is historical evidence and was not reread today. It is not certified as the original local customer database or safe LIVE data. The original wallet INR2010.25 and24historical UNKNOWN pending orders were not queried or changed.

## Backup and expiry

Previously approved private backup completed27Oct2026. Today read-only checksum revalidation **PASS**: archive422,854bytes, SHA256 `1160353c74dd3da3ee2b1a2c9082ba17f2c1cb72c6b289abf921ed385f5ee9ed`, matching receipt `render-staging-private-backup-receipt.json` (86tables). No permissions were changed. Private archive remains outside Git; no backup upload performed.

**Restore readiness PARTIAL:** receipt explicitly says `restoreExecuted:false`. Archive integrity is not restore/data-equivalence proof. Do not import it into the fresh deployment; it contains old records. Any restore rehearsal needs a separately approved isolated recovery database and private credentials. Render documents Free database expiry and no Free recovery support; paid PITR is3days on Hobby /7days on Pro+. [Free limits](https://render.com/docs/free), [backup/recovery](https://render.com/docs/postgresql-backups).

## Proposed durable plan and cost

Recommendation for roughly100 **registered/lightly active** users: paid PostgreSQL18 `0.5c-1g` (legacyBasic-1gb),1GiBRAM, initially5GBdisk, no storage autoscaling until approved. This is an engineering starting point, not a100-concurrent-user capacity guarantee. Pool a bounded number of DB connections, reserve maintenance headroom and load-test before LIVE. Do not allocate one database connection per user.

| Proposed item | Plan | Published monthly compute |
|---|---|---:|
| Fresh TEST PostgreSQL18 | `0.5c-1g`,1GiBRAM | USD19 |
| TEST backend | `0.5c-512mb`,512MiB | USD7 |
| Dedicated persistent TEST Key Value | `256mb`, noeviction | USD10 |
| TEST Next.js website/Admin | `0.5c-512mb`,512MiB | USD7 |
| Base total | Hobby workspace compute | **USD43** |

Budget **up toUSD44.50/month** for those four services plus5GBPostgres storage at publishedUSD0.30/GB; confirm whether the quoted1GB inclusion reduces the storage line. This is published-rate arithmetic, **not an authenticated workspace quote or spending cap**. Optional Pro workspace addsUSD25/month; bandwidth/build overages,taxes,object storage,external APIs and extra workers excluded. Existing paid services continue to add to the bill. The previousUSD15ceiling is insufficient. [Official pricing](https://render.com/pricing), [storage billing](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses).

Cheaper durable TEST floor:256MiBPostgresUSD6 +backend7+Redis10 =USD23 compute, orUSD30 including website, plus storage/extras; it provides less database headroom and is not my100-user launch recommendation. 512MiBbackend/website also require measured memory/latency checks. If either needs2GiB atUSD25, addUSD18 per upgraded service; both upgraded givesUSD80.50 conservative storage-inclusive budget. No performance/HA/SLA claim. Free Redis is not durable queue storage. [Compute plans](https://render.com/docs/compute-plans), [Key Value](https://render.com/docs/key-value).

Region choice is conditional: reuse a verified isolated same-region backend/Redis where safe; otherwise propose all fresh TEST resources in Singapore if available, with fallback separately approved. Existing Oregon resources are not silently migrated. Proposed names are labels only: `asp-razorpay-durable-test-backend`, `asp-razorpay-durable-test-db`, `asp-razorpay-durable-test-redis`, `asp-razorpay-durable-test-web`. **No target IDs exist in this package**; replace proposals only after inventory prevents duplicates. Disable public DB/Redis access by default, automatic deploy and automatic storage growth. Dedicated TEST auth/session settings, never production credentials.

## Migrations, permissions and recovery: execution prerequisites

Today schema SHA256 matches manifest: `9d0dadab3a51e761f0475cb71d1118f54c43faafd3ddb25f0993164f5653dcc3`. All four actual SQL pins match `fresh-prisma-release-manifest.review.json`, in order:

1. `20261027000100_fresh_model_baseline`
2. `20261027000200_fresh_sql_protections`
3. `20261027000300_minimal_inactive_catalogue`
4. `20261027000400_product_refund_reservation_guards`

Earlier isolated SQL rehearsal and Step3 Prisma validation remain prior evidence; not repeated against any database today. No old users/wallets/orders import. Catalogue paid plans remain inactive until approved configuration. Confirm empty financial state and legitimate new accounts starting at zero.

`phase3b-payment-runtime-grants.review.sql` is explicitly **finance-only**,NOLOGIN and not the complete monolithic runtime role. It omits required auth/profile/bootstrap capabilities and must not be applied as a full production permission plan. Full role review, non-owner LOGIN membership/private credential provisioning, required auth/profile and trigger behavior, schemaCREATE/audit mutation restrictions, and Prisma history registration are unresolved. Do not grant globalALL/owner privileges to make checks pass. This prevents unconditional migration/deployment GO.

Conditional operator command templates, **not executed/approved**, using a private libpq service file and password file outside Git rather than URL/credentials in command lines:

```text
psql -X --set=ON_ERROR_STOP=1 --dbname=service=asp_fresh_test_owner --command="SELECT current_database(),inet_server_addr(),inet_server_port(),version();"
pg_dump --dbname=service=asp_fresh_test_owner --format=custom --file=<PRIVATE_BASELINE_ARCHIVE>
pg_restore --list <PRIVATE_BASELINE_ARCHIVE>
```

Before any SQL, pin resourceID/host/database/role/PG18 and prove target empty; stop on drift. For each of the four reviewed files, after exact-target approval:

```text
psql -X --set=ON_ERROR_STOP=1 --dbname=service=asp_fresh_test_owner --file=review/payments/fresh-production-prisma/migrations/<APPROVED_MIGRATION>/migration.sql
```

Stop on first failure; do not automatically run remaining files or recreate the database. Each SQL file has its reviewed transaction boundaries; the chain is not one global atomic transaction. Prisma history must then be established through the separately rehearsed/approved procedure, not invented markers. No blanket historical `migrate deploy`, no automatic seed/build/start migration.

Recovery verification template for an **approved new empty recovery target only**:

```text
pg_restore --exit-on-error --no-owner --no-privileges --dbname=service=asp_approved_recovery <PRIVATE_ARCHIVE>
```

No `--clean`/drop, restore over existing financial records, destructive down migration or automatic unknown-payment retry. Verify row/schema fingerprints and independently restore required role grants, because the template excludes ownership/privileges. Record actual previous deployed SHA/config before app rollback; select that exact compatible SHA, not a guessed remote staging ref. Preserve provider/ledger outcomes and reconcile before resuming. Recovery may incur additional resource cost and requires approval.

## TEST setup and secure LIVE checklist

The release already enforces durable production/LIVE creation, LIVE approval, nonempty webhook configuration, authenticated order ownership, signed callback verification and server-side fulfillment. No secret/frontend success shortcut was added here. Existing security tests are recorded in Step3:177backend,49website,31Flutter; Node22backend/Nextbuild and scoped Flutter analysis passed. Not rerun because no executable code changed today. Genuine HTTPS/native/LIVE E2E remains UNVERIFIED.

For initial TEST deployment privately set `RAZORPAY_KEY_ID` and matching`RAZORPAY_KEY_SECRET` from **TEST**; separateTEST`RAZORPAY_WEBHOOK_SECRET`; keep`RAZORPAY_LIVE_PAYMENTS_ENABLED=false`. Do not enable durable gates until schema/grants checks pass; both are required for production-runtime creation. Keep refund/worker/notification gates off absent separate approval. Verify inherited envgroups too. `DATABASE_URL`,`REDIS_URL` must target freshTEST; migration`DIRECT_URL`must match the approved target. Private auth/Firebase/session and CORS settings must remain environment-specific.

For later durable **production** setup, not now:

1. Authorized operator signs in normally to Razorpay, selectsLIVE and verifies merchant/KYC, website/app approval, bank/settlement and enabled payment methods. International/USD eligibility requires explicit status. Do not infer approval from publicTESTkey or SDK schemes.
2. Privately provision matchingLIVE`RAZORPAY_KEY_ID`,`RAZORPAY_KEY_SECRET` into the approved production backend's Render Environment; never mobile/web public variables, Git, `.env` commits, screenshots or chat. Presence/mode only in evidence. Do not regenerate existing keys unnecessarily.
3. Set a distinct production`RAZORPAY_WEBHOOK_SECRET` privately, matching the approved Dashboard endpoint. The API secret and webhook secret are different. Exact future production HTTPS URL must come from an actual verified service; do not reuse staging blindly.
4. KeepLIVEapproval false until database/runtime/security/deployment and merchant gates pass; then separately approve changing `RAZORPAY_LIVE_PAYMENTS_ENABLED`. Creation also requires verified`PAYMENT_CREATION_SCHEMA_READY`and`PAYMENT_CREATION_COMMANDS_ENABLED`. Nonempty webhook secret is not transport proof.
5. Refunds stay off until approved policy and execution verification: `PRODUCT_REFUND_SCHEMA_READY`,`PRODUCT_REFUND_EXECUTION_ENABLED`,`PRODUCT_REFUND_POLICY_APPROVED`,`RAZORPAY_REFUNDS_ENABLED`, and `RAZORPAY_REFUND_POLICY_REVISION=full-unspent-principal-and-subscription-v1`. Do not enable these simply to remove Admin warnings.
6. International gates `RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED`,`MARKETPLACE_INTERNATIONAL_PAYMENTS_ENABLED`remain off pending capability/FX review. Keep gateway fees/taxes separate from gross revenue allocations. Ledger70:30 allocation is not seller payout capability.
7. Flutter`API_BASE_URL`/website`NEXT_PUBLIC_API_BASE_URL`must point to the intended HTTPS backend. Authenticated `/payments/checkout-config` supplies only public keyID/mode and server-owned orders. No privateRazorpaykey in Flutter defines/mobile bundle/browser code. Verify Android/iOS release signing, native checkout returns and supported methods on actual devices; iOS needsMac/Xcode/iPhone.
8. Register only reviewed webhook events`payment.captured`,`payment.failed`,`order.paid`; raw-bodyHMAC is required. Do not claim event200/FCMacceptance/callback alone proves end-to-end fulfillment. KeepTESTandLIVEwebhook secrets, records and backend environments separate.

Genuine payment E2E is **reserved for the separately approved durable deployment**, per user direction. No checkout or provider event is initiated by this package. Before LIVE acceptance, require appropriate genuineHTTPSdelivery/exactly-once evidence in authorized isolatedTEST, then a separately approved bounded production payment. OldINR100capture/refund is not repeated.

## Exact push / deployment sequence after approval

1. Recheck remote branch still points to parent44d4339, authorized Render inventory/current quote and full permission plan; inspect CI has no deployment/migration sideeffects.
2. Exact non-force push, only after approval:

```powershell
git -c push.followTags=false push --no-follow-tags origin a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1:refs/heads/integration/latest-approved-20261028
git ls-remote origin refs/heads/integration/latest-approved-20261028
```

3. Separately approve creating fresh paidTESTtargets, private secrets and pinned migration/grant operations after missing permission review. No old financial import. Verify backup/restore independently.
4. Deploy the exactSHA through Render **Manual Deploy > Deploy a specific commit**, never implicitlatest. Backend repositoryroot,Node22.23.4:

```text
Build: cd backend-main && corepack pnpm@11.25.0 install --frozen-lockfile --prod=false && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build
Start: cd backend-main && corepack pnpm@11.25.0 run start:prod
Pre-deploy: blank; auto-deploy Off; health /health
```

Website root`website`: `npm ci && npm run build -- --webpack`; `npm run start -- --hostname 0.0.0.0 --port $PORT`. Verify publicAPIURL,Firebaseauthorizedorigin,CORS/sessionRESTandWebSocketcompatibility. Don't apply resource-creatingBlueprintblindly.

5. Checkdatabase/Redishealth,unauthcheckoutconfig401,authorizedTESTconfig200,approvedpubliccontentandAdminRBAC. Staging404cannotbefixedbylocalcodealone. CaptureactualdeploymentSHA/targetidentity. No automatic device writes or paymentE2E withoutscopeapproval.

**ONE next action:** provide the existing Render Services/Settings/Billing non-secret inventory and review this **exact-SHA fresh durableTEST approval package**, with budget up toUSD44.50/month beforeextras (or an explicitly chosen largerplan). Execution remains conditional on complete runtime grants and exactnewresourceIDs. Approve push, purchase/creation, schema/grants, private configuration and deployment only as explicit scopes. No LIVE, payment/refund or production database action is implied.
