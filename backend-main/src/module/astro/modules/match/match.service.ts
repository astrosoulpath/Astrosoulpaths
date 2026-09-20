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
import { profileToAstroParams } from '../../../../common/utlis/profile-to-astro.mapper';
import { assignRoles } from './utlis/match.helper';
import { LocalVedicKundliProvider } from '../../../kundli/providers/local-vedic-kundli.provider';
import {
  AshtakootPerson,
  calculateAshtakootMatch,
} from '../../../kundli/engine/ashtakoot-match.util';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly localVedicKundliProvider: LocalVedicKundliProvider,
  ) {}

  async createMatch(profile1Id: string, profile2Id: string) {
    this.logger.log(
      `ðŸ” Creating match: profile1=${profile1Id}, profile2=${profile2Id}`,
    );

    try {
      // ðŸ”¥ 1. Fetch profiles
      const [p1, p2] = await Promise.all([
        this.profileService.getProfileById(profile1Id),
        this.profileService.getProfileById(profile2Id),
      ]);

      // Server got Crashed due to this, added checks to avoid that, but ideally this should not happen as we are validating the input in controller

      if (!p1 || !p2) {
        this.logger.warn('âŒ Profile not found');
        throw new BadRequestException('Profile not found');
      }

      // ðŸ”¥ 2. Assign roles
      const { boy, girl } = assignRoles(p1, p2);

      this.logger.log(`ðŸ‘¦ Boy: ${boy.id}, ðŸ‘§ Girl: ${girl.id}`);

      // ðŸ”¥ 3. Check existing match (CACHE)
      const existing = await this.prisma.match.findUnique({
        where: {
          boyId_girlId: {
            boyId: boy.id,
            girlId: girl.id,
          },
        },
      });

      if (existing) {
        this.logger.log('âš¡ Returning cached match');
        return existing;
      }

      // ðŸ”¥ 4. Convert â†’ AstroParams
      const boyParams = profileToAstroParams(boy);
      const girlParams = profileToAstroParams(girl);

      // ðŸ”¥ 5. Convert â†’ API payload
      // 5. Generate both natal charts using our own Vedic engine.
      const [boyKundli, girlKundli] = await Promise.all([
        this.localVedicKundliProvider.generate(boyParams, 'en'),
        this.localVedicKundliProvider.generate(girlParams, 'en'),
      ]);

      const extractMoon = (
        report: any,
        role: 'boy' | 'girl',
      ): AshtakootPerson => {
        const positions = Array.isArray(report?.planetaryPositions)
          ? report.planetaryPositions
          : [];

        const moon = positions.find(
          (position: any) =>
            String(position?.name ?? '').toLowerCase() === 'moon',
        );

        if (!moon) {
          throw new InternalServerErrorException(
            `Local Vedic Moon position unavailable for ${role}`,
          );
        }

        const moonLongitude = Number(
          moon.longitude ?? moon.absolute_degree,
        );
        const rashiNumber = Number(
          moon.rasi_no ?? moon.sign_no,
        );
        const nakshatraNumber = Number(
          moon.nakshatra_number,
        );
        const nakshatraPada = Number(
          moon.nakshatra_pada,
        );

        if (
          !Number.isFinite(moonLongitude) ||
          !Number.isInteger(rashiNumber) ||
          rashiNumber < 1 ||
          rashiNumber > 12 ||
          !Number.isInteger(nakshatraNumber) ||
          nakshatraNumber < 1 ||
          nakshatraNumber > 27 ||
          !Number.isInteger(nakshatraPada) ||
          nakshatraPada < 1 ||
          nakshatraPada > 4
        ) {
          throw new InternalServerErrorException(
            `Invalid local Vedic Moon data for ${role}`,
          );
        }

        return {
          moonLongitude,
          rashiNumber,
          nakshatraNumber,
          nakshatraPada,
        };
      };

      const boyMatchData = extractMoon(boyKundli, 'boy');
      const girlMatchData = extractMoon(girlKundli, 'girl');

      const resultData = calculateAshtakootMatch(
        boyMatchData,
        girlMatchData,
      );

      this.logger.debug(
        `Local Ashtakoot result: ${JSON.stringify(resultData)}`,
      );
      const match = await this.prisma.match.create({
        data: {
          boyId: boy.id,
          girlId: girl.id,
          result: resultData,
        },
      });

      this.logger.log(`âœ… Match created successfully: ${match.id}`);

      return match;
    } catch (error: any) {
      this.logger.error(
        'âŒ Match creation failed',
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


