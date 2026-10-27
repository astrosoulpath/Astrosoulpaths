import {
  DiagnosticContext,
  BootstrapStage,
  runBootstrapWithDiagnostics,
} from './admin-google-bootstrap-diagnostics';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { readAllowedAdminUid } from '../src/common/auth/admin-identity-policy';

export const BOOTSTRAP_APPROVAL = 'CREATE_ONE_LOCAL_GOOGLE_ADMIN';
export type BootstrapIdentity = {
  uid: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  googleEmail: string;
  googleProviderCount: number;
};
export type BootstrapOptions = {
  databaseUrl: string;
  email: string;
  execute?: boolean;
  approval?: string;
};

function check(ok: unknown, code: string): asserts ok {
  if (!ok) throw new Error(code);
}
export function validateBootstrapOptions(options: BootstrapOptions) {
  const u = new URL(options.databaseUrl);
  check(
    ['postgres:', 'postgresql:'].includes(u.protocol) &&
      ['localhost', '127.0.0.1'].includes(u.hostname) &&
      (u.port || '5432') === '5432' &&
      decodeURIComponent(u.pathname.slice(1)) === 'astro_soul_path' &&
      !!u.username &&
      !u.hash &&
      [...u.searchParams.keys()].every((key) => key === 'schema') &&
      (!u.searchParams.has('schema') ||
        u.searchParams.get('schema') === 'public'),
    'BOOTSTRAP_LOCAL_TARGET_REQUIRED',
  );
  check(
    !!options.email &&
      options.email === options.email.trim().toLowerCase() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email),
    'BOOTSTRAP_EMAIL_REQUIRED',
  );
  check(
    !options.execute || options.approval === BOOTSTRAP_APPROVAL,
    'BOOTSTRAP_EXPLICIT_APPROVAL_REQUIRED',
  );
  u.hostname = '127.0.0.1';
  return u.toString();
}

