import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ABOUT_DEFAULT, validateAbout, AboutContent } from './about-content';
const DRAFT = 'ABOUT_CMS_DRAFT_V1',
  LIVE = 'ABOUT_CMS_PUBLISHED_V1';
type Document = {
  revision: number;
  content: AboutContent;
  publishedAt?: string;
};
@Injectable()
export class AboutCmsService {
  constructor(private readonly prisma: PrismaService) {}
  private parse(value: string): Document {
    const doc = JSON.parse(value) as Document;
    if (!Number.isSafeInteger(doc.revision) || doc.revision < 1)
      throw new Error('Invalid stored About revision');
    return {
      revision: doc.revision,
      content: validateAbout(doc.content),
      ...(doc.publishedAt ? { publishedAt: doc.publishedAt } : {}),
    };
  }
  async published() {
    const live = await this.prisma.appConfig.findUnique({
      where: { key: LIVE },
    });
    if (live?.isActive)
      return {
        success: true,
        data: this.parse(live.shareMessage),
        source: 'published',
      };
    const legacy = await this.prisma.appConfig.findUnique({
      where: { key: 'PUBLIC_APP_CONFIG' },
    });
    const content = { ...ABOUT_DEFAULT };
    if (
      legacy?.isActive &&
      legacy.aboutTitle?.trim() &&
      legacy.aboutDescription?.trim()
    ) {
      content.title = legacy.aboutTitle;
      content.introduction = legacy.aboutDescription;
    }
    return {
      success: true,
      data: { revision: 0, content: validateAbout(content) },
      source:
        legacy?.isActive &&
        legacy.aboutTitle?.trim() &&
        legacy.aboutDescription?.trim()
          ? 'shared-app-config'
          : 'approved-flutter-default',
    };
  }
  async admin() {
    const [draft, published, audit, shared] = await Promise.all([
      this.prisma.appConfig.findUnique({ where: { key: DRAFT } }),
      this.published(),
      this.prisma.appConfig.findMany({
        where: { key: { startsWith: 'ABOUT_CMS_AUDIT_' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { key: true, shareMessage: true, createdAt: true },
      }),
      this.prisma.appConfig.findUnique({
        where: { key: 'PUBLIC_APP_CONFIG' },
        select: { isActive: true },
      }),
    ]);
    return {
      success: true,
      draft: draft
        ? this.parse(draft.shareMessage)
        : { revision: 0, content: published.data.content },
      published,
      readiness: {
        canPublish: shared?.isActive === true,
        reason: shared?.isActive
          ? null
          : 'An existing active PUBLIC_APP_CONFIG is required. An operator must verify and configure the shared application settings before About publication.',
      },
      audit: audit.map((row) => ({
        id: row.key,
        at: row.createdAt,
        ...(JSON.parse(row.shareMessage) as Record<string, unknown>),
      })),
    };
  }
  async save(
    actorId: string,
    expectedRevision: number,
    value: unknown,
    publish: boolean,
  ) {
    const content = validateAbout(value);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      throw new BadRequestException('Invalid revision');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(1095979057, 1094864725)::text AS lock_result`;
        const current = await tx.appConfig.findUnique({
          where: { key: DRAFT },
        });
        const revision = current
          ? this.parse(current.shareMessage).revision
          : 0;
        if (expectedRevision !== revision)
          throw new ConflictException(
            'About draft changed. Reload before saving.',
          );
        const doc: Document = {
          revision: revision + 1,
          content,
          ...(publish ? { publishedAt: new Date().toISOString() } : {}),
        };
        await tx.appConfig.upsert({
          where: { key: DRAFT },
          create: {
            key: DRAFT,
            shareMessage: JSON.stringify(doc),
            isActive: false,
          },
          update: { shareMessage: JSON.stringify(doc), isActive: false },
        });
        if (publish) {
          await tx.appConfig.upsert({
            where: { key: LIVE },
            create: {
              key: LIVE,
              shareMessage: JSON.stringify(doc),
              isActive: true,
            },
            update: { shareMessage: JSON.stringify(doc), isActive: true },
          });
          const shared = await tx.appConfig.findUnique({
            where: { key: 'PUBLIC_APP_CONFIG' },
          });
          if (!shared?.isActive)
            throw new ConflictException(
              'Active shared app configuration is required before publishing',
            );
          await tx.appConfig.update({
            where: { key: 'PUBLIC_APP_CONFIG' },
            data: {
              aboutTitle: content.title,
              aboutDescription: content.introduction,
            },
          });
        }
        await tx.appConfig.create({
          data: {
            key: 'ABOUT_CMS_AUDIT_' + randomUUID(),
            isActive: false,
            shareMessage: JSON.stringify({
              actorId,
              action: publish ? 'PUBLISH' : 'SAVE_DRAFT',
              revision: doc.revision,
              content,
            }),
          },
        });
        return { success: true, data: doc };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
