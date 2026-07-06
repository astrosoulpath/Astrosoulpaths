// modules/match/match.service.ts

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { ProfileService } from '../../../profile/profile.service';
import { VedicProvider } from '../provider/vedic.provider';

import { profileToAstroParams } from '../../../../common/utlis/profile-to-astro.mapper';
import { MatchMapper } from '../provider/mapper/match.mapper';
import { assignRoles } from './utlis/match.helper';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly provider: VedicProvider,
  ) {}

  async createMatch(profile1Id: string, profile2Id: string) {
    this.logger.log(
      `🔍 Creating match: profile1=${profile1Id}, profile2=${profile2Id}`,
    );

    try {
      // 🔥 1. Fetch profiles
      const [p1, p2] = await Promise.all([
        this.profileService.getProfileById(profile1Id),
        this.profileService.getProfileById(profile2Id),
      ]);

      // Server got Crashed due to this, added checks to avoid that, but ideally this should not happen as we are validating the input in controller

      if (!p1 || !p2) {
        this.logger.warn('❌ Profile not found');
        throw new BadRequestException('Profile not found');
      }

      // 🔥 2. Assign roles
      const { boy, girl } = assignRoles(p1, p2);

      this.logger.log(`👦 Boy: ${boy.id}, 👧 Girl: ${girl.id}`);

      // 🔥 3. Check existing match (CACHE)
      const existing = await this.prisma.match.findUnique({
        where: {
          boyId_girlId: {
            boyId: boy.id,
            girlId: girl.id,
          },
        },
      });

      if (existing) {
        this.logger.log('⚡ Returning cached match');
        return existing;
      }

      // 🔥 4. Convert → AstroParams
      const boyParams = profileToAstroParams(boy);
      const girlParams = profileToAstroParams(girl);

      // 🔥 5. Convert → API payload
      const payload = MatchMapper.toApiFormat({
        boy: boyParams,
        girl: girlParams,
        lang: 'en',
      });

      this.logger.debug(`📤 Payload: ${JSON.stringify(payload)}`);

      // 🔥 6. Call external API
      const response = await this.provider.getMatchCompatibility(payload);

      if (!response) {
        this.logger.error('❌ Empty response from provider');
        throw new InternalServerErrorException(
          'Failed to fetch match compatibility',
        );
      }

      // 🔥 7. Extract safe data
      const resultData = response?.data || response;

      // 🔥 8. Save match
      const match = await this.prisma.match.create({
        data: {
          boyId: boy.id,
          girlId: girl.id,
          result: resultData,
        },
      });

      this.logger.log(`✅ Match created successfully: ${match.id}`);

      return match;
    } catch (error: any) {
      this.logger.error(
        '❌ Match creation failed',
        error?.stack || error?.message,
      );

      throw new InternalServerErrorException(
        error?.message || 'Match creation failed',
      );
    }
  }
  async getMatchById(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  async getAllMatches() {
    return this.prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
  async saveMatch(id: string) {
    return this.prisma.match.update({
      where: { id },
      data: { isSaved: true },
    });
  }
  async getSavedMatches() {
    return this.prisma.match.findMany({
      where: { isSaved: true },
    });
  }
}
