import {
  BOOTSTRAP_ERROR_CODES,
  BOOTSTRAP_STAGES,
  runBootstrapWithDiagnostics,
  sanitizedBootstrapFailure,
} from '../../../prisma/admin-google-bootstrap-diagnostics';
const {
  parseDiagnostic,
  runBootstrapOnce,
} = require('../../../prisma/admin-google-bootstrap-launcher.cjs');

describe('bootstrap sanitized diagnostics (offline mocks only)', () => {
  const secret =
    'secret-uid token password postgresql://private:credential@host/db';
  it.each([
    ['CONFIGURATION', 'BOOTSTRAP_LOCAL_TARGET_REQUIRED', false],
    ['CONFIGURATION', 'BOOTSTRAP_FIREBASE_CONFIG_REQUIRED', false],
    ['FIREBASE_LOOKUP', 'auth/user-not-found', false],
    ['FIREBASE_CONFIGURATION', 'app/invalid-credential', false],
    ['FIREBASE_VALIDATION', 'BOOTSTRAP_FIREBASE_IDENTITY_MISMATCH', false],
    ['DATABASE_TRANSACTION', 'BOOTSTRAP_EXISTING_RECORD_CONFLICT', false],
    ['DATABASE_TRANSACTION', 'P2002', false],
    ['DATABASE_TRANSACTION', 'P2028', false],
    ['AUDIT_PREPARATION', 'EACCES', false],
    ['AUDIT_COMPLETION', 'ENOSPC', true],
    ['CLEANUP', 'EIO', true],
  ])('reports only allowlisted %s/%s', async (stage, code, committed) => {
    const emit = jest.fn();
    const work = jest.fn(async (context) => {
      context.stage = stage;
      context.committed = committed;
      throw Object.assign(new Error(secret), { code, metadata: secret });
    });
    expect(await runBootstrapWithDiagnostics(work, emit)).toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      status: 'BOOTSTRAP_STOPPED',
      stage,
      code,
      committed,
      retryAllowed: false,
    });
    expect(JSON.stringify(emit.mock.calls)).not.toContain(secret);
  });
  it('retains exact internal validation codes without raw exception text', () => {
    expect(
      sanitizedBootstrapFailure(
        new Error('BOOTSTRAP_NORMALIZED_EMAIL_CONFLICT'),
        { stage: 'DATABASE_TRANSACTION', committed: false },
      ).code,
    ).toBe('BOOTSTRAP_NORMALIZED_EMAIL_CONFLICT');
  });
  it.each([
    new Error(secret),
    { code: secret },
    new Error('P2002 ' + secret),
    null,
  ])('redacts unknown failures', (error) => {
    const output = sanitizedBootstrapFailure(error, {
      stage: 'CONFIGURATION',
      committed: false,
    });
    expect(output.code).toBe('UNCLASSIFIED_FAILURE');
    expect(JSON.stringify(output)).not.toContain(secret);
  });
  it('does not emit errors on successful mocked work', async () => {
    const emit = jest.fn();
    expect(await runBootstrapWithDiagnostics(async () => {}, emit)).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });
  it('launcher strips additional fields and never keeps raw stderr/stdout', () => {
    const failure = {
      status: 'BOOTSTRAP_STOPPED',
      stage: 'FIREBASE_VALIDATION',
      code: 'BOOTSTRAP_FIREBASE_IDENTITY_MISMATCH',
      committed: false,
      retryAllowed: false,
      uid: secret,
    };
    const spawn = jest.fn().mockReturnValue({
      status: 1,
      stdout: secret,
      stderr: secret + '\n' + JSON.stringify(failure),
    });
    const output = runBootstrapOnce({}, process.cwd(), spawn);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(output.diagnostic.code).toBe(failure.code);
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(output.transactionResult).toBeNull();
  });
  it('timeout does not retry or assume rollback', () => {
    const spawn = jest.fn().mockReturnValue({
      status: null,
      error: { code: 'ETIMEDOUT', message: secret },
      stderr: secret,
    });
    const result = runBootstrapOnce({}, process.cwd(), spawn);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(result.timedOut).toBe(true);
    expect(result.diagnostic).toBeNull();
  });
  it('rejects injected stages/codes and malformed diagnostics', () => {
    for (const line of [
      secret,
      JSON.stringify({
        status: 'BOOTSTRAP_STOPPED',
        stage: secret,
        code: 'EIO',
      }),
      JSON.stringify({
        status: 'BOOTSTRAP_STOPPED',
        stage: 'CLEANUP',
        code: secret,
      }),
    ]) {
      expect(
        parseDiagnostic(line, BOOTSTRAP_STAGES, BOOTSTRAP_ERROR_CODES),
      ).toBeNull();
    }
  });
  it('successful launcher output omits extra identities and tokens', () => {
    const spawn = jest.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        status: 'CREATED',
        usersCreated: 1,
        identitiesCreated: 1,
        uid: secret,
      }),
      stderr: '',
    });
    expect(
      runBootstrapOnce({}, process.cwd(), spawn).transactionResult,
    ).toEqual({ status: 'CREATED', usersCreated: 1, identitiesCreated: 1 });
  });
});

