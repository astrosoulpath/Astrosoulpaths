# Final local security release readiness — 2026-11-02

Overall PARTIAL because residual vulnerabilities and production acceptance remain. Local release commit readiness YES: the candidate is ready for operator review and separate explicit local-commit approval. This is not approval to commit/push/deploy and not a production security PASS. No commit was made.

## Exact candidate

Worktree review/launch/.runtime/security-release-20261101, branch security/stage-b-runtime-isolation-20261101, unchanged HEAD f2ca03e2237acefc1293a10b6e5f47349bd23bbc. All fixes remain uncommitted. The full current file/hash allowlist is FINAL-SECURITY-RELEASE-MANIFEST-20261102.json; it supersedes earlier candidate fingerprints for these changed bytes while retaining old reports/evidence unchanged. Prior pushed release approval does not cover this new candidate.

## Remediation

- Nodemailer 9.1.1 -> explicitly pinned10.3.1. This is an intentionally reviewed major adaptation, not audit fix --force: official10.0 release requires Node20+, met by this Node22 platform, preserves CommonJS and plain Transporter/object configuration APIs used by this app. App implementation unchanged. Three actual MailService methods are exercised with real local JSON transport: recipients, subjects, Unicode and HTML escaping preserved. No SMTP or provider calls were made. Real delivery and edge-case provider behavior are unverified.
- Handlebars pinned4.7.10 for npm and pnpm. GHSA-xw65-4hp5-5hc7, GHSA-p8wg-vrv2-v86f and GHSA-8r5x-fm3f-whwj resolved. Test verifies own function-prototype constructor lookup is blocked and normal interpolation/escaping remains valid.
- Compatible non-force builder lockfile updates remove remaining high findings in brace-expansion, browserslist, fast-uri and js-yaml. Both locks synchronized; pnpm frozen installation PASS; lifecycle scripts disabled during dependency maintenance. Prisma remains6.6.0; mapped-types remains pinned2.1.1; no blanket cross-major archive/queue override or library downgrade.
- Existing non-root Docker configuration, optional-peer pruning, runtime owner credential guards, worker gates, test typing corrections and complete environment template preserved. CI adds the new mail/template regressions. Existing payment/commission/business logic, migrations, website and Flutter source unchanged.

## Audits and residual risk

Production npm package findings: before11 (one high, ten moderate), now10 (zero critical/high/low, ten moderate). Full npm dependency audit including runtime+builder: before51 (one critical, five high,43moderate,two low), now42 (zero critical/high,41moderate,one low). Do not add these totals: all-dependency counts include runtime entries. Counts reflect the public advisory response captured in this run, not OS-image CVE scanning or proof of exploitability.

Remaining runtime entries: archiver, archiver-utils, bullmq, exceljs, glob, minimatch, readdir-glob, rimraf, uuid, zip-stream. Detailed exact chains, affected ranges, resolved versions, advisory IDs/links, and all builder findings are in FINAL-SECURITY-ADVISORY-INVENTORY.md. Underlying runtime advisories include GHSA-g3hv-75wg-m249 (matching-pattern amplification) and GHSA-w5hq-g745-h8pq (UUID v3/v5/v6 caller-buffer bounds); the rest include inherited meta-findings.

No safe compatible vendor fix was identified for the retained legacy matching/archive/UUID majors. Legacy BullMQ's script loader actually calls callback-style glob; blindly forcing modern promise/export APIs can break queue loading. Inspected BullMQ queue/flow generation uses v4() without caller buffers, unlike the affected UUID methods. Admin report generation uses in-memory XLSX buffers; no user-supplied filesystem glob forwarding was found. These observations lower demonstrated exposure but are not an exhaustive non-reachability proof. Keep canonical ADMIN authorization/report limits, reject untrusted matching patterns, preserve all57 disabled/protective gates and maintain source-controlled trusted build templates. Runtime/worker activation remains blocked. A tested queue/archive migration or reviewed vendor backport is the remaining remediation path, not an audit downgrade/force command.

## Verification

- 275 backend tests PASS in21suites, including five new mail/template cases and previous proxy security/finance regressions.
- 37 offline tests PASS:22 guarded activation,12 Stage B policy,three deployment safety.
- Full TypeScript noEmit, Prisma generate/validate and Nest production builds PASS. Prisma generation uses synthetic loopback port1 URL, never production. No migrations.
- Final Docker build PASS; Prisma6.6 generation and Nest build passed inside Linux image. Frozen native dependency installation also PASS.
- Network-disabled derivative build probe PASS as non-root: native Prisma library loads, generated schema excludes DIRECT_URL, Prisma CLI/TypeScript absent, URL/owner guards fail closed, no credential env/dotenv, master and three maintenance gates default OFF. XLSX/PDF buffer and Nodemailer JSON-transport compatibility PASS. No Nest bootstrap/backend container/query/SMTP call.
- All57 safety flags match:53 false/four protective true. Actual Render values remain unknown/offline, not inferred from template.
- Complete uncommitted path/diff review: intended dependency/Docker/CI/tests/template/docs only, including preserved earlier fixes. Credential/private-key/live-key/connection-URL scan found no confirmed secrets. Lockfile integrity hashes/public registry URLs are not credentials. Source pattern scanning is not proof about every historical/binary secret. Git whitespace validation PASS with Windows CR-at-EOL handling.

## Image

Tag asp-stage-b-security:final-security-20261102-f74e2e53.
Docker image ID sha256:84da0b36c9022c7f1159a8f0b858b16a7a70d99aae102a155dcda9aac395795f.
Linux amd64,162649342bytes, USER node (probe confirms nonzero uid), CMD npm run start:prod. Credential variables absent. Image was never started as a backend container. Existing containers/images/evidence were not deleted, stopped or restarted. Build-time public dependency downloads were used; no production build arguments, secrets or environment files supplied.

## Remaining release/production boundary

Next safe action: review this exact candidate manifest and documented moderate/low residual risks, then separately approve one local commit if acceptable. No automatic commit/push is authorized. Retaining moderate legacy dependencies is a documented risk decision, not a zero-vulnerability claim.

Production remains NO-GO pending Render Support verifier-logging assurance, fresh unexpired database evidence, separately approved restricted LOGIN/password activation, effective runtime-only DATABASE_URL and removal of owner DIRECT_URL, Singapore Redis/Firebase/CORS/flag checks, and provider-supported first start of the exact reviewed SHA. No database access, role change, migration, Render edit, Resume, backend startup or GitHub operation occurred during this task. Preserve all existing backups/restore evidence and do not treat old expired identity receipts as current.

Official references: https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0 ; https://github.com/advisories/GHSA-p8wg-vrv2-v86f ; https://github.com/advisories/GHSA-g3hv-75wg-m249 ; https://github.com/advisories/GHSA-w5hq-g745-h8pq .
