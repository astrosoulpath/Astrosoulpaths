# Final security advisory inventory ? 2026-11-02

Package/metavulnerability counts and advisory counts differ. This inventory retains advisory IDs/URLs, affected ranges, resolved versions and direct parents. No production exploit testing or database access was performed.

## Production runtime

{"info": 0, "low": 0, "moderate": 10, "high": 0, "critical": 0, "total": 10}

| Package | Severity | Direct | Locked copies | Direct parents | Underlying advisories / inherited findings |
|---|---|---|---|---|---|
| archiver | moderate | False | 5.3.2 | exceljs | inherits archiver-utils; inherits readdir-glob; inherits zip-stream |
| archiver-utils | moderate | False | 2.1.0, 3.0.4 | archiver, zip-stream | inherits glob |
| bullmq | moderate | True | 4.18.3 | application | inherits glob; inherits uuid |
| exceljs | moderate | True | 4.4.0 | application | inherits archiver; inherits uuid |
| glob | moderate | False | 10.5.0, 13.0.6, 7.2.3, 8.1.0 | @jest/reporters, @nestjs/cli, archiver-utils, bullmq, jest-config, jest-runtime, rimraf, test-exclude | inherits minimatch |
| minimatch | moderate | False | 10.2.6, 3.1.5, 5.1.9, 9.0.9 | @eslint/config-array, @eslint/eslintrc, @typescript-eslint/typescript-estree, eslint, fork-ts-checker-webpack-plugin, glob, readdir-glob, test-exclude | https://github.com/advisories/GHSA-g3hv-75wg-m249 (affected <11.0.1) |
| readdir-glob | moderate | False | 1.1.3 | archiver | inherits minimatch |
| rimraf | moderate | False | 2.7.1 | fstream | inherits glob |
| uuid | moderate | False | 14.0.1, 8.3.2, 9.0.1 | @vonage/jwt, bullmq, exceljs | https://github.com/advisories/GHSA-w5hq-g745-h8pq (affected <11.1.1) |
| zip-stream | moderate | False | 4.1.1 | archiver | inherits archiver-utils |
## All dependencies including builder

{"info": 0, "low": 1, "moderate": 41, "high": 0, "critical": 0, "total": 42}

| Package | Severity | Direct | Locked copies | Direct parents | Underlying advisories / inherited findings |
|---|---|---|---|---|---|
| @eslint-community/eslint-utils | moderate | False | 4.10.1 | @typescript-eslint/utils, eslint | inherits eslint |
| @eslint/config-array | moderate | False | 0.21.2 | eslint | inherits minimatch |
| @eslint/eslintrc | moderate | True | 3.3.7 | eslint | inherits minimatch |
| @jest/core | moderate | False | 30.5.2 | jest, jest-cli | inherits @jest/reporters; inherits @jest/transform; inherits jest-config; inherits jest-resolve-dependencies; inherits jest-runner; inherits jest-runtime; inherits jest-snapshot |
| @jest/expect | moderate | False | 30.5.2 | @jest/globals, jest-circus | inherits jest-snapshot |
| @jest/globals | moderate | False | 30.5.2 | jest-runtime | inherits @jest/expect |
| @jest/reporters | moderate | False | 30.5.2 | @jest/core | inherits @jest/transform; inherits glob |
| @jest/transform | moderate | False | 30.5.2 | @jest/core, @jest/reporters, babel-jest, jest-runner, jest-runtime, jest-snapshot | inherits babel-plugin-istanbul |
| @nestjs/cli | moderate | True | 11.0.24 |  | inherits fork-ts-checker-webpack-plugin; inherits glob |
| @typescript-eslint/eslint-plugin | moderate | False | 8.72.1 | typescript-eslint | inherits @typescript-eslint/parser; inherits @typescript-eslint/type-utils; inherits @typescript-eslint/utils; inherits eslint |
| @typescript-eslint/parser | moderate | False | 8.72.1 | typescript-eslint | inherits @typescript-eslint/typescript-estree; inherits eslint |
| @typescript-eslint/type-utils | moderate | False | 8.72.1 | @typescript-eslint/eslint-plugin | inherits @typescript-eslint/typescript-estree; inherits @typescript-eslint/utils; inherits eslint |
| @typescript-eslint/typescript-estree | moderate | False | 8.72.1 | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils, typescript-eslint | inherits minimatch |
| @typescript-eslint/utils | moderate | False | 8.72.1 | @typescript-eslint/eslint-plugin, @typescript-eslint/type-utils, typescript-eslint | inherits @eslint-community/eslint-utils; inherits @typescript-eslint/typescript-estree; inherits eslint |
| archiver | moderate | False | 5.3.2 | exceljs | inherits archiver-utils; inherits readdir-glob; inherits zip-stream |
| archiver-utils | moderate | False | 2.1.0, 3.0.4 | archiver, zip-stream | inherits glob |
| babel-jest | moderate | False | 30.5.2 | jest-config | inherits @jest/transform; inherits babel-plugin-istanbul |
| babel-plugin-istanbul | moderate | False | 8.0.2 | @jest/transform, babel-jest | inherits test-exclude |
| bullmq | moderate | True | 4.18.3 | application | inherits glob; inherits uuid |
| deepmerge | low | False | 4.3.1 | fork-ts-checker-webpack-plugin, jest-config | https://github.com/advisories/GHSA-gcqx-w48m-w2h4 (affected >=4.2.0 <=4.3.1) |
| eslint | moderate | True | 9.39.5 |  | inherits @eslint-community/eslint-utils; inherits @eslint/config-array; inherits @eslint/eslintrc; inherits minimatch |
| eslint-config-prettier | moderate | True | 10.1.8 |  | inherits eslint |
| eslint-plugin-prettier | moderate | True | 5.5.7 |  | inherits eslint; inherits eslint-config-prettier |
| exceljs | moderate | True | 4.4.0 | application | inherits archiver; inherits uuid |
| fork-ts-checker-webpack-plugin | moderate | False | 9.1.0 | @nestjs/cli | inherits deepmerge; inherits minimatch |
| glob | moderate | False | 10.5.0, 13.0.6, 7.2.3, 8.1.0 | @jest/reporters, @nestjs/cli, archiver-utils, bullmq, jest-config, jest-runtime, rimraf, test-exclude | https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 (affected >=9.0.0 <=14.0.1); inherits minimatch |
| jest | moderate | True | 30.5.2 |  | inherits @jest/core; inherits jest-cli |
| jest-circus | moderate | False | 30.5.2 | jest-config | inherits @jest/expect; inherits jest-runtime; inherits jest-snapshot |
| jest-cli | moderate | False | 30.5.2 | jest | inherits @jest/core; inherits jest-config |
| jest-config | moderate | False | 30.5.2 | @jest/core, jest-cli | inherits babel-jest; inherits deepmerge; inherits glob; inherits jest-circus; inherits jest-runner |
| jest-resolve-dependencies | moderate | False | 30.5.2 | @jest/core | inherits jest-snapshot |
| jest-runner | moderate | False | 30.5.2 | @jest/core, jest-config | inherits @jest/transform; inherits jest-runtime |
| jest-runtime | moderate | False | 30.5.2 | @jest/core, jest-circus, jest-runner | inherits @jest/globals; inherits @jest/transform; inherits glob; inherits jest-snapshot |
| jest-snapshot | moderate | False | 30.5.2 | @jest/core, @jest/expect, jest-circus, jest-resolve-dependencies, jest-runtime | inherits @jest/transform |
| minimatch | moderate | False | 10.2.6, 3.1.5, 5.1.9, 9.0.9 | @eslint/config-array, @eslint/eslintrc, @typescript-eslint/typescript-estree, eslint, fork-ts-checker-webpack-plugin, glob, readdir-glob, test-exclude | https://github.com/advisories/GHSA-g3hv-75wg-m249 (affected <11.0.1) |
| readdir-glob | moderate | False | 1.1.3 | archiver | inherits minimatch |
| rimraf | moderate | False | 2.7.1 | fstream | inherits glob |
| test-exclude | moderate | False | 7.0.2 | babel-plugin-istanbul | inherits glob; inherits minimatch |
| ts-jest | moderate | True | 29.4.15 |  | inherits @jest/transform; inherits babel-jest |
| typescript-eslint | moderate | True | 8.72.1 |  | inherits @typescript-eslint/eslint-plugin; inherits @typescript-eslint/parser; inherits @typescript-eslint/typescript-estree; inherits @typescript-eslint/utils; inherits eslint |
| uuid | moderate | False | 14.0.1, 8.3.2, 9.0.1 | @vonage/jwt, bullmq, exceljs | https://github.com/advisories/GHSA-w5hq-g745-h8pq (affected <11.1.1) |
| zip-stream | moderate | False | 4.1.1 | archiver | inherits archiver-utils |

