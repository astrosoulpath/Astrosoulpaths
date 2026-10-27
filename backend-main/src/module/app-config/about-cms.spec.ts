jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class {},
}));
import { AboutCmsService } from './about-cms.service';
import { ABOUT_DEFAULT, validateAbout } from './about-content';
import {
  AboutAdminController,
  AboutPublicController,
} from './about-cms.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { syncLegacyAbout } from './about-legacy-sync';
function fixture() {
  let rows = new Map<string, any>([
    [
      'PUBLIC_APP_CONFIG',
      {
        key: 'PUBLIC_APP_CONFIG',
        isActive: true,
        shareMessage: 'preserved',
        websiteUrl: 'https://example.test',
        aboutTitle: 'Approved shared title',
        aboutDescription: 'Approved shared introduction',
      },
    ],
  ]);
  const operations: string[] = [];
  const store = (target: Map<string, any>) => ({
    findUnique: jest.fn(
      async ({ where }: any) => target.get(where.key) || null,
    ),
    findMany: jest.fn(async () =>
      [...target.values()]
        .filter((r) => r.key.startsWith('ABOUT_CMS_AUDIT_'))
        .reverse()
        .slice(0, 20),
    ),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      operations.push(where.key);
      const row = target.has(where.key)
        ? { ...target.get(where.key), ...update }
        : create;
      target.set(where.key, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = { ...target.get(where.key), ...data };
      target.set(where.key, row);
      return row;
    }),
    create: jest.fn(async ({ data }: any) => {
      target.set(data.key, data);
      return data;
    }),
  });
  const prisma: any = {
    get appConfig() {
      return store(rows);
    },
    $transaction: jest.fn(async (work: any, options: any) => {
      expect(options.isolationLevel).toBe('Serializable');
      const copy = new Map(rows);
      const tx = {
        appConfig: store(copy),
        user: {
          findUnique: jest.fn(async () => ({
            id: 'synthetic-admin',
            isActive: true,
            isBlocked: false,
            role: { name: 'ADMIN' },
          })),
        },
        $queryRaw: jest.fn(async () => {
          operations.push('LOCK');
          return [{ lock_result: '' }];
        }),
      };
      const result = await work(tx);
      rows = copy;
      return result;
    }),
  };
  return {
    service: new AboutCmsService(prisma),
    rows: () => rows,
    operations,
    prisma,
  };
}
describe('About CMS synthetic transactional contract', () => {
  it('Admin readiness identifies a missing shared config without creating records', async () => {
    const f = fixture();
    f.rows().delete('PUBLIC_APP_CONFIG');
    const result = await f.service.admin();
    expect(result.readiness.canPublish).toBe(false);
    expect(result.readiness.reason).toContain('PUBLIC_APP_CONFIG');
    expect(f.rows().size).toBe(0);
  });
  it('inactive shared config blocks publication and valid config permits preparation', async () => {
    const f = fixture();
    expect((await f.service.admin()).readiness.canPublish).toBe(true);
    f.rows().get('PUBLIC_APP_CONFIG').isActive = false;
    expect((await f.service.admin()).readiness.canPublish).toBe(false);
  });
  it('legacy About edits share revision locking and audit without publishing unsaved draft sections', async () => {
    const f = fixture();
    await f.service.save(
      'synthetic-admin',
      0,
      { ...ABOUT_DEFAULT, mission: 'UNPUBLISHED MISSION' },
      false,
    );
    await f.prisma.$transaction(
      (tx: never) =>
        syncLegacyAbout(tx, 'synthetic-subject', {
          title: 'Legacy approved title',
        }),
      { isolationLevel: 'Serializable' },
    );
    const live = await f.service.published();
    expect(live.data.revision).toBe(2);
    expect(live.data.content.title).toBe('Legacy approved title');
    expect(live.data.content.mission).toBe(ABOUT_DEFAULT.mission);
    expect((await f.service.admin()).draft.content.mission).toBe(
      'UNPUBLISHED MISSION',
    );
    expect((await f.service.admin()).audit[0]).toMatchObject({
      action: 'LEGACY_PUBLISH',
      revision: 2,
    });
    await expect(
      f.service.save('synthetic-admin', 1, ABOUT_DEFAULT, true),
    ).rejects.toThrow('Reload');
  });
  it('legacy About synchronization rejects missing actors and unsafe text atomically', async () => {
    const f = fixture();
    await expect(
      f.prisma.$transaction(
        (tx: never) => syncLegacyAbout(tx, undefined, { title: 'Denied' }),
        { isolationLevel: 'Serializable' },
      ),
    ).rejects.toThrow('editor');
    await expect(
      f.prisma.$transaction(
        (tx: never) =>
          syncLegacyAbout(tx, 'synthetic-subject', {
            introduction: '<script>bad</script>',
          }),
        { isolationLevel: 'Serializable' },
      ),
    ).rejects.toThrow('About text');
    expect(f.rows().size).toBe(1);
  });
  it('all nonempty default copy is present verbatim in the existing Flutter About screen', () => {
    const mobile = readFileSync(
      resolve(
        process.cwd(),
        '../astro-soul-path-app/lib/features/about_us/presentation/screens/about_us_screen.dart',
      ),
      'utf8',
    );
    for (const text of Object.values(ABOUT_DEFAULT).filter(Boolean))
      expect(mobile).toContain(text);
  });
  it('defaults use Flutter-approved copy and no invented commitment', () => {
    expect(ABOUT_DEFAULT.commitment).toBe('');
    expect(ABOUT_DEFAULT.services).toContain('entitlement');
  });
  it('accepts Unicode plain text', () => {
    expect(
      validateAbout({ ...ABOUT_DEFAULT, mission: 'नमस्ते · مرحبا' }).mission,
    ).toContain('مرحبا');
  });
  it.each([
    null,
    [],
    { ...ABOUT_DEFAULT, title: '' },
    { ...ABOUT_DEFAULT, introduction: '<script>x</script>' },
    { ...ABOUT_DEFAULT, images: ['x'] },
    { ...ABOUT_DEFAULT, title: 'x'.repeat(121) },
  ])('rejects malformed or unsupported managed content %j', (value) =>
    expect(() => validateAbout(value)).toThrow(),
  );
  it('uses exact shared introduction before CMS publication', async () => {
    const f = fixture();
    const result = await f.service.published();
    expect(result.data.content.introduction).toBe(
      'Approved shared introduction',
    );
    expect(result.data.revision).toBe(0);
  });
  it('draft never leaks into published API', async () => {
    const f = fixture();
    await f.service.save(
      'synthetic-admin',
      0,
      { ...ABOUT_DEFAULT, introduction: 'DRAFT SECRET' },
      false,
    );
    const result = await f.service.published();
    expect(JSON.stringify(result)).not.toContain('DRAFT SECRET');
    expect(f.rows().get('ABOUT_CMS_DRAFT_V1').isActive).toBe(false);
  });
  it('publishes and updates only shared About fields atomically', async () => {
    const f = fixture();
    await f.service.save('synthetic-admin', 0, ABOUT_DEFAULT, true);
    const result = await f.service.published();
    expect(result.source).toBe('published');
    expect(result.data.content).toEqual(ABOUT_DEFAULT);
    expect(f.rows().get('PUBLIC_APP_CONFIG')).toMatchObject({
      shareMessage: 'preserved',
      websiteUrl: 'https://example.test',
      aboutTitle: ABOUT_DEFAULT.title,
      aboutDescription: ABOUT_DEFAULT.introduction,
    });
    expect(f.operations[0]).toBe('LOCK');
  });
  it('stale revisions prevent lost updates and duplicate publication', async () => {
    const f = fixture();
    await f.service.save('synthetic-admin', 0, ABOUT_DEFAULT, false);
    await expect(
      f.service.save('synthetic-admin', 0, ABOUT_DEFAULT, true),
    ).rejects.toThrow('Reload');
    expect(f.rows().has('ABOUT_CMS_PUBLISHED_V1')).toBe(false);
  });
  it('failed shared prerequisite rolls back draft, published content and audit', async () => {
    const f = fixture();
    f.rows().delete('PUBLIC_APP_CONFIG');
    await expect(
      f.service.save('synthetic-admin', 0, ABOUT_DEFAULT, true),
    ).rejects.toThrow('shared');
    expect(f.rows().size).toBe(0);
  });
  it('audit contains revision, action, content and canonical actor', async () => {
    const f = fixture();
    await f.service.save('synthetic-admin', 0, ABOUT_DEFAULT, false);
    const state = await f.service.admin();
    expect(state.audit[0]).toMatchObject({
      actorId: 'synthetic-admin',
      action: 'SAVE_DRAFT',
      revision: 1,
      content: ABOUT_DEFAULT,
    });
  });
  it('Admin controller retains existing guarded ADMIN contract', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AboutAdminController)).toEqual([
      'admin',
    ]);
    expect(
      Reflect.getMetadata('__guards__', AboutAdminController),
    ).toHaveLength(2);
  });
  it('forged Admin request cannot read drafts or save', () => {
    const service: any = { admin: jest.fn(), save: jest.fn() };
    const controller = new AboutAdminController(service);
    expect(() => controller.get({ user: { sub: 'fake' } } as any)).toThrow();
    expect(() =>
      controller.save({ user: { sub: 'fake' } } as any, {
        expectedRevision: 0,
        content: ABOUT_DEFAULT,
        publish: false,
      }),
    ).toThrow();
    expect(service.admin).not.toHaveBeenCalled();
    expect(service.save).not.toHaveBeenCalled();
  });
  it('public controller calls published projection only', async () => {
    const service: any = {
      published: jest.fn(async () => ({ success: true })),
    };
    expect(await new AboutPublicController(service).get()).toEqual({
      success: true,
    });
  });
});
