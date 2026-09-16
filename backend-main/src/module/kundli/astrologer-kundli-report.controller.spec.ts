jest.mock('./guards/kundli-subscription.guard', () => ({
  KundliSubscriptionGuard: class KundliSubscriptionGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AstrologerKundliReportController } from './astrologer-kundli-report.controller';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';

describe('AstrologerKundliReportController', () => {
  let controller: AstrologerKundliReportController;

  const serviceMock = {
    createOrGetDraft: jest.fn(),
    updateDraft: jest.fn(),
    finalize: jest.fn(),
    listForAstrologer: jest.fn(),
    resolveAuthenticatedUserId: jest.fn(),
    listFinalForCustomer: jest.fn(),
  };

  const request = {
    kundliAccess: {
      userId: 'astrologer-user-1',
      astrologerId: 'astrologer-row-1',
      subscriptionId: 'subscription-1',
      planName: 'ASTROLOGER_KUNDLI_YEARLY',
    },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AstrologerKundliReportController],
      providers: [
        {
          provide: AstrologerKundliReportService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(AstrologerKundliReportController);
  });

  it('uses internal User.id for consultation ownership', async () => {
    serviceMock.createOrGetDraft.mockResolvedValue({
      id: 'report-1',
    });

    await controller.createOrGetDraft(request, 'call-1');

    expect(serviceMock.createOrGetDraft).toHaveBeenCalledWith(
      'call-1',
      'astrologer-user-1',
    );
  });

  it('uses internal User.id when editing a report', async () => {
    serviceMock.updateDraft.mockResolvedValue({
      id: 'report-1',
      title: 'Updated',
    });

    await controller.updateDraft(request, 'report-1', {
      title: 'Updated',
    });

    expect(serviceMock.updateDraft).toHaveBeenCalledWith(
      'report-1',
      'astrologer-user-1',
      {
        title: 'Updated',
      },
    );
  });

  it('uses internal User.id when finalizing', async () => {
    serviceMock.finalize.mockResolvedValue({
      id: 'report-1',
      status: 'FINAL',
    });

    await controller.finalize(request, 'report-1');

    expect(serviceMock.finalize).toHaveBeenCalledWith(
      'report-1',
      'astrologer-user-1',
    );
  });

  it('lists only authenticated astrologer reports', async () => {
    serviceMock.listForAstrologer.mockResolvedValue([]);

    await controller.listForAstrologer(request);

    expect(serviceMock.listForAstrologer).toHaveBeenCalledWith(
      'astrologer-user-1',
    );
  });

  it('resolves customer Supabase identity before reading FINAL reports', async () => {
    serviceMock.resolveAuthenticatedUserId.mockResolvedValue('customer-user-1');

    serviceMock.listFinalForCustomer.mockResolvedValue([
      {
        id: 'final-report-1',
        status: 'FINAL',
      },
    ]);

    const result = await controller.listFinalForCustomer({
      sub: 'supabase-customer-1',
    } as any);

    expect(serviceMock.resolveAuthenticatedUserId).toHaveBeenCalledWith(
      'supabase-customer-1',
    );

    expect(serviceMock.listFinalForCustomer).toHaveBeenCalledWith(
      'customer-user-1',
    );

    expect(result.data).toEqual([
      {
        id: 'final-report-1',
        status: 'FINAL',
      },
    ]);
  });

  it('rejects astrologer route when subscription access context is missing', async () => {
    await expect(
      controller.createOrGetDraft({} as any, 'call-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(serviceMock.createOrGetDraft).not.toHaveBeenCalled();
  });
});
