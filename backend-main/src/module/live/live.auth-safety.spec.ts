import { hasLiveV2Schema } from './live-schema-compatibility';
jest.mock('./live-schema-compatibility', () => ({
  ...jest.requireActual('./live-schema-compatibility'),
  hasLiveV2Schema: jest.fn().mockResolvedValue(true),
}));
import { LiveService } from './live.service';

describe('Live authorization and RTC contracts', () => {
  const user = {
    id: 'canonical',
    isActive: true,
    isBlocked: false,
    isAstrologer: true,
    astrologer: {
      id: 'astro',
      userId: 'canonical',
      isApproved: true,
      isVerified: true,
    },
  };
  const session = {
    id: 'live',
    connectionProtocol: 1,
    astrologerId: 'astro',
    channelName: 'exact-channel',
    status: 'LIVE',
    astrologer: { ...user.astrologer, user: { name: 'Host' } },
  };
  let db: any;
  let agora: any;
  let service: LiveService;
  beforeEach(() => {
    (hasLiveV2Schema as jest.Mock).mockResolvedValue(true);
    db = {
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'canonical' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      liveSession: {
        findFirst: jest.fn().mockResolvedValue(session),
        findUnique: jest.fn().mockResolvedValue(session),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(session),
      },
      liveViewer: {
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'viewer' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'astro' }]),
      $transaction: jest.fn((operations) =>
        typeof operations === 'function'
          ? operations(db)
          : Promise.all(operations),
      ),
    };
    agora = {
      generateRtcToken: jest
        .fn()
        .mockImplementation((channelName, uid, role) => ({
          channelName,
          uid,
          role,
        })),
    };
    service = new LiveService(db, agora);
  });
  it('approved canonical host reuses existing live session and publisher channel', async () => {
    const result = await service.startLive('authenticated-subject');
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'canonical' } }),
    );
    expect(db.liveSession.create).not.toHaveBeenCalled();
    expect(result.data.rtc).toEqual(
      expect.objectContaining({
        channelName: 'exact-channel',
        role: 'PUBLISHER',
      }),
    );
  });
  it('pending astrologer cannot start or obtain publisher token', async () => {
    db.user.findUnique.mockResolvedValue({
      ...user,
      astrologer: { ...user.astrologer, isApproved: false },
    });
    await expect(service.startLive('subject')).rejects.toThrow('Only approved');
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('approval revoked before acquiring the row lock fails closed', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(service.startLive('subject')).rejects.toThrow('Only approved');
    expect(db.liveSession.findFirst).not.toHaveBeenCalled();
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('simultaneous starts serialize the lookup and create only one session', async () => {
    let saved: any = null;
    let lock = Promise.resolve();
    db.liveSession.findFirst.mockImplementation(async () => saved);
    db.liveSession.create.mockImplementation(async () => {
      await Promise.resolve();
      saved = session;
      return saved;
    });
    // Simulate the PostgreSQL transaction-scoped row lock, not a live database.
    db.$transaction.mockImplementation(async (operation) => {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(db);
      } finally {
        release();
      }
    });
    const results = await Promise.all([
      service.startLive('subject'),
      service.startLive('subject'),
    ]);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    const query = db.$queryRaw.mock.calls[0][0].join('?');
    expect(query).toContain('FOR UPDATE');
    expect(db.$queryRaw.mock.calls[0][1]).toBe('astro');
    expect(db.liveSession.create).toHaveBeenCalledTimes(1);
    expect(results[0].data.session.id).toBe(results[1].data.session.id);
  });
  it('customer receives only subscriber credentials for selected session', async () => {
    db.user.findUnique.mockResolvedValue({
      ...user,
      isAstrologer: false,
      astrologer: null,
    });
    const result = await service.joinLive('subject', 'live');
    expect(result.data.session.id).toBe('live');
    expect(result.data.rtc).toEqual(
      expect.objectContaining({
        channelName: 'exact-channel',
        role: 'SUBSCRIBER',
      }),
    );
  });
  it('foreign host cannot end another live session', async () => {
    db.liveSession.findUnique.mockResolvedValue({
      ...session,
      astrologerId: 'foreign',
    });
    await expect(service.endLive('subject', 'live')).rejects.toThrow(
      'cannot end',
    );
    expect(db.liveSession.update).not.toHaveBeenCalled();
  });
  it('ended session cannot issue subscriber token', async () => {
    db.liveSession.findFirst.mockResolvedValue(null);
    await expect(service.joinLive('subject', 'live')).rejects.toThrow(
      'no longer available',
    );
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('viewer leave does not end the host session', async () => {
    await service.leaveLive('subject', 'live');
    expect(db.liveViewer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { liveSessionId: 'live', userId: 'canonical', leftAt: null },
      }),
    );
    expect(db.liveSession.update).not.toHaveBeenCalled();
  });
  it.each(['start', 'join', 'leave', 'end', 'chat'])(
    'legacy %s rejects protocol-2 sessions',
    async (operation) => {
      const v2 = { ...session, connectionProtocol: 2 };
      db.liveSession.findFirst.mockResolvedValue(v2);
      db.liveSession.findUnique.mockResolvedValue(v2);
      const request =
        operation === 'start'
          ? service.startLive('subject')
          : operation === 'join'
            ? service.joinLive('subject', 'live')
            : operation === 'leave'
              ? service.leaveLive('subject', 'live')
              : operation === 'end'
                ? service.endLive('subject', 'live')
                : service.joinLiveChat('subject', 'live');
      await expect(request).rejects.toThrow('Use Live v2');
      expect(agora.generateRtcToken).not.toHaveBeenCalled();
      expect(db.liveViewer.updateMany).not.toHaveBeenCalled();
      expect(db.liveSession.update).not.toHaveBeenCalled();
    },
  );
  it('migrated list retains protocol-1 filter and explicit protocol selection', async () => {
    db.liveSession.findMany = jest.fn().mockResolvedValue([]);
    await service.listLive();
    expect(db.liveSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ connectionProtocol: 1 }),
        select: expect.objectContaining({ connectionProtocol: true }),
      }),
    );
  });
  it('unavailable schema metadata fails closed without session writes', async () => {
    (hasLiveV2Schema as jest.Mock).mockRejectedValue(
      new Error('capabilities unavailable'),
    );
    await expect(service.startLive('subject')).rejects.toThrow(
      'capabilities unavailable',
    );
    expect(db.liveSession.create).not.toHaveBeenCalled();
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  describe('pre-v2 schema P2022 regression', () => {
    beforeEach(() => {
      (hasLiveV2Schema as jest.Mock).mockResolvedValue(false);
      db.liveSession.findMany = jest.fn();
      for (const method of ['findFirst', 'findUnique', 'findMany', 'update']) {
        db.liveSession[method].mockImplementation(async (args: any) => {
          if (
            !args.select ||
            args.select.connectionProtocol ||
            args.select.hostConnectionId ||
            args.where.connectionProtocol
          ) {
            throw Object.assign(new Error('missing v2 column'), {
              code: 'P2022',
            });
          }
          const { connectionProtocol, ...old } = session;
          return method === 'findMany'
            ? [{ ...old, _count: { viewers: 1 } }]
            : old;
        });
      }
    });
    it.each(['list', 'start', 'join', 'leave', 'end', 'chat'])(
      '%s avoids missing columns',
      async (action) => {
        const result =
          action === 'list'
            ? await service.listLive()
            : action === 'start'
              ? await service.startLive('subject')
              : action === 'join'
                ? await service.joinLive('subject', 'live')
                : action === 'leave'
                  ? await service.leaveLive('subject', 'live')
                  : action === 'end'
                    ? await service.endLive('subject', 'live')
                    : await service.joinLiveChat('subject', 'live');
        expect(result).toBeTruthy();
      },
    );
    it('still rejects a foreign host ending a legacy session', async () => {
      db.liveSession.findUnique.mockResolvedValue({
        ...session,
        astrologerId: 'foreign',
      });
      await expect(service.endLive('subject', 'live')).rejects.toThrow(
        'cannot end',
      );
      expect(db.liveSession.update).not.toHaveBeenCalled();
    });
    it('still denies publisher tokens to pending applicants', async () => {
      db.user.findUnique.mockResolvedValue({
        ...user,
        astrologer: { ...user.astrologer, isApproved: false },
      });
      await expect(service.startLive('subject')).rejects.toThrow(
        'Only approved',
      );
      expect(agora.generateRtcToken).not.toHaveBeenCalled();
    });
    it('inserts original columns with bound values after host lock', async () => {
      db.liveSession.findFirst.mockResolvedValue(null);
      db.$executeRaw = jest.fn().mockResolvedValue(1);
      await service.startLive('subject', "quoted ' title");
      expect(db.liveSession.create).not.toHaveBeenCalled();
      const [parts, ...values] = db.$executeRaw.mock.calls[0];
      expect(parts.join('?')).not.toMatch(
        /connectionProtocol|hostConnectionId/,
      );
      expect(parts.join('?')).not.toContain("quoted ' title");
      expect(values).toContain("quoted ' title");
      expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        db.$executeRaw.mock.invocationCallOrder[0],
      );
    });
    it('does not retry failed writes or issue tokens', async () => {
      db.liveSession.findFirst.mockResolvedValue(null);
      const error = Object.assign(new Error('schema changed'), {
        code: 'P2022',
      });
      db.$executeRaw = jest.fn().mockRejectedValue(error);
      await expect(service.startLive('subject')).rejects.toBe(error);
      expect(db.$executeRaw).toHaveBeenCalledTimes(1);
      expect(agora.generateRtcToken).not.toHaveBeenCalled();
    });
  });
});
