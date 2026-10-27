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
import { createHmac } from 'crypto';

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

  it('keeps checkout proof behind the existing authenticated guard', () => {
    expect(Reflect.getMetadata('__guards__', PaymentsController.prototype.verifyCheckout)).toContain(SupabaseAuthGuard);
  });

  it('rejects missing and forged webhook signatures before processing', async () => {
    const processVerifiedWebhook = jest.fn();
    const signed = new PaymentsController({ processVerifiedWebhook } as any, new RazorpayVerificationService());
    await expect(signed.webhook({ headers: {}, rawBody: Buffer.from('{}') } as any)).rejects.toThrow('Missing webhook signature');
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-secret';
    try {
      await expect(signed.webhook({ headers: { 'x-razorpay-signature': '0'.repeat(64) }, rawBody: Buffer.from('{}') } as any)).rejects.toThrow('Invalid webhook signature');
      expect(processVerifiedWebhook).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });

  it('passes verified original bytes to isolated duplicate-aware processing on replay', async () => {
    const body = Buffer.from('{"event":"payment.captured","payload":{}}');
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-secret';
    const processor = jest.fn().mockResolvedValueOnce({ status: 'success' }).mockResolvedValueOnce({ status: 'duplicate' });
    const signed = new PaymentsController({ processVerifiedWebhook: processor } as any, new RazorpayVerificationService());
    try {
      const signature = createHmac('sha256', 'synthetic-secret').update(body).digest('hex');
      const request = { headers: { 'x-razorpay-signature': signature }, rawBody: body, body: { event: 'payment.failed' } } as any;
      expect((await signed.webhook(request)).status).toBe('success');
      expect((await signed.webhook(request)).status).toBe('duplicate');
      expect(processor).toHaveBeenNthCalledWith(2, { event: 'payment.captured', payload: {} });
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });

  it.each(['pending', 'ignored'])('does not report unsettled status %s as success', async status => {
    const service = (controller as any).paymentsService;
    service.reconcileOrder.mockResolvedValue({status, reason: 'gateway_payment_pending'});
    expect(await controller.reconcileOrder({sub: 'synthetic-subject'}, 'synthetic-order')).toEqual({
      success: true, status: 'PENDING', reason: 'gateway_payment_pending',
    });
  });

  it('does not log raw errors or process a failed webhook boundary', async () => {
    const verifier = (controller as any).razorpayVerificationService;
    verifier.extractWebhookRawBody.mockImplementation(() => {throw new Error('synthetic-private-sentinel');});
    const log = jest.spyOn((controller as any).logger, 'error').mockImplementation(() => {});
    await expect(controller.webhook({headers: {'x-razorpay-signature': 'synthetic'}} as any)).rejects.toThrow('Failed to process webhook');
    expect(log).toHaveBeenCalledWith('webhook.unhandled_error');
    expect((controller as any).paymentsService.processVerifiedWebhook).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
