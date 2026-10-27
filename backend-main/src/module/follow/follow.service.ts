import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  private async customerId(supabaseId: string, customerContext = false): Promise<string> {
    const clean = supabaseId?.trim();

    if (!clean) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: clean,
        },
      },
      select: { userId: true },
    });

    const user = identity
      ? await this.prisma.user.findUnique({
          where: { id: identity.userId },
          select: { id: true, isActive: true, isBlocked: true, role: { select: { name: true } } },
        })
      : await this.prisma.user.findUnique({
          where: { supabaseId: clean },
          select: { id: true, isActive: true, isBlocked: true, role: { select: { name: true } } },
        });

    if (!user) {
      throw new UnauthorizedException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked ||
        (!customerContext && !['CUSTOMER', 'USER'].includes(user.role?.name?.toUpperCase() ?? ''))) {
      throw new ForbiddenException('An active Customer session is required');
    }

    return user.id;
  }

  async realStatus(supabaseId: string, astrologerId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    const astrologer = await this.prisma.astrologer.findUnique({
      where: { id: astrologerId },
      select: { id: true },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    const [followerCount, follow] = await this.prisma.$transaction([
      this.prisma.astrologerFollow.count({
        where: { astrologerId },
      }),
      this.prisma.astrologerFollow.findUnique({
        where: {
          followerId_astrologerId: {
            followerId,
            astrologerId,
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      astrologerId,
      followerCount,
      isFollowing: follow !== null,
    };
  }

  async followReal(supabaseId: string, astrologerId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    const astrologer = await this.prisma.astrologer.findUnique({
      where: { id: astrologerId },
      select: { id: true, userId: true, isApproved: true, user: { select: { isActive: true, isBlocked: true } } },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    if (astrologer.userId === followerId) throw new ForbiddenException('Self-following is not permitted');
    if (!astrologer.isApproved || !astrologer.user.isActive || astrologer.user.isBlocked) {
      throw new NotFoundException('Astrologer is not available');
    }

    try {
      await this.prisma.astrologerFollow.upsert({
        where: {
          followerId_astrologerId: {
            followerId,
            astrologerId,
          },
        },
        update: {},
        create: {
          followerId,
          astrologerId,
        },
      });
    } catch (error) {
      // Some Prisma versions emulate upsert. A concurrent winner is success
      // only when this exact canonical ownership key now exists; never retry inserts.
      if ((error as {code?: string})?.code !== 'P2002' ||
          !await this.prisma.astrologerFollow.findUnique({where:{followerId_astrologerId:{followerId,astrologerId}},select:{id:true}})) {
        throw error;
      }
    }

    const followerCount = await this.prisma.astrologerFollow.count({
      where: { astrologerId },
    });

    return {
      astrologerId,
      followerCount,
      isFollowing: true,
    };
  }

  async unfollowReal(supabaseId: string, astrologerId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    await this.prisma.astrologerFollow.deleteMany({
      where: {
        followerId,
        astrologerId,
      },
    });

    const followerCount = await this.prisma.astrologerFollow.count({
      where: { astrologerId },
    });

    return {
      astrologerId,
      followerCount,
      isFollowing: false,
    };
  }

  async aiStatus(supabaseId: string, personaId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    const persona = await this.prisma.aiAstroPersona.findUnique({
      where: { id: personaId },
      select: { id: true },
    });

    if (!persona) {
      throw new NotFoundException('AI astrologer not found');
    }

    const [followerCount, follow] = await this.prisma.$transaction([
      this.prisma.aiAstroFollow.count({
        where: { personaId },
      }),
      this.prisma.aiAstroFollow.findUnique({
        where: {
          followerId_personaId: {
            followerId,
            personaId,
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      personaId,
      followerCount,
      isFollowing: follow !== null,
    };
  }

  async followAi(supabaseId: string, personaId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    const persona = await this.prisma.aiAstroPersona.findUnique({
      where: { id: personaId },
      select: { id: true },
    });

    if (!persona) {
      throw new NotFoundException('AI astrologer not found');
    }

    await this.prisma.aiAstroFollow.upsert({
      where: {
        followerId_personaId: {
          followerId,
          personaId,
        },
      },
      update: {},
      create: {
        followerId,
        personaId,
      },
    });

    const followerCount = await this.prisma.aiAstroFollow.count({
      where: { personaId },
    });

    return {
      personaId,
      followerCount,
      isFollowing: true,
    };
  }

  async unfollowAi(supabaseId: string, personaId: string, customerContext = false) {
    const followerId = await this.customerId(supabaseId, customerContext);

    await this.prisma.aiAstroFollow.deleteMany({
      where: {
        followerId,
        personaId,
      },
    });

    const followerCount = await this.prisma.aiAstroFollow.count({
      where: { personaId },
    });

    return {
      personaId,
      followerCount,
      isFollowing: false,
    };
  }
}
