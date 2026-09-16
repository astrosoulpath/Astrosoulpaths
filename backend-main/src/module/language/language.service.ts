import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async getLanguages() {
    const languages = await this.prisma.appLanguage.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          englishName: 'asc',
        },
      ],
      select: {
        code: true,
        englishName: true,
        nativeName: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
      },
    });

    return {
      success: true,
      data: languages,
    };
  }

  async getTranslations(languageCode: string) {
    const code = languageCode.trim().toLowerCase();

    const language = await this.prisma.appLanguage.findUnique({
      where: { code },
      select: {
        code: true,
        isActive: true,
      },
    });

    if (!language || !language.isActive) {
      return {
        success: false,
        message: 'Selected language is not available',
        data: {
          languageCode: code,
          translations: {},
        },
      };
    }

    const rows = await this.prisma.appTranslation.findMany({
      where: {
        languageCode: code,
        isActive: true,
      },
      orderBy: {
        key: 'asc',
      },
      select: {
        key: true,
        value: true,
      },
    });

    return {
      success: true,
      data: {
        languageCode: language.code,
        translations: Object.fromEntries(
          rows.map((row) => [row.key, row.value]),
        ),
      },
    };
  }

}