// Importing this file never connects. Tests inject a mocked Prisma client.
export async function prepareOrExecuteBootstrap(
  prisma: PrismaClient,
  identity: BootstrapIdentity,
  options: BootstrapOptions,
  stage: (value: BootstrapStage) => void = () => {},
) {
  stage('CONFIGURATION');
  validateBootstrapOptions(options);
  stage('FIREBASE_VALIDATION');
  check(
    identity.uid === readAllowedAdminUid() &&
      identity.email === options.email &&
      identity.emailVerified &&
      !identity.disabled &&
      identity.googleProviderCount === 1 &&
      identity.googleEmail === options.email,
    'BOOTSTRAP_FIREBASE_IDENTITY_MISMATCH',
  );
  const execute = options.execute === true;
  stage('DATABASE_TRANSACTION');
  return prisma.$transaction(
    async (tx) => {
      if (!execute) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const target = await tx.$queryRaw<
        Array<{ ok: boolean }>
      >`SELECT current_database()='astro_soul_path' AND inet_server_addr()=inet '127.0.0.1' AND inet_server_port()=5432 AND current_schema()='public' AS ok`;
      check(target[0]?.ok, 'BOOTSTRAP_DATABASE_IDENTITY_MISMATCH');
      const triggers = await tx.$queryRaw<
        Array<{ ok: boolean }>
      >`SELECT NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid IN ('public."User"'::regclass, 'public.user_auth_identities'::regclass) AND NOT tgisinternal) AS ok`;
      check(triggers[0]?.ok, 'BOOTSTRAP_UNREVIEWED_TRIGGER');
      if (execute) {
        stage('ADVISORY_LOCK');
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(1095979057, 1196377165)::text AS lock_result`;
        stage('DATABASE_TRANSACTION');
      } else {
        const readonly = await tx.$queryRaw<
          Array<{ ok: boolean }>
        >`SELECT current_setting('transaction_read_only')='on' AS ok`;
        check(readonly[0]?.ok, 'BOOTSTRAP_READ_ONLY_REQUIRED');
      }
      const roles = await tx.role.findMany({
        where: { name: { equals: 'admin', mode: 'insensitive' } },
      });
      check(
        roles.length === 1,
        'BOOTSTRAP_EXISTING_UNIQUE_ADMIN_ROLE_REQUIRED',
      );
      const internalId = `firebase:${identity.uid}`;
      const mappings = await tx.userAuthIdentity.findMany({
        where: {
          OR: [
            { provider: 'firebase', providerUserId: identity.uid },
            { email: { equals: identity.email, mode: 'insensitive' } },
          ],
        },
      });
      const users = await tx.user.findMany({
        where: {
          OR: [
            { email: { equals: identity.email, mode: 'insensitive' } },
            { supabaseId: internalId },
            ...mappings.map((mapping) => ({ id: mapping.userId })),
          ],
        },
      });
      const profiles = await tx.userProfile.count({
        where: { email: { equals: identity.email, mode: 'insensitive' } },
      });
      const normalized = await tx.$queryRaw<
        Array<{
          normalized_users: number;
          normalized_identities: number;
          normalized_profiles: number;
        }>
      >`SELECT
      (SELECT count(*)::int FROM public."User" WHERE lower(btrim(email))=${identity.email}) AS normalized_users,
      (SELECT count(*)::int FROM public.user_auth_identities WHERE lower(btrim(email))=${identity.email}) AS normalized_identities,
      (SELECT count(*)::int FROM public."UserProfile" WHERE lower(btrim(email))=${identity.email}) AS normalized_profiles`;
      check(
        normalized[0]?.normalized_users ===
          users.filter(
            (user) => user.email?.trim().toLowerCase() === identity.email,
          ).length &&
          normalized[0]?.normalized_identities ===
            mappings.filter(
              (mapping) =>
                mapping.email?.trim().toLowerCase() === identity.email,
            ).length &&
          normalized[0]?.normalized_profiles === profiles,
        'BOOTSTRAP_NORMALIZED_EMAIL_CONFLICT',
      );
      if (users.length || mappings.length) {
        const user = users[0],
          mapping = mappings[0];
        check(
          users.length === 1 &&
            mappings.length === 1 &&
            mapping.provider === 'firebase' &&
            mapping.providerUserId === identity.uid &&
            mapping.userId === user.id &&
            mapping.identityType === 'google' &&
            mapping.email?.trim().toLowerCase() === identity.email &&
            user.email?.trim().toLowerCase() === identity.email &&
            user.supabaseId === internalId &&
            user.roleId === roles[0].id &&
            user.isActive &&
            !user.isBlocked &&
            !user.isAstrologer,
          'BOOTSTRAP_EXISTING_RECORD_CONFLICT',
        );
        check(profiles === 0, 'BOOTSTRAP_LEGACY_PROFILE_CONFLICT');
        return {
          status: 'ALREADY_PREPARED',
          usersCreated: 0,
          identitiesCreated: 0,
        };
      }
      check(profiles === 0, 'BOOTSTRAP_LEGACY_PROFILE_CONFLICT');
      if (!execute)
        return {
          status: 'DRY_RUN_READY',
          usersCreated: 0,
          identitiesCreated: 0,
          plannedUsers: 1,
          plannedIdentities: 1,
        };
      const user = await tx.user.create({
        data: {
          email: identity.email,
          supabaseId: internalId,
          roleId: roles[0].id,
          phone: null,
          isActive: true,
          isBlocked: false,
          isVerified: false,
          isNewUser: false,
          isAstrologer: false,
          isProfileComplete: false,
          freeChatMinutes: 0,
        },
      });
      const mapping = await tx.userAuthIdentity.create({
        data: {
          userId: user.id,
          provider: 'firebase',
          providerUserId: identity.uid,
          identityType: 'google',
          email: identity.email,
          phone: null,
          isPrimary: true,
        },
      });
      const saved = await tx.userAuthIdentity.findUnique({
        where: { id: mapping.id },
        include: { user: true },
      });
      check(
        saved?.user.id === user.id &&
          saved.providerUserId === identity.uid &&
          saved.user.roleId === roles[0].id &&
          saved.user.email === identity.email &&
          saved.identityType === 'google' &&
          saved.user.isActive &&
          !saved.user.isBlocked &&
          saved.user.supabaseId === internalId &&
          saved.user.phone === null &&
          !saved.user.isVerified &&
          !saved.user.isAstrologer,
        'BOOTSTRAP_READBACK_FAILED',
      );
      return {
        status: 'CREATED',
        usersCreated: 1,
        identitiesCreated: 1,
        userId: user.id,
        identityId: mapping.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}

async function main(context: DiagnosticContext) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const args = process.argv.slice(2);
  check(
    args.every(
      (arg) =>
        arg === '--dry-run' ||
        arg === '--execute' ||
        arg.startsWith('--approve='),
    ),
    'BOOTSTRAP_UNKNOWN_ARGUMENT',
  );
  check(
    !(args.includes('--dry-run') && args.includes('--execute')),
    'BOOTSTRAP_CONFLICTING_MODE',
  );
  // Explicit variables only: do not load .env or inherit its database implicitly.
  const options: BootstrapOptions = {
    databaseUrl: process.env.ADMIN_BOOTSTRAP_DATABASE_URL || '',
    email: process.env.ADMIN_BOOTSTRAP_EMAIL || '',
    execute: args.includes('--execute'),
    approval: args
      .find((arg) => arg.startsWith('--approve='))
      ?.slice('--approve='.length),
  };
  const url = validateBootstrapOptions(options);
  readAllowedAdminUid();
  const operationId = randomUUID();
  let auditFd: number | undefined;
  context.stage = 'AUDIT_PREPARATION';
  if (options.execute) {
    const audit = process.env.ADMIN_BOOTSTRAP_AUDIT_FILE;
    check(
      process.env.ADMIN_BOOTSTRAP_PRIVATE_AUDIT_CONFIRMED === 'true',
      'BOOTSTRAP_PRIVATE_AUDIT_CONFIRMATION_REQUIRED',
    );
    check(
      !!audit && path.isAbsolute(audit),
      'BOOTSTRAP_PRIVATE_AUDIT_FILE_REQUIRED',
    );
    const parent = fs.realpathSync(path.dirname(audit));
    const repository = fs.realpathSync(path.resolve(__dirname, '../..'));
    const relative = path.relative(repository, parent);
    check(
      relative === '..' ||
        relative.startsWith('..' + path.sep) ||
        path.isAbsolute(relative),
      'BOOTSTRAP_AUDIT_MUST_BE_OUTSIDE_REPOSITORY',
    );
    auditFd = fs.openSync(path.join(parent, path.basename(audit)), 'wx', 0o600);
    fs.writeSync(
      auditFd,
      JSON.stringify({
        operationId,
        phase: 'PREPARED',
        target: 'astro_soul_path',
      }) + '\n',
    );
    fs.fsyncSync(auditFd);
  }
  let prisma: PrismaClient | undefined;
  try {
    context.stage = 'FIREBASE_CONFIGURATION';
    const projectId = process.env.FIREBASE_PROJECT_ID;
    check(
      !!projectId &&
        !!process.env.FIREBASE_CLIENT_EMAIL &&
        !!process.env.FIREBASE_PRIVATE_KEY,
      'BOOTSTRAP_FIREBASE_CONFIG_REQUIRED',
    );
    const app =
      getApps().find((a) => a.options.projectId === projectId) ??
      initializeApp(
        {
          projectId,
          credential: cert({
            projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          }),
        },
        `asp-bootstrap-${projectId}`,
      );
    context.stage = 'FIREBASE_LOOKUP';
    const firebase = await getAuth(app).getUserByEmail(options.email);
    const google = firebase.providerData.filter(
      (provider) => provider.providerId === 'google.com',
    );
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const result = await prepareOrExecuteBootstrap(
      prisma,
      {
        uid: firebase.uid,
        email: firebase.email?.toLowerCase() || '',
        emailVerified: firebase.emailVerified,
        disabled: firebase.disabled,
        googleEmail: google[0]?.email?.toLowerCase() || '',
        googleProviderCount: google.length,
      },
      options,
      (stage) => {
        context.stage = stage;
      },
    );
    context.committed =
      options.execute === true && result.status !== 'ALREADY_PREPARED';
    context.stage = 'AUDIT_COMPLETION';
    if (auditFd !== undefined) {
      fs.writeSync(
        auditFd,
        JSON.stringify({ operationId, phase: 'COMPLETED', ...result }) + '\n',
      );
      fs.fsyncSync(auditFd);
    }
    console.log(
      JSON.stringify({
        operationId,
        status: result.status,
        usersCreated: result.usersCreated,
        identitiesCreated: result.identitiesCreated,
        ...('plannedUsers' in result
          ? {
              plannedUsers: result.plannedUsers,
              plannedIdentities: result.plannedIdentities,
            }
          : {}),
      }),
    );
  } catch (error) {
    // Preserve the original stage/code if cleanup also fails.
    try {
      if (prisma) await prisma.$disconnect();
    } catch {}
    try {
      if (auditFd !== undefined) fs.closeSync(auditFd);
    } catch {}
    throw error;
  }
  context.stage = 'CLEANUP';
  try {
    if (prisma) await prisma.$disconnect();
  } finally {
    if (auditFd !== undefined) fs.closeSync(auditFd);
  }
}
if (require.main === module)
  void runBootstrapWithDiagnostics(main, (diagnostic) =>
    console.error(JSON.stringify(diagnostic)),
  ).then((ok) => {
    if (!ok) process.exitCode = 1;
  });
