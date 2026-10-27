jest.mock('../../infrastructure/supabase/supabase.service', () => ({
  SupabaseService: class {},
}));
import {
  DEFAULT_SUPPORT_CATALOGUE,
  SupportCatalogueService,
  validateSupportCatalogue,
} from './support-catalogue.service';
import { SupportAssistantService } from './support-assistant.service';
import { SupportAdminService } from './support-admin.service';
import {
  hasSupportCredential,
  redactSupportCredentials,
} from './support-input-policy';
const auth = { sub: 'synthetic-sub' };
function fixture(admin = false) {
  const events: any[] = [];
  const db: any = {
    user: {
      findMany: jest.fn(async () => [
        {
          id: 'owner',
          isActive: true,
          isBlocked: false,
          role: { name: admin ? 'ADMIN' : 'CUSTOMER' },
        },
      ]),
    },
    assistantConversation: {
      findUnique: jest.fn(async () => ({
        id: 'conversation',
        customerId: 'owner',
        status: 'ACTIVE',
      })),
      update: jest.fn(async () => ({ id: 'conversation' })),
    },
    assistantMessage: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => ({ id: 'message', ...data })),
    },
    paymentOrder: { findFirst: jest.fn(async () => ({ status: 'SUCCESS' })) },
    callSession: { findFirst: jest.fn(async () => ({ status: 'COMPLETED' })) },
    subscription: { findMany: jest.fn(async () => []) },
    $queryRaw: jest.fn(async (strings: any) =>
      String(strings).includes('pg_advisory')
        ? []
        : events.length
          ? [{ details: events.at(-1) }]
          : [],
    ),
    $executeRaw: jest.fn(async (_strings: any, ...values: any[]) => {
      const event = values.find(
        (v) => typeof v === 'string' && v.startsWith('{"revision"'),
      );
      if (event) events.push(JSON.parse(event));
      return 1;
    }),
  };
  db.$transaction = jest.fn(async (fn: any) => {
    const size = events.length;
    try {
      return await fn(db);
    } catch (e) {
      events.splice(size);
      throw e;
    }
  });
  const provider = {
    generate: jest.fn(async (_input: any) => ({
      answer: 'Synthetic response',
      provider: 'mock',
      model: 'mock',
    })),
  };
  const catalogue = {
    question: jest.fn(async () => 'Configured question'),
    reference: jest.fn(async () => []),
  };
  const redis = {
    setNX: jest.fn(async () => true),
    increment: jest.fn(async () => 1),
    expire: jest.fn(async () => {}),
    ttl: jest.fn(async () => 89),
    releaseLock: jest.fn(async () => true),
  };
  return {
    db,
    events,
    provider,
    catalogue,
    redis,
    service: new SupportAssistantService(
      db,
      provider as never,
      catalogue as never,
      redis as never,
    ),
  };
}
describe('Premium support safety', () => {
  it('rejects new credential disclosure and redacts legacy provider history', () => {
    const synthetic = 'Bearer ' + 'x'.repeat(30);
    expect(hasSupportCredential(synthetic)).toBe(true);
    expect(redactSupportCredentials(synthetic)).toBe('[redacted credential]');
    const config = structuredClone(DEFAULT_SUPPORT_CATALOGUE);
    config.knowledge = [synthetic];
    expect(() => validateSupportCatalogue(config)).toThrow();
  });
  it('blank or credential message never reaches AI or inserts', async () => {
    const f = fixture();
    for (const content of ['   ', 'sk-' + 'x'.repeat(30)]) {
      await expect(
        f.service.sendCustomerMessage(auth, 'conversation', { content }),
      ).rejects.toThrow();
    }
    expect(f.provider.generate).not.toHaveBeenCalled();
    expect(f.db.assistantMessage.create).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'conversation review is Admin-only: %s',
    async (admin) => {
      const f = fixture(admin);
      f.db.assistantConversation.findMany = jest.fn(async () => []);
      const service = new SupportAdminService(f.db, {} as never, {} as never);
      if (admin) {
        expect(
          (await service.assistantConversations(auth, 1)).conversations,
        ).toEqual([]);
      } else {
        await expect(service.assistantConversations(auth, 1)).rejects.toThrow(
          'not authorized',
        );
        expect(f.db.assistantConversation.findMany).not.toHaveBeenCalled();
      }
    },
  );
  it.each([false, true])(
    'start/resume active conversation uses lock before write: existing=%s',
    async (exists) => {
      const f = fixture();
      f.db.assistantConversation.findFirst = jest.fn(async () =>
        exists ? { id: 'existing' } : null,
      );
      f.db.assistantConversation.create = jest.fn(async () => ({ id: 'new' }));
      const result = await f.service.startOrGetConversation(auth);
      expect(result.created).toBe(!exists);
      expect(f.db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        f.db.assistantConversation.findFirst.mock.invocationCallOrder[0],
      );
      expect(f.db.assistantConversation.create).toHaveBeenCalledTimes(
        exists ? 0 : 1,
      );
    },
  );
  const oldSchema = process.env.SUPPORT_OPERATIONS_SCHEMA_READY,
    oldEnabled = process.env.SUPPORT_OPERATIONS_ENABLED;
  beforeEach(() => {
    process.env.SUPPORT_OPERATIONS_SCHEMA_READY = 'true';
    process.env.SUPPORT_OPERATIONS_ENABLED = 'true';
  });
  afterAll(() => {
    if (oldSchema === undefined)
      delete process.env.SUPPORT_OPERATIONS_SCHEMA_READY;
    else process.env.SUPPORT_OPERATIONS_SCHEMA_READY = oldSchema;
    if (oldEnabled === undefined) delete process.env.SUPPORT_OPERATIONS_ENABLED;
    else process.env.SUPPORT_OPERATIONS_ENABLED = oldEnabled;
  });
  it('validates three backend categories with 17 unique questions', () => {
    const c = validateSupportCatalogue(DEFAULT_SUPPORT_CATALOGUE);
    expect(c.categories).toHaveLength(3);
    expect(
      new Set(c.categories.flatMap((x) => x.questions.map((q) => q.id))).size,
    ).toBe(17);
  });
  it.each(['duplicate', 'category', 'oversize', 'type'])(
    'rejects invalid catalogue: %s',
    (kind) => {
      const c = structuredClone(DEFAULT_SUPPORT_CATALOGUE);
      if (kind === 'duplicate')
        c.categories[1].questions[0].id = c.categories[0].questions[0].id;
      if (kind === 'category') c.categories[0].id = 'admin';
      if (kind === 'oversize') c.welcome = 'x'.repeat(501);
      if (kind === 'type') (c as any).visible = 'true';
      expect(() => validateSupportCatalogue(c)).toThrow();
    },
  );
  it('saves one audited revision and filters disabled questions for customers', async () => {
    const f = fixture(true),
      s = new SupportCatalogueService(f.db),
      c = structuredClone(DEFAULT_SUPPORT_CATALOGUE);
    c.categories[0].questions[0].enabled = false;
    expect(
      (await s.save(auth, { expectedRevision: 0, config: c })).revision,
    ).toBe(1);
    expect(f.events).toHaveLength(1);
    f.db.user.findMany.mockResolvedValue([
      { id: 'owner', isActive: true, role: { name: 'CUSTOMER' } },
    ]);
    const view = await s.customer(auth);
    expect(view.categories[0].questions).toHaveLength(4);
    expect(view).not.toHaveProperty('knowledge');
    await expect(s.question('consultation', 'payment-2')).rejects.toThrow(
      'unavailable',
    );
    await expect(s.question('payment', 'payment-1')).rejects.toThrow(
      'unavailable',
    );
  });
  it('stale revision cannot overwrite; customer cannot save', async () => {
    const f = fixture(true),
      s = new SupportCatalogueService(f.db);
    await s.save(auth, {
      expectedRevision: 0,
      config: DEFAULT_SUPPORT_CATALOGUE,
    });
    await expect(
      s.save(auth, { expectedRevision: 0, config: DEFAULT_SUPPORT_CATALOGUE }),
    ).rejects.toThrow('changed');
    expect(f.events).toHaveLength(1);
    const customer = fixture();
    await expect(
      new SupportCatalogueService(customer.db).save(auth, {
        expectedRevision: 0,
        config: DEFAULT_SUPPORT_CATALOGUE,
      }),
    ).rejects.toThrow('not authorized');
    expect(customer.events).toHaveLength(0);
  });
  it('disabled operations serves defaults read-only without optional table query', async () => {
    process.env.SUPPORT_OPERATIONS_ENABLED = 'false';
    const f = fixture(true),
      s = new SupportCatalogueService(f.db);
    expect((await s.admin(auth)).editable).toBe(false);
    expect(f.db.$queryRaw).not.toHaveBeenCalled();
    await expect(
      s.save(auth, { expectedRevision: 0, config: DEFAULT_SUPPORT_CATALOGUE }),
    ).rejects.toThrow('approval');
  });
  it('audit failure prevents publishing configuration', async () => {
    const f = fixture(true);
    f.db.$executeRaw.mockRejectedValue(new Error('Synthetic audit failure'));
    await expect(
      new SupportCatalogueService(f.db).save(auth, {
        expectedRevision: 0,
        config: DEFAULT_SUPPORT_CATALOGUE,
      }),
    ).rejects.toThrow('audit');
    expect(f.events).toHaveLength(0);
  });
  it('only owned recorded statuses reach provider; refund stays unverified', async () => {
    const f = fixture();
    await f.service.sendCustomerMessage(auth, 'conversation', {
      content: 'Synthetic',
      paymentOrderId: 'payment',
      consultationId: 'call',
    });
    expect(f.db.paymentOrder.findFirst).toHaveBeenCalledWith({
      where: { id: 'payment', userId: 'owner' },
      select: { status: true },
    });
    expect(f.db.callSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'call', userId: 'owner' },
      select: { status: true },
    });
    expect(f.provider.generate.mock.calls[0][0].verifiedContext).toEqual({
      paymentStatus: 'SUCCESS',
      consultationStatus: 'COMPLETED',
      refundStatus: 'NOT_VERIFIED',
      accountStatus: 'ACTIVE',
      subscriptions: [],
    });
    expect(f.db.assistantMessage.create).toHaveBeenCalledTimes(2);
    expect(f.redis.releaseLock).toHaveBeenCalledTimes(1);
  });
  it.each(['payment', 'consultation', 'conversation'])(
    'foreign %s blocks provider and inserts',
    async (kind) => {
      const f = fixture(),
        dto: any = { content: 'Synthetic' };
      if (kind === 'payment') {
        dto.paymentOrderId = 'foreign';
        f.db.paymentOrder.findFirst.mockResolvedValue(null);
      }
      if (kind === 'consultation') {
        dto.consultationId = 'foreign';
        f.db.callSession.findFirst.mockResolvedValue(null);
      }
      if (kind === 'conversation')
        f.db.assistantConversation.findUnique.mockResolvedValue({
          customerId: 'foreign',
          status: 'ACTIVE',
        });
      await expect(
        f.service.sendCustomerMessage(auth, 'conversation', dto),
      ).rejects.toThrow();
      expect(f.provider.generate).not.toHaveBeenCalled();
      expect(f.db.assistantMessage.create).not.toHaveBeenCalled();
    },
  );
  it('disabled question or edited selected question rejected before provider', async () => {
    const f = fixture();
    f.catalogue.question.mockRejectedValue(new Error('Unavailable question'));
    await expect(
      f.service.sendCustomerMessage(auth, 'conversation', {
        content: 'Synthetic',
        categoryId: 'account',
        questionId: 'disabled',
      }),
    ).rejects.toThrow('Unavailable');
    f.catalogue.question.mockResolvedValue('Configured question');
    await expect(
      f.service.sendCustomerMessage(auth, 'conversation', {
        content: 'Spoofed text',
        categoryId: 'account',
        questionId: 'account-1',
      }),
    ).rejects.toThrow('changed');
    expect(f.provider.generate).not.toHaveBeenCalled();
  });
  it.each(['concurrent', 'rate', 'unavailable'])(
    'cost control fails closed: %s',
    async (kind) => {
      const f = fixture();
      if (kind === 'concurrent') f.redis.setNX.mockResolvedValue(false);
      if (kind === 'rate') f.redis.increment.mockResolvedValue(11);
      if (kind === 'unavailable') f.redis.increment.mockResolvedValue(0);
      await expect(
        f.service.sendCustomerMessage(auth, 'conversation', {
          content: 'Synthetic',
        }),
      ).rejects.toThrow();
      expect(f.provider.generate).not.toHaveBeenCalled();
    },
  );
  it('duplicate returns persisted message without new provider call', async () => {
    const f = fixture();
    f.db.assistantMessage.findFirst.mockResolvedValue({
      conversationId: 'conversation',
      content: 'Same',
      id: 'stored',
    });
    expect(
      (
        await f.service.sendCustomerMessage(auth, 'conversation', {
          content: 'Same',
          clientMessageId: 'same',
        })
      ).duplicate,
    ).toBe(true);
    expect(f.provider.generate).not.toHaveBeenCalled();
  });
  it('idempotency reference cannot cross conversation boundaries', async () => {
    const f = fixture();
    f.db.assistantMessage.findFirst.mockResolvedValue({
      conversationId: 'other',
      content: 'Same',
    });
    await expect(
      f.service.sendCustomerMessage(auth, 'conversation', {
        content: 'Same',
        clientMessageId: 'same',
      }),
    ).rejects.toThrow('different request');
    expect(f.provider.generate).not.toHaveBeenCalled();
  });
  it('provider error never stores fake reply and always releases lock', async () => {
    const f = fixture();
    f.provider.generate.mockRejectedValue(
      new Error('Synthetic provider failure'),
    );
    await expect(
      f.service.sendCustomerMessage(auth, 'conversation', {
        content: 'Synthetic',
      }),
    ).rejects.toThrow('provider');
    expect(f.db.assistantMessage.create).not.toHaveBeenCalled();
    expect(f.redis.releaseLock).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'escalation copies only explicitly consented bounded context: %s',
    async (includeConversation) => {
      const f = fixture();
      const original = 'Synthetic transcript ' + 'x'.repeat(5000);
      f.db.assistantConversation.findUnique.mockResolvedValue({
        id: 'conversation',
        customerId: 'owner',
        messages: [{ senderType: 'CUSTOMER', content: original }],
      });
      f.db.assistantConversation.findFirst = jest.fn(async () => ({
        id: 'conversation',
        customerId: 'owner',
        supportTicket: null,
      }));
      f.db.supportTicket = {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: 'ticket', ...data })),
      };
      const result = await f.service.escalateToHumanSupport(
        auth,
        'conversation',
        { includeConversation },
      );
      expect(result.ticket.id).toBe('ticket');
      const data = f.db.supportTicket.create.mock.calls[0][0].data;
      expect(data.customerId).toBe('owner');
      expect(data.category).toBe('ASSISTANT_ESCALATION');
      expect(data.description.includes('Synthetic transcript')).toBe(
        includeConversation,
      );
      expect(data.description.length).toBeLessThan(4000);
      expect(original.length).toBeGreaterThan(5000);
    },
  );
  it('concurrent committed escalation returns existing ticket without duplicate insert', async () => {
    const f = fixture();
    f.db.assistantConversation.findUnique.mockResolvedValue({
      id: 'conversation',
      customerId: 'owner',
      messages: [],
    });
    f.db.assistantConversation.findFirst = jest.fn(async () => ({
      id: 'conversation',
      supportTicket: { id: 'existing-ticket' },
    }));
    f.db.supportTicket = {
      findUnique: jest.fn(async () => null),
      create: jest.fn(),
    };
    const result = await f.service.escalateToHumanSupport(
      auth,
      'conversation',
      {},
    );
    expect(result.ticket.id).toBe('existing-ticket');
    expect(result.alreadyEscalated).toBe(true);
    expect(f.db.supportTicket.create).not.toHaveBeenCalled();
  });
});
