# All-project source sync and deployment handoff

Date:2026-10-28. Source parent `a4acc0571dad7823e0345cceb7fb4e04f191246d`; integration branch `integration/latest-approved-20261028`. Final commit/remote verification is recorded in a separate post-push receipt. **Source sync and production readiness are separate: LIVE remains NO-GO.** No deployment, DNS, database, payment, merchant or mobile publication action is authorized/performed here.

## Source audit and preservation

Reviewed all1692 release-tree files against actual local files, normalizing text line endings for comparison. Current approved Flutter Android/iOS, Home/Login/dashboard, AI, real astrologer/free chat, wallet, horoscope, Kundli, articles/support/consultation, website/customer/Admin/backend source and assets are inherited from the parent. No normal functional source delta was missing. All prior payment proof/durable creation and fixed future human70/30 policy patches are included. INR3500/365days and USD1/30days are unchanged.

Exceptions deliberately preserved, not silently synchronized:

- Local deleted historical migration `20260830150000_add_marketplace_finance_foundation/migration.sql` remains present in release.
- Local modified historical migration files `20260901235811_add_astrologer_consultation_categories/migration.sql` and `20260924115453_add_global_articles/migration.sql` retain their previously approved release versions. This follows the prior integration decision to preserve published migration history; no migration is run or rewritten. Local variants remain on disk for recovery/review.
- Temporary unimported `horoscope_identity_diagnostic.dart`, `support_identity_diagnostic.dart`, broken receptionist schema backup and answer-cache schema backup stay local. They are not required normal entrypoints or approved release code.
- Raw `.gitignore` comparison differs, but Git canonical diff is empty. No functional ignore change is required.

Inspected additional test/script/integration-test/workflow locations for omitted source. No missing approved executable input identified. Existing source lockfiles and public Firebase client configuration are included; public Firebase identifiers are not service-account/private credentials. Private defines, environment files, signing material, generated builds, backup snapshots and databases remain excluded.

Added `astro-soul-path-app/dart_defines.example.json`: public-config field names with empty/invalid-domain placeholders only. Operators must supply the approved API origin and their public client configuration privately; never put backend Razorpay/API secrets in Flutter defines. No runtime defaults changed.

Existing dirty checkout remains on `auth/firebase-google-linking`. Use a separate parent-pinned index and compare-and-swap integration ref; no checkout/reset/stash/pop/delete. Prior full private backup and a newly verified incremental bundle preserve the release chain. The incremental bundle requires existing44d4339base; it is not a standalone full-repository backup. Local diagnostic files/backups were not deleted.

## Emulator parity

Read-only ADB: emulator-5554 online, Owner user0. Installed package `com.astrosoulpath.astro_soul_path` SHA256 **`41c440ac9c1b61fc9c82005ab2499d796608a6ca1aa1fe60d6a5f82d0c89c4a7`** matches local `app-render-staging-debug.apk` and the build receipt. Compiler/kernel receipt pins API to `https://astro-soul-path-backend-staging.onrender.com`.

Flutter functional source matches the release parent; subsequent changes are backend/Admin or documentation/template. This is source/artifact parity evidence, **not a fresh visible-session/API E2E pass**. No app launch, account switch, reinstall, data clearing or device registration occurred. Previous startup write restrictions remain respected. No claim the installed client contains deployed backend changes: staging checkout-config/API gaps still need coordinated deployment.

## Verification executed for this sync

| Check | Actual evidence |
|---|---|
| Full Flutter tests | **736 passed**, exit0 |
| Focused login/customer/premium UI | **35 passed**; overlaps full suite |
| All website `tests/*.test.cjs` | **501 passed**, exit0 |
| Backend finance/payment/security/Admin | **363 passed,24 suites**, exit0 |
| Backend production compilation | **PASS**, Node22/private output |
| Website/Admin production build | **PASS**, isolated Next.js webpack build, exit0 |
| Actual Flutter lib/test analysis | **0 errors;14 existing nonblocking findings**, exit0 with warnings/info retained |
| Fresh-kit Prisma validation | **PASS**, schema only/no DB connection |
| Git object integrity | **PASS**, `git fsck --no-reflogs --no-dangling` |
| Secret-pattern scan | **No matches** across1692release blobs for private-key/AWS/Razorpay credential patterns; forbidden env/key/archive/APK paths absent |
| Recovery bundle | **PASS**, `git bundle verify` |

Whole-folder Flutter analysis returned1211issues from incomplete archived backup projects plus style findings; **zero errors matched actuallib/test source paths** in that run. This broad failure is retained, not relabeled a clean analysis pass. Actual `lib test` analysis completed with14nonblocking findings and no errors (`--no-fatal-infos --no-fatal-warnings`); details remain in the log. No backup source is deleted or included in Git to resolve analyzer noise.

