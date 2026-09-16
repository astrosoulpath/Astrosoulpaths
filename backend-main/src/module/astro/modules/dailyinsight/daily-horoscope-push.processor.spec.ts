import { DailyHoroscopePushProcessor } from './daily-horoscope-push.processor';

describe('DailyHoroscopePushProcessor', () => {
  const prismaMock = {
    subscription: {
      findMany: jest.fn(),
    },
  };

  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    setNX: jest.fn(),
  };

  const dailyInsightServiceMock = {
    getNakshatraDailyInsight: jest.fn(),
  };

  const pushServiceMock = {
    sendToUser: jest.fn(),
  };

  let processor: DailyHoroscopePushProcessor;

  beforeEach(() => {
    jest.clearAllMocks();

    processor = new DailyHoroscopePushProcessor(
      prismaMock as any,
      redisMock as any,
      dailyInsightServiceMock as any,
      pushServiceMock as any,
    );
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('does nothing when there are no eligible subscriptions', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);

    await processor.processDailyHoroscopePushes();

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).not.toHaveBeenCalled();
    expect(pushServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('skips users outside their local 8 AM hour', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          supabaseId: 'supabase-1',
          userProfile: {
            timezoneName: 'Pacific/Auckland',
            timezone: 12,
          },
        },
      },
    ]);

    await processor.processDailyHoroscopePushes();

    expect(pushServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('skips when horoscope push was already sent for the local date', async () => {
    const processorAny = processor as any;

    jest.spyOn(processorAny, 'resolveLocalTime').mockReturnValue({
      date: '2026-08-21',
      hour: 8,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          supabaseId: 'supabase-1',
          userProfile: {
            timezoneName: 'Asia/Kolkata',
            timezone: 5.5,
          },
        },
      },
    ]);

    redisMock.get.mockResolvedValue('1');

    await processor.processDailyHoroscopePushes();

    expect(redisMock.setNX).not.toHaveBeenCalled();
    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).not.toHaveBeenCalled();
    expect(pushServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('skips when another worker already holds the push lock', async () => {
    const processorAny = processor as any;

    jest.spyOn(processorAny, 'resolveLocalTime').mockReturnValue({
      date: '2026-08-21',
      hour: 8,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          supabaseId: 'supabase-1',
          userProfile: {
            timezoneName: 'Asia/Kolkata',
            timezone: 5.5,
          },
        },
      },
    ]);

    redisMock.get.mockResolvedValue(null);
    redisMock.setNX.mockResolvedValue(false);

    await processor.processDailyHoroscopePushes();

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).not.toHaveBeenCalled();
    expect(pushServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('sends the real personalized horoscope and marks it sent after success', async () => {
    const processorAny = processor as any;

    jest.spyOn(processorAny, 'resolveLocalTime').mockReturnValue({
      date: '2026-08-21',
      hour: 8,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          supabaseId: 'supabase-1',
          userProfile: {
            timezoneName: 'Asia/Kolkata',
            timezone: 5.5,
          },
        },
      },
    ]);

    redisMock.get.mockResolvedValue(null);
    redisMock.setNX.mockResolvedValue(true);

    dailyInsightServiceMock.getNakshatraDailyInsight.mockResolvedValue({
      success: true,
      data: {
        ai: {
          notificationTitle: 'Your Daily Horoscope',
          shortReading: 'A focused and balanced Vedic day is indicated.',
          dailyAdvice: 'Complete your highest-priority work first.',
        },
      },
    });

    pushServiceMock.sendToUser.mockResolvedValue({
      sent: 1,
      failed: 0,
    });

    await processor.processDailyHoroscopePushes();

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-1', 'today');

    expect(pushServiceMock.sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Your Daily Horoscope',
        body: 'A focused and balanced Vedic day is indicated.',
        data: {
          type: 'horoscope',
          day: 'today',
          targetDate: '2026-08-21',
        },
      }),
    );

    expect(redisMock.set).toHaveBeenCalledWith(
      'daily-horoscope:push:sent:user-1:2026-08-21',
      '1',
      48 * 60 * 60,
    );
  });

  it('does not mark a horoscope sent when push delivery fails', async () => {
    const processorAny = processor as any;

    jest.spyOn(processorAny, 'resolveLocalTime').mockReturnValue({
      date: '2026-08-21',
      hour: 8,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          supabaseId: 'supabase-1',
          userProfile: {
            timezoneName: 'Asia/Kolkata',
            timezone: 5.5,
          },
        },
      },
    ]);

    redisMock.get.mockResolvedValue(null);
    redisMock.setNX.mockResolvedValue(true);

    dailyInsightServiceMock.getNakshatraDailyInsight.mockResolvedValue({
      success: true,
      data: {
        ai: {
          shortReading: 'Your Vedic reading is ready.',
          dailyAdvice: 'Stay steady today.',
        },
      },
    });

    pushServiceMock.sendToUser.mockResolvedValue({
      sent: 0,
      failed: 1,
    });

    await processor.processDailyHoroscopePushes();

    expect(redisMock.set).not.toHaveBeenCalled();
  });
});

