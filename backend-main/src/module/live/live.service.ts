import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  hasLiveV2Schema,
  legacySessionSelect,
} from './live-schema-compatibility';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AgoraService } from '../call/agora.service';

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agoraService: AgoraService,
  ) {}

  private async sessionRead(
    db: any,
    method: 'findFirst' | 'findUnique' | 'findMany',
    args: any,
  ) {
    const v2 = await hasLiveV2Schema(db);
    const { include, ...rest } = args;
    const where = { ...rest.where };
    if (!v2) delete where.connectionProtocol;
    const result = await db.liveSession[method]({
      ...rest,
      where,
      select: {
        ...legacySessionSelect,
        ...(v2 ? { connectionProtocol: true } : {}),
        ...include,
      },
    });
    const normalize = (row: any) =>
      row && { ...row, connectionProtocol: v2 ? row.connectionProtocol : 1 };
    return Array.isArray(result) ? result.map(normalize) : normalize(result);
  }

  private async getUserBySupabaseId(supabaseId: string) {
    const normalized = supabaseId?.trim();

    if (!normalized) {
      throw new BadRequestException('Authenticated user is required');
    }

    /*
     * Canonical production identity:
     *
     * Supabase JWT subject
     *        ->
     * UserAuthIdentity(provider = supabase)
     *        ->
     * canonical User.id
     *
     * Keep User.supabaseId as a legacy fallback so existing accounts
     * continue to work without changing any other authentication flow.
     */
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalized,
        },
      },
      select: {
        userId: true,
      },
    });

    const user = identity?.userId
      ? await this.prisma.user.findUnique({
          where: {
            id: identity.userId,
          },
          include: {
            astrologer: true,
          },
        })
      : await this.prisma.user.findUnique({
          where: {
            supabaseId: normalized,
          },
          include: {
            astrologer: true,
          },
        });

    if (!user) {
      throw new ForbiddenException('User account is not allowed');
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException('User account is not allowed');
    }

    return user;
  }

  private serializeSession(session: any, viewerCount = 0) {
    return {
      id: session.id,
      astrologerId: session.astrologerId,
      channelName: session.channelName,
      title: session.title,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      viewerCount,
      astrologer: {
        id: session.astrologer.id,
        name: session.astrologer.user.name ?? 'Astrologer',
        avatarUrl:
          session.astrologer.user.avatarUrl ??
          session.astrologer.profileUrl ??
          null,
        rating: session.astrologer.rating ?? 0,
        isVerified: session.astrologer.isVerified,
      },
    };
  }

  async startLive(supabaseId: string, title?: string) {
    const user = await this.getUserBySupabaseId(supabaseId);
    const astrologer = user.astrologer;

    if (!user.isAstrologer || !astrologer) {
      throw new ForbiddenException('Astrologer account is required');
    }

    if (!astrologer.isApproved || !astrologer.isVerified) {
      throw new ForbiddenException(
        'Only approved and verified astrologers can go live',
      );
    }

    // Serialize starts for this host across API workers. The lock and the
    // existence check must share a transaction (an in-memory mutex is not enough).
    const session = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Astrologer"
        WHERE "id" = ${astrologer.id}
          AND "isApproved" = true AND "isVerified" = true
        FOR UPDATE
      `;
        if (locked.length !== 1) {
          throw new ForbiddenException(
            'Only approved and verified astrologers can go live',
          );
        }
        const existing = await this.sessionRead(tx, 'findFirst', {
          where: {
            astrologerId: astrologer.id,
            status: 'LIVE',
            endedAt: null,
          },
          include: {
            astrologer: {
              include: {
                user: true,
              },
            },
          },
        });

        if (existing && existing.connectionProtocol !== 1) {
          throw new ConflictException('Use Live v2 for this session');
        }
        if (existing) return existing;
        const channelName = 'live_' + randomUUID().replace(/-/g, '');
        if (!(await hasLiveV2Schema(tx))) {
          // Prisma create may inject new defaults despite a restricted select.
          // Bind every value and write only the original schema's columns.
          const id = randomUUID();
          await tx.$executeRaw`
          INSERT INTO "LiveSession" ("id", "astrologerId", "channelName", "title", "status", "updatedAt")
          VALUES (${id}, ${astrologer.id}, ${channelName}, ${title?.trim() || null}, 'LIVE', CURRENT_TIMESTAMP)
        `;
          return this.sessionRead(tx, 'findUnique', {
            where: { id },
            include: { astrologer: { include: { user: true } } },
          });
        }
        return tx.liveSession.create({
          data: {
            astrologerId: astrologer.id,
            channelName,
            title: title?.trim() || null,
            status: 'LIVE',
          },
          select: {
            ...legacySessionSelect,
            connectionProtocol: true,
            astrologer: { include: { user: true } },
          },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );

    const uid = Math.floor(Math.random() * 2_000_000_000) + 1;

    const rtc = this.agoraService.generateRtcToken(
      session.channelName,
      uid,
      'PUBLISHER',
    );

    const viewerCount = await this.prisma.liveViewer.count({
      where: {
        liveSessionId: session.id,
        leftAt: null,
      },
    });

    return {
      success: true,
      data: {
        session: this.serializeSession(session, viewerCount),
        rtc,
      },
    };
  }

  async endLive(supabaseId: string, liveSessionId: string) {
    const user = await this.getUserBySupabaseId(supabaseId);
    const astrologer = user.astrologer;

    if (!astrologer) {
      throw new ForbiddenException('Astrologer account is required');
    }

    const session = await this.sessionRead(this.prisma, 'findUnique', {
      where: { id: liveSessionId },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.connectionProtocol !== 1) {
      throw new ConflictException('Use Live v2 for this session');
    }

    if (session.astrologerId !== astrologer.id) {
      throw new ForbiddenException('You cannot end this live session');
    }

    const endedAt = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.liveSession.update({
        select: legacySessionSelect,
        where: { id: session.id },
        data: {
          status: 'ENDED',
          endedAt,
        },
      }),
      this.prisma.liveViewer.updateMany({
        where: {
          liveSessionId: session.id,
          leftAt: null,
        },
        data: {
          leftAt: endedAt,
        },
      }),
    ]);

    return {
      success: true,
      data: updated,
    };
  }

  async listLive() {
    const sessions = await this.sessionRead(this.prisma, 'findMany', {
      where: {
        status: 'LIVE',
        endedAt: null,
        connectionProtocol: 1,
        astrologer: {
          isApproved: true,
          isVerified: true,
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      include: {
        astrologer: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            viewers: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: sessions.map((session) =>
        this.serializeSession(session, session._count.viewers),
      ),
    };
  }

  async joinLive(supabaseId: string, liveSessionId: string) {
    const user = await this.getUserBySupabaseId(supabaseId);

    const session = await this.sessionRead(this.prisma, 'findFirst', {
      where: {
        id: liveSessionId,
        status: 'LIVE',
        endedAt: null,
      },
      include: {
        astrologer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Live session is no longer available');
    }

    if (session.connectionProtocol !== 1) {
      throw new ConflictException('Use Live v2 for this session');
    }

    await this.prisma.liveViewer.updateMany({
      where: {
        liveSessionId: session.id,
        userId: user.id,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    const viewer = await this.prisma.liveViewer.create({
      data: {
        liveSessionId: session.id,
        userId: user.id,
      },
    });

    const uid = Math.floor(Math.random() * 2_000_000_000) + 1;

    const rtc = this.agoraService.generateRtcToken(
      session.channelName,
      uid,
      'SUBSCRIBER',
    );

    const viewerCount = await this.prisma.liveViewer.count({
      where: {
        liveSessionId: session.id,
        leftAt: null,
      },
    });

    return {
      success: true,
      data: {
        session: this.serializeSession(session, viewerCount),
        viewer,
        rtc,
      },
    };
  }

  async joinLiveChat(supabaseId: string, liveSessionId: string) {
    const user = await this.getUserBySupabaseId(supabaseId);

    const session = await this.sessionRead(this.prisma, 'findFirst', {
      where: {
        id: liveSessionId,
        status: 'LIVE',
        endedAt: null,
      },
      include: {
        astrologer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.connectionProtocol !== 1) {
      throw new ConflictException('Use Live v2 for this session');
    }

    const isHost = session.astrologer.userId === user.id;

    if (!isHost) {
      const viewer = await this.prisma.liveViewer.findFirst({
        where: {
          liveSessionId,
          userId: user.id,
          leftAt: null,
        },
      });

      if (!viewer) {
        throw new ForbiddenException(
          'Join live session before using live chat',
        );
      }
    }

    return {
      liveSessionId,
      user: {
        id: user.id,
        name: user.name ?? 'User',
        avatarUrl: user.avatarUrl ?? null,
        isAstrologer: isHost,
      },
    };
  }

  async sendLiveMessage(
    supabaseId: string,
    liveSessionId: string,
    rawMessage: string,
  ) {
    const access = await this.joinLiveChat(supabaseId, liveSessionId);

    const message = String(rawMessage ?? '').trim();

    if (!message) {
      throw new BadRequestException('Message is required');
    }

    if (message.length > 500) {
      throw new BadRequestException('Message is too long');
    }

    const created = await this.prisma.liveMessage.create({
      data: {
        liveSessionId,
        userId: access.user.id,
        message,
      },
    });

    return {
      id: created.id,
      liveSessionId: created.liveSessionId,
      message: created.message,
      createdAt: created.createdAt,
      sender: access.user,
    };
  }
  async leaveLive(supabaseId: string, liveSessionId: string) {
    const user = await this.getUserBySupabaseId(supabaseId);
    const session = await this.sessionRead(this.prisma, 'findUnique', {
      where: { id: liveSessionId },
    });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.connectionProtocol !== 1) {
      throw new ConflictException('Use Live v2 for this session');
    }

    await this.prisma.liveViewer.updateMany({
      where: {
        liveSessionId,
        userId: user.id,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    const viewerCount = await this.prisma.liveViewer.count({
      where: {
        liveSessionId,
        leftAt: null,
      },
    });

    return {
      success: true,
      data: {
        liveSessionId,
        viewerCount,
      },
    };
  }
}
