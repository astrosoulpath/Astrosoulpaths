import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { hasOwnedIdentityProof } from '../astrologer/kyc-document-policy';
import {
  requireAdminRequest,
  readAllowedAdminUid,
} from '../../common/auth/admin-identity-policy';
import {
  moderationInput,
  moderationTransition,
  ModerationKind,
} from './admin-moderation.policy';
type RequestProof = Parameters<typeof requireAdminRequest>[0];
type Subject = { state: string; version: number };
type Audit = {
  details?: {requestedFields?:string[]};
  requestId: string;
  actorId: string;
  userId: string;
  kind: string;
  action: string;
  reason: string;
  previousState: string;
  nextState: string;
  version: number;
  createdAt: Date;
};
@Injectable()
export class AdminModerationService {
  constructor(private readonly prisma: PrismaService) {}
  capabilities() {
    return {
      success: true,
      available:
        process.env.ADMIN_MODERATION_WRITES_ENABLED === 'true' &&
        process.env.ADMIN_MODERATION_SCHEMA_REVIEWED === 'true',
      correctionsAvailable: process.env.ADMIN_MODERATION_WRITES_ENABLED === 'true' && process.env.ADMIN_MODERATION_SCHEMA_REVIEWED === 'true' && process.env.ADMIN_ASTROLOGER_CORRECTIONS_READY === 'true',
    };
  }
  private enabled() {
    if (!this.capabilities().available)
      throw new ServiceUnavailableException(
        'Audited moderation is not activated. No account was changed.',
      );
  }
  private async target(
    tx: Prisma.TransactionClient,
    kind: ModerationKind,
    id: string,
  ) {
    if (!id || id.length > 128)
      throw new NotFoundException('Account not found');
    const profile =
      kind === 'ASTROLOGER'
        ? await tx.astrologer.findUnique({ where: { id } })
        : null;
    if (kind === 'ASTROLOGER' && !profile)
      throw new NotFoundException('Astrologer not found');
    const user = await tx.user.findUnique({
      where: { id: profile?.userId ?? id },
      include: { role: true, astrologer: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.role?.name?.toUpperCase() === 'ADMIN')
      throw new ForbiddenException('Admin accounts cannot be moderated here');
    if (
      kind === 'CUSTOMER' &&
      (!['CUSTOMER', 'USER'].includes(user.role?.name?.toUpperCase() ?? '') ||
        user.astrologer ||
        user.isAstrologer)
    )
      throw new ForbiddenException('A dedicated customer account is required');
    return { user, profile };
  }
  async snapshot(request: RequestProof, kind: ModerationKind, id: string) {
    requireAdminRequest(request);
    if (!this.capabilities().available)
      return { success: true, available: false };
    this.enabled();
    return this.safe(() =>
      this.prisma.$transaction(
        async (tx) => {
          const { user, profile } = await this.target(tx, kind, id);
          const rows = await tx.$queryRaw<
            Subject[]
          >`SELECT "state","version" FROM "AdminModerationSubject" WHERE "kind"=${kind} AND "userId"=${user.id}`;
          const correction = kind==='ASTROLOGER' && this.capabilities().correctionsAvailable ? await tx.$queryRaw<{requestedFields:string[]}[]>`SELECT "requestedFields" FROM "AdminModerationSubject" WHERE "kind"=${kind} AND "userId"=${user.id}` : [];
          const history = await tx.$queryRaw<
            Audit[]
          >`SELECT "requestId","actorId","userId","kind","action","reason","previousState","nextState","version","createdAt" FROM "AdminModerationAudit" WHERE "kind"=${kind} AND "userId"=${user.id} ORDER BY "createdAt" DESC,"version" DESC LIMIT 50`;
          return {
            success: true,
            available: true,
            state:
              rows[0]?.state ??
              (kind === 'CUSTOMER'
                ? user.isBlocked
                  ? 'BLOCKED'
                  : 'ACTIVE'
                : profile?.isApproved && profile.isVerified
                  ? 'APPROVED'
                  : 'UNREVIEWED'),
            version: rows[0]?.version ?? 0,
            active: user.isActive,
            requestedFields: correction[0]?.requestedFields ?? [],
            correctionsAvailable: this.capabilities().correctionsAvailable,
            history,
            allowedActions: (
              [
                'BLOCK',
                'UNBLOCK',
                'VERIFY',
                'APPROVE',
                'REJECT',
                'SUSPEND',
                'REQUEST_CHANGES',
              ] as const
            ).filter((action) => {
              if(action==='REQUEST_CHANGES'&&!this.capabilities().correctionsAvailable)return false;
              try {
                moderationTransition(
                  kind,
                  rows[0]?.state ??
                    (kind === 'CUSTOMER'
                      ? user.isBlocked
                        ? 'BLOCKED'
                        : 'ACTIVE'
                      : profile?.isApproved && profile.isVerified
                        ? 'APPROVED'
                        : 'UNREVIEWED'),
                  action,
                );
                return true;
              } catch {
                return false;
              }
            }),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  async execute(
    request: RequestProof,
    kind: ModerationKind,
    id: string,
    body: unknown,
  ) {
    const actorId = requireAdminRequest(request).id;
    this.enabled();
    const input = moderationInput(body);
    if(input.action==='REQUEST_CHANGES' && (kind!=='ASTROLOGER'||!this.capabilities().correctionsAvailable))throw new ServiceUnavailableException('Astrologer corrections await reviewed migration and activation');
    return this.safe(() =>
      this.prisma.$transaction(
        async (tx) => {
          const target = await this.target(tx, kind, id);
          const userId = target.user.id;
          if (userId === actorId)
            throw new ForbiddenException('Self moderation is not allowed');
          // Existing canonical rows serialize first-use state and repeated commands.
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actorId},${userId}) ORDER BY "id" FOR UPDATE`;
          const actor = await tx.user.findUnique({
            where: { id: actorId },
            include: { role: true },
          });
          const identity = await tx.userAuthIdentity.findUnique({
            where: {
              provider_providerUserId: {
                provider: 'firebase',
                providerUserId: readAllowedAdminUid(),
              },
            },
          });
          if (
            !actor?.isActive ||
            actor.isBlocked ||
            actor.role?.name?.toUpperCase() !== 'ADMIN' ||
            identity?.userId !== actorId
          )
            throw new ForbiddenException(
              'An active authorized Admin is required',
            );
          const previous = input.action==='REQUEST_CHANGES' ? await tx.$queryRaw<Audit[]>`SELECT "requestId","actorId","userId","kind","action","reason","previousState","nextState","version","createdAt","details" FROM "AdminModerationAudit" WHERE "requestId"=${input.requestId}` : await tx.$queryRaw<
            Audit[]
          >`SELECT "requestId","actorId","userId","kind","action","reason","previousState","nextState","version","createdAt" FROM "AdminModerationAudit" WHERE "requestId"=${input.requestId}`;
          if (previous[0]) {
            const a = previous[0];
            if (
              a.actorId !== actorId ||
              a.userId !== userId ||
              a.kind !== kind ||
              a.action !== input.action ||
              a.reason !== input.reason ||
              a.version !== input.expectedVersion + 1
              || (input.action==='REQUEST_CHANGES' && JSON.stringify(a.details?.requestedFields)!==JSON.stringify(input.requestedFields))
            )
              throw new ConflictException(
                'Request ID belongs to a different moderation command',
              );
            return {
              success: true,
              replayed: true,
              state: a.nextState,
              version: a.version,
            };
          }
          const current = await this.target(tx, kind, id);
          const user = current.user;
          const profile = current.profile;
          if (!user.isActive)
            throw new ConflictException(
              'Inactive accounts require a separate reviewed recovery',
            );
          if (kind === 'ASTROLOGER' && user.isBlocked)
            throw new ConflictException(
              'Blocked accounts cannot change astrologer access here',
            );
          const states = await tx.$queryRaw<
            Subject[]
          >`SELECT "state","version" FROM "AdminModerationSubject" WHERE "kind"=${kind} AND "userId"=${userId} FOR UPDATE`;
          const state =
            states[0]?.state ??
            (kind === 'CUSTOMER'
              ? user.isBlocked
                ? 'BLOCKED'
                : 'ACTIVE'
              : profile?.isApproved && profile.isVerified
                ? 'APPROVED'
                : 'UNREVIEWED');
          const version = states[0]?.version ?? 0;
          if (version !== input.expectedVersion)
            throw new ConflictException(
              'Account changed. Refresh before moderating.',
            );
          if (
            states[0] &&
            (kind === 'CUSTOMER'
              ? (state === 'BLOCKED') !== user.isBlocked
              : (state === 'APPROVED') !== !!profile?.isApproved)
          )
            throw new ConflictException(
              'Legacy account flags changed outside audited moderation',
            );
          const next = moderationTransition(kind, state, input.action);
          if (
            kind === 'ASTROLOGER' &&
            input.action === 'VERIFY' &&
            !hasOwnedIdentityProof(profile?.documents, userId)
          ) {
            throw new ConflictException(
              'Owned identity proof is required before verification review',
            );
          }
          if (input.action === 'APPROVE' && !profile?.isVerified)
            throw new ConflictException(
              'Explicit verification review is required before approval',
            );
          const [calls, payments, wallet, payouts] = await Promise.all([
            tx.callSession.count({
              where: {
                OR: [{ userId }, { astrologerId: userId }],
                status: {
                  in: ['PENDING', 'ACTIVE', 'ONGOING'],
                  mode: 'insensitive',
                },
              },
            }),
            tx.paymentOrder.count({ where: { userId, status: 'PENDING' } }),
            tx.wallet.findUnique({
              where: { userId },
              select: { lockedBalance: true },
            }),
            profile
              ? tx.astrologerPayout.count({
                  where: {
                    astrologerId: profile.id,
                    status: { in: ['REQUESTED', 'PROCESSING'] },
                  },
                })
              : Promise.resolve(0),
          ]);
          if (
            calls ||
            payments ||
            payouts ||
            Number(wallet?.lockedBalance ?? 0) > 0
          )
            throw new ConflictException(
              'Active consultations or unsettled operations require a separate maintenance review',
            );
          if (kind === 'CUSTOMER')
            await tx.user.update({
              where: { id: userId },
              data: { isBlocked: next === 'BLOCKED' },
            });
          else {
            await tx.astrologer.update({
              where: { id },
              data: {
                isApproved: next === 'APPROVED',
                isVerified:
                  next === 'REVIEWED' ||
                  next === 'APPROVED' ||
                  next === 'SUSPENDED',
                isOnline: false,
              },
            });
            if (next === 'APPROVED')
              await tx.user.update({
                where: { id: userId },
                data: { isAstrologer: true },
              });
          }
          const changed = input.action==='REQUEST_CHANGES' ? (states[0]
            ? await tx.$executeRaw`UPDATE "AdminModerationSubject" SET "state"=${next},"version"=${version+1},"requestedFields"=${input.requestedFields}::text[],"updatedAt"=CURRENT_TIMESTAMP WHERE "kind"=${kind} AND "userId"=${userId} AND "version"=${version}`
            : await tx.$executeRaw`INSERT INTO "AdminModerationSubject" ("kind","userId","state","version","requestedFields") VALUES (${kind},${userId},${next},1,${input.requestedFields}::text[])`) : states[0]
            ? await tx.$executeRaw`UPDATE "AdminModerationSubject" SET "state"=${next},"version"=${version + 1},"updatedAt"=CURRENT_TIMESTAMP WHERE "kind"=${kind} AND "userId"=${userId} AND "version"=${version}`
            : await tx.$executeRaw`INSERT INTO "AdminModerationSubject" ("kind","userId","state","version") VALUES (${kind},${userId},${next},1)`;
          if (changed !== 1)
            throw new ConflictException(
              'Moderation state changed concurrently',
            );
          if(input.action==='REQUEST_CHANGES')await tx.$executeRaw`INSERT INTO "AdminModerationAudit" ("requestId","actorId","userId","kind","action","reason","previousState","nextState","version","details") VALUES (${input.requestId},${actorId},${userId},${kind},${input.action},${input.reason},${state},${next},${version+1},${JSON.stringify({requestedFields:input.requestedFields})}::jsonb)`;
          else await tx.$executeRaw`INSERT INTO "AdminModerationAudit" ("requestId","actorId","userId","kind","action","reason","previousState","nextState","version") VALUES (${input.requestId},${actorId},${userId},${kind},${input.action},${input.reason},${state},${next},${version + 1})`;
          return {
            success: true,
            replayed: false,
            state: next,
            version: version + 1,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      ),
    );
  }
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Moderation could not be confirmed. Refresh before retrying.',
      );
    }
  }
}
