import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ABOUT_DEFAULT,
  validateAbout,
  type AboutContent,
} from './about-content';

/** Preserve the existing public-edit API while bringing its About-only writes
 * under the same lock, revision and audit contract as the new CMS. */
export async function syncLegacyAbout(
  tx: Prisma.TransactionClient,
  subject: string | undefined,
  patch: { title?: string | null; introduction?: string | null },
) {
  if (!subject)
    throw new ForbiddenException('Verified About editor is required');
  const actor = await tx.user.findUnique({
    where: { supabaseId: subject },
    select: {
      id: true,
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
    throw new ForbiddenException('Authorized About editor is required');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1095979057, 1094864725)::text AS lock_result`;
  const [draft, live, shared] = await Promise.all([
    tx.appConfig.findUnique({ where: { key: 'ABOUT_CMS_DRAFT_V1' } }),
    tx.appConfig.findUnique({ where: { key: 'ABOUT_CMS_PUBLISHED_V1' } }),
    tx.appConfig.findUnique({ where: { key: 'PUBLIC_APP_CONFIG' } }),
  ]);
  const parse = (row: { shareMessage: string } | null) =>
    row
      ? (JSON.parse(row.shareMessage) as {
          revision: number;
          content: AboutContent;
        })
      : null;
  const currentDraft = parse(draft),
    currentLive = parse(live);
  for (const doc of [currentDraft, currentLive])
    if (doc && (!Number.isSafeInteger(doc.revision) || doc.revision < 1))
      throw new ForbiddenException('About revision requires review');
  const introduction =
    patch.introduction === undefined
      ? shared?.aboutDescription || ABOUT_DEFAULT.introduction
      : patch.introduction || ABOUT_DEFAULT.introduction;
  const title =
    patch.title === undefined
      ? shared?.aboutTitle || ABOUT_DEFAULT.title
      : patch.title || ABOUT_DEFAULT.title;
  const published = validateAbout({
    ...(currentLive?.content || ABOUT_DEFAULT),
    title,
    introduction,
  });
  const pending = validateAbout({
    ...(currentDraft?.content || published),
    title,
    introduction,
  });
  const revision =
    Math.max(currentDraft?.revision || 0, currentLive?.revision || 0) + 1;
  for (const [key, content, isActive] of [
    ['ABOUT_CMS_DRAFT_V1', pending, false],
    ['ABOUT_CMS_PUBLISHED_V1', published, true],
  ] as const) {
    const doc = {
      revision,
      content,
      ...(isActive ? { publishedAt: new Date().toISOString() } : {}),
    };
    await tx.appConfig.upsert({
      where: { key },
      create: { key, shareMessage: JSON.stringify(doc), isActive },
      update: { shareMessage: JSON.stringify(doc), isActive },
    });
  }
  await tx.appConfig.create({
    data: {
      key: 'ABOUT_CMS_AUDIT_' + randomUUID(),
      isActive: false,
      shareMessage: JSON.stringify({
        actorId: actor.id,
        action: 'LEGACY_PUBLISH',
        revision,
        content: published,
      }),
    },
  });
}
