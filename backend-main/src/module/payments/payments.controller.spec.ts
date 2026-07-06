import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class MockSupabaseAuthGuard {
    canActivate = jest.fn().mockReturnValue(true);
  },
}));

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayVerificationService } from './razorpay-verification.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createWalletRechargeOrder: jest.fn(),
            createKundliReportOrder: jest.fn(),
            reconcileOrder: jest.fn(),
            processVerifiedWebhook: jest.fn(),
          },
        },
        {
          provide: RazorpayVerificationService,
          useValue: {
            extractWebhookRawBody: jest.fn(),
            verifyWebhookSignature: jest.fn(),
            parseWebhookPayload: jest.fn(),
          },
        },
        {
          provide: SupabaseAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
