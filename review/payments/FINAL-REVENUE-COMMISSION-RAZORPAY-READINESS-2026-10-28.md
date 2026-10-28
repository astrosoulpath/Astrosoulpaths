# Revenue, commission and Razorpay local release

**PARTIAL; LIVE NO-GO.** Parent release `a7b75a6eaf9cb0dd9a3c6759a5e627114aff0db1`. Resulting local commit is recorded in the execution receipt after creation. No database, provider, merchant, payout, hosting or financial-record changes. No push or deployment. Prior working changes remain preserved.

## Approved policy and fixes

The operator explicitly approved **fixed70/30 for future human consultations**, resolving the conflict with the existing configurable Admin percentage. New policy snapshots now use platform30%, astrologer70%, version hash based on `HUMAN_CONSULTATION_70_30_V1`; they no longer read mutable global settings. Existing snapshots/earnings/Admin settings are untouched. New paid sessions fail before wallet/session writes if the financial lifecycle/schema gates or approved hold policy are unavailable. Free first-minute chat retains its zero-charge path. Deployment will therefore block new paid consultation creation until the existing schema/lifecycle/hold prerequisites are explicitly verified and activated; no flags changed here.

Files: `consultation-financial-policy.ts`, its spec, `consultation.repository.ts`, `financial-integrity.spec.ts`. The existing `ConsultationFinancialPolicy` table is reused: no schema change is needed for this patch. Historical sessions without snapshots retain historical behavior; they are not backfilled or relabeled fixed70/30.

Confirmed catalogue bug fixed: `SubscriptionService.getPlans` previously filtered invalid horoscope policy but allowed malformed professional Kundli configurations into the public catalogue. It now validates both without editing records. New catalogue test preserves unrelated products and verifies invalid price/currency/term configurations are not advertised. Checkout policy remains INR3500/365days and USD1/30days, unchanged.

Expanded subscription fulfillment tests exercise both confirmed products, preserve purchased duration despite later plan edits, and assert no wallet credit or astrologer earning allocation. Admin Finance now states the new fixed policy and historical preservation. CI includes the new policy/catalogue regressions.

## Verified implementation/missing matrix

| Area | Verified source/test evidence | Status and remaining work |
|---|---|---|
| Human consultation70/30 | Future snapshot helper, repository serializable completion, verified ledger deductions, unique session earning and existing-earning checks | Code PASS. Actual restricted-role PostgreSQL concurrency/retry rehearsal pending; no live payout proof. |
| INR100 and partial amounts | Repository fixture tests:100→70/30;37.50→26.25/11.25;0.01→0.01/0.00; existing1.05→0.73/0.32 | PASS synthetic. Platform rounded to2decimals; astrologer receives conserved remainder. |
| Free first minute | Free-chat intent/lifecycle tests cover atomic claim, no paid fallback and zero earnings/wallet settlement | PASS synthetic; no real entitlement consumed. |
| Historical allocations | Existing locked policy/earning preservation and no resetting paid/reserved rows | PASS fixtures. No records changed or inferred. |
| Paid partial/cancel/refund handling | Verified deduction reconciliation; inactive/stale completion and inconsistent/refund evidence rejected; existing payout reservations/reversals tested | PARTIAL. Complete provider-backed consultation partial-refund/chargeback compensating-journal E2E not proven. Do not present rejection/reversal fixtures as a universal refund engine. |
| Wallet, payable and revenue separation | `Wallet`/`WalletLedger`, `AstrologerEarning`, commission snapshot/audit, marketplace journals and Admin read models | PARTIAL. Customer balance is not earned revenue; payable is not paid cash. No complete independent platform revenue journal for both subscriptions established by this audit. |
| Professional subscription | `kundli-plan-policy.ts`, owner/role checks in PaymentsService, purchased snapshot fulfillment | INR3500/365days confirmed, no astrologer commission. Actual fresh-target/provider/native E2E pending. |
| Personalized horoscope | `daily-horoscope-policy.ts`, checkout currency gate and entitlement/recovery tests | USD1/30days confirmed. Merchant USD/international eligibility remains unverified; no silent INR substitution. |
| Subscription100% platform | Both subscription fixtures produce entitlement without wallet/astrologer allocation | PASS for no astrologer split; **not** proof of a posted100% earned-revenue journal, gateway net settlement or accounting recognition. Those remain gaps. |
| Renewals/expiry | Purchased period snapshot, exact UTC duration, horoscope manual renewal/cancellation controls | PARTIAL. No approved recurring mandate; `automaticRenewalSupported:false` remains truthful. Provider-managed subscription IDs are not mandate proof. |
| Razorpay verification | Order ownership/amount/currency, checkout HMAC, raw-byte webhook HMAC, mode binding, durable commands, transactional duplicate fulfillment | PASS mocked security tests; genuine HTTPS delivery and production database constraints not newly exercised. |
| Refunds | Product refund schema/policy/SDK gates, reservations, uncertain-outcome holds and provider-confirmed completion | PASS fixtures, not an executed refund or universal production refund-policy approval. |
| Admin | Currency/mode grouping, global versus page scope, wallet bucket diagnostics, audit gates; truthful policy note | PARTIAL. Authenticated live Admin record E2E and bank reconciliation remain unverified. |
| Flutter Android/iOS / website | Existing secure checkout contract, backend-confirmed success, proof/recovery/account isolation tests | Source/tests PASS; actual device/store/provider tests remain separate. No mobile UI or APK changed. |

## Money treatment: explicit limits

