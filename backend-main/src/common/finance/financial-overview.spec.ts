import { AdminRepository } from '../../module/admin/admin.repository';
import { AstrologerPayoutWebhookService } from '../../module/astrologer/astrologer-payout-webhook.service';
import { AstrologerPayoutProviderService } from '../../module/astrologer/astrologer-payout-provider.service';

describe('finance reporting and provider safety (mocks only)', () => {
  it('provider failures do not expose raw account, credential or response data', () => {
    const provider: any = Object.create(
      AstrologerPayoutProviderService.prototype,
    );
    try {
      provider.throwProviderError(
        {
          isAxiosError: true,
          message: 'private-fixture',
          response: { data: { account_number: 'private-fixture' } },
        },
        'Provider unavailable',
      );
      throw new Error('Expected failure');
    } catch (error: any) {
      expect(error.message).toBe('Provider unavailable');
      expect(JSON.stringify(error.getResponse())).not.toContain(
        'private-fixture',
      );
    }
  });
  it('contradictory provider success cannot mark earnings PAID', async () => {
    const db: any = {
      astrologerPayout: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payout' }),
      },
      $transaction: jest.fn(),
    };
    await expect(
      new AstrologerPayoutWebhookService(db).process({
        event: 'payout.processed',
        payload: { payout: { entity: { id: 'provider', status: 'failed' } } },
      }),
    ).rejects.toThrow('inconsistent');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('keeps currencies, liabilities, commission, payable and collection status separate', async () => {
    const wallets = [
      { currency: 'INR', _sum: { balance: '100', lockedBalance: '20' } },
    ];
    const earnings = [
      {
        currency: 'USD',
        status: 'PENDING',
        _sum: { platformFee: '3', netAmount: '7' },
      },
    ];
    const tx: any = {
      wallet: { groupBy: jest.fn().mockResolvedValue(wallets) },
      astrologerEarning: { groupBy: jest.fn().mockResolvedValue(earnings) },
      astrologerPayout: { groupBy: jest.fn().mockResolvedValue([]) },
      paymentOrder: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const db: any = { $transaction: jest.fn(async (fn) => fn(tx)) };
    const report = await new AdminRepository(db).getFinanceOverview();
    expect(report.wallets).toBe(wallets);
    expect(report.earnings).toBe(earnings);
    expect(report.settlement.status).toBe('UNVERIFIED');
    expect(report).not.toHaveProperty('settledAmount');
    expect(tx.astrologerEarning.groupBy.mock.calls[0][0].by).toEqual([
      'currency',
      'status',
    ]);
    expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe(
      'RepeatableRead',
    );
  });
  it('does not turn reporting failures into fabricated zero balances', async () => {
    const db: any = {
      $transaction: jest
        .fn()
        .mockRejectedValue(new Error('synthetic unavailable')),
    };
    await expect(
      new AdminRepository(db).getFinanceOverview(),
    ).rejects.toThrow();
  });
  it('early callback for known pending app payout asks for retry without binding or settlement', async () => {
    const db: any = {
      astrologerPayout: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest
          .fn()
          .mockResolvedValue({ providerReference: null, status: 'REQUESTED' }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    await expect(
      new AstrologerPayoutWebhookService(db).process({
        event: 'payout.processed',
        payload: {
          payout: {
            entity: {
              id: 'provider-test',
              notes: {
                internalPayoutId: 'fixture',
                purpose: 'ASTROLOGER_EARNINGS',
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.astrologerPayout.update).not.toHaveBeenCalled();
  });
  it('does not adopt unrelated provider payouts', async () => {
    const db: any = {
      astrologerPayout: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
      },
    };
    const result = await new AstrologerPayoutWebhookService(db).process({
      event: 'payout.processed',
      payload: { payout: { entity: { id: 'external' } } },
    });
    expect(result).toMatchObject({ ignored: true });
    expect(db.astrologerPayout.findUnique).not.toHaveBeenCalled();
  });
  it('provider transfer boundary is disabled by default, even if called directly', async () => {
    const previous = process.env.FINANCIAL_PAYOUTS_ENABLED;
    delete process.env.FINANCIAL_PAYOUTS_ENABLED;
    try {
      const provider: any = Object.create(
        AstrologerPayoutProviderService.prototype,
      );
      await expect(provider.createPayout({})).rejects.toThrow('disabled');
    } finally {
      if (previous === undefined) delete process.env.FINANCIAL_PAYOUTS_ENABLED;
      else process.env.FINANCIAL_PAYOUTS_ENABLED = previous;
    }
  });
});