All payment/provider fixtures are synthetic; no genuine provider checkout, webhook delivery, bank settlement or actual mobile-store approval follows from these tests. Logs remain ignored under `backend-main/.local-backups/sync-*20261028.log`.

## Commit and push controls

Existing remote integration was verified at `44d4339178642b935fa3f1b239df297a4a9e21dd`, an ancestor of the local finance release. Protected `main=d18a4c41fa079cd9ef1dcc708b5b0b9b97a282c0` and `staging=72b6257a4e0f9f174df5baeaf58e594587051424` must remain unchanged. Never force-push or push tags.

Only verified public build template and missing non-secret handoff documents need a final child commit. Use **`[skip render]`** in its commit message to suppress Render auto-deploy on this push; the only included GitHub workflow is manual/PR testing, not push deployment. [Render skip behavior](https://render.com/docs/deploys). No deploy hooks or provider configuration calls are made. Actual Render inventory is unavailable, so no claim about other manually operated systems is inferred.

After all critical checks and release-tree scan pass, push the final immutable SHA to only the named integration branch, then compare remote SHA and protected refs. Report failure rather than retry with force if the remote moved unexpectedly. A post-push receipt records exact SHA/command and outcome; this document cannot contain its own resulting commit hash.

## Next deployment procedure — not executed

1. Obtain non-secret Render inventory, current quotes, region, deployed SHAs, environment groups and target identities. Do not create duplicates or silently repoint shared Admin. Old expiring staging must not become LIVE production. Fresh PostgreSQL18 and persistent Redis must be environment-isolated; never import old wallets/orders/users.
2. Resolve complete restricted runtime grants, Prisma history-registration and private restore proof. Use only the four pinned fresh-kit migrations under separate exact-target approval; no blanket historical migration or startup seed. Preserve original databases and financial records.
3. After purchase/configuration/deployment approval, deploy exact final receipt SHA with auto-deployOff and pre-deployblank. Backend repository root, Node22:

```text
Build: cd backend-main && corepack pnpm@11.25.0 install --frozen-lockfile --prod=false && corepack pnpm@11.25.0 exec prisma generate && corepack pnpm@11.25.0 run build
Start: cd backend-main && corepack pnpm@11.25.0 run start:prod
Health: /health
```

4. Website/Admin root`website`: `npm ci && npm run build -- --webpack`; `npm run start -- --hostname 0.0.0.0 --port $PORT`. Set approved publicHTTPSAPI/Firebaseclient configuration only; private payment/auth secrets backend-only. Verify CORS/cookies/role context, protected checkout-config and backend/Redis/DB health.
5. Domain/HTTPS: add intended domains to the correct service only after DNS approval; use the exact records shown by Render, not guessed IPs/targets. Verify domain ownership/TLS, canonical redirects and Firebase authorized origins before changing public traffic. No DNS changed here.
6. Android approved config from clean release checkout:

```text
flutter pub get
flutter build apk --debug --dart-define-from-file=<PRIVATE_APPROVED_PUBLIC_CLIENT_CONFIG>
flutter build appbundle --release --dart-define-from-file=<PRIVATE_APPROVED_PUBLIC_CLIENT_CONFIG>
```

Use required Android SDK/JDK/Gradle and private release signing outside Git. Existing stagingAPK path above is a debug deliverable, not a signed Play release. Build/install/rollout is a separate task; preserve current sessions. Never use secret server credentials in the client configuration file.
7. iOS requires Mac/Xcode, CocoaPods, Apple certificates/provisioning and physical iPhone verification. From the same release: `flutter build ipa --release --dart-define-from-file=<PRIVATE_APPROVED_PUBLIC_CLIENT_CONFIG>`. Verify bundle/Firebase/GoogleSignIn registration and app-switch/UPI callbacks; Windows/emulator passes do not prove iOS.
8. Razorpay operator verifies merchant/KYC, website/app and bank/method eligibility. Configure matchingTEST/LIVE credentials and distinctwebhooksecret privately on the correct backend only after approval; keepLIVE/refund/delivery gates off pending prerequisites. Verify signedHTTPSwebhook and one bounded authorized transaction on approved durable infrastructure. No originalINR100repeat or automatic payouts inferred from70:30allocation.

## Remaining blockers and one next action

Production still requires actual Render inventory/quotes, fresh runtime grants and restore/history verification, real merchant/HTTPS/device evidence, store billing compliance for digital products, subscription revenue journal/recognition and chargeback/partial-refund/AI/tax decisions documented in the finance report. A successful GitHub sync is not production activation or a claim these features are complete.

**ONE next action after remote verification:** review the final receipt SHA in a target-pinned durable TEST database/backend/website deployment approval package, with exact costs, full runtime role and recovery plan. No purchase, database, secret change, DNS, LIVE, transaction or publication permission is implied by this source sync.
