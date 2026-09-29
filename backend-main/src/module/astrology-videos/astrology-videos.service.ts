import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type VideoTranslationInput = {
  locale: string;
  title: string;
  shortDescription?: string;
  description?: string;
  captionUrl?: string;
  audioLocale?: string;
};

type CreateVideoInput = {
  youtubeUrl: string;
  category?: string;
  defaultLocale?: string;
  visibilityCountries?: string[];
  isFeatured?: boolean;
  sortOrder?: number;
  translations: VideoTranslationInput[];
};

@Injectable()
export class AstrologyVideosService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLocale(value?: string): string {
    const locale = (value || 'en').trim().replace('_', '-').toLowerCase();

    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(locale)) {
      throw new BadRequestException(
        'Use a valid locale, for example en, fr, pt-BR, ar.',
      );
    }

    return locale;
  }

  private normalizeCountries(countries?: string[]): string[] {
    return [
      ...new Set(
        (countries || [])
          .map((country) => String(country).trim().toUpperCase())
          .filter((country) => /^[A-Z]{2}$/.test(country)),
      ),
    ];
  }

  private extractYouTube(input: string) {
    let url: URL;

    try {
      url = new URL(input.trim());
    } catch {
      throw new BadRequestException('Enter a valid YouTube URL.');
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (['youtube.com', 'm.youtube.com'].includes(host)) {
      videoId =
        url.searchParams.get('v') ||
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
        '';
    }

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new BadRequestException(
        'This is not a supported YouTube video URL.',
      );
    }

    return {
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      youtubeVideoId: videoId,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  private normalizeTranslations(
    translations: VideoTranslationInput[],
    defaultLocale: string,
  ) {
    if (!Array.isArray(translations) || translations.length === 0) {
      throw new BadRequestException('Add at least one video translation.');
    }

    const seen = new Set<string>();
    const normalized = translations.map((translation) => {
      const locale = this.normalizeLocale(translation.locale);

      if (seen.has(locale)) {
        throw new BadRequestException(
          `Duplicate translation locale: ${locale}`,
        );
      }
      seen.add(locale);

      const title = String(translation.title || '').trim();
      if (title.length < 2 || title.length > 180) {
        throw new BadRequestException(
          'Each translation title must be 2�180 characters.',
        );
      }

      return {
        locale,
        title,
        shortDescription: translation.shortDescription?.trim() || null,
        description: translation.description?.trim() || null,
        captionUrl: translation.captionUrl?.trim() || null,
        audioLocale: translation.audioLocale
          ? this.normalizeLocale(translation.audioLocale)
          : null,
      };
    });

    if (!seen.has(defaultLocale)) {
      throw new BadRequestException(
        `Add a ${defaultLocale} translation because it is the default locale.`,
      );
    }

    return normalized;
  }

  private localeCandidates(locale: string, defaultLocale: string) {
    const base = locale.split('-')[0];
    return [...new Set([locale, base, 'en', defaultLocale])];
  }

  private localized(video: any, locale: string) {
    const translation =
      this.localeCandidates(locale, video.defaultLocale)
        .map((candidate) =>
          video.translations.find((item: any) => item.locale === candidate),
        )
        .find(Boolean) || null;

    if (!translation) {
      return null;
    }

    return {
      id: video.id,
      youtubeUrl: video.youtubeUrl,
      youtubeVideoId: video.youtubeVideoId,
      thumbnailUrl: video.thumbnailUrl,
      category: video.category,
      isFeatured: video.isFeatured,
      sortOrder: video.sortOrder,
      locale: translation.locale,
      title: translation.title,
      shortDescription: translation.shortDescription,
      description: translation.description,
      captionUrl: translation.captionUrl,
      audioLocale: translation.audioLocale,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }

  async adminList() {
    return this.prisma.astrologyVideo.findMany({
      include: { translations: { orderBy: { locale: 'asc' } } },
      orderBy: [
        { isPublished: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(input: CreateVideoInput) {
    const defaultLocale = this.normalizeLocale(input.defaultLocale);
    const youtube = this.extractYouTube(input.youtubeUrl);
    const translations = this.normalizeTranslations(
      input.translations,
      defaultLocale,
    );

    return this.prisma.astrologyVideo.create({
      data: {
        ...youtube,
        category: String(input.category || 'ASTROLOGY_LESSONS')
          .trim()
          .toUpperCase(),
        defaultLocale,
        visibilityCountries: this.normalizeCountries(input.visibilityCountries),
        isFeatured: Boolean(input.isFeatured),
        sortOrder: Number.isFinite(Number(input.sortOrder))
          ? Number(input.sortOrder)
          : 0,
        translations: { create: translations },
      },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async update(id: string, input: Partial<CreateVideoInput>) {
    const existing = await this.prisma.astrologyVideo.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!existing) {
      throw new NotFoundException('Video not found.');
    }

    const defaultLocale = input.defaultLocale
      ? this.normalizeLocale(input.defaultLocale)
      : existing.defaultLocale;

    const data: any = {
      defaultLocale,
    };

    if (input.youtubeUrl !== undefined) {
      Object.assign(data, this.extractYouTube(input.youtubeUrl));
    }

    if (input.category !== undefined) {
      data.category = String(input.category).trim().toUpperCase();
    }

    if (input.visibilityCountries !== undefined) {
      data.visibilityCountries = this.normalizeCountries(
        input.visibilityCountries,
      );
    }

    if (input.isFeatured !== undefined)
      data.isFeatured = Boolean(input.isFeatured);
    if (input.sortOrder !== undefined)
      data.sortOrder = Number(input.sortOrder) || 0;

    if (input.translations !== undefined) {
      const translations = this.normalizeTranslations(
        input.translations,
        defaultLocale,
      );
      data.translations = {
        deleteMany: {},
        create: translations,
      };
    }

    return this.prisma.astrologyVideo.update({
      where: { id },
      data,
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async setPublished(id: string, isPublished: boolean) {
    return this.prisma.astrologyVideo
      .update({
        where: { id },
        data: { isPublished },
      })
      .catch(() => {
        throw new NotFoundException('Video not found.');
      });
  }

  async remove(id: string) {
    await this.prisma.astrologyVideo.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Video not found.');
    });

    return { success: true };
  }

  async publicFeed(locale?: string, category?: string, country?: string) {
    const selectedLocale = this.normalizeLocale(locale);
    const selectedCountry = country?.trim().toUpperCase();

    const countryRule =
      selectedCountry && /^[A-Z]{2}$/.test(selectedCountry)
        ? {
            OR: [
              { visibilityCountries: { isEmpty: true } },
              { visibilityCountries: { has: selectedCountry } },
            ],
          }
        : {};

    const videos = await this.prisma.astrologyVideo.findMany({
      where: {
        isPublished: true,
        ...(category ? { category: category.trim().toUpperCase() } : {}),
        ...countryRule,
      },
      include: { translations: true },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return videos
      .map((video) => this.localized(video, selectedLocale))
      .filter(Boolean);
  }

  async publicDetail(id: string, locale?: string, country?: string) {
    const selectedLocale = this.normalizeLocale(locale);
    const selectedCountry = country?.trim().toUpperCase();

    const video = await this.prisma.astrologyVideo.findFirst({
      where: {
        id,
        isPublished: true,
        ...(selectedCountry && /^[A-Z]{2}$/.test(selectedCountry)
          ? {
              OR: [
                { visibilityCountries: { isEmpty: true } },
                { visibilityCountries: { has: selectedCountry } },
              ],
            }
          : {}),
      },
      include: { translations: true },
    });

    if (!video) {
      throw new NotFoundException('Video not found.');
    }

    return this.localized(video, selectedLocale);
  }
}
