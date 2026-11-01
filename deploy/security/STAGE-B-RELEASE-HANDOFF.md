# Isolated Stage B security release — local preparation PASS

Branch: `security/stage-b-runtime-isolation-20261101`.
Base and current HEAD: `ab20e50393cc5ab2b7575408b100d0de80bf233c`.
No new commit exists. No commit, staging, push, deployment, LOGIN/password operation, migration, backend Resume or production connection was performed during preparation.

## Scope

The exact source/operation-template file list and hashes are in `stage-b/release-manifest.json`. Only the reviewed runtime credential boundary, scheduler guards, Prisma datasource change, safe image/environment templates and their tests are included. Original Stage A SQL, receipts, private evidence, backups, credential files and local dotenv files are not copied into the release changes.

The isolated tree was created directly from the base, not from the dirty development branch. The16reviewed source files were explicitly hash-checked before copying; six sanitized operator/policy files were copied to deploy/security/stage-b. Everything else in the base is retained. Original957pending paths are not bulk-staged/copied. Package manifests, npm/pnpm lockfiles, migrations, Flutter and website source are unchanged from the base.

Three additional security-only integration adjustments were made only in this worktree:

- Existing Node22 CI runs the new runtime/worker tests and offline Stage B tests, and watches their deployment-template paths. No deploy or migration step is added.
- Generated-schema assertion resolves the Prisma package's actual output through createRequire, supporting both npm and pnpm layouts; the no-DIRECT_URL assertion is unchanged.
- The old financial-integrity synthetic earnings eligibility test explicitly enables/restores its worker gates so that paid/reversed/reserved-row protection is still tested. Production remains default-OFF. One legacy worker file's CRLF line endings were normalized to LF for a clean whitespace check; its business body is otherwise unchanged.

## Actual local checks

- Official previously checksum-verified Node22.23.4, pnpm11.25.0.
- Fresh isolated frozen-lockfile installation, scripts disabled;946packages. Offline content cache was insufficient, so pinned public registry dependencies were downloaded. No dependency versions or lockfiles changed. No shared original node_modules/junction was used as the active dependency tree.
- Prisma6.6 validate and generate PASS, using a synthetic loopback port1 URL; no dotenv files in the isolated root/backend. Pinned engine download required network permission. No database connection or migration is part of these commands.
- TypeScript noEmit and Nest production build PASS under Node22.
- Security/regression selection:95tests PASS in8suites.
- CI-selected backend payment/security selection:237tests PASS in14suites. These overlap with the95selection by27parameterized test cases;305distinct backend cases, not332.
- Stage B offline policy:12tests PASS,57required flags including the previous53plus4worker gates.
- New TypeScript files: formatting check PASS. Git diff whitespace check PASS.
- Full tracked base scan and candidate-file scan: no confirmed secrets/private credentials. Existing credential-URL hits are synthetic localhost/invalid-domain unit-test fixtures; the new guard fixture also uses a literal synthetic password. Pattern scanning is not proof about all Git history/binary formats. No dotenv/dump/private-receipt paths are in the release changes.

Test result JSON and the complete unstaged diff (including new files) are retained under the isolated `.runtime/` directory, never release inputs. Build/cache output is ignored. Failed initial portability and worker-eligibility test attempts were corrected only as described above; the final counts are passing results.

## Credential and worker acceptance

Runtime Prisma schema/client has no DIRECT_URL. Production/Render startup rejects that variable even if blank and rejects non-runtime roles, wrong Singapore resource/database, unsafe TLS and unbounded pools. Owner secrets belong in a separate operator-only migration process; no owner CLI environment is shared with NestJS. Actual Render secret groups/files remain unverified until operator inspection.

Nest scheduled registration defaults OFF through BACKGROUND_JOBS_ENABLED; the three maintenance methods independently require both the master and their own gate. No-call tests cover disabled database and service access. All57feature gates must be privately checked against the deployed configuration; the copied template is not evidence of actual values. Registered Nest schedules are gated; external worker services, inbound API/webhook activity and Redis initialization are separate acceptance items.

## Independent approval sequence — none executed