- **Human consultations:** snapshot applies to verified actual charged service gross. Rates and partial-session charging rules were not changed. Gross is not gateway collections or wallet recharge. No new tax/discount formula was invented.
- **AI consultations:** separate `AiAstroUsage` stores configured charge, currency and free flag. A human70/30 share must not be inferred for AI. AI provider cost, any persona/licensing share and platform recognition remain unapproved/unverified accounting requirements; no paid AI was called and no AI pricing changed.
- **Subscriptions:** eligible product gross is100% platform policy, zero astrologer commission. Fees/taxes are separate from this allocation. An earned/deferred revenue recognition policy and separate subscription revenue postings still require implementation/approval; collections cannot be relabeled revenue to close the gap.
- **Taxes/discounts:** marketplace allocation tests exclude separately modeled tax/shipping and preserve configured product basis. Consultation tax inclusion, invoice treatment and discount allocation require operator/accounting decisions. No tax or discount rows were modified.
- **Gateway fees:** never subtract silently from the agreed70/30 gross split. Track separately; provider fee/settlement reconciliation remains required.
- **Refunds:** preserve originals and use linked compensating entries/holds. Do not rewrite historical earnings. Pending/uncertain provider outcomes must retain reservations and forbid blind resubmission. Existing synthetic refund policies are not legal approval for every product.
- **FX:** keep original amount/currency, authoritative purchase snapshot and explicit approved conversion. Do not add INR/USD totals together or infer international approval from key availability. Horoscope remains USD1/30days unless separately approved otherwise.
- **Chargebacks:** no complete dispute/chargeback event→hold/reversal→recovery workflow was established. This is a launch blocker requiring policy, supported events and auditable compensating entries, not a fabricated webhook pass.

## Payout and Route eligibility

`AstrologerPayoutProviderService` uses RazorpayX contacts/fund accounts/payout API and `RAZORPAYX_ACCOUNT_NUMBER`. A created fund account does not verify bank ownership or merchant payout eligibility. Existing safety fixtures cover bank verification remaining false, payable reservation and unknown outcomes. Payout remains a separate explicitly approved workflow; no disbursement executed.

Route is a different linked-account/transfer capability. No authorized merchant access or Route capability proof is available, and no operational Route transfer implementation was verified. Operator must inspect Dashboard **Route**, linked-account onboarding/compliance and provider approval. [Official Route documentation](https://razorpay.com/docs/payments/route/). The payable ledger can record obligations while transfers remain unavailable; it cannot prove automatic settlement.

## Tests actually executed

- Finance/subscription/free-chat/marketplace: **185 passed,11 suites**, after fixed-policy and catalogue changes. Log `.local-backups/revenue-final-tests-20261028.log`.
- Payment/security/refund/Admin: **177 passed,13 suites** before expanded subscription case; affected service suite rerun afterwards: **38 passed**, including INR3500 and USD1 cases. Do not sum overlapping reruns as distinct coverage. Logs `revenue-payment-security-tests-20261028.log`, `revenue-subscription-fulfillment-tests-20261028.log`.
- Website payment contracts: **49 passed**. Flutter payment proof/recovery: **31 passed**; scoped analysis: **no issues**.
- Node22 backend production compilation **PASS**, repeated after backend changes. Prisma fresh-kit validation **PASS**, no DB connection. Next.js isolated production build **PASS**, log `revenue-website-build-20261028.log`; source/live service output preserved.
- Initial changed policy test failed because it expected mutable settings reads; updated to assert fixed30%, no settings read and lock-before-snapshot. Final relevant suites passed. No failure is hidden as provider success.

All financial/provider fixtures are synthetic mocks/in-memory, not real PostgreSQL concurrency or Razorpay delivery. No new provider order, refund, wallet write, payment, notification or external AI charge occurred. Original wallet INR2010.25 and24 UNKNOWN pending orders were untouched. The new tests did not consume free-chat eligibility.

## Store compliance and launch blockers

Razorpay alone does not establish Play/App Store compliance for digital AI, horoscope or report subscriptions. Google generally requires its billing for covered digital goods/services unless an applicable exception/enrolled regional program applies. Its1:1 exception also requires that the paid session cannot be replayed afterward; retained consultation history needs review. [Google policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google1:1/alternative guidance](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en).

Apple permits qualifying real-time person-to-person services under3.1.3(d), not a general digital/AI subscription exemption. Physical goods and storefront-specific rules need product-by-country review; mixed wallet usage does not bypass billing requirements. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/). No store enrollment/approval, native billing integration or actual-device compliance is claimed.

## Release and handoff

Create one local child commit on `integration/latest-approved-20261028` through a separate allowlisted index, preserving the current older checkout and index. Include only the verified source/test/Admin/CI changes and this report. Record immutable SHA in a separate receipt; do not push. Secret-pattern/path scan and branch compare-and-swap are required before commit publication.

Fresh PostgreSQL18 uses the existing four pinned fresh migrations, not historical blanket replay; this patch requires no schema change. However complete auth/profile/runtime grants, restore proof and Prisma history registration remain deployment blockers. Verify financial lifecycle/schema and approved hold seconds before new paid consultations; do not merely enable flags. New paid consultation creation intentionally stops until those checks pass.

Render backend/website commands, private TEST/LIVE variable names, no-auto-migration build/start, exact-SHA deployment, backup/restore and rollback sequence remain in `FINAL-LIVE-DEPLOYMENT-EXECUTION-CHECKLIST-2026-10-28.md`. Replace its old source SHA with the resulting receipt SHA during approval. Existing staging must not become production silently; no old customer/financial imports. Preserve exact prior application/config rollback and reconcile uncertain outcomes rather than resetting records.

**ONE next action:** review the new local release receipt and resolve the remaining accounting/policy and fresh-target permission gates in a target-pinned durable deployment package. It must explicitly cover subscription revenue journal/recognition, AI/tax/chargeback treatment, store billing, provider capabilities and resource identities/cost before LIVE activation. No unconditional production or real-money approval is requested while these gaps remain.
