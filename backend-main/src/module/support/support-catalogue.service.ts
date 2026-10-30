import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { hasSupportCredential } from './support-input-policy';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  auditSupport,
  requireSupportOperations,
  supportOperationsEnabled,
} from './support-operations';
import { resolveSupportActor, supportLock } from './support-policy';
import { OFFICIAL_SUPPORT_EMAIL, PUBLIC_SUPPORT_CATEGORIES, validatePublicHelp, type PublicHelp } from './public-support-policy';

export type SupportCatalogue = {
  publicHelp?: PublicHelp;
  welcome: string;
  visible: boolean;
  knowledge: string[];
  categories: {
    id: string;
    title: string;
    enabled: boolean;
    questions: { id: string; text: string; enabled: boolean }[];
  }[];
};
const definitions = [
  [
    'payment',
    'Payment & Refund Help',
    [
      'Payment deducted but service not received',
      'Failed transaction',
      'Refund status',
      'Wallet balance issue',
      'Subscription payment issue',
    ],
  ],
  [
    'consultation',
    'Consultation Help',
    [
      'Call not connected',
      'Astrologer unavailable',
      'Chat consultation issue',
      'Consultation ended unexpectedly',
      'Booking or consultation status',
      'Consultation-related refund request',
    ],
  ],
  [
    'account',
    'App & Account Help',
    [
      'Google Login issue',
      'Profile issue',
      'Kundli generation or download issue',
      'Subscription access issue',
      'App crash or technical issue',
      'Account management help',
    ],
  ],
] as const;
export const DEFAULT_SUPPORT_CATALOGUE: SupportCatalogue = {
  welcome: 'Namaste! 🙏 How can I help you today?',
  visible: true,
  knowledge: [],
  categories: definitions.map(([id, title, questions]) => ({
    id,
    title,
    enabled: true,
    questions: questions.map((text: string, i: number) => ({
      id: `${id}-${i + 1}`,
      text,
      enabled: true,
    })),
  })),
};
export function validateSupportCatalogue(value: unknown): SupportCatalogue {
  const input = value as SupportCatalogue;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' &&
    v.trim().length > 0 &&
    v.length <= max &&
    !hasSupportCredential(v);
  if (
    !input ||
    !text(input.welcome, 500) ||
    typeof input.visible !== 'boolean' ||
    !Array.isArray(input.knowledge) ||
    input.knowledge.length > 20 ||
    input.knowledge.some((k) => !text(k, 1500)) ||
    !Array.isArray(input.categories) ||
    input.categories.length !== 3
  )
    throw new BadRequestException('Invalid support catalogue');
  const ids = new Set<string>();
  const categories = new Set<string>();
  for (const category of input.categories) {
    if (!category || typeof category !== 'object')
      throw new BadRequestException('Invalid support category');
    if (
      !['payment', 'consultation', 'account'].includes(category.id) ||
      categories.has(category.id) ||
      !text(category.title, 80) ||
      typeof category.enabled !== 'boolean' ||
      !Array.isArray(category.questions) ||
      category.questions.length > 30
    )
      throw new BadRequestException('Invalid support category');
    categories.add(category.id);
    for (const q of category.questions) {
      if (!q || typeof q !== 'object')
        throw new BadRequestException('Invalid support question');
      if (
        !text(q.id, 80) ||
        !/^[a-z0-9-]+$/.test(q.id) ||
        ids.has(q.id) ||
        !text(q.text, 300) ||
        typeof q.enabled !== 'boolean'
      )
        throw new BadRequestException('Invalid support question');
      ids.add(q.id);
    }
  }
  // Explicit projection excludes extra metadata, permissions, URLs or executable content.
  return {
    ...(input.publicHelp === undefined ? {} : {publicHelp: validatePublicHelp(input.publicHelp)}),
    welcome: input.welcome.trim(),
    visible: input.visible,
    knowledge: input.knowledge.map((k) => k.trim()),
    categories: input.categories.map((c) => ({
      id: c.id,
      title: c.title.trim(),
      enabled: c.enabled,
      questions: c.questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        enabled: q.enabled,
      })),
    })),
  };
}
@Injectable()
export class SupportCatalogueService {
  constructor(private readonly db: PrismaService) {}
  async publicHelp() {
    const {config} = await this.read();
    const help = validatePublicHelp(config.publicHelp);
    return {success: true, categories: [...PUBLIC_SUPPORT_CATEGORIES], published: help.published,
      contact: {email: help.published && help.email ? help.email : OFFICIAL_SUPPORT_EMAIL,
        hours: help.published ? help.hours : '', responseTime: help.published ? help.responseTime : ''},
      contactSource: help.published && help.email ? 'published-cms' : 'approved-official-default',
      faqs: help.published ? help.faqs.filter(faq => faq.enabled).map(({id, question, answer, category}) => ({id, question, answer, category})) : []};
  }
  private async read(
    db: Pick<Prisma.TransactionClient, '$queryRaw'> = this.db,
  ) {
    if (!supportOperationsEnabled())
      return {
        revision: 0,
        config: structuredClone(DEFAULT_SUPPORT_CATALOGUE),
      };
    const rows = await db.$queryRaw<
      { details: unknown }[]
    >`SELECT "details" FROM public."SupportOperationAudit" WHERE "objectType"='ASSISTANT_CONFIG' AND "objectId"='catalogue' AND "action"='CONFIG_UPDATED' ORDER BY ("details"->>'revision')::bigint DESC,"id" DESC LIMIT 1`;
    if (!rows.length)
      return {
        revision: 0,
        config: structuredClone(DEFAULT_SUPPORT_CATALOGUE),
      };
    const details = rows[0].details;
    if (
      !details ||
      typeof details !== 'object' ||
      !('revision' in details) ||
      !('config' in details)
    )
      throw new ConflictException('Support configuration requires review');
    const { revision, config } = details;
    if (
      typeof revision !== 'number' ||
      !Number.isSafeInteger(revision) ||
      revision < 1
    )
      throw new ConflictException('Support configuration requires review');
    return { revision, config: validateSupportCatalogue(config) };
  }
  async customer(auth: unknown) {
    await resolveSupportActor(this.db, auth, false);
    const { revision, config } = await this.read();
    return {
      revision,
      visible: config.visible,
      welcome: config.welcome,
      categories: config.visible
        ? config.categories
            .filter((c) => c.enabled)
            .map((c) => ({
              ...c,
              questions: c.questions.filter((q) => q.enabled),
            }))
        : [],
    };
  }
  async admin(auth: unknown) {
    await resolveSupportActor(this.db, auth, true);
    const history = supportOperationsEnabled()
      ? await this.db.$queryRaw<
          { id: string; actorId: string; createdAt: Date; revision: string }[]
        >`SELECT "id","actorId","createdAt",("details"->>'revision') AS "revision" FROM public."SupportOperationAudit" WHERE "objectType"='ASSISTANT_CONFIG' AND "objectId"='catalogue' AND "action"='CONFIG_UPDATED' ORDER BY ("details"->>'revision')::bigint DESC LIMIT 10`
      : [];
    return {
      ...(await this.read()),
      editable: supportOperationsEnabled(),
      history,
    };
  }
  async save(
    auth: unknown,
    body: { expectedRevision: number; config: unknown },
  ) {
    const actor: unknown = await resolveSupportActor(this.db, auth, true);
    if (
      !actor ||
      typeof actor !== 'object' ||
      !('id' in actor) ||
      typeof actor.id !== 'string'
    )
      throw new ConflictException('Admin verification unavailable');
    const actorId = actor.id;
    requireSupportOperations();
    if (
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0
    )
      throw new BadRequestException('Invalid revision');
    const config = validateSupportCatalogue(body.config);
    return this.db.$transaction(async (tx) => {
      await supportLock(tx, 'assistant-catalogue');
      const current = await this.read(tx);
      if (current.revision !== body.expectedRevision)
        throw new ConflictException(
          'Configuration changed. Reload before saving.',
        );
      const revision = current.revision + 1;
      // Existing append-only audit stream is the versioned configuration source.
      // One committed event atomically records both state and the Admin actor.
      await auditSupport(
        tx,
        actorId,
        'ASSISTANT_CONFIG',
        'catalogue',
        'CONFIG_UPDATED',
        { revision, config },
      );
      return { revision, config, editable: true };
    });
  }
  async question(categoryId: string, questionId: string) {
    const { config } = await this.read();
    const category =
      config.visible &&
      config.categories.find((c) => c.id === categoryId && c.enabled);
    const question =
      category &&
      category.questions.find((q) => q.id === questionId && q.enabled);
    if (!question)
      throw new BadRequestException(
        'This support question is unavailable. Reload the topics.',
      );
    return question.text;
  }
  async reference() {
    const { config } = await this.read();
    if (!config.visible)
      throw new ServiceUnavailableException(
        'AI Support is paused. Please use Human Support.',
      );
    return config.knowledge;
  }
}
