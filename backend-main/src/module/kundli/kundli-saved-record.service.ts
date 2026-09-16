import { createHash } from 'crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Gender } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type SaveKundliRecordInput = {
  kundliId: string;
  astrologerId: string;
  name: string;
  gender: Gender;
  birthPlace: string;
  lang: string;
  customerUserId?: string | null;
};

import { validateProfessionalKundliReport } from './professional-kundli-report.validator';

@Injectable()
export class KundliSavedRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async saveGeneratedRecord(input: SaveKundliRecordInput) {
    const name = this.normalizeText(input.name);
    const birthPlace = this.normalizeText(input.birthPlace);
    const lang = input.lang.trim().toLowerCase();

    const idempotencyKey = this.createIdempotencyKey({
      astrologerId: input.astrologerId,
      kundliId: input.kundliId,
      name,
      lang,
    });

    return this.prisma.kundliSavedRecord.upsert({
      where: {
        idempotencyKey,
      },

      update: {
        gender: input.gender,
        birthPlace,
        customerUserId: input.customerUserId ?? null,
      },

      create: {
        kundliId: input.kundliId,
        createdByAstrologerId: input.astrologerId,
        customerUserId: input.customerUserId ?? null,
        name,
        gender: input.gender,
        birthPlace,
        lang,
        idempotencyKey,
      },

      select: {
        id: true,
        kundliId: true,
        createdByAstrologerId: true,
        customerUserId: true,
        name: true,
        gender: true,
        birthPlace: true,
        lang: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findForAstrologer(astrologerId: string) {
    return this.prisma.kundliSavedRecord.findMany({
      where: {
        createdByAstrologerId: astrologerId,
      },

      select: {
        id: true,
        kundliId: true,
        customerUserId: true,
        name: true,
        gender: true,
        birthPlace: true,
        lang: true,
        createdAt: true,
        updatedAt: true,

        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
            createdAt: true,
          },
        },

        customerUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 100,
    });
  }

  async findOneForAstrologer(savedRecordId: string, astrologerId: string) {
    const record = await this.prisma.kundliSavedRecord.findFirst({
      where: {
        id: savedRecordId,
        createdByAstrologerId: astrologerId,
      },

      select: {
        id: true,
        kundliId: true,
        customerUserId: true,
        name: true,
        gender: true,
        birthPlace: true,
        lang: true,
        createdAt: true,
        updatedAt: true,

        customerUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },

        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
            createdAt: true,

            data: {
              select: {
                lang: true,
                vedic: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException({
        success: false,
        code: 'SAVED_KUNDLI_NOT_FOUND',
        message: 'Saved Kundli was not found',
      });
    }

    if (!record.kundli.data?.vedic) {
      throw new NotFoundException({
        success: false,
        code: 'KUNDLI_REPORT_NOT_FOUND',
        message: 'Saved Kundli report data was not found',
      });
    }
    // A saved Kundli may legitimately be PARTIAL.
    // Detail retrieval must return the provider's actual saved report so the
    // astrologer can inspect it and explicitly regenerate it.
    // Professional PDF completeness remains enforced in KundliPdfService.
    const { data, ...kundli } = record.kundli;

    return {
      id: record.id,
      kundliId: record.kundliId,
      customerUserId: record.customerUserId,
      name: record.name,
      gender: record.gender,
      birthPlace: record.birthPlace,
      lang: record.lang,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      customerUser: record.customerUser,
      kundli,
      report: data.vedic,
      reportUpdatedAt: data.updatedAt,
    };
  }

  async findForRegeneration(savedRecordId: string, astrologerId: string) {
    const record = await this.prisma.kundliSavedRecord.findFirst({
      where: {
        id: savedRecordId,
        createdByAstrologerId: astrologerId,
      },

      select: {
        id: true,
        kundliId: true,
        customerUserId: true,
        name: true,
        gender: true,
        birthPlace: true,
        lang: true,

        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException({
        success: false,
        code: 'SAVED_KUNDLI_NOT_FOUND',
        message: 'Saved Kundli record was not found',
      });
    }

    return record;
  }
  private createIdempotencyKey(input: {
    astrologerId: string;
    kundliId: string;
    name: string;
    lang: string;
  }): string {
    const value = [
      input.astrologerId,
      input.kundliId,
      input.name.toLowerCase(),
      input.lang,
    ].join('|');

    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  }
}
