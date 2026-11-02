# Stage B production dependency triage

All 32 original npm production package findings reviewed. Counts describe vulnerable package entries, not 32 independent exploits. Versions include all locked copies; dev-only copies may also be listed. Production reachability is conditional, not proven by a dependency audit. No production exploitation tests performed.

| Package | Original severity | Direct? | Before | Current npm lock | Audit status | Exposure / disposition |
|---|---|---|---|---|---|---|
| @fastify/busboy | high | False | 3.2.0 | 3.2.4 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| @google-cloud/storage | moderate | False | 7.22.0 | 8.4.0 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| @grpc/grpc-js | high | False | 1.14.4 | 1.14.7 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| @nestjs/platform-express | high | True | 11.1.19 | 11.2.8 | CLEARED in post-fix npm production audit | HTTP parsing or transitive input processing; compatible dependency fixes applied. No live traffic test performed. |
| archiver | moderate | False | 5.3.2 | 5.3.2 | REMAINS | Transitive archive/report helper; inherited glob/minimatch finding. No breaking archive replacement; residual tracked. |
| archiver-utils | moderate | False | 2.1.0, 3.0.4 | 2.1.0, 3.0.4 | REMAINS | Transitive archive/report helper; inherited glob/minimatch finding. No breaking archive replacement; residual tracked. |
| axios | high | True | 1.15.0 | 1.21.0 | CLEARED in post-fix npm production audit | Outbound provider/API requests: redirect, proxy, form-field or prototype-influenced configuration; same-major fixes applied, synthetic contract tests only. |
| body-parser | high | True | 2.2.2 | 2.4.0 | CLEARED in post-fix npm production audit | HTTP parsing or transitive input processing; compatible dependency fixes applied. No live traffic test performed. |
| brace-expansion | high | False | 1.1.14, 2.1.0, 5.0.5 | 1.1.21, 2.1.7, 5.0.5 | CLEARED in post-fix npm production audit | HTTP parsing or transitive input processing; compatible dependency fixes applied. No live traffic test performed. |
| bullmq | moderate | True | 4.18.3 | 4.18.3 | REMAINS | Queue helpers: metadata finding inherits glob/UUID chains. No registered queue consumer found; master gate does not disable every Redis operation. Cross-major queue migration deferred. |
| engine.io | high | False | 6.6.9 | 6.6.11 | CLEARED in post-fix npm production audit | Public socket parsing/transport DoS surface; compatible parser/transport updates applied, production socket access not tested. |
| esbuild | low | False | 0.28.0 | 0.28.2 | CLEARED in post-fix npm production audit | Optional Prisma CLI/config build tooling; pruned with optional peers from runtime image, builder not claimed vulnerability-free. |
| exceljs | moderate | True | 4.4.0 | 4.4.0 | REMAINS | Authorized Admin XLSX report generation uses in-memory Workbook/writeBuffer; metadata finding inherits archive/glob/UUID chains. Do not downgrade report library to clear audit. |
| firebase-admin | moderate | True | 14.2.0 | 14.5.0 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| follow-redirects | high | False | 1.16.0 | 1.16.2 | CLEARED in post-fix npm production audit | Outbound provider/API requests: redirect, proxy, form-field or prototype-influenced configuration; same-major fixes applied, synthetic contract tests only. |
| form-data | high | False | 2.5.6, 4.0.5 | 4.0.6 | CLEARED in post-fix npm production audit | Outbound provider/API requests: redirect, proxy, form-field or prototype-influenced configuration; same-major fixes applied, synthetic contract tests only. |
| gaxios | moderate | False | 6.7.1, 7.3.0 | 7.3.1, 8.3.2 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| glob | moderate | False | 10.5.0, 13.0.6, 7.2.3, 8.1.0 | 10.5.0, 13.0.6, 7.2.3, 8.1.0 | REMAINS | Archive/report and queue filesystem traversal: hostile glob patterns/cancellation needed for advisory path. Admin report currently generates workbooks in memory; library paths still require dedicated testing. |
| google-gax | moderate | False | 5.0.8 | 5.0.4, 6.14.0 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| joi | high | True | 18.1.2 | 18.3.1 | CLEARED in post-fix npm production audit | Environment validation in current source; hostile schema/messages needed for several advisories. Patched within major18; no pricing/auth behavior changed. |
| minimatch | moderate | False | 10.2.5, 3.1.5, 5.1.9, 9.0.9 | 10.2.5, 3.1.5, 5.1.9, 9.0.9 | REMAINS | Archive/report/queue matching: hostile patterns plus affected optimization behavior required. Cross-major override unsafe for consumers; retained. |
| multer | high | False | 2.1.1 | 2.5.0 | CLEARED in post-fix npm production audit | HTTP multipart uploads: DoS with pending async fileFilter; patched same-major override, upload behavior still requires device/E2E checks. |
| nodemailer | high | True | 9.1.1 | 9.1.1 | REMAINS | Lazy SMTP support notifications: malicious SMTP/DNS or attacker-controlled structured addresses can trigger disclosure/DoS. Production reachability not disproved; no major upgrade attempted. |
| proxy-addr | critical | False | 2.0.7 | 2.0.8 | CLEARED in post-fix npm production audit | Express proxy trust: exploitable with incorrectly configured mapped IPv6 trust subnets; source does not explicitly enable trust proxy; provider configuration unknown. |
| qs | moderate | False | 6.15.1 | 6.17.1 | CLEARED in post-fix npm production audit | HTTP parsing or transitive input processing; compatible dependency fixes applied. No live traffic test performed. |
| readdir-glob | moderate | False | 1.1.3 | 1.1.3 | REMAINS | Transitive archive/report helper; inherited glob/minimatch finding. No breaking archive replacement; residual tracked. |
| retry-request | moderate | False | 7.0.2, 8.0.4 | 8.0.4, 9.1.0 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| rimraf | moderate | False | 2.7.1, 5.0.10 | 2.7.1 | REMAINS | Transitive archive/report helper; inherited glob/minimatch finding. No breaking archive replacement; residual tracked. |
| socket.io-parser | high | False | 4.2.6 | 4.2.7 | CLEARED in post-fix npm production audit | Public socket parsing/transport DoS surface; compatible parser/transport updates applied, production socket access not tested. |
| teeny-request | moderate | False | 10.1.4, 9.0.0 | 10.1.4, 11.1.1 | CLEARED in post-fix npm production audit | Firebase/Google SDK chain: malformed remote responses, HTTP parsing or transport behavior; same-range lock updates applied. No real provider calls used to verify reachability. |
| uuid | moderate | False | 14.0.1, 8.3.2, 9.0.1 | 14.0.1, 8.3.2, 9.0.1 | REMAINS | Transitive BullMQ/ExcelJS/HTTP helpers: advisory concerns v3/v5/v6 with caller-provided output buffers, not ordinary v4 string generation. No external buffer control identified in app source; not declared unexploitable. |
| zip-stream | moderate | False | 4.1.1 | 4.1.1 | REMAINS | Transitive archive/report helper; inherited glob/minimatch finding. No breaking archive replacement; residual tracked. |

Critical reference: https://github.com/advisories/GHSA-jqcg-44mw-7w3h (patched proxy-addr 2.0.8).
Multer reference: https://github.com/advisories/GHSA-q7qp-rjg7-q26m (patched 2.5.0).
Residual UUID reference: https://github.com/advisories/GHSA-w5hq-g745-h8pq.
Residual minimatch reference: https://github.com/advisories/GHSA-g3hv-75wg-m249.

Complete advisory titles, affected ranges, advisory URLs and suggested fix metadata are retained in private ignored audit JSONs. No audit fix --force or cross-major overrides were used. Nodemailer10+, BullMQ6+ or archive-library replacement require separate compatibility work.
