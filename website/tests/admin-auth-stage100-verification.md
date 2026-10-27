# Admin Google Login: local integration verification (not 100% complete)

Branch: auth/firebase-google-linking. No real Google authentication was attempted. No database connection, account creation, role change, identity linking, migration, environment change, process restart, commit, push or deployment was performed.

## Gates

| Gate | Status | Evidence |
|---|---|---|
| Backend endpoint source and non-provisioning checks | PASS (mocked/code) | auth.controller.ts:139; auth.service.ts:1567; 85/85 targeted backend tests |
| Backend health | PASS (HTTP) | Port 4000 /health returned 200 |
| New endpoint loaded in running local backend | FAIL | Empty unauthenticated POST {} to /auth/admin/firebase/google returned 404; expected DTO validation 400. No token or account lookup was supplied. |
| Backend protected API without credentials | PASS (HTTP) | GET /admin/stats returned 401 |
| Website health/login | PASS (HTTP) | Port 3000 /admin/login returned 200 |
| Google-only initial Admin login | PASS (markup/mock render) | Actual served HTML contains Google and a hidden/aria-hidden legacy Email/Phone container. Real browser accessibility/visual check remains manual. |
| Running website middleware protection | FAIL | Two independent requests to /admin without Cookie or Authorization returned 200 and dashboard loading markup, no redirect. Source and mock middleware tests require redirect. This establishes a runtime discrepancy, not its cause. |
| Backup Admin routes | FAIL | /admin.backup-before-token-fix returned 200 and is outside the middleware matcher. No authenticated data exposure has been established. |
| Browser API target | PASS (identified) | The served Admin JavaScript includes https://astro-soul-path-backend-staging.onrender.com; it does not establish that the local patch is available there. |
| Configured staging reachability | UNVERIFIED | Credential-free /health check timed out even after network-enabled retry. |
| Firebase project configuration | PASS (local files only) | Website and inspected backend .env/.env.production/.env.render-staging project IDs match. Live runtime project identity is not established by this. |
| Firebase Google enabled / authorized domains | UNVERIFIED | Requires authenticated Firebase Console evidence. |
| Intended existing canonical Firebase Admin mapping | UNVERIFIED | No verified access to the database serving the configured staging API, and no independently confirmed intended Firebase UID. No database was queried. |
| Session, expiry, renewal, logout, 401/403 | PASS (mocked); UNVERIFIED (real login) | Website regression suite 41/41. Actual protected-dashboard authentication not performed. |
| Customer/Astrologer regression | PASS (mocked); UNVERIFIED (real login) | Existing customer/Google recovery/user/astrologer/wallet suites included in 85 backend tests; website tests reject Customer credentials as Admin fallback. |
| TypeScript | PASS | tsc --noEmit --incremental false |
| Website lint | PASS with existing warnings | 0 errors, 19 existing warnings |
| Prisma validation | PASS | Local schema validation only, no DB connection |
| NestJS production build | PASS | Existing two npm project-config warnings |
| Next.js production build | PASS | Initial sandbox attempt failed downloading existing Geist fonts; network-enabled retry compiled successfully and generated 71 pages. |

Read-only process metadata identified Next.js PID 25292 (started 2026-10-15 11:02:25 local) on port 3000 and NestJS PID 14816 (started 2026-10-14 10:22:38 local) on port 4000. Neither was restarted. Source/build success is not proof that either process loaded the latest code.

## Files changed in this verification stage

- website/src/app/admin/login/page.tsx: hide Email/Password and Phone OTP forms in a native hidden + CSS hidden + aria-hidden container; preserve handlers, inputs, OTP/reCAPTCHA code, endpoints and prior edits. Formatting applied.
- website/tests/admin-auth.test.cjs: rendered-login regression now verifies Google is outside the hidden legacy container and legacy controls remain preserved inside it.
- website/tests/admin-auth-stage100-verification.md: this evidence and manual checklist.

## Required manual gate before Google sign-in

Do not attempt Google login yet while the new endpoint is unavailable on the actual API target or the website routing check fails. First obtain separate approval to align the running services with the verified code and the intended verified database. No restart, configuration change or deployment was executed here.

After that alignment, verify without credentials that /admin redirects to /admin/login and that an empty POST {} to the actual API's /auth/admin/firebase/google returns validation 400 rather than 404. This is an endpoint-presence check, not successful authentication.

Using authenticated Firebase Console access, inspect the intended existing project (do not change it): Authentication > Sign-in method must show Google enabled; Authentication > Settings > Authorized domains must include localhost for http://localhost:3000 and the actual website hostname for hosted use. The API hostname is not a substitute for authorizing the browser's website origin. Confirm the selected Admin already exists in Firebase Authentication with a Google provider, then verify its UID is already mapped to an active/unblocked canonical backend ADMIN in the database serving that API. A Google email address alone is not sufficient. Do not select a new Google account, because Firebase may create an account before backend rejection.

## Real browser checklist (manual, after prerequisites pass)

1. Open http://localhost:3000/admin/login in a dedicated private browser window. Confirm Google is the only visible sign-in method and Tab does not focus hidden Email/Phone controls.
2. Click Continue with Google yourself. Select ONLY the already-existing, verified Google-linked Admin account. Do not paste tokens, passwords, cookies, email addresses or customer data into chat.
3. In DevTools Network, confirm the same-origin /api/admin/session request succeeds and navigation reaches /admin. The backend endpoint must authorize the existing UID; there must be no role/portal selection or provisioning request.
4. Confirm real dashboard data loads successfully, without exporting or sharing customer details. Record only sanitized status codes and PASS/FAIL.
5. In browser cookie metadata, confirm asp_admin_session is HttpOnly and SameSite=Strict (Secure on HTTPS production). Do not copy its value. No access/ID token should appear in a script-readable cookie.
6. Refresh /admin, close/reopen the tab, then allow normal token expiry/refresh without changing machine time. Confirm the same canonical account remains authorized. Test background/foreground and another tab.
7. Click Logout. Confirm Firebase sign-out, Admin storage cleanup, expiry of the routing cookie, navigation to login, and that Back/refresh/direct /admin cannot recover dashboard access. Test logout while refresh is in flight; no session may be restored.
8. Using ONLY an existing Google-linked Customer/Astrologer test account, confirm Admin access is denied. Do not create accounts, change roles, link providers, revoke real accounts or alter existing records to manufacture negative tests. Blocked/revoked scenarios remain mocked unless independently approved existing fixtures are available.
9. Inspect expired/missing credentials and authorization outages. They must show an error/redirect, never fake zero-value dashboard data. Real 401/403 handling must be checked without role mutations or altering real records.
10. Check existing Customer and Astrologer login/navigation using existing approved test accounts. Preserve their records and do not perform payments, OTP requests or KYC/application writes.

100% completion requires the real browser Google authentication and protected dashboard steps to pass. Current result: BLOCKED / NOT 100%.