## Exposure, mitigation and residual risk

- Runtime UUID: GHSA-w5hq-g745-h8pq concerns v3/v5/v6 output-buffer bounds. Inspected BullMQ queue/flow paths call v4() without caller buffers. This lowers demonstrated exposure but does not prove every transitive path unreachable. Preserve server-generated identifiers and never expose buffer/offset control. Existing UUID majors lack a compatible vendor patch; overriding across major versions is deferred.

- Runtime minimatch: GHSA-g3hv-75wg-m249 concerns attacker-controlled matching patterns/amplification. BullMQ legacy script-loader uses the callback-style glob API; changing to modern glob/minimatch exports can break it. Admin Excel export generates a Workbook in memory; no application endpoint forwarding arbitrary filesystem glob patterns was found. Restrict report operations with existing ADMIN RBAC, bound report work, retain disabled workers and do not accept user-provided match patterns. This is conditional exposure analysis, not an exemption or claim of no risk.

- The archive/queue meta-findings inherit those parser/UUID issues through ExcelJS -> archiver -> zip-stream/archiver-utils/readdir-glob/glob/minimatch and BullMQ -> glob/UUID, plus fstream -> rimraf -> glob. Safe upstream backports are preferred. BullMQ major migration, archive replacement, or manually patched vendoring needs independent compatibility coverage and approval; npm suggesting a downgrade/force is not evidence of a safe fix.

- Builder findings require executing affected build tools/parsers. Only trusted source/templates are used in this rehearsal; CI permissions remain contents:read and credentials are not persisted. Never pass production secrets into builds, do not execute unreviewed PR code with privileged secrets, and restrict artifact/log access. These controls do not erase dependency findings or replace vendor patches. Remaining moderate/low builder fixes requiring major changes remain documented.

- Runtime and builder audits now contain zero high/critical entries. Handlebars GHSA-xw65-4hp5-5hc7, GHSA-p8wg-vrv2-v86f and GHSA-8r5x-fm3f-whwj were patched with 4.7.10. Nodemailer advisory set listed in the earlier audit was removed by reviewed 10.3.1 adaptation on Node22; the documented Node20 floor is met, CommonJS/object-transport APIs used here are retained. Local JSON-transport tests cover all three app mail methods, escaping, recipients and Unicode. Real SMTP/provider/device behavior remains unverified and disabled.
