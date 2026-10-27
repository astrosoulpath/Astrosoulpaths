jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class {},
}));
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { ArticlesAdminController } from './articles-admin.controller';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
const translation = (locale = 'en', title = 'Synthetic approved article') => ({
  locale,
  title,
  excerpt: 'Synthetic description',
  contentMarkdown: 'Synthetic educational article text. '.repeat(8),
  authorName: null,
});
const article = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  slug: id,
  category: 'SYNTHETIC',
  isPublished: true,
  status: 'PUBLISHED',
  publishedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  createdAt: new Date('2026-01-01'),
  visibilityCountries: [],
  isFeatured: false,
  defaultLocale: 'en',
  translations: [translation()],
  createdByAdminId: 'PRIVATE-ACTOR',
  ...patch,
});
function matches(row: any, w: any): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, v]: [string, any]) => {
    if (k === 'OR') return v.some((part: any) => matches(row, part));
    if (k === 'AND') return v.every((part: any) => matches(row, part));
    if (k === 'visibilityCountries')
      return v.isEmpty ? row[k].length === 0 : row[k].includes(v.has);
    if (k === 'translations')
      return row.translations.some((t: any) => matches(t, v.some));
    if (v && typeof v === 'object' && 'lte' in v)
      return row[k] != null && new Date(row[k]) <= v.lte;
    if (v && typeof v === 'object' && 'contains' in v)
      return String(row[k] || '')
        .toLowerCase()
        .includes(v.contains.toLowerCase());
    return row[k] === v;
  });
}
function fixture(initial: any[] = [], actorRole = 'ADMIN') {
  let rows = new Map(initial.map((a) => [a.id, a])),
    audits: any[] = [];
  let auditFails = false;
  const build = (data: Map<string, any>, history: any[]) => ({
    userAuthIdentity: {
      findUnique: jest.fn(async () => ({ userId: 'synthetic-admin' })),
    },
    user: {
      findUnique: jest.fn(async () => ({
        id: 'synthetic-admin',
        isActive: true,
        isBlocked: false,
        role: { name: actorRole },
      })),
    },
    astrologyArticle: {
      findMany: jest.fn(async (q: any) => {
        let values = [...data.values()].filter((a) => matches(a, q.where));
        if (q.distinct)
          values = values.filter(
            (a, i) => values.findIndex((b) => b.category === a.category) === i,
          );
        values = values.slice(q.skip || 0, (q.skip || 0) + (q.take || 10000));
        return q.select
          ? values.map((a) => ({ category: a.category }))
          : values;
      }),
      findUnique: jest.fn(async ({ where }: any) => data.get(where.id) || null),
      findFirst: jest.fn(
        async ({ where }: any) =>
          [...data.values()].find((a) => matches(a, where)) || null,
      ),
      create: jest.fn(async ({ data: input }: any) => {
        const row = article('created-synthetic', {
          ...input,
          translations: input.translations.create,
          updatedAt: new Date(),
        });
        data.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data: patch }: any) => {
        if (!data.has(where.id)) throw Error('missing');
        const current = data.get(where.id),
          next = { ...current, ...patch, updatedAt: new Date() };
        if (patch.translations) next.translations = patch.translations.create;
        data.set(where.id, next);
        return next;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = data.get(where.id);
        data.delete(where.id);
        return row;
      }),
    },
    appConfig: {
      create: jest.fn(async ({ data }: any) => {
        if (auditFails) throw Error('Synthetic audit failure');
        history.push(data);
        return data;
      }),
      findMany: jest.fn(async () =>
        history.map((a) => ({
          shareMessage: a.shareMessage,
          createdAt: new Date(),
        })),
      ),
    },
    $queryRaw: jest.fn(async () => [{ lock_result: '' }]),
  });
  const prisma: any = {
    ...build(rows, audits),
    $transaction: jest.fn(async (work: any, options: any) => {
      expect(options.isolationLevel).toBe('Serializable');
      const copy = new Map(structuredClone([...rows])),
        history = structuredClone(audits);
      const result = await work(build(copy, history));
      rows = copy;
      audits = history;
      Object.assign(prisma, build(rows, audits));
      return result;
    }),
  };
  return {
    service: new ArticlesService(prisma),
    prisma,
    rows: () => rows,
    audits: () => audits,
    failAudit: () => (auditFails = true),
  };
}
describe('shared Articles publication and CMS safety — synthetic only', () => {
  it('category catalogue does not reserve an existing valid article slug', async () => {
    const f = fixture([article('categories')]);
    expect((await f.service.publicDetail('categories'))?.slug).toBe(
      'categories',
    );
    expect(
      Reflect.getMetadata('path', ArticlesController.prototype.categories),
    ).toBe('catalogue/categories');
  });
  it('preserves existing trimmed country-input normalization', async () => {
    const f = fixture();
    const row = await f.service.adminMutation('CREATE', 'admin', undefined, {
      slug: 'trimmed',
      visibilityCountries: [' in '],
      translations: [translation()],
    });
    if (!('id' in row)) throw Error('Expected article');
    expect(row.visibilityCountries).toEqual(['IN']);
  });
  it('keeps Flutter feed an array with canonical IDs and translated body', async () => {
    const f = fixture([article('global')]);
    const result = await f.service.publicFeed('en');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({
      id: 'global',
      slug: 'global',
      locale: 'en',
      contentMarkdown: translation().contentMarkdown,
    });
    expect(result[0]).not.toHaveProperty('createdByAdminId');
  });
  it.each([
    { status: 'DRAFT' },
    { status: 'REJECTED' },
    { status: 'PENDING_REVIEW' },
    { isPublished: false },
    { publishedAt: new Date('2100-01-01') },
  ])('hides nonpublic state %j', async (patch) => {
    const f = fixture([article('hidden', patch)]);
    expect(await f.service.publicFeed()).toEqual([]);
    await expect(f.service.publicDetail('hidden')).rejects.toThrow('not found');
  });
  it('unknown country exposes only global records; matching country adds its region', async () => {
    const f = fixture([
      article('global'),
      article('india', { visibilityCountries: ['IN'] }),
      article('france', { visibilityCountries: ['FR'] }),
    ]);
    expect((await f.service.publicFeed()).map((a) => a?.id)).toEqual([
      'global',
    ]);
    expect((await f.service.publicFeed('en', 'IN')).map((a) => a?.id)).toEqual([
      'global',
      'india',
    ]);
    await expect(f.service.publicFeed('en', 'invalid')).rejects.toThrow(
      'country',
    );
  });
  it('search, categories and offset use the same publication predicate', async () => {
    const f = fixture([
      article('one', {
        category: 'MOON',
        translations: [translation('en', 'Moon perspective')],
      }),
      article('two', {
        category: 'SUN',
        translations: [translation('en', 'Sun perspective')],
      }),
      article('private', { category: 'PRIVATE', status: 'DRAFT' }),
    ]);
    expect(await f.service.publicCategories()).toEqual(['MOON', 'SUN']);
    expect(
      (await f.service.publicFeed('en', undefined, undefined, '1', '1')).map(
        (a) => a?.id,
      ),
    ).toEqual(['two']);
    expect(
      (
        await f.service.publicFeed(
          'en',
          undefined,
          undefined,
          '12',
          '0',
          'moon',
        )
      ).map((a) => a?.id),
    ).toEqual(['one']);
  });
  it.each(['-1', '1.5', 'NaN', '100001'])(
    'rejects invalid offset %s',
    async (offset) => {
      await expect(
        fixture().service.publicFeed('en', undefined, undefined, '12', offset),
      ).rejects.toThrow('pagination');
    },
  );
  it('retains existing fallback language contract and reports actual locale', async () => {
    const f = fixture([article('global')]);
    expect((await f.service.publicFeed('hi'))[0]?.locale).toBe('en');
  });
  it('Admin creation is draft-only and audited atomically', async () => {
    const f = fixture();
    const row = await f.service.adminMutation(
      'CREATE',
      'synthetic-subject',
      undefined,
      { slug: 'new-article', category: 'MOON', translations: [translation()] },
    );
    if (!('id' in row)) throw new Error('Expected a synthetic article result.');
    expect(row.status).toBe('DRAFT');
    expect(row.isPublished).toBe(false);
    expect(JSON.parse(f.audits()[0].shareMessage)).toMatchObject({
      actorId: 'synthetic-admin',
      action: 'CREATE',
      articleId: row.id,
    });
    expect(await f.service.publicFeed()).toEqual([]);
  });
  it('publication then unpublication controls both website and Flutter reads', async () => {
    const f = fixture([
      article('draft', { status: 'DRAFT', isPublished: false }),
    ]);
    await f.service.adminMutation('PUBLISH', 'synthetic-subject', 'draft');
    expect((await f.service.publicFeed()).map((a) => a?.id)).toEqual(['draft']);
    await f.service.adminMutation('UNPUBLISH', 'synthetic-subject', 'draft');
    expect(await f.service.publicFeed()).toEqual([]);
    expect(f.audits()).toHaveLength(2);
  });
  it('future publication remains hidden until due', async () => {
    const f = fixture([
      article('scheduled', { isPublished: false, status: 'DRAFT' }),
    ]);
    await f.service.adminMutation('PUBLISH', 'synthetic-subject', 'scheduled', {
      publishedAt: '2100-01-01T00:00:00Z',
    });
    expect(await f.service.publicFeed()).toEqual([]);
  });
  it('published body edits require an explicit unpublish', async () => {
    const f = fixture([article('live')]);
    await expect(
      f.service.adminMutation('UPDATE', 'synthetic-subject', 'live', {
        translations: [translation()],
      }),
    ).rejects.toThrow('Unpublish');
    expect(f.audits()).toHaveLength(0);
  });
  it('stale revision cannot overwrite a saved draft', async () => {
    const f = fixture([
      article('draft', { status: 'DRAFT', isPublished: false }),
    ]);
    await expect(
      f.service.adminMutation('UPDATE', 'synthetic-subject', 'draft', {
        expectedUpdatedAt: 'old',
        category: 'SUN',
      }),
    ).rejects.toThrow('Reload');
  });
  it('audit failure rolls back the publication', async () => {
    const f = fixture([
      article('draft', { status: 'DRAFT', isPublished: false }),
    ]);
    f.failAudit();
    await expect(
      f.service.adminMutation('PUBLISH', 'synthetic-subject', 'draft'),
    ).rejects.toThrow('audit failure');
    expect(f.rows().get('draft').isPublished).toBe(false);
    expect(f.audits()).toHaveLength(0);
  });
  it('non-Admin actor cannot create, and malformed cover URLs fail', async () => {
    await expect(
      fixture([], 'CUSTOMER').service.adminMutation(
        'CREATE',
        'customer',
        undefined,
        {},
      ),
    ).rejects.toThrow('Admin');
    await expect(
      fixture().service.adminMutation('CREATE', 'admin', undefined, {
        coverImageUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('HTTPS');
  });
  it('malformed featured values and duplicate translation locales reject', async () => {
    await expect(
      fixture().service.adminMutation('CREATE', 'admin', undefined, {
        isFeatured: 'false',
      }),
    ).rejects.toThrow('featured');
    await expect(
      fixture().service.adminMutation('CREATE', 'admin', undefined, {
        slug: 'test',
        translations: [translation(), translation()],
      }),
    ).rejects.toThrow('Duplicate');
  });
  it('public category route is explicit and Admin controller retains RBAC', () => {
    expect(Reflect.getMetadata('path', ArticlesController)).toBe('articles');
    expect(
      Reflect.getMetadata('path', ArticlesController.prototype.categories),
    ).toBe('catalogue/categories');
    expect(Reflect.getMetadata(ROLES_KEY, ArticlesAdminController)).toEqual([
      'admin',
    ]);
    expect(
      Reflect.getMetadata('__guards__', ArticlesAdminController),
    ).toHaveLength(2);
  });
  it('forged role fields cannot satisfy the real Admin role guard', async () => {
    const guard = new RolesGuard(new Reflector(), {} as never);
    const request = { user: { sub: 'fake', role: 'ADMIN' } };
    const context = {
      getHandler: () => ArticlesAdminController.prototype.list,
      getClass: () => ArticlesAdminController,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      'Admin context',
    );
  });
});
