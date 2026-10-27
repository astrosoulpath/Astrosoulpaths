// No action on import. This helper invokes at most once and never retains raw stderr.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseDiagnostic(stderr, stages, codes, sqlstates = []) {
  for (const line of String(stderr || '')
    .split(/\r?\n/)
    .reverse()) {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      value?.status !== 'BOOTSTRAP_STOPPED' ||
      !stages.includes(value.stage) ||
      ![...codes, 'UNCLASSIFIED_FAILURE'].includes(value.code) ||
      typeof value.committed !== 'boolean' ||
      value.retryAllowed !== false
    )
      continue;
    return {
      status: 'BOOTSTRAP_STOPPED',
      stage: value.stage,
      code: value.code,
      committed: value.committed,
      retryAllowed: false,
      ...(value.code === 'P2010' && sqlstates.includes(value.sqlstate)
        ? { sqlstate: value.sqlstate }
        : {}),
    };
  }
  return null;
}

function runBootstrapOnce(env, cwd, spawn = spawnSync) {
  // Read only the literal allowlists; never import or execute the bootstrap to parse diagnostics.
  const source = fs.readFileSync(
    path.join(__dirname, 'admin-google-bootstrap-diagnostics.ts'),
    'utf8',
  );
  const extract = (name) => {
    const body = source.match(
      new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`),
    );
    if (!body) throw new Error('Diagnostic allowlist unavailable');
    return [...body[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  };
  const stages = extract('BOOTSTRAP_STAGES');
  const codes = extract('BOOTSTRAP_ERROR_CODES');
  const sqlstates = extract('BOOTSTRAP_SQLSTATES');
  const result = spawn(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      'prisma/admin-google-bootstrap.ts',
      '--execute',
      '--approve=CREATE_ONE_LOCAL_GOOGLE_ADMIN',
    ],
    { env, cwd, encoding: 'utf8', timeout: 60000 },
  );
  let value;
  try {
    value = JSON.parse((result.stdout || '').trim());
  } catch {}
  const transactionResult =
    value &&
    ['CREATED', 'ALREADY_PREPARED'].includes(value.status) &&
    [0, 1].includes(value.usersCreated) &&
    [0, 1].includes(value.identitiesCreated)
      ? {
          status: value.status,
          usersCreated: value.usersCreated,
          identitiesCreated: value.identitiesCreated,
        }
      : null;
  return {
    status: result.status,
    timedOut: result.error?.code === 'ETIMEDOUT',
    transactionResult,
    diagnostic: parseDiagnostic(result.stderr, stages, codes, sqlstates),
  };
}
module.exports = { parseDiagnostic, runBootstrapOnce };
