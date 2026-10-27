import { ConfigService } from '@nestjs/config';
import { hasLiveV2Schema } from './live-schema-compatibility';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, LiveConnectionRole } from '@prisma/client';
import type { JWTPayload } from 'jose';
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AgoraService } from '../call/agora.service';
import {
  LiveCreateDto,
  LiveDiscoveryDto,
  LiveStartDto,
  LiveProofDto,
  LiveResumeDto,
} from './live-v2.dto';
import {
  LIVE_ENDED,
  LiveV2Events,
  type LiveEndedEvent,
} from './live-v2.events';

export interface LiveSocketBinding {
  sessionId: string;
  connectionId: string;
  userId: string;
  generation: number;
}

type Tx = Prisma.TransactionClient;
const sessionInclude = {
  astrologer: { include: { user: true } },
  hostConnection: true,
} as const;
type Session = Prisma.LiveSessionGetPayload<{ include: typeof sessionInclude }>;
type User = Prisma.UserGetPayload<{ include: { astrologer: true } }>;
type Connection = Prisma.LiveConnectionGetPayload<{}>;
type Action = 'renew' | 'resume' | 'heartbeat' | 'leave' | 'end';

@Injectable()
export class LiveV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agora: AgoraService,
    @Optional() private readonly events?: LiveV2Events,
    @Optional() private readonly config: ConfigService = new ConfigService(),
  ) {}

  private async transaction<T>(work: (tx: Tx) => Promise<T>) {
    if (this.config.get('LIVE_V2_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('Live v2 is not enabled');
    }
    const result = await this.prisma.$transaction(
      async (tx) => {
        if (!(await hasLiveV2Schema(tx))) {
          throw new ServiceUnavailableException(
            'Live v2 requires the approved schema migration',
          );
        }
        return work(tx);
      },
      {
        isolationLevel: 'ReadCommitted',
      },
    );
    const event = (result as any)?.[LIVE_ENDED] as LiveEndedEvent | undefined;
    if (event) await this.events?.publish(event);
    return result;
  }
  private async now(tx: Tx) {
    const rows = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS "now"`;
    if (
      !(rows[0]?.now instanceof Date) ||
      !Number.isFinite(rows[0].now.getTime())
    ) {
      throw new ForbiddenException('Authoritative Live clock unavailable');
    }
    return rows[0].now;
  }
  private auth(actor: JWTPayload, now: Date) {
    if (
      !actor.sub?.trim() ||
      !Number.isFinite(actor.exp) ||
      actor.exp! <= now.getTime() / 1000
    ) {
      throw new UnauthorizedException('Valid authenticated session required');
    }
  }
  private async user(tx: Tx, actor: JWTPayload) {
    this.auth(actor, await this.now(tx));
    // Auth guards map Firebase claims to the existing canonical user's subject.
    // Never resolve by email/phone or create/link accounts here.
    const identity = await tx.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: actor.sub!,
        },
      },
      select: { userId: true },
    });
    const found = await tx.user.findUnique({
      where: identity ? { id: identity.userId } : { supabaseId: actor.sub! },
      include: { astrologer: true },
    });
    if (!found) throw new ForbiddenException('Live account unavailable');
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.id} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: found.id },
      include: { astrologer: true },
    });
    if (!user?.isActive || user.isBlocked)
      throw new ForbiddenException('Live account unavailable');
    return user;
  }
  private approved(user: User) {
    if (
      !user.isAstrologer ||
      !user.astrologer?.isApproved ||
      !user.astrologer.isVerified
    ) {
      throw new ForbiddenException('Approved verified astrologer required');
    }
  }
  private async session(tx: Tx, id: string) {
    if (!id || id.length > 128)
      throw new BadRequestException('Invalid Live session');
    const located = await tx.liveSession.findUnique({
      where: { id },
      select: { astrologerId: true },
    });
    if (!located) throw new NotFoundException('Live session unavailable');
    // Lock ordering: caller User -> host Astrologer -> LiveSession.
    // Starts use the same host lock, including legacy starts.
    await tx.$queryRaw`SELECT "id" FROM "Astrologer" WHERE "id" = ${located.astrologerId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "LiveSession" WHERE "id" = ${id} FOR UPDATE`;
    const session = await tx.liveSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Live session unavailable');
    if (session.astrologerId !== located.astrologerId)
      throw new ConflictException('Live host changed');
    if (session.connectionProtocol !== 2)
      throw new ConflictException('Live protocol mismatch');
    return session;
  }
  private hash(secret: string) {
    if (
      typeof secret !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
      Buffer.from(secret, 'base64url').toString('base64url') !== secret
    ) {
      throw new BadRequestException('Invalid Live resume proof');
    }
    return createHash('sha256')
      .update(Buffer.from(secret, 'base64url'))
      .digest('hex');
  }
  private proof(
    connection: Connection,
    user: User,
    sid: string,
    secret: string,
  ) {
    const hash = this.hash(secret);
    if (
      connection.userId !== user.id ||
      connection.liveSessionId !== sid ||
      !/^[a-f0-9]{64}$/.test(connection.resumeSecretHash) ||
      !timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(connection.resumeSecretHash, 'hex'),
      )
    ) {
      throw new ForbiddenException(
        'Live connection ownership verification failed',
      );
    }
    if (
      !Number.isInteger(connection.agoraUid) ||
      connection.agoraUid < 1 ||
      connection.agoraUid > 2_000_000_000 ||
      !Number.isInteger(connection.generation) ||
      connection.generation < 1 ||
      !['PUBLISHER', 'SUBSCRIBER'].includes(connection.role)
    ) {
      throw new ForbiddenException('Invalid stored Live connection');
    }
  }
  private live(session: Session, now: Date) {
    if (session.status !== 'LIVE' || session.endedAt)
      throw new GoneException('Live session ended');
    const host = session.hostConnection;
    if (
      !host ||
      host.id !== session.hostConnectionId ||
      host.liveSessionId !== session.id ||
      host.role !== 'PUBLISHER' ||
      host.userId !== session.astrologer.userId ||
      host.closedAt ||
      !(host.leaseExpiresAt instanceof Date) ||
      host.leaseExpiresAt <= now
    ) {
      throw new GoneException('Live host lease unavailable');
    }
    if (
      !session.astrologer.isApproved ||
      !session.astrologer.isVerified ||
      !session.astrologer.user.isActive ||
      session.astrologer.user.isBlocked ||
      !session.astrologer.user.isAstrologer
    )
      throw new ForbiddenException('Live host unavailable');
  }
  private active(connection: Connection, now: Date) {
    if (
      connection.closedAt ||
      !(connection.leaseExpiresAt instanceof Date) ||
      connection.leaseExpiresAt <= now
    ) {
      throw new GoneException('Live connection expired or closed');
    }
  }
  private host(connection: Connection, session: Session, user: User) {
    this.approved(user);
    if (
      connection.role !== 'PUBLISHER' ||
      session.hostConnectionId !== connection.id ||
      session.astrologerId !== user.astrologer!.id
    )
      throw new ForbiddenException('Designated host required');
  }
  private visible(connection: Connection) {
    return {
      id: connection.id,
      generation: connection.generation,
      role: connection.role,
      leaseExpiresAt: connection.leaseExpiresAt,
    };
  }
  private async count(tx: Tx, session: Session, now: Date) {
    if (!this.available(session, now)) return 0;
    if (
      session.status !== 'LIVE' ||
      session.endedAt ||
      !session.hostConnection ||
      session.hostConnection.closedAt ||
      session.hostConnection.leaseExpiresAt <= now
    )
      return 0;
    return tx.liveConnection.count({
      where: {
        liveSessionId: session.id,
        role: 'SUBSCRIBER',
        closedAt: null,
        leaseExpiresAt: { gt: now },
      },
    });
  }
  private rtc(
    actor: JWTPayload,
    session: Session,
    connection: Connection,
    now: Date,
  ) {
    this.auth(actor, now);
    const remaining = Math.floor(
      actor.exp! -
        Math.max(Math.ceil(now.getTime() / 1000), Math.ceil(Date.now() / 1000)),
    );
    if (remaining < 10)
      throw new UnauthorizedException(
        'Refresh authentication before requesting a Live token',
      );
    return this.agora.generateRtcToken(
      session.channelName,
      connection.agoraUid,
      connection.role,
      Math.min(120, remaining),
    );
  }
  private async response(
    tx: Tx,
    actor: JWTPayload,
    session: Session,
    connection: Connection,
    now: Date,
  ) {
    return {
      success: true,
      data: {
        session: {
          id: session.id,
          astrologerId: session.astrologerId,
          channelName: session.channelName,
          title: session.title,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          connectionProtocol: 2,
          viewerCount: await this.count(tx, session, now),
          astrologer: {
            id: session.astrologer.id,
            name: session.astrologer.user.name ?? 'Astrologer',
            avatarUrl:
              session.astrologer.user.avatarUrl ??
              session.astrologer.profileUrl,
            rating: session.astrologer.rating ?? 0,
            isVerified: session.astrologer.isVerified,
          },
        },
        connection: this.visible(connection),
        rtc: this.rtc(actor, session, connection, now),
        serverTime: now,
      },
    };
  }
  private async create(
    tx: Tx,
    user: User,
    session: Session,
    body: LiveCreateDto,
    role: LiveConnectionRole,
    now: Date,
  ) {
    let uid = 0;
    for (let i = 0; i < 8; i++) {
      const candidate = randomInt(1, 2_000_000_001);
      const exists = await tx.liveConnection.findUnique({
        where: {
          liveSessionId_agoraUid: {
            liveSessionId: session.id,
            agoraUid: candidate,
          },
        },
      });
      if (!exists) {
        uid = candidate;
        break;
      }
    }
    if (!uid) throw new ConflictException('Live UID allocation unavailable');
    const viewer =
      role === 'SUBSCRIBER'
        ? await tx.liveViewer.create({
            data: { liveSessionId: session.id, userId: user.id },
          })
        : null;
    return tx.liveConnection.create({
      data: {
        liveSessionId: session.id,
        userId: user.id,
        role,
        agoraUid: uid,
        resumeSecretHash: this.hash(body.resumeSecret),
        joinRequestId: body.joinRequestId,
        generation: 1,
        lastHeartbeatAt: now,
        leaseExpiresAt: new Date(
          now.getTime() + (role === 'PUBLISHER' ? 60_000 : 45_000),
        ),
        legacyViewerId: viewer?.id,
      },
    });
  }
  async start(actor: JWTPayload, body: LiveStartDto) {
    return this.transaction(async (tx) => {
      const user = await this.user(tx, actor);
      this.approved(user);
      // Same host-row lock as legacy starts, preventing protocol-1/2 races.
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Astrologer" WHERE "id" = ${user.astrologer!.id} AND "isApproved" = true AND "isVerified" = true FOR UPDATE`;
      if (locked.length !== 1)
        throw new ForbiddenException('Approved verified astrologer required');
      const prior = await tx.liveConnection.findUnique({
        where: {
          userId_joinRequestId: {
            userId: user.id,
            joinRequestId: body.joinRequestId,
          },
        },
      });
      if (prior) {
        const session = await this.session(tx, prior.liveSessionId);
        this.proof(prior, user, session.id, body.resumeSecret);
        this.host(prior, session, user);
        if ((session.title ?? '') !== (body.title?.trim() || '')) {
          throw new ConflictException('Start request payload conflict');
        }
        const now = await this.now(tx);
        this.live(session, now);
        this.active(prior, now);
        return this.response(tx, actor, session, prior, now);
      }
      const existing = await tx.liveSession.findFirst({
        where: {
          astrologerId: user.astrologer!.id,
          status: 'LIVE',
          endedAt: null,
        },
      });
      if (existing)
        throw new ConflictException(
          'A Live session already exists; resume it or end it first',
        );
      const session = await tx.liveSession.create({
        data: {
          astrologerId: user.astrologer!.id,
          channelName: `live_${randomUUID().replace(/-/g, '')}`,
          title: body.title?.trim() || null,
          connectionProtocol: 2,
          status: 'LIVE',
        },
        include: sessionInclude,
      });
      const now = await this.now(tx);
      const connection = await this.create(
        tx,
        user,
        session,
        body,
        'PUBLISHER',
        now,
      );
      const designated = await tx.liveSession.update({
        where: { id: session.id },
        data: { hostConnectionId: connection.id },
        include: sessionInclude,
      });
      return this.response(tx, actor, designated, connection, now);
    });
  }
  async join(actor: JWTPayload, sid: string, body: LiveCreateDto) {
    return this.transaction(async (tx) => {
      const user = await this.user(tx, actor);
      const session = await this.session(tx, sid);
      const now = await this.now(tx);
      this.live(session, now);
      const prior = await tx.liveConnection.findUnique({
        where: {
          userId_joinRequestId: {
            userId: user.id,
            joinRequestId: body.joinRequestId,
          },
        },
      });
      if (prior) {
        this.proof(prior, user, sid, body.resumeSecret);
        if (prior.role !== 'SUBSCRIBER')
          throw new ConflictException('Join request role conflict');
        this.active(prior, now);
        return this.response(tx, actor, session, prior, now);
      }
      const connection = await this.create(
        tx,
        user,
        session,
        body,
        'SUBSCRIBER',
        now,
      );
      return this.response(tx, actor, session, connection, now);
    });
  }
  async operate(
    actor: JWTPayload,
    sid: string,
    cid: string,
    action: Action,
    body: LiveProofDto | LiveResumeDto,
  ) {
    return this.transaction(async (tx) => {
      const user = await this.user(tx, actor);
      const session = await this.session(tx, sid);
      let connection = await tx.liveConnection.findUnique({
        where: { id: cid },
      });
      if (!connection)
        throw new NotFoundException('Live connection unavailable');
      this.proof(connection, user, sid, body.resumeSecret);
      const now = await this.now(tx);
      this.auth(actor, now);
      const resumeId =
        action === 'resume'
          ? (body as LiveResumeDto).resumeRequestId
          : undefined;
      const retry =
        resumeId &&
        connection.lastResumeRequestId === resumeId &&
        connection.generation === body.generation + 1;
      if (connection.generation !== body.generation && !retry)
        throw new ConflictException('Stale Live connection generation');
      if (action === 'end') {
        this.host(connection, session, user);
        return this.end(tx, session, now);
      }
      if (action === 'leave') {
        if (connection.role === 'PUBLISHER') {
          this.host(connection, session, user);
          return this.end(tx, session, now);
        }
        if (!connection.closedAt)
          connection = await tx.liveConnection.update({
            where: { id: cid },
            data: { closedAt: now },
          });
        if (connection.legacyViewerId)
          await tx.liveViewer.updateMany({
            where: {
              id: connection.legacyViewerId,
              userId: user.id,
              leftAt: null,
            },
            data: { leftAt: connection.closedAt },
          });
        return {
          success: true,
          data: {
            connectionId: cid,
            closedAt: connection.closedAt,
            viewerCount: await this.count(tx, session, now),
            serverTime: now,
          },
        };
      }
      this.live(session, now);
      this.active(connection, now);
      if (connection.role === 'PUBLISHER') this.host(connection, session, user);
      if (action === 'resume') {
        if (!resumeId)
          throw new BadRequestException('Resume request ID required');
        if (!retry) {
          if (
            connection.lastResumeRequestId === resumeId ||
            connection.generation >= 2147483646
          )
            throw new ConflictException('Resume request conflict');
          connection = await tx.liveConnection.update({
            where: { id: cid },
            data: {
              generation: { increment: 1 },
              lastResumeRequestId: resumeId,
            },
          });
        }
      }
      if (action === 'heartbeat' || action === 'resume') {
        connection = await tx.liveConnection.update({
          where: { id: cid },
          data: {
            lastHeartbeatAt: now,
            leaseExpiresAt: new Date(
              now.getTime() +
                (connection.role === 'PUBLISHER' ? 60_000 : 45_000),
            ),
          },
        });
      }
      return {
        success: true,
        data: {
          connection: this.visible(connection),
          ...(action === 'heartbeat'
            ? {}
            : { rtc: this.rtc(actor, session, connection, now) }),
          serverTime: now,
        },
      };
    });
  }
  private async end(
    tx: Tx,
    session: Session,
    now: Date,
    reason: LiveEndedEvent['reason'] = 'EXPLICIT_END',
  ) {
    let changed = false;
    if (session.status !== 'ENDED' || !session.endedAt) {
      if (session.status !== 'LIVE' || session.endedAt)
        throw new ConflictException('Invalid Live session state');
      session = await tx.liveSession.update({
        where: { id: session.id },
        data: { status: 'ENDED', endedAt: now },
        include: sessionInclude,
      });
      changed = true;
      await tx.liveConnection.updateMany({
        where: { liveSessionId: session.id, closedAt: null },
        data: { closedAt: now },
      });
      await tx.liveViewer.updateMany({
        where: { liveSessionId: session.id, leftAt: null },
        data: { leftAt: now },
      });
    }
    const result = {
      success: true,
      data: {
        sessionId: session.id,
        status: 'ENDED',
        endedAt: session.endedAt,
        viewerCount: 0,
      },
    };
    if (changed)
      Object.defineProperty(result, LIVE_ENDED, {
        value: {
          eventId: `live-ended:${session.id}:${session.endedAt!.toISOString()}`,
          sessionId: session.id,
          status: 'ENDED',
          endedAt: session.endedAt!,
          reason,
        } satisfies LiveEndedEvent,
      });
    return result;
  }

  async bindSocket(
    actor: JWTPayload,
    sid: string,
    cid: string,
    body: LiveResumeDto,
  ) {
    // Uses the existing idempotent resume contract. A new binding attempt must
    // use a fresh resumeRequestId; retry a lost acknowledgement with the same ID.
    const resumed = await this.operate(actor, sid, cid, 'resume', body);
    if (!('connection' in resumed.data))
      throw new ForbiddenException('Live resume unavailable');
    return this.socketAccess(actor, {
      sessionId: sid,
      connectionId: cid,
      generation: resumed.data.connection.generation,
    });
  }

  private async socketState(
    tx: Tx,
    actor: JWTPayload,
    binding: Omit<LiveSocketBinding, 'userId'> & { userId?: string },
  ) {
    const user = await this.user(tx, actor);
    const session = await this.session(tx, binding.sessionId);
    const now = await this.now(tx);
    this.auth(actor, now);
    this.live(session, now);
    const connection = await tx.liveConnection.findUnique({
      where: { id: binding.connectionId },
    });
    if (
      !connection ||
      connection.liveSessionId !== session.id ||
      connection.userId !== user.id ||
      (binding.userId !== undefined && binding.userId !== user.id)
    )
      throw new ForbiddenException('Live socket ownership verification failed');
    this.active(connection, now);
    if (connection.generation !== binding.generation)
      throw new ConflictException('Stale Live socket generation');
    if (!['PUBLISHER', 'SUBSCRIBER'].includes(connection.role))
      throw new ForbiddenException('Invalid Live socket role');
    if (connection.role === 'PUBLISHER') this.host(connection, session, user);
    return { user, session, connection, now };
  }

  async socketAccess(
    actor: JWTPayload,
    binding: Omit<LiveSocketBinding, 'userId'> & { userId?: string },
  ) {
    return this.transaction(async (tx) => {
      const { user, connection } = await this.socketState(tx, actor, binding);
      return {
        sessionId: binding.sessionId,
        connectionId: connection.id,
        userId: user.id,
        generation: connection.generation,
      };
    });
  }

  async socketHeartbeat(actor: JWTPayload, binding: LiveSocketBinding) {
    return this.transaction(async (tx) => {
      const { connection, now } = await this.socketState(tx, actor, binding);
      const updated = await tx.liveConnection.update({
        where: { id: connection.id },
        data: {
          lastHeartbeatAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + (connection.role === 'PUBLISHER' ? 60_000 : 45_000),
          ),
        },
      });
      return { connection: this.visible(updated), serverTime: now };
    });
  }

  async socketMessage(
    actor: JWTPayload,
    binding: LiveSocketBinding,
    raw: string,
  ) {
    const message = typeof raw === 'string' ? raw.trim() : '';
    if (!message || message.length > 500)
      throw new BadRequestException(
        'Live message must contain 1 to 500 characters',
      );
    return this.transaction(async (tx) => {
      const { user, connection } = await this.socketState(tx, actor, binding);
      const saved = await tx.liveMessage.create({
        data: { liveSessionId: binding.sessionId, userId: user.id, message },
      });
      return {
        id: saved.id,
        liveSessionId: saved.liveSessionId,
        message: saved.message,
        createdAt: saved.createdAt,
        sender: {
          id: user.id,
          name: user.name ?? 'User',
          avatarUrl: user.avatarUrl ?? null,
          isAstrologer: connection.role === 'PUBLISHER',
        },
      };
    });
  }

  async sweepLeases() {
    // Scan only protocol-2 records. Each decision is rechecked under the same
    // host/session locks as heartbeat/end; scanning itself does not authorize an end.
    const candidates = await this.transaction(async (tx) => {
      const now = await this.now(tx);
      const hosts = await tx.liveSession.findMany({
        where: {
          connectionProtocol: 2,
          status: 'LIVE',
          endedAt: null,
          OR: [
            { hostConnection: { is: null } },
            {
              hostConnection: {
                is: {
                  OR: [
                    { closedAt: { not: null } },
                    { leaseExpiresAt: { lte: now } },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
        orderBy: { startedAt: 'asc' },
        take: 100,
      });
      const viewers = await tx.liveConnection.findMany({
        where: {
          role: 'SUBSCRIBER',
          closedAt: null,
          leaseExpiresAt: { lte: now },
          liveSession: { connectionProtocol: 2 },
        },
        select: { id: true, liveSessionId: true },
        orderBy: { leaseExpiresAt: 'asc' },
        take: 100,
      });
      return { hosts, viewers };
    });
    let failures = 0;
    for (const candidate of candidates.hosts) {
      try {
        await this.transaction(async (tx) => {
          const session = await this.session(tx, candidate.id);
          const now = await this.now(tx);
          if (session.status !== 'LIVE' || session.endedAt) return;
          const host = session.hostConnection;
          if (host && !host.closedAt && host.leaseExpiresAt > now) return;
          return this.end(tx, session, now, 'HOST_LEASE_EXPIRED');
        });
      } catch {
        failures++;
      }
    }
    for (const candidate of candidates.viewers) {
      try {
        await this.transaction(async (tx) => {
          await this.session(tx, candidate.liveSessionId);
          const now = await this.now(tx);
          const connection = await tx.liveConnection.findUnique({
            where: { id: candidate.id },
          });
          if (
            !connection ||
            connection.role !== 'SUBSCRIBER' ||
            connection.closedAt ||
            connection.liveSessionId !== candidate.liveSessionId ||
            connection.leaseExpiresAt > now
          )
            return;
          await tx.liveConnection.update({
            where: { id: connection.id },
            data: { closedAt: now },
          });
          if (connection.legacyViewerId)
            await tx.liveViewer.updateMany({
              where: {
                id: connection.legacyViewerId,
                liveSessionId: connection.liveSessionId,
                userId: connection.userId,
                leftAt: null,
              },
              data: { leftAt: now },
            });
        });
      } catch {
        failures++;
      }
    }
    return {
      hostCandidates: candidates.hosts.length,
      viewerCandidates: candidates.viewers.length,
      failures,
    };
  }
  async discover(actor: JWTPayload, query: LiveDiscoveryDto) {
    const { offset = 0, limit = 20 } = query;
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 10000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      throw new BadRequestException('Invalid Live discovery pagination');
    }
    return this.transaction(async (tx) => {
      await this.user(tx, actor);
      const now = await this.now(tx);
      this.auth(actor, now);
      const rows = await tx.liveSession.findMany({
        where: {
          connectionProtocol: 2,
          status: 'LIVE',
          endedAt: null,
          astrologer: {
            isApproved: true,
            isVerified: true,
            user: { isActive: true, isBlocked: false, isAstrologer: true },
          },
          hostConnection: {
            is: {
              role: 'PUBLISHER',
              closedAt: null,
              leaseExpiresAt: { gt: now },
            },
          },
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit + 1,
        include: sessionInclude,
      });
      const sessions: Array<
        Pick<
          Session,
          'id' | 'astrologerId' | 'title' | 'status' | 'startedAt' | 'endedAt'
        > & {
          connectionProtocol: 2;
          viewerCount: number;
          astrologer: {
            id: string;
            name: string;
            avatarUrl: string | null;
            rating: number;
            isVerified: boolean;
          };
        }
      > = [];
      for (const row of rows.slice(0, limit)) {
        // Also verify cross-relation ownership: nullable foreign keys alone do
        // not prove that the designated host belongs to this session/account.
        if (row.connectionProtocol !== 2 || !this.available(row, now)) continue;
        sessions.push({
          id: row.id,
          astrologerId: row.astrologerId,
          title: row.title,
          status: row.status,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          connectionProtocol: 2,
          viewerCount: await this.count(tx, row, now),
          astrologer: {
            id: row.astrologer.id,
            name: row.astrologer.user.name ?? 'Astrologer',
            avatarUrl:
              row.astrologer.user.avatarUrl ??
              row.astrologer.profileUrl ??
              null,
            rating: row.astrologer.rating ?? 0,
            isVerified: row.astrologer.isVerified,
          },
        });
      }
      return {
        success: true,
        data: {
          sessions,
          nextOffset:
            rows.length > limit && offset + limit <= 10000
              ? offset + limit
              : null,
          serverTime: now,
        },
      };
    });
  }

  async status(actor: JWTPayload, sid: string) {
    return this.transaction(async (tx) => {
      await this.user(tx, actor);
      const session = await this.session(tx, sid);
      const now = await this.now(tx);
      this.auth(actor, now);
      const hostLeaseValid = this.available(session, now);
      return {
        success: true,
        data: {
          sessionId: sid,
          status: session.status,
          endedAt: session.endedAt,
          viewerCount: await this.count(tx, session, now),
          hostLeaseValid,
          serverTime: now,
        },
      };
    });
  }

  private available(session: Session, now: Date) {
    try {
      this.live(session, now);
      return true;
    } catch {
      return false;
    }
  }
}
