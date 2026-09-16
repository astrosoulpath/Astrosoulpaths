jest.mock('../../../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DailyinsightController } from './dailyinsight.controller';
import { NakshatraDailyInsightService } from './dailyinsight.service';

describe('DailyinsightController', () => {
  let controller: DailyinsightController;

  const dailyInsightServiceMock = {
    getNakshatraDailyInsight: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyinsightController],
      providers: [
        {
          provide: NakshatraDailyInsightService,
          useValue: dailyInsightServiceMock,
        },
      ],
    }).compile();

    controller = module.get<DailyinsightController>(DailyinsightController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('defaults to today', async () => {
    dailyInsightServiceMock.getNakshatraDailyInsight.mockResolvedValue({
      success: true,
    });

    await controller.getDailyInsight({
      sub: 'supabase-customer-1',
    });

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-customer-1', 'today');
  });

  it('passes today to the service', async () => {
    await controller.getDailyInsight(
      {
        sub: 'supabase-customer-1',
      },
      'today',
    );

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-customer-1', 'today');
  });

  it('passes yesterday to the service', async () => {
    await controller.getDailyInsight(
      {
        sub: 'supabase-customer-1',
      },
      'yesterday',
    );

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-customer-1', 'yesterday');
  });

  it('passes tomorrow to the service', async () => {
    await controller.getDailyInsight(
      {
        sub: 'supabase-customer-1',
      },
      'tomorrow',
    );

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-customer-1', 'tomorrow');
  });

  it('normalizes day input', async () => {
    await controller.getDailyInsight(
      {
        sub: 'supabase-customer-1',
      },
      ' TOMORROW ',
    );

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).toHaveBeenCalledWith('supabase-customer-1', 'tomorrow');
  });

  it('rejects an invalid day', () => {
    expect(() =>
      controller.getDailyInsight(
        {
          sub: 'supabase-customer-1',
        },
        'next-week',
      ),
    ).toThrow(BadRequestException);

    expect(
      dailyInsightServiceMock.getNakshatraDailyInsight,
    ).not.toHaveBeenCalled();
  });
});
