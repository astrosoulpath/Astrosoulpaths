import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AgoraService } from '../call/agora.service';

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agoraService: AgoraService,
  ) {}

  private async getUserBySupabaseId(supabaseId: string) {
    const normalized = supabaseId?.trim();

    if (!normalized) {
      throw new BadRequestException('Authenticated user is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId: normalized },
      include: {
        astrologer: true,
      },
    });

    if (!user || !user.isActive || user.isBlocked) {
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

    const existing = await this.prisma.liveSession.findFirst({
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

    const session =
      existing ??
      (await this.prisma.liveSession.create({
        data: {
          astrologerId: astrologer.id,
          channelName: `live_${randomUUID().replace(/-/g, '')}`,
          title: title?.trim() || null,
          status: 'LIVE',
        },
        include: {
          astrologer: {
            include: {
              user: true,
            },
          },
        },
      }));

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

    const session = await this.prisma.liveSession.findUnique({
      where: { id: liveSessionId },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.astrologerId !== astrologer.id) {
      throw new ForbiddenException('You cannot end this live session');
    }

    const endedAt = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.liveSession.update({
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
    const sessions = await this.prisma.liveSession.findMany({
      where: {
        status: 'LIVE',
        endedAt: null,
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

    const session = await this.prisma.liveSession.findFirst({
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

  async leaveLive(supabaseId: string, liveSessionId: string) {
    const user = await this.getUserBySupabaseId(supabaseId);

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
