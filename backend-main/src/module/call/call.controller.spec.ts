jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';

import { CallController } from './call.controller';
import { CallService } from './call.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('CallController', () => {
  let controller: CallController;

  const callServiceMock = {
    startCall: jest.fn(),
    generateAgoraToken: jest.fn(),
    extendCall: jest.fn(),
    endCall: jest.fn(),
    getCurrentCall: jest.fn(),
    getCallHistory: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CallService,
          useValue: callServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CallController>(CallController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('extendCall', () => {
    it('delegates a 5 minute extension to CallService', async () => {
      const user = {
        sub: 'supabase-customer-1',
      };

      const response = {
        success: true,
        message: 'Consultation extended by 5 minutes',
        data: {
          extension: {
            minutes: 5,
            amount: 50,
          },
        },
      };

      callServiceMock.extendCall.mockResolvedValue(response);

      const result = await controller.extendCall(user, 'call-1', {
        minutes: 5,
      });

      expect(callServiceMock.extendCall).toHaveBeenCalledTimes(1);

      expect(callServiceMock.extendCall).toHaveBeenCalledWith(
        'supabase-customer-1',
        'call-1',
        {
          minutes: 5,
        },
      );

      expect(result).toEqual(response);
    });

    it('delegates a 10 minute extension to CallService', async () => {
      const user = {
        sub: 'supabase-customer-1',
      };

      callServiceMock.extendCall.mockResolvedValue({
        success: true,
      });

      await controller.extendCall(user, 'call-1', {
        minutes: 10,
      });

      expect(callServiceMock.extendCall).toHaveBeenCalledWith(
        'supabase-customer-1',
        'call-1',
        {
          minutes: 10,
        },
      );
    });
  });
});
