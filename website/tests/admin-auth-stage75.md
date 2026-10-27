# Admin Firebase Google Login ? website stage 75%

Local implementation only. No live Firebase authentication, database access, deployment, Git staging or commits were performed. The existing backend stage 50% files were not edited.

## Implementation

- Google popup uses existing Firebase config and posts the ID token through the same-origin Next.js bridge to the existing POST /auth/admin/firebase/google contract.
- The bridge stores a bearer token in an HttpOnly, SameSite=Strict cookie (Secure in production). No ID/access token is placed in a client-readable cookie.
- Every protected /admin route is reauthorized by the existing backend /admin/stats guard, independently of asp_user and client role claims. Authorization outages fail closed.
- Existing Email and Phone login contracts remain. Their tokens must pass the same backend Admin authorization check before a routing cookie is issued.
- Firebase SDK renewal and existing backend Email refresh are supported. Firebase UID changes require sign-in again. Session establishment is serialized and fenced against same-tab logout races.
- Logout signs out Firebase, clears Admin application state, deletes the HttpOnly routing cookie and invalidates navigation. It does not delete customer storage or records.
- The dashboard shows explicit loading/error states instead of a fake zero-value preview.
- All Admin modules share the explicit NEXT_PUBLIC_API_BASE_URL configuration; no Admin localhost or alternate-variable fallback remains.

## Local verification

- node --test tests/admin-auth.test.cjs: 41 PASS, 0 FAIL. Network/Firebase operations are mocked; three tests render login/dashboard HTML. No browser popup, real login or database behavior is claimed verified.
- TypeScript: node node_modules/typescript/bin/tsc --noEmit --incremental false: PASS.
- Full website ESLint: 0 errors, 19 existing warnings. Expanded Admin scope: 0 errors, 8 existing warnings.
- Next.js production build: PASS after network-enabled retry for existing Geist font downloads.
- Git whitespace check: PASS.

## Remaining release gates

1. Verify the configured staging backend actually serves the completed stage 50% endpoint, with the intended Firebase project and existing Admin UID mapping. No mapping is created automatically.
2. Verify Firebase authorized domains for localhost and the intended website origin, Google provider availability and popup behavior using an authorized existing test Admin.
3. Test Admin/non-admin login, token expiry, refresh/reopen, cross-tab logout, back navigation, 401/403, outage handling, and existing Email/Phone flows in a real browser.
4. Existing legacy Admin API pages retain their bearer-token browser-storage integration. Routing never trusts that storage, but browser tokens remain sensitive to XSS; this is not a complete backend-for-frontend API proxy redesign.
5. Authorization currently uses /admin/stats, which aggregates data. Check latency/load; a dedicated read-only Admin identity endpoint would be a separate backend improvement.
6. Existing /admin.backup-before-token-fix routes are included by Next.js and are outside the /admin middleware matcher. They were not modified. Review/quarantine these routes before release; protected backend APIs still enforce roles.
7. No database, Flutter, Firebase settings, environment files, dependencies or Git history were changed. Existing unrelated work is preserved.

## Exact website files in this phase

The two previously modified Admin login/OTP files retain their Email/Phone functionality and prior redirect correction. The 24 additional Admin modules only replace inconsistent API configuration with the shared helper.

- website/middleware.ts
- website/src/app/admin/analytics/page.tsx
- website/src/app/admin/astrologers/[id]/page.tsx
- website/src/app/admin/astrologers/page.tsx
- website/src/app/admin/consultations/page.tsx
- website/src/app/admin/customers/page.tsx
- website/src/app/admin/feedback/page.tsx
- website/src/app/admin/kundli-settings/page.tsx
- website/src/app/admin/layout.tsx
- website/src/app/admin/login/page.tsx
- website/src/app/admin/marketplace/categories/page.tsx
- website/src/app/admin/marketplace/page.tsx
- website/src/app/admin/marketplace/products/page.tsx
- website/src/app/admin/payments/page.tsx
- website/src/app/admin/platform-settings/page.tsx
- website/src/app/admin/reports/page.tsx
- website/src/app/admin/subscriptions/page.tsx
- website/src/app/admin/support/page.tsx
- website/src/app/admin/verify-otp/page.tsx
- website/src/app/admin/wallet/page.tsx
- website/src/app/api/admin/session/route.ts
- website/src/components/layouts/Navbar.tsx
- website/src/features/admin/AdminArticleManagement.tsx
- website/src/features/admin/AdminDashboard.tsx
- website/src/features/admin/AdminVideoManagement.tsx
- website/src/features/admin/auth/AdminSessionBoundary.tsx
- website/src/features/admin/auth/admin-contract.ts
- website/src/features/admin/auth/admin-session.ts
- website/src/features/admin/marketplace/MarketplaceCampaigns.tsx
- website/src/features/admin/marketplace/MarketplaceCategories.tsx
- website/src/features/admin/marketplace/MarketplaceFinance.tsx
- website/src/features/admin/marketplace/MarketplaceOrders.tsx
- website/src/features/admin/marketplace/MarketplaceProducts.tsx
- website/src/features/admin/marketplace/MarketplaceSellers.tsx
- website/src/services/adminService.ts
- website/tests/admin-auth-stage75.md
- website/tests/admin-auth.test.cjs
