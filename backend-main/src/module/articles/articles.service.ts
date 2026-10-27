import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type ArticleTranslationInput = {
  locale: string;
  title: string;
  excerpt?: string;
  contentMarkdown: string;
  authorName?: string;
  readingMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
};

type ArticleInput = {
  slug: string;
  coverImageUrl?: string;
  category?: string;
  festivalTags?: string[];
  defaultLocale?: string;
  visibilityCountries?: string[];
  isFeatured?: boolean;
  sortOrder?: number;
  publishedAt?: string;
  translations: ArticleTranslationInput[];
};

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private locale(value?: string): string {
    const locale = String(value || 'en')
      .trim()
      .replace('_', '-')
      .toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(locale)) {
      throw new BadRequestException(
        'Use a valid locale, for example en, fr, ru, hi.',
      );
    }
    return locale;
  }

  private countries(values?: string[]): string[] {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length > 250 ||
        values.some(
          (v) => typeof v !== 'string' || !/^[A-Za-z]{2}$/.test(v.trim()),
        ))
    )
      throw new BadRequestException('Use ISO country codes.');
    return [
      ...new Set(
        (values || [])
          .map((item) => String(item).trim().toUpperCase())
          .filter((item) => /^[A-Z]{2}$/.test(item)),
      ),
    ];
  }

  private tags(values?: string[]): string[] {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.some((v) => typeof v !== 'string' || v.length > 80))
    )
      throw new BadRequestException('Invalid article tags.');
    return [
      ...new Set(
        (values || [])
          .map((item) => String(item).trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 12),
      ),
    ];
  }

  private slug(value: string): string {
    const slug = String(value || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        'Slug must use lowercase letters, numbers and hyphens.',
      );
    }
    return slug;
  }

  private date(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('publishedAt must be a valid ISO date.');
    }
    return date;
  }

  private reviewStatus(value?: string) {
    const status = String(value || '')
      .trim()
      .toUpperCase();
    const allowed = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid article status: ${value}`);
    }
    return status as 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
  }

  private async approvedAstrologer(supabaseId: string) {
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: supabaseId,
        },
      },
      select: { userId: true },
    });

    const user = await this.prisma.user.findUnique({
      where: identity ? { id: identity.userId } : { supabaseId },
      include: { astrologer: true },
    });

    if (
      !user?.astrologer ||
      !user.isActive ||
      user.isBlocked ||
      !user.isAstrologer ||
      !user.astrologer.isApproved ||
      !user.astrologer.isVerified
    ) {
      throw new ForbiddenException(
        'Only approved astrologers can submit or manage articles.',
      );
    }

    return user.astrologer;
  }

  private async internalUserId(supabaseId?: string) {
    if (!supabaseId) return null;
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: supabaseId,
        },
      },
      select: { userId: true },
    });

    const user = await this.prisma.user.findUnique({
      where: identity ? { id: identity.userId } : { supabaseId },
      select: { id: true },
    });
    return user?.id || null;
  }

  private translations(
    values: ArticleTranslationInput[],
    defaultLocale: string,
  ) {
    if (!Array.isArray(values) || values.length === 0 || values.length > 30) {
      throw new BadRequestException('Add at least one article translation.');
    }

    const seen = new Set<string>();

    const data = values.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.title !== 'string' ||
        typeof item.contentMarkdown !== 'string' ||
        item.contentMarkdown.length > 100000
      )
        throw new BadRequestException('Invalid article translation.');
      for (const key of [
        'excerpt',
        'authorName',
        'seoTitle',
        'seoDescription',
      ] as const)
        if (
          item[key] != null &&
          (typeof item[key] !== 'string' ||
            item[key].length > (key === 'excerpt' ? 2000 : 500))
        )
          throw new BadRequestException('Invalid article metadata.');
      const locale = this.locale(item.locale);
      if (seen.has(locale)) {
        throw new BadRequestException(
          `Duplicate translation locale: ${locale}`,
        );
      }
      seen.add(locale);

      const title = String(item.title || '').trim();
      const contentMarkdown = String(item.contentMarkdown || '').trim();

      if (title.length < 4 || title.length > 180) {
        throw new BadRequestException(
          'Each article title must be 4ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“180 characters.',
        );
      }

      if (contentMarkdown.length < 40) {
        throw new BadRequestException(
          'Each article needs at least 40 characters of content.',
        );
      }

      return {
        locale,
        title,
        excerpt: item.excerpt?.trim() || null,
        contentMarkdown,
        authorName: item.authorName?.trim() || null,
        readingMinutes: Math.min(
          60,
          Math.max(1, Number(item.readingMinutes) || 3),
        ),
        seoTitle: item.seoTitle?.trim() || null,
        seoDescription: item.seoDescription?.trim() || null,
      };
    });

    if (!seen.has(defaultLocale)) {
      throw new BadRequestException(
        `Add a ${defaultLocale} translation because it is the default locale.`,
      );
    }

    return data;
  }

  private localized(
    article: Prisma.AstrologyArticleGetPayload<{
      include: { translations: true };
    }>,
    requestedLocale: string,
  ) {
    const base = requestedLocale.split('-')[0];
    const candidates = [
      ...new Set([requestedLocale, base, 'en', article.defaultLocale]),
    ];

    const translation = candidates
      .map((locale) =>
        article.translations.find((item) => item.locale === locale),
      )
      .find(Boolean);

    if (!translation) return null;

    return {
      id: article.id,
      slug: article.slug,
      coverImageUrl: article.coverImageUrl,
      category: article.category,
      festivalTags: article.festivalTags,
      visibilityCountries: article.visibilityCountries,
      isFeatured: article.isFeatured,
      locale: translation.locale,
      title: translation.title,
      excerpt: translation.excerpt,
      contentMarkdown: translation.contentMarkdown,
      authorName: translation.authorName,
      readingMinutes: translation.readingMinutes,
      seoTitle: translation.seoTitle,
      seoDescription: translation.seoDescription,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private countryRule(country?: string) {
    const value = String(country || '')
      .trim()
      .toUpperCase();
    // An omitted country must not expose country-restricted articles.
    if (!value) return { visibilityCountries: { isEmpty: true } };
    if (!/^[A-Z]{2}$/.test(value))
      throw new BadRequestException('Use an ISO country code.');

    return {
      AND: [
        {
          OR: [
            { visibilityCountries: { isEmpty: true } },
            { visibilityCountries: { has: value } },
          ],
        },
      ],
    };
  }

  async adminList(status?: string) {
    return this.prisma.astrologyArticle.findMany({
      where: status ? { status: this.reviewStatus(status) } : undefined,
      include: { translations: { orderBy: { locale: 'asc' } } },
      orderBy: [
        { status: 'asc' },
        { isPublished: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(input: ArticleInput, adminSupabaseId?: string) {
    const defaultLocale = this.locale(input.defaultLocale);
    const translations = this.translations(input.translations, defaultLocale);

    return this.prisma.astrologyArticle.create({
      data: {
        slug: this.slug(input.slug),
        coverImageUrl: input.coverImageUrl?.trim() || null,
        category: String(input.category || 'ASTROLOGY')
          .trim()
          .toUpperCase(),
        festivalTags: this.tags(input.festivalTags),
        defaultLocale,
        visibilityCountries: this.countries(input.visibilityCountries),
        isFeatured: Boolean(input.isFeatured),
        sortOrder: Number(input.sortOrder) || 0,
        publishedAt: this.date(input.publishedAt),
        createdByAdminId: await this.internalUserId(adminSupabaseId),
        authorType: 'ADMIN',
        status: 'DRAFT',
        isPublished: false,
        translations: { create: translations },
      },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async update(id: string, input: Partial<ArticleInput>) {
    const existing = await this.prisma.astrologyArticle.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!existing) throw new NotFoundException('Article not found.');

    const defaultLocale = input.defaultLocale
      ? this.locale(input.defaultLocale)
      : existing.defaultLocale;
    if (
      input.translations === undefined &&
      !existing.translations.some((t) => t.locale === defaultLocale)
    )
      throw new BadRequestException(
        'Default locale needs an existing translation.',
      );

    const data: Prisma.AstrologyArticleUpdateInput = { defaultLocale };

    if (input.slug !== undefined) data.slug = this.slug(input.slug);
    if (input.coverImageUrl !== undefined) {
      data.coverImageUrl = input.coverImageUrl?.trim() || null;
    }
    if (input.category !== undefined) {
      data.category = String(input.category).trim().toUpperCase();
    }
    if (input.festivalTags !== undefined) {
      data.festivalTags = this.tags(input.festivalTags);
    }
    if (input.visibilityCountries !== undefined) {
      data.visibilityCountries = this.countries(input.visibilityCountries);
    }
    if (input.isFeatured !== undefined)
      data.isFeatured = Boolean(input.isFeatured);
    if (input.sortOrder !== undefined)
      data.sortOrder = Number(input.sortOrder) || 0;
    if (input.publishedAt !== undefined)
      data.publishedAt = this.date(input.publishedAt);

    if (input.translations !== undefined) {
      data.translations = {
        deleteMany: {},
        create: this.translations(input.translations, defaultLocale),
      };
    }

    return this.prisma.astrologyArticle.update({
      where: { id },
      data,
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async setPublished(
    id: string,
    isPublished: boolean,
    publishedAt?: string,
    adminSupabaseId?: string,
  ) {
    return this.prisma.astrologyArticle
      .update({
        where: { id },
        data: {
          isPublished,
          status: isPublished ? 'PUBLISHED' : 'DRAFT',
          publishedAt: isPublished
            ? this.date(publishedAt) || new Date()
            : null,
          reviewedByAdminId: await this.internalUserId(adminSupabaseId),
          reviewedAt: new Date(),
        },
      })
      .catch(() => {
        throw new NotFoundException('Article not found.');
      });
  }

  async approve(id: string, adminSupabaseId: string, publishedAt?: string) {
    return this.setPublished(id, true, publishedAt, adminSupabaseId);
  }

  async reject(id: string, adminSupabaseId: string, reviewNote?: string) {
    const note = String(reviewNote || '').trim();
    if (note.length < 3) {
      throw new BadRequestException(
        'Add a short review note so the astrologer knows what to improve.',
      );
    }

    return this.prisma.astrologyArticle
      .update({
        where: { id },
        data: {
          status: 'REJECTED',
          isPublished: false,
          publishedAt: null,
          reviewedByAdminId: await this.internalUserId(adminSupabaseId),
          reviewedAt: new Date(),
          reviewNote: note,
        },
      })
      .catch(() => {
        throw new NotFoundException('Article not found.');
      });
  }

  async submitAstrologerArticle(supabaseId: string, input: ArticleInput) {
    const astrologer = await this.approvedAstrologer(supabaseId);
    const defaultLocale = this.locale(input.defaultLocale);
    const translations = this.translations(input.translations, defaultLocale);

    return this.prisma.astrologyArticle.create({
      data: {
        slug: this.slug(input.slug),
        coverImageUrl: input.coverImageUrl?.trim() || null,
        category: String(input.category || 'ASTROLOGY')
          .trim()
          .toUpperCase(),
        festivalTags: this.tags(input.festivalTags),
        defaultLocale,
        visibilityCountries: this.countries(input.visibilityCountries),
        isFeatured: false,
        sortOrder: Number(input.sortOrder) || 0,
        authorType: 'ASTROLOGER',
        status: 'PENDING_REVIEW',
        isPublished: false,
        submittedByAstrologerId: astrologer.id,
        submittedAt: new Date(),
        translations: { create: translations },
      },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async listAstrologerArticles(supabaseId: string) {
    const astrologer = await this.approvedAstrologer(supabaseId);

    return this.prisma.astrologyArticle.findMany({
      where: { submittedByAstrologerId: astrologer.id },
      include: { translations: { orderBy: { locale: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async updateAstrologerArticle(
    supabaseId: string,
    id: string,
    input: Partial<ArticleInput>,
  ) {
    const astrologer = await this.approvedAstrologer(supabaseId);

    const existing = await this.prisma.astrologyArticle.findFirst({
      where: { id, submittedByAstrologerId: astrologer.id },
    });

    if (!existing) throw new NotFoundException('Article not found.');
    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new BadRequestException(
        'Only draft or rejected articles can be edited and submitted again.',
      );
    }

    await this.update(id, input);

    return this.prisma.astrologyArticle.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        isPublished: false,
        submittedAt: new Date(),
        reviewedByAdminId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
  }

  async remove(id: string) {
    await this.prisma.astrologyArticle.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Article not found.');
    });

    return { success: true };
  }

  async publicFeed(
    locale?: string,
    country?: string,
    category?: string,
    limit?: string,
    offset?: string,
    query?: string,
  ) {
    const selectedLocale = this.locale(locale);
    const take = Math.min(25, Math.max(1, Number(limit) || 10));
    const skip = offset === undefined ? 0 : Number(offset);
    if (
      !Number.isSafeInteger(skip) ||
      skip < 0 ||
      skip > 100000 ||
      !Number.isInteger(take)
    )
      throw new BadRequestException('Invalid article pagination.');
    const q = (query || '').trim();
    if (q.length > 120)
      throw new BadRequestException('Article search is too long.');

    const articles = await this.prisma.astrologyArticle.findMany({
      where: {
        isPublished: true,
        status: 'PUBLISHED',
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
        ...(category ? { category: category.trim().toUpperCase() } : {}),
        ...this.countryRule(country),
        ...(q
          ? {
              translations: {
                some: {
                  OR: [
                    { title: { contains: q, mode: 'insensitive' as const } },
                    { excerpt: { contains: q, mode: 'insensitive' as const } },
                  ],
                },
              },
            }
          : {}),
      },
      include: { translations: true },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { publishedAt: 'desc' },
        { id: 'asc' },
      ],
      take,
      skip,
    });

    return articles
      .map((article) => this.localized(article, selectedLocale))
      .filter(Boolean);
  }

  async publicAstrologerPosts(
    astrologerId: string,
    locale?: string,
    country?: string,
    limit?: string,
  ) {
    const normalizedAstrologerId = astrologerId?.trim();

    if (!normalizedAstrologerId) {
      throw new BadRequestException('Astrologer id is required.');
    }

    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id: normalizedAstrologerId,
        isApproved: true,
      },
      select: { id: true },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found.');
    }

    const requestedLocale = this.locale(locale);
    const countryFilter = this.countryRule(country);

    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const take =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50)
        : 20;

    const articles = await this.prisma.astrologyArticle.findMany({
      where: {
        submittedByAstrologerId: normalizedAstrologerId,
        isPublished: true,
        status: 'PUBLISHED',
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
        ...countryFilter,
      },
      include: {
        translations: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
    });

    return articles.map((article) => this.localized(article, requestedLocale));
  }

  async publicDetail(slug: string, locale?: string, country?: string) {
    const article = await this.prisma.astrologyArticle.findFirst({
      where: {
        slug,
        isPublished: true,
        status: 'PUBLISHED',
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
        ...this.countryRule(country),
      },
      include: { translations: true },
    });

    if (!article) throw new NotFoundException('Article not found.');
    return this.localized(article, this.locale(locale));
  }

  async publicCategories(country?: string) {
    const rows = await this.prisma.astrologyArticle.findMany({
      where: {
        isPublished: true,
        status: 'PUBLISHED',
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
        ...this.countryRule(country),
      },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => row.category);
  }

  async adminAudit(id: string) {
    const rows = await this.prisma.appConfig.findMany({
      where: { key: { startsWith: `ARTICLE_AUDIT_${id}_` } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { shareMessage: true, createdAt: true },
    });
    return rows.map((row) => ({
      at: row.createdAt,
      ...(JSON.parse(row.shareMessage) as Record<string, unknown>),
    }));
  }

  /** Existing article operations, made atomic with an append-only application audit. */
  async adminMutation(
    action:
      | 'CREATE'
      | 'UPDATE'
      | 'PUBLISH'
      | 'UNPUBLISH'
      | 'APPROVE'
      | 'REJECT'
      | 'DELETE',
    subject: string,
    id?: string,
    raw: unknown = {},
  ) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new BadRequestException('Invalid article request.');
    const input = raw as Partial<ArticleInput> & {
      expectedUpdatedAt?: string;
      reviewNote?: string;
    };
    if (action !== 'CREATE' && !id)
      throw new BadRequestException('Article id is required.');
    if (input.isFeatured !== undefined && typeof input.isFeatured !== 'boolean')
      throw new BadRequestException('Invalid featured state.');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(1095979057, 1095914572)::text AS lock_result`;
        const service = new ArticlesService(tx as PrismaService);
        const actorId = await service.internalUserId(subject);
        if (!actorId)
          throw new ForbiddenException('An existing Admin actor is required.');
        const actor = await tx.user.findUnique({
          where: { id: actorId },
          select: {
            isActive: true,
            isBlocked: true,
            role: { select: { name: true } },
          },
        });
        if (
          !actor?.isActive ||
          actor.isBlocked ||
          actor.role.name.toUpperCase() !== 'ADMIN'
        )
          throw new ForbiddenException('An active Admin actor is required.');
        const before = id
          ? await tx.astrologyArticle.findUnique({ where: { id } })
          : null;
        if (id && !before) throw new NotFoundException('Article not found.');
        if (
          input.expectedUpdatedAt &&
          before?.updatedAt.toISOString() !== input.expectedUpdatedAt
        )
          throw new ConflictException('Article changed. Reload before saving.');
        if (action === 'UPDATE' && before?.isPublished)
          throw new ConflictException(
            'Unpublish before editing to keep draft changes private.',
          );
        if (input.coverImageUrl) {
          let url: URL;
          try {
            url = new URL(input.coverImageUrl);
          } catch {
            throw new BadRequestException('Invalid article cover.');
          }
          if (url.protocol !== 'https:' || url.username || url.password)
            throw new BadRequestException(
              'Article covers require a public HTTPS URL.',
            );
        }
        if (
          input.category !== undefined &&
          (typeof input.category !== 'string' ||
            !/^[A-Za-z0-9_ -]{1,80}$/.test(input.category))
        )
          throw new BadRequestException('Invalid article category.');
        let result:
          | Awaited<ReturnType<ArticlesService['create']>>
          | Awaited<ReturnType<ArticlesService['setPublished']>>
          | { success: boolean };
        if (action === 'CREATE')
          result = await service.create(input as ArticleInput, subject);
        else if (action === 'UPDATE') result = await service.update(id!, input);
        else if (action === 'REJECT')
          result = await service.reject(id!, subject, input.reviewNote);
        else if (action === 'DELETE') result = await service.remove(id!);
        else
          result = await service.setPublished(
            id!,
            action !== 'UNPUBLISH',
            input.publishedAt,
            subject,
          );
        const articleId = id || ('id' in result ? result.id : undefined);
        if (!articleId)
          throw new BadRequestException(
            'Article result could not be identified.',
          );
        await tx.appConfig.create({
          data: {
            key: `ARTICLE_AUDIT_${articleId}_${randomUUID()}`,
            isActive: false,
            shareMessage: JSON.stringify({
              actorId,
              articleId,
              action,
              previousStatus: before?.status || null,
              status: 'status' in result ? result.status : null,
              changedFields: Object.keys(input).filter((k) =>
                [
                  'slug',
                  'category',
                  'translations',
                  'coverImageUrl',
                  'isFeatured',
                  'publishedAt',
                  'defaultLocale',
                  'festivalTags',
                  'visibilityCountries',
                  'sortOrder',
                  'reviewNote',
                ].includes(k),
              ),
            }),
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
