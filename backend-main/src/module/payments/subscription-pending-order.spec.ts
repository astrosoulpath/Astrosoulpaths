import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
jest.mock('../../config/razorpay.config', () => ({
  getRazorpayInstance: jest.fn(() => ({ orders: { create: jest.fn() } })),
}));
import { getRazorpayInstance } from '../../config/razorpay.config';
import { PaymentsService } from './payments.service';

describe('pending subscription provider binding', () => {
  it('rejects replacement checkout without modifying records or calling Razorpay', async () => {
    const gate = process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
    process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED = 'true';
    try {
      const db = {
        userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
        user: { findUnique: jest.fn().mockResolvedValue({
          id: 'synthetic-user', isActive: true, isBlocked: false, isAstrologer: true,
        }) },
        astrologer: { findUnique: jest.fn().mockResolvedValue({ isApproved: true, isVerified: true }) },
        subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({
          id: 'synthetic-plan', name: 'ASTROLOGER_KUNDLI_YEARLY',
          price: new Prisma.Decimal(3500), currency: 'INR', durationDays: 365, isActive: true,
        }) },
        userProfile: { findUnique: jest.fn().mockResolvedValue({countryCode: 'IN'}) },
        subscription: {
          findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: 'synthetic-pending', razorpayOrderId: 'order_existing',
          }),
          create: jest.fn(), update: jest.fn(),
        },
        paymentOrder: {create: jest.fn()},
      };
      const service = new PaymentsService(db as never, {} as never,
        {quotePrice: jest.fn()} as never, {} as never, {} as never, {} as never);
      (getRazorpayInstance as jest.Mock).mockClear();
      await expect(service.createSubscriptionOrder('synthetic-subject', {
        planName: 'ASTROLOGER_KUNDLI_YEARLY',
      })).rejects.toBeInstanceOf(ConflictException);
      expect(db.subscription.create).not.toHaveBeenCalled();
      expect(db.subscription.update).not.toHaveBeenCalled();
      expect(db.paymentOrder.create).not.toHaveBeenCalled();
      expect(getRazorpayInstance).not.toHaveBeenCalled();
    } finally {
      if (gate === undefined) delete process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
      else process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED = gate;
    }
  });
});
