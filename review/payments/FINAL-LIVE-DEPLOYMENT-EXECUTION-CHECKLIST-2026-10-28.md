# Final execution checklist â€” Astro Soul Path

**PARTIAL. Local release/code checks PASS; infrastructure, merchant, store-policy and genuine E2E gates remain open. LIVE NO-GO.** This is the consolidated procedure, not authorization to execute it. No resources, database data, secrets, deployment, GitHub remote or payments changed in this step. Unchanged tests were not repeated.

Pinned local release: **`a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1`** on `integration/latest-approved-20261028`; parent `44d4339178642b935fa3f1b239df297a4a9e21dd`. Verified again today. Nine-file patch scope and whitespace check passed. Original checkout remains on its preserved branch with345 tracked changed paths relative to its older HEAD, plus untracked work. Those are not345 new release defects; do not stage the whole checkout. The separate-index commit preserves prior integrated mobile/site/Admin/backend code. This final checklist is an uncommitted review artifact, not part of the pinned SHA.

## 1. Resolve manual inventory and policy gates before spending

- [ ] Render project **AstroSoulPath > Services**: inventory backend, website/Admin, PostgreSQL and Key Value IDs, regions, plans, current quote and environment. Existing recorded backend `srv-db3799l9fdbs73a7d2qg`; old database `dpg-datmq8favr4c73e64m4g-a`, both Oregon. Neither is an approved fresh production target. Website/Redis IDs remain unknown. Do not create duplicates.
- [ ] Backend **Deploys/Settings**: record actual current full deployed SHA, repository/branch, root/build/start/pre-deploy and auto-deploy settings. Git remote staging SHA does not prove deployed SHA. **Environment**: inspect inherited groups, names/presence only; never share values.
- [ ] Old database **Info/Recovery**: check current expiry/status; recorded expiry is29October2026. Preserve existing users/wallets/orders. Do not use it for LIVE, reset it or import its records into fresh production.
- [ ] Razorpay operator signs in normally, selectsLIVE and records merchant/KYC activation, approved website/app, settlement-bank verification, enabled domestic/international methods and key availability. No authenticated merchant/Render tool is exposed here; all remain UNVERIFIED. No key generation/regeneration required for evidence collection.
- [ ] Classify every mobile SKU and wallet use by storefront/region before store submission. Digital AI/horoscope/report functionality is not automatically exempt from store billing. No Play Billing/alternative-billing integration indicator was found in the limited pubspec/native-source scan today; that is not a full compliance audit or proof of enrollment.

| Product | Required release decision |
|---|---|
| AI answers, digital horoscope subscription, Kundli software/reports | Treat as in-app digital products pending store-specific review. Implement required store billing or an eligible enrolled alternative-billing program before exposing external checkout in affected store builds. |
| Live1:1 human consultation | Verify exact exception criteria. Google's guidance requires two individuals and no replay/access to the paid session afterward in a Play app; retained chat/recordings need review. Do not assume every chat/audio/video consultation qualifies. |
| Soul Bazaar physical goods | Distinguish genuine physical goods from downloadable/digital items. External gateway eligibility differs by item. |
| Mixed wallet | A wallet that buys digital content does not itself bypass store billing. Document allowed spending/provenance and enforce it server-side if product segregation is required. Do not alter existing balances to achieve compliance. |

