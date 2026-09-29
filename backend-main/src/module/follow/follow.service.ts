import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  private async customerId(supabaseId: string): Promise<string> {
    const clean = supabaseId?.trim();

    if (!clean) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId: clean },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('Customer account not found');
    }

    return user.id;
  }

  async realStatus(supabaseId: string, astrologerId: string) {
    const followerId = await this.customerId(supabaseId);

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

  async followReal(supabaseId: string, astrologerId: string) {
    const followerId = await this.customerId(supabaseId);

    const astrologer = await this.prisma.astrologer.findUnique({
      where: { id: astrologerId },
      select: { id: true },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

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

    const followerCount = await this.prisma.astrologerFollow.count({
      where: { astrologerId },
    });

    return {
      astrologerId,
      followerCount,
      isFollowing: true,
    };
  }

  async unfollowReal(supabaseId: string, astrologerId: string) {
    const followerId = await this.customerId(supabaseId);

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

  async aiStatus(supabaseId: string, personaId: string) {
    const followerId = await this.customerId(supabaseId);

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

  async followAi(supabaseId: string, personaId: string) {
    const followerId = await this.customerId(supabaseId);

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

  async unfollowAi(supabaseId: string, personaId: string) {
    const followerId = await this.customerId(supabaseId);

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
