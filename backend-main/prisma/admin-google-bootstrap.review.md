# Local single-Google Admin bootstrap review

Status: prepared and mock-tested; NOT executed. This is not a Prisma seed or migration.

The separate CLI `admin-google-bootstrap.ts` defaults to a read-only dry-run. It requires an explicit local connection to `astro_soul_path` on localhost/127.0.0.1:5432 and verifies the server identity inside the transaction. It does not load `.env` or use `DATABASE_URL` implicitly.

## Proposed mutations, after separate approval

Create exactly one new canonical User with the existing case-insensitive Admin role ID, and one primary Firebase Google identity mapping. Never update/promote an existing User. Exact existing approved mapping returns ALREADY_PREPARED without writes. Partial mappings, email ownership conflicts, ambiguous roles, unexpected table triggers and inconsistent identity evidence stop execution. Both inserts and read-back verification run in one serializable transaction with an advisory lock.

## Secure configuration prerequisites

An operator must privately verify and supply these variables; do not paste values into chat or commit them:

- ADMIN_BOOTSTRAP_DATABASE_URL: explicit approved local connection.
- ADMIN_BOOTSTRAP_EMAIL: the user-approved Google email.
- ADMIN_ALLOWED_FIREBASE_UID: exactly that existing Firebase user's UID, verified privately.
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: existing project-specific Admin SDK credentials.
- Execution only: ADMIN_BOOTSTRAP_AUDIT_FILE and ADMIN_BOOTSTRAP_PRIVATE_AUDIT_CONFIRMED=true.

Use a new audit file outside the repository in a directory with an operator-verified restrictive Windows ACL. File mode 0600 alone does not establish a private Windows ACL. The audit contains canonical record IDs for later review, not the Firebase UID or credentials. Verify database INSERT privileges separately; a successful dry-run does not prove INSERT permission.

## Commands for separate approval, not executed here

From backend-main after securely supplying the variables:

```powershell
node -r ts-node/register prisma/admin-google-bootstrap.ts --dry-run
```

Review DRY_RUN_READY, the target, ownership checks and the exact two proposed inserts before authorizing execution:

```powershell
node -r ts-node/register prisma/admin-google-bootstrap.ts --execute --approve=CREATE_ONE_LOCAL_GOOGLE_ADMIN
```

Do not use the older `admin:bootstrap` package script for this operation. This new CLI is intentionally isolated.

## Failure and verification

Database failures roll back the transaction. A private audit write/disconnect failure AFTER commit cannot undo committed inserts: do not assume rollback, retry blindly, or delete records. Inspect the private audit and exact mapping read-only first. Preserve any uncertain PREPARED audit as evidence. An exact existing mapping is idempotent; conflicting/partial state requires separate review, not repair.

After separately approved execution, verify one canonical mapping, the unchanged existing Admin role, active/unblocked state and zero unrelated record changes. No automatic rollback deletion is provided: any reversal needs separately approved ownership/dependency checks.

## Runtime gate

The website must be explicitly configured for the local backend; the existing staging URL is not changed by this patch. A separately approved local restart must load the compiled backend policy and the verified UID configuration. Then manually verify Google login, protected dashboard data, refresh, logout, unauthorized identities, and Customer/Astrologer regressions. No real-login success is implied by mocked tests or builds.