Google requires Play Billing for covered digital purchases unless an applicable exception/program applies. India alternatives require applicable enrollment and program integration, not merely a Razorpay SDK. [Google Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [1:1 and alternative-billing guidance](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en).

Apple's3.1.3(d) covers real-time services between two individuals; it does not exempt AI/digital subscriptions generally. Physical-goods rules and region-specific exceptions must be reviewed separately. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/). These are product-specific launch blockers, not a claim that the current app has been formally rejected. Website checkout does not establish mobile-store compliance; do not add in-app steering as a workaround.

## 2. Approve the actual infrastructure quote

Recommended initial production planning sizes for about100registered users, not100simultaneous sessions: PostgreSQL18 with1GiBRAM, backend2GiBRAM, Next.js website/Admin2GiBRAM, persistent Key Value256MiB. Capacity must be measured; real-time media/provider capacity and AI costs are separate.

| Service | Recommended production plan | Published monthly compute |
|---|---|---:|
| Backend | `1c-2g` | USD25 |
| Website and Admin in one Next.js service | `1c-2g` | USD25 |
| PostgreSQL18 | `0.5c-1g`,5GBinitial disk | USD19 |
| Persistent isolated Redis | `256mb`,noeviction | USD10 |
| Total compute | Hobby workspace assumed | **USD79** |

Conservative5GBstorage allowanceUSD1.50 gives **USD80.50/month** before extras. Published pricing also lists1GBincluded; actual creation quote must settle that storage adjustment. A smaller TEST stack uses512MiBbackend/site atUSD7each: **USD44.50/month** conservative storage-inclusive base. Retaining both separate stacks is approximately **USD125/month**, notUSD80.50. Never share a TEST/LIVE database or credential set to hide this cost.

Add workspace fees if applicable (ProUSD25/month), taxes, bandwidth/build overages, object storage, workers, external AI/media/email and backup/recovery resources. Existing paid resources keep billing. Budget is arithmetic from published rates, **not an account quote or hard cap**. The oldUSD15ceiling is insufficient. No purchase is approved. [Render pricing](https://render.com/pricing).

- [ ] Confirm whether existing isolated services can safely be reused, then choose same-region resources. PreferSingapore for new targets only if available; Oregon reuse/fallback requires explicit scope. Record actual new IDs and HTTPS URLs after approved creation; none are invented here.
- [ ] Set storage autoscaling off initially, private DB/Redis access, bounded connection pools and billing/usage alerts. Require CPU/RAM/latency/load evidence before accepting the size recommendation. Paid backups do not imply high availability or a guaranteed recovery time.

## 3. Fresh database, permissions and recovery â€” approval required

- [ ] Finalize complete restricted runtime grants for auth/profile/payment/Admin paths. The existing `phase3b-payment-runtime-grants.review.sql` is finance-only,NOLOGIN and **not a full backend runtime role**. This and Prisma history-registration rehearsal remain blockers; do not approve executable migrations until resolved.
- [ ] Approve an exact fresh empty PG18 target and owner/runtime separation. Do not copy historical users, wallets or orders; verify zero initial financial tables and legitimate new-account zero wallet provisioning.
- [ ] Verify `fresh-prisma-release-manifest.review.json` and pinned schema. Apply only the four reviewed fresh migrations in order: baseline, SQLprotections, inactivecatalogue, refundreservationguards. Step4 checksums and earlier rehearsal remain evidence; no migration ran today. Never blanket-replay historical migrations or run seed/migration on service startup.
- [ ] Before changes, take private archive/checksum and test restore into a separately approved disposable recovery target. The old staging archive checksum was verified, but its restore remains untested; it must not populate fresh production. Paid Render PITR and private exports are complementary. [Render backup/recovery](https://render.com/docs/postgresql-backups).

Conditional operator templates, **not executable authorization**, with private libpq service/password files outside Git:

```text
psql -X --set=ON_ERROR_STOP=1 --dbname=service=asp_approved_owner --command="SELECT current_database(),inet_server_addr(),inet_server_port(),version();"
pg_dump --dbname=service=asp_approved_owner --format=custom --file=<PRIVATE_ARCHIVE>
pg_restore --list <PRIVATE_ARCHIVE>
psql -X --set=ON_ERROR_STOP=1 --dbname=service=asp_approved_owner --file=review/payments/fresh-production-prisma/migrations/<PINNED_MIGRATION>/migration.sql
pg_restore --exit-on-error --no-owner --no-privileges --dbname=service=asp_approved_empty_recovery <PRIVATE_ARCHIVE>
```

Stop on first error/drift. Four files have individual transaction boundaries; the entire chain is not globally atomic. Verify constraints,indexes,triggers,role permissions and Prisma history after the separately rehearsed registration procedure. Restore template excludes ownership/grants: validate them separately. No `--clean`, destructive down migration, reset or original-database restore.

## 4. Release push and Render deployment â€” separate approval required

- [ ] Verify remote branch has not changed unexpectedly, review the pinned tree/secret scan and authorize exact push only. No tags/main/staging merge or force push:

```powershell
git rev-parse integration/latest-approved-20261028
git ls-remote origin refs/heads/integration/latest-approved-20261028
git -c push.followTags=false push --no-follow-tags origin a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1:refs/heads/integration/latest-approved-20261028
git ls-remote origin refs/heads/integration/latest-approved-20261028
```

- [ ] Explicitly approve resource creation/configuration AND initial deployment behavior; creating a service or saving environment settings may trigger deployment. Do not apply a resource-creating Blueprint blindly. Keep auto-deploy off.
- [ ] Backend repository root,Node22.23.4,pre-deployblank,health`/health`:

```text
Build: cd backend-main && corepack pnpm@11.25.0 install --frozen-lockfile --prod=false && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build
Start: cd backend-main && corepack pnpm@11.25.0 run start:prod
```

- [ ] Website/Admin root`website`,Node22,approvedHTTPSAPIconfiguration:

```text
Build: npm ci && npm run build -- --webpack
Start: npm run start -- --hostname 0.0.0.0 --port $PORT
```

- [ ] Render **Manual Deploy > Deploy a specific commit**: select the exact release SHA on the approved backend, then website. Never â€œlatest.â€ Verify final deployed SHA,DB/Redishealth,auth/RBAC and cookie/CORS/WebSocketbehavior. Source `/payments/checkout-config` exists; its staging404requires compatible deployment, not auth bypass. Check unauthorized rejection and authorized public-key/mode response.
- [ ] Record DNS/TLS changes for separate approval. Do not invent a productionURL or repoint sharedAdmin. No local.devURL,emulatorauthoverride or TESTsecret may enter production configuration.

## 5. Secure Razorpay configuration â€” keep LIVE off initially

- [ ] Store only in backend secure hosting environment: `RAZORPAY_KEY_ID`,matching`RAZORPAY_KEY_SECRET`,distinct`RAZORPAY_WEBHOOK_SECRET`. TEST and LIVE get different approved service/database/Redis/auth contexts; do not mix. Values never in Git,chat,logs,screenshots,Flutterdefines or`NEXT_PUBLIC_*`.
- [ ] Privately verify presence, key mode and pair ownership; publicTESTprefix is insufficient. Local presence was checked in Step3, not evidence of Render. Keep`RAZORPAY_LIVE_PAYMENTS_ENABLED=false`until activation approval.
- [ ] `PAYMENT_CREATION_SCHEMA_READY`and`PAYMENT_CREATION_COMMANDS_ENABLED`both required after schema/grants verification. LIVE creation additionally checksapprovalandwebhooksecretpresence. Presence is not proof of genuineHTTPSdelivery.
- [ ] Refunds remain off untilapproved: `PRODUCT_REFUND_SCHEMA_READY`,`PRODUCT_REFUND_EXECUTION_ENABLED`,`PRODUCT_REFUND_POLICY_APPROVED`,`RAZORPAY_REFUNDS_ENABLED`; revision`RAZORPAY_REFUND_POLICY_REVISION=full-unspent-principal-and-subscription-v1`. Internationalgatesremainoffuntilmerchant/FXapproval. Do not enable gates to remove Adminwarnings.
- [ ] Set`DATABASE_URL`,`REDIS_URL`,privateFirebase/session/authsettings and approvedCORSorigins for the intended environment. Migrationowner`DIRECT_URL`is not a runtimepermission shortcut. WebsitepublicFirebaseconfig/APIURLonly. Secrets must not be committed in `.env` or embedded in mobilebundles.
- [ ] Derive productionwebhookURL from the actual approvedHTTPSservice plus`/payments/webhook`. In Razorpay's matchingmode, separatelyapproveendpoint/secret andevents`payment.captured`,`payment.failed`,`order.paid`. Do not configure unsupported refundevents as if implemented. Prove originalrawbyteHMAC,providerdeliveryID/status and exactlyonefinancialeffect; event200alone is insufficient.

## 6. Android, iOS and genuine E2E release gates

- [ ] Use release-source build from the pinned commit, explicitapprovedHTTPS`API_BASE_URL`,publicFirebaseclientconfiguration and correctpackage/signingidentity. Never silently replace the original emulatorAPK/session; deviceinstall/normalstartupwrites require scopeapproval.
- [ ] Android: signedAAB/requiredtargetSDK,PlayConsolepolicyroutingandreleaseSHAregistration; actual physical deviceRazorpayreturn/UPI/cardcancel/pending/reopen andaccountswitchtests. Emulator/mockpassesare notphysicaldeviceproof.
- [ ] iOS: availableMac/Xcode,Pods/provisioning,releasebundle/sign-inURLconfiguration,AppStorepolicydecision,physicaliPhonecheckout/appswitch/callbacks. These remainunverified. No iOSdeploymentclaim from Android/webtests.
- [ ] Website/Admin: authenticCustomer/Adminsessionstability,restrictedscopecontrols,publickeyonly,safepending/retrystates,no successuntilbackendfulfillment. Fresh paidplan/catalogueactivationis separateapprovedconfiguration,not seedfakeentitlements.
- [ ] Execute genuine provider E2E only after durabledeployment and transactionapproval: serverownedorder/amount/currency/customer;captureandHMAC;oneledgercredit;history/reopen;actualHTTPSwebhookdelivery/retry;duplicateeventnoextracredit;failed/cancelled/pending;boundedreconciliation;authorizedrefundwithunknownoutcomehold. Do not repeat the oldINR100or refundedINR3500. Never automaticretry on uncertaincharge/refund.
- [ ] Verify each product separately: wallet;professionalKundliINR3500/365days100%platformgross;horoscopeUSD1/30days100%platformgross with authoritativeFX/currency andmerchanteligibility;consultation/physicalmarketplacesales70:30. Keepgatewayfees/taxes/refundsseparate. Allocationis notautomaticbanksettlement/sellerpayoutproof. PaidAI/notifications requiretheir ownapprovals and designatedconsentingaccounts/devices.

Previous verified results retained, not rerun: 177 backend, 49 website and 31 Flutter tests; backend/Next builds, TypeScript, scoped Flutter analysis and Prisma validation passed. These are code and synthetic checks. No new genuine HTTPS, LIVE, native-device or full restricted-role database E2E is claimed.

## 7. Operations, rollback and final approval gate

- [ ] Define alerts forsignaturefailure,unknowncreation/refund,pendingage,duplicateattempts,reconciliationdifference,DB/Redis/memorypressure andwebhookfailures. LogIDs/statuses,notrawcredentials/privatepayloads. Set retention/accessandrefund/reconciliationoperatorpolicies.
- [ ] RecordactualpreviousdeploymentSHA/configandschemacompatibility;approveapplicationrollback tothatexactSHA. Don't guess from remotestagingref. Environmentrollbackis separate;LIVEdisablealsoaffectsproviderreconciliation,soverify anincidentpauseprocedurethatpreservesrecovery. No DBreset,ledgerrewriteorrestoreoverproviderconfirmedfinancialeffects.
- [ ] Stoponmissinginventory,unsafegrant,restorefailure,storepolicyuncertainty,merchantrestrictionorproviderenvironmentmismatch. Successfulcodechecksarenotpermissiontobypassremaininggates.

**ONE next approval action:** review this checklist with the non-secret Render inventory/currentquote and complete runtime-role plan, then approve a **target-pinned durableTEST deployment package for `a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1`** specifying push,resourcecosts/IDs,freshschema/grants,privateconfiguration and deployment as explicit scopes. These fields are still unresolved, so an unconditional LIVEexecutionapprovalwould be premature. Productionpurchase/LIVEconfiguration,storebillingchanges,DNSand a boundedreal-moneyverificationremain separatelaterapprovals.
