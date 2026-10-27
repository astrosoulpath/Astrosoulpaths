# Single-Google Admin localhost integration: 70% gate

## Observed runtime

On 2026-10-15, port 3000 belongs to Next server PID 25292, child of Next CLI PID 14324. The server started at 11:02:25 local time. Port 4000 belongs to backend PID 14816, started on 2026-10-14. No process was restarted.

Unauthenticated HTTP requests to `/admin`, `/admin.backup-before-token-fix`, and its `/login` route return 500 containing the reported missing `middleware.ts` module error. The running development metadata still describes the older middleware and lacks the backup-route matcher. The current source has one correct Next 16 entry point, `src/proxy.ts`, with matching retirement rules. Do not recreate a second middleware entry point. No executable source reference to the old root file was found; historical reports retain old paths intentionally.

Restart approval is required before resolving the running development graph. First restart only the identified website from its existing terminal. Do not clear `.next` automatically. If the error survives restart, inspect again and obtain separate approval before any cache cleanup.

## Local configuration, not changed

Backend `.env`: DATABASE_URL and DIRECT_URL identify the local `astro_soul_path` database on port 5432; Firebase project is `astrosoulpath-95242`; ADMIN_ALLOWED_FIREBASE_UID is absent. This is file evidence, not proof of the old backend process's inherited environment.

Website `.env.local`: Firebase project matches, but NEXT_PUBLIC_API_BASE_URL targets Render staging. Before any real sign-in, privately change the local website setting to `http://localhost:4000` after authorization. This is an explicit change, not a fallback. Next public variables require the website to reload/rebuild with the chosen value.

The operator must privately inspect the existing selected account in that Firebase project's Authentication console and confirm its actual UID, enabled status, verified email and linked Google provider. Email selection alone never authorizes access. Supply that exact UID only to the backend's server-only ADMIN_ALLOWED_FIREBASE_UID; do not add a NEXT_PUBLIC equivalent, paste it in chat, or commit it. Current Firebase identity and DB conflicts were not re-queried in this task.

## Bootstrap approval boundary

See `backend-main/prisma/admin-google-bootstrap.review.md`. No bootstrap CLI or dry-run was run. Dry-run defaults to a read-only transaction and requires explicit ADMIN_BOOTSTRAP_DATABASE_URL, ADMIN_BOOTSTRAP_EMAIL and existing Firebase Admin credentials in the launching process. It does not load `.env` itself. The approved email is an identity consistency check, not an authorization substitute for the verified UID.

After separate secure configuration and dry-run approval, from backend-main:

```powershell
node -r ts-node/register prisma/admin-google-bootstrap.ts --dry-run
```

Expected: DRY_RUN_READY, zero created records, one planned User and one planned Firebase identity; or ALREADY_PREPARED for an exact existing mapping. Any partial mapping, existing User/email ownership, ambiguous role, disabled/unverified/mismatched Google identity, trigger or target conflict stops. Existing users are never promoted or updated. Successful dry-run does not establish INSERT privileges. Execution needs a separate approval and private audit prerequisites; do not execute during this gate.

## Proposed website restart and checks, approval required

Use Ctrl+C only in the identified website terminal, then:

```powershell
Set-Location C:\Users\iamha\ASP-Platforms\website
npm.cmd run dev -- --hostname localhost --port 3000
```

Do not start a duplicate server or stop the backend as part of this step. After restart, check unauthenticated `/admin` redirects to `/admin/login`, all backup routes return 404, and `/admin/verify-otp` redirects to Google login. No credentials or cookies should be supplied for these checks. Real Google authentication remains gated on secure local configuration, separately approved bootstrap and backend reload.

## Validation

Targeted backend policy/bootstrap/Admin tests: 76 passed, 0 failed. Website routing/session/UI tests: 51 passed, 0 failed. Prisma validation, NestJS build and website TypeScript passed. Production build result is recorded in the accompanying task report. These are local/mocked results, not real Google login verification.