describe('advisory-lock SQLSTATE sanitization', () => {
  const {
    BOOTSTRAP_SQLSTATES,
  } = require('../../../prisma/admin-google-bootstrap-diagnostics');
  const context = { stage: 'ADVISORY_LOCK' as const, committed: false };
  it.each(['42501', '42883', '40001', '0A000'])(
    'retains allowlisted SQLSTATE %s only',
    (sqlstate) => {
      const diagnostic = sanitizedBootstrapFailure(
        {
          code: 'P2010',
          message: 'secret URL',
          meta: {
            code: sqlstate,
            message: 'secret UID',
            parameters: 'secret password',
          },
        },
        context,
      );
      expect(diagnostic).toMatchObject({
        stage: 'ADVISORY_LOCK',
        code: 'P2010',
        sqlstate,
      });
      expect(JSON.stringify(diagnostic)).not.toContain('secret');
      expect(
        parseDiagnostic(
          JSON.stringify({ ...diagnostic, uid: 'secret' }),
          BOOTSTRAP_STAGES,
          BOOTSTRAP_ERROR_CODES,
          BOOTSTRAP_SQLSTATES,
        ),
      ).toEqual(diagnostic);
    },
  );
  it.each(['99999', 'secret UID', '23505 secret', null, {}, 'P2010'])(
    'omits non-allowlisted metadata codes',
    (code) => {
      const diagnostic = sanitizedBootstrapFailure(
        { code: 'P2010', meta: { code } },
        context,
      );
      expect(diagnostic).not.toHaveProperty('sqlstate');
    },
  );
  it('never extracts SQLSTATE from raw messages or unrelated exception codes', () => {
    expect(
      sanitizedBootstrapFailure(
        { code: 'EIO', meta: { code: '42501' } },
        context,
      ),
    ).not.toHaveProperty('sqlstate');
    expect(
      sanitizedBootstrapFailure(
        { code: 'P2010', meta: { message: '42501' } },
        context,
      ),
    ).not.toHaveProperty('sqlstate');
  });
  it('launcher drops an injected SQLSTATE without retaining extra fields', () => {
    const diagnostic = {
      status: 'BOOTSTRAP_STOPPED',
      stage: 'ADVISORY_LOCK',
      code: 'P2010',
      committed: false,
      retryAllowed: false,
      sqlstate: 'private value',
      meta: 'private metadata',
    };
    const parsed = parseDiagnostic(
      JSON.stringify(diagnostic),
      BOOTSTRAP_STAGES,
      BOOTSTRAP_ERROR_CODES,
      BOOTSTRAP_SQLSTATES,
    );
    expect(parsed).not.toHaveProperty('sqlstate');
    expect(JSON.stringify(parsed)).not.toContain('private');
  });
});
