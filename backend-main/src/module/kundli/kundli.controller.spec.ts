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
import { StreamableFile, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsPushService } from '../notifications/notifications.push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KundliController } from './kundli.controller';
import { KundliPdfService } from './kundli-pdf.service';
import { KundliSavedRecordService } from './kundli-saved-record.service';
import { KundliService } from './kundli.service';

describe('KundliController', () => {
  let controller: KundliController;

  const kundliServiceMock = {
    generateReport: jest.fn(),
  };

  const savedRecordServiceMock = {
    saveGeneratedRecord: jest.fn(),
    findForAstrologer: jest.fn(),
    findOneForAstrologer: jest.fn(),
  };

  const pdfServiceMock = {
    generateSavedKundliPdf: jest.fn(),
  };
  const notificationsServiceMock = {
    createForUser: jest.fn(),
  };

  const notificationsPushServiceMock = {
    sendToUser: jest.fn(),
  };

  const access = {
    userId: 'user-1',
    astrologerId: 'astrologer-1',
    subscriptionId: 'subscription-1',
    planName: 'KUNDLI',
  };

  const request = {
    kundliAccess: access,
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    notificationsServiceMock.createForUser.mockResolvedValue({
      id: 'notification-1',
    });

    notificationsPushServiceMock.sendToUser.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KundliController],
      providers: [
        {
          provide: KundliService,
          useValue: kundliServiceMock,
        },
        {
          provide: KundliSavedRecordService,
          useValue: savedRecordServiceMock,
        },
        {
          provide: KundliPdfService,
          useValue: pdfServiceMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
        {
          provide: NotificationsPushService,
          useValue: notificationsPushServiceMock,
        },
      ],
    }).compile();

    controller = module.get<KundliController>(KundliController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('retires legacy astrologer provider generation without calling provider', async () => {
    await expect(controller.generate()).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ASTROLOGER_PROVIDER_KUNDLI_RETIRED',
        replacement: '/kundli/manual-reports',
      }),
    });

    expect(kundliServiceMock.generateReport).not.toHaveBeenCalled();

    expect(savedRecordServiceMock.saveGeneratedRecord).not.toHaveBeenCalled();
  });

  it('retires legacy astrologer provider regeneration without calling provider', async () => {
    await expect(controller.regenerateSavedKundli()).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ASTROLOGER_PROVIDER_REGENERATION_RETIRED',
        replacement: '/kundli/manual-reports',
      }),
    });

    expect(kundliServiceMock.generateReport).not.toHaveBeenCalled();
  });
  it('returns only saved Kundlis for current astrologer', async () => {
    savedRecordServiceMock.findForAstrologer.mockResolvedValue([
      { id: 'saved-1' },
    ]);

    const result = await controller.getSavedKundlis(request);

    expect(savedRecordServiceMock.findForAstrologer).toHaveBeenCalledWith(
      'astrologer-1',
    );

    expect(result).toEqual({
      success: true,
      data: [{ id: 'saved-1' }],
    });
  });

  it('gets saved Kundli scoped to current astrologer', async () => {
    savedRecordServiceMock.findOneForAstrologer.mockResolvedValue({
      id: 'saved-1',
    });

    const result = await controller.getSavedKundli(request, 'saved-1');

    expect(savedRecordServiceMock.findOneForAstrologer).toHaveBeenCalledWith(
      'saved-1',
      'astrologer-1',
    );

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('saved-1');
  });

  it('downloads PDF with production-safe headers', async () => {
    const record = {
      id: 'saved-1',
      kundliId: 'kundli-1',
      name: 'Test User',
      gender: 'MALE',
      birthPlace: 'Patna',
      lang: 'en',
      report: {
        provider: 'vedicastro',
      },
      kundli: {
        dob: '1995-01-10',
        tob: '10:30',
        latitude: 25.5941,
        longitude: 85.1376,
        timezone: 5.5,
      },
    };

    savedRecordServiceMock.findOneForAstrologer.mockResolvedValue(record);

    const pdfBuffer = Buffer.from('%PDF-test');

    pdfServiceMock.generateSavedKundliPdf.mockResolvedValue(pdfBuffer);

    const set = jest.fn();

    const response = {
      set,
    } as any;

    const result = await controller.downloadSavedKundliPdf(
      request,
      'saved-1',
      response,
    );

    expect(savedRecordServiceMock.findOneForAstrologer).toHaveBeenCalledWith(
      'saved-1',
      'astrologer-1',
    );

    expect(pdfServiceMock.generateSavedKundliPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        savedRecordId: 'saved-1',
        kundliId: 'kundli-1',
        name: 'Test User',
        birthPlace: 'Patna',
      }),
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="kundli-saved-1.pdf"',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      }),
    );

    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('rejects request when Kundli access context is missing', async () => {
    await expect(controller.getSavedKundlis({} as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(savedRecordServiceMock.findForAstrologer).not.toHaveBeenCalled();
  });
});