1. Review the full diff/manifest and original-tree preservation receipt. Approve a local commit only. Record its real SHA afterward; do not call the base SHA the new security release.
2. Inspect GitHub/Render branch bindings and auto-deploy settings read-only. Verify origin is https://github.com/astrosoulpath/Astrosoulpaths.git. Obtain separate approval for the exact new SHA and branch before a normal non-force push, with no tags. Proposed command shape, only after replacing REVIEWED_SHA with the approved real commit: `git -c push.followTags=false push --no-follow-tags origin REVIEWED_SHA:refs/heads/security/stage-b-runtime-isolation-20261101`.
3. Reconfirm Singapore backend service immutable ID/fullSHA/Suspended status, new DB resource dpg-dbicfj8n74is73b23i90-a, fresh identity/ACL receipts, backup evidence and zero runtime sessions. Current role remains NOLOGIN. Independent credential, LOGIN and Render configuration approvals are required; use a reviewed target-pinned guarded operator procedure, not unguarded ALTER ROLE text.
4. Store a unique runtime password only in the approved secret manager, use the hidden psql password workflow after approval, and verify restricted read-only connectivity/privileges without starting NestJS. Set restricted DATABASE_URL; remove owner DIRECT_URL from every service/group/file; preserve the owner credential solely in the operator vault. Verify Prisma6 strict certificate/hostname trust and the actual Singapore internal hostname, URI encoding and total pool budget. No real URL or password is stored in this package.
5. Operator-read-only inventory must establish Singapore Redis identity/auth/TLS, Firebase project/credentials, session secrets/Admin RBAC and exact HTTPS CORS origins. Do not test these by making paid/provider calls, push sends, customer login/device POSTs or wallet writes.
6. Approve any Render Save-only configuration changes separately. Source build command is `pnpm install --frozen-lockfile && pnpm prisma generate && pnpm run build`; start is `pnpm run start:prod`; pre-deploy must be empty. Privately inspect actual dashboard/group/hooks and pipeline commands. No blanket migrate deploy/seed/admin-bootstrap is allowed. Do not apply the generic blueprint to provision duplicate resources or change the existing database.
7. Treat deployment/first startup as an independent approval. Render's normal lifecycle includes start, and deploy hooks reject suspended services; a deploy-without-start operation is NOT verified. Do not Resume the old commit merely to make deployment possible. Establish a provider-supported path where the first running process is the exact new security SHA with restricted credentials and all57gates disabled. If that cannot be assured on the suspended service, stop for a separately reviewed platform/bootstrap alternative, not an automatic resume.
8. Only after the effective SHA/configuration is confirmed, approve bounded health/log/read-only smoke checks. No payments/notifications/maintenance activation is included. This package does not authorize that deployment or smoke test.

## Rollback

First response to unexpected startup is a separately authorized suspension, preserving evidence and restricted credentials. Do not reintroduce the owner URL or use Oregon. The historical source fallback is ab20e50393cc5ab2b7575408b100d0de80bf233c, but it has ungated maintenance and owner-bound configuration. Render rollback can reuse old environment variables/groups and starts a new deploy; one-click rollback is NOT a safe approved recovery for this cutover. Preserve old artifacts for investigation, but review a restricted/worker-safe rollback or fix-forward release before running it. NOLOGIN alone does not close active sessions; any reversal requires identity/session checks and separate approval. No destructive data restore or migration rollback is required by this source-only patch.

Render references: https://render.com/docs/deploys ; https://render.com/docs/deploy-hooks ; https://render.com/docs/configure-environment-variables ; https://render.com/docs/rollbacks . Exact service-specific behavior and current deploy identity require authorized dashboard verification.

## Remaining blockers

No new commit/push, clean-branch hosted CI result, authorized actual Render inventory, restricted LOGIN/query/TLS verification or effective configuration proof exists yet. Full source-vs-restore inventory equality and ACL/ownership recovery remain historical limitations. Production remains NO-GO. Next safe action is review and approval of a local security-only commit, excluding caches/test results. Deployment, DNS, live finance and provider activation remain outside this preparation.
