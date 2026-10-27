export const BOOTSTRAP_STAGES = [
  'CONFIGURATION',
  'AUDIT_PREPARATION',
  'FIREBASE_CONFIGURATION',
  'FIREBASE_LOOKUP',
  'FIREBASE_VALIDATION',
  'DATABASE_TRANSACTION',
  'ADVISORY_LOCK',
  'AUDIT_COMPLETION',
  'CLEANUP',
] as const;
export type BootstrapStage = (typeof BOOTSTRAP_STAGES)[number];
export type DiagnosticContext = { stage: BootstrapStage; committed: boolean };

export const BOOTSTRAP_SQLSTATES = [
  '08001',
  '08006',
  '0A000',
  '22P02',
  '23502',
  '23503',
  '23505',
  '25006',
  '25P02',
  '40001',
  '40P01',
  '42501',
  '42601',
  '42703',
  '42804',
  '42883',
  '42P01',
  '55P03',
  '57014',
  '53300',
] as const;

// Exact matches only. Never emit messages, stacks, metadata, paths or identities.
export const BOOTSTRAP_ERROR_CODES = [
  'BOOTSTRAP_AUDIT_MUST_BE_OUTSIDE_REPOSITORY',
  'BOOTSTRAP_CONFLICTING_MODE',
  'BOOTSTRAP_DATABASE_IDENTITY_MISMATCH',
  'BOOTSTRAP_EMAIL_REQUIRED',
  'BOOTSTRAP_EXISTING_RECORD_CONFLICT',
  'BOOTSTRAP_EXISTING_UNIQUE_ADMIN_ROLE_REQUIRED',
  'BOOTSTRAP_EXPLICIT_APPROVAL_REQUIRED',
  'BOOTSTRAP_FIREBASE_CONFIG_REQUIRED',
  'BOOTSTRAP_FIREBASE_IDENTITY_MISMATCH',
  'BOOTSTRAP_LEGACY_PROFILE_CONFLICT',
  'BOOTSTRAP_LOCAL_TARGET_REQUIRED',
  'BOOTSTRAP_NORMALIZED_EMAIL_CONFLICT',
  'BOOTSTRAP_PRIVATE_AUDIT_CONFIRMATION_REQUIRED',
  'BOOTSTRAP_PRIVATE_AUDIT_FILE_REQUIRED',
  'BOOTSTRAP_READ_ONLY_REQUIRED',
  'BOOTSTRAP_READBACK_FAILED',
  'BOOTSTRAP_UNKNOWN_ARGUMENT',
  'BOOTSTRAP_UNREVIEWED_TRIGGER',
  'P1000',
  'P1001',
  'P1002',
  'P1010',
  'P2002',
  'P2003',
  'P2010',
  'P2022',
  'P2028',
  'P2034',
  'EACCES',
  'EPERM',
  'EEXIST',
  'ENOENT',
  'EIO',
  'ENOSPC',
  'auth/user-not-found',
  'auth/invalid-credential',
  'auth/insufficient-permission',
  'auth/internal-error',
  'app/invalid-credential',
  'app/invalid-app-options',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
] as const;

export function sanitizedBootstrapFailure(
  error: unknown,
  context: DiagnosticContext,
) {
  const value = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown };
  } | null;
  const allowed = BOOTSTRAP_ERROR_CODES as readonly unknown[];
  const code = allowed.includes(value?.code)
    ? value!.code
    : allowed.includes(value?.message)
      ? value!.message
      : 'UNCLASSIFIED_FAILURE';
  return {
    status: 'BOOTSTRAP_STOPPED',
    stage: context.stage,
    code,
    committed: context.committed,
    retryAllowed: false,
    ...(value?.code === 'P2010' &&
    (BOOTSTRAP_SQLSTATES as readonly unknown[]).includes(value.meta?.code)
      ? { sqlstate: value.meta!.code as string }
      : {}),
  };
}

export async function runBootstrapWithDiagnostics(
  work: (context: DiagnosticContext) => Promise<void>,
  emit: (diagnostic: ReturnType<typeof sanitizedBootstrapFailure>) => void,
) {
  const context: DiagnosticContext = {
    stage: 'CONFIGURATION',
    committed: false,
  };
  try {
    await work(context);
    return true;
  } catch (error) {
    emit(sanitizedBootstrapFailure(error, context));
    return false;
  }
}
