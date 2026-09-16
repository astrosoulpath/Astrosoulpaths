import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { AgoraService } from './agora.service';
import { CallService } from './call.service';

describe('CallService', () => {
  let service: CallService;

  const txMock = {
    callSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    walletLedger: {
      create: jest.fn(),
    },
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const agoraServiceMock = {
    generateRtcToken: jest.fn(),
    getRtcConfiguration: jest.fn(),
  };

  const customer = {
    id: 'customer-1',
    supabaseId: 'supabase-customer-1',
    role: 'CUSTOMER',
    isActive: true,
    isBlocked: false,
  };

  const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);

  const activeCall = {
    id: 'call-1',
    userId: customer.id,
    astrologerId: 'astrologer-1',
    status: 'ACTIVE',
    endedAt: null,
    expiresAt: futureExpiry,
    ratePerMinute: new Prisma.Decimal(10),
    amountCharged: new Prisma.Decimal(50),
    extendedMinutes: 0,
  };

  const wallet = {
    id: 'wallet-1',
    userId: customer.id,
    balance: new Prisma.Decimal(500),
    lockedBalance: new Prisma.Decimal(0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue(customer);

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AgoraService,
          useValue: agoraServiceMock,
        },
      ],
    }).compile();

    service = module.get<CallService>(CallService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extendCall', () => {
    it('extends an active call by 5 minutes and charges wallet atomically', async () => {
      txMock.callSession.findUnique.mockResolvedValue({
        ...activeCall,
      });

      txMock.wallet.findUnique.mockResolvedValue({
        ...wallet,
      });

      txMock.wallet.update.mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(450),
      });

      txMock.callSession.update.mockImplementation(async ({ data }) => ({
        ...activeCall,
        extendedMinutes: 5,
        amountCharged: new Prisma.Decimal(100),
        expiresAt: data.expiresAt,
        astrologer: {
          id: 'astrologer-1',
          name: 'Astrologer',
          avatarUrl: null,
        },
      }));

      txMock.walletLedger.create.mockResolvedValue({
        id: 'ledger-1',
        amount: new Prisma.Decimal(-50),
        balanceBefore: new Prisma.Decimal(500),
        balanceAfter: new Prisma.Decimal(450),
      });

      const result = await service.extendCall(
        customer.supabaseId,
        activeCall.id,
        { minutes: 5 },
      );

      expect(result.success).toBe(true);
      expect(result.data.extension.minutes).toBe(5);
      expect(result.data.extension.amount).toBe(50);
      expect(result.data.wallet.balance).toBe(450);

      expect(txMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: wallet.id,
          },
          data: {
            balance: expect.anything(),
          },
        }),
      );

      expect(txMock.callSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: activeCall.id,
          },
          data: expect.objectContaining({
            extendedMinutes: {
              increment: 5,
            },
            amountCharged: {
              increment: 50,
            },
            expiresAt: expect.any(Date),
          }),
        }),
      );

      expect(txMock.walletLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CALL_DEDUCTION',
            referenceType: 'CALL_SESSION',
            referenceId: activeCall.id,
          }),
        }),
      );

      const updateArgs = txMock.callSession.update.mock.calls[0][0];

      expect(updateArgs.data.expiresAt.getTime()).toBe(
        futureExpiry.getTime() + 5 * 60 * 1000,
      );
    });

    it('supports a 10 minute extension', async () => {
      txMock.callSession.findUnique.mockResolvedValue({
        ...activeCall,
      });

      txMock.wallet.findUnique.mockResolvedValue({
        ...wallet,
      });

      txMock.wallet.update.mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(400),
      });

      txMock.callSession.update.mockImplementation(async ({ data }) => ({
        ...activeCall,
        extendedMinutes: 10,
        amountCharged: new Prisma.Decimal(150),
        expiresAt: data.expiresAt,
        astrologer: {
          id: 'astrologer-1',
          name: 'Astrologer',
          avatarUrl: null,
        },
      }));

      txMock.walletLedger.create.mockResolvedValue({
        id: 'ledger-10',
        amount: new Prisma.Decimal(-100),
        balanceBefore: new Prisma.Decimal(500),
        balanceAfter: new Prisma.Decimal(400),
      });

      const result = await service.extendCall(
        customer.supabaseId,
        activeCall.id,
        { minutes: 10 },
      );

      expect(result.success).toBe(true);
      expect(result.data.extension.minutes).toBe(10);
      expect(result.data.extension.amount).toBe(100);

      expect(txMock.callSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extendedMinutes: {
              increment: 10,
            },
            amountCharged: {
              increment: 100,
            },
          }),
        }),
      );
    });

    it('rejects extension when wallet balance is insufficient', async () => {
      txMock.callSession.findUnique.mockResolvedValue({
        ...activeCall,
      });

      txMock.wallet.findUnique.mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(20),
      });

      await expect(
        service.extendCall(customer.supabaseId, activeCall.id, { minutes: 5 }),
      ).rejects.toThrow('INSUFFICIENT_BALANCE');

      expect(txMock.wallet.update).not.toHaveBeenCalled();
      expect(txMock.callSession.update).not.toHaveBeenCalled();
      expect(txMock.walletLedger.create).not.toHaveBeenCalled();
    });

    it('rejects extension from a user who does not own the call', async () => {
      txMock.callSession.findUnique.mockResolvedValue({
        ...activeCall,
        userId: 'another-customer',
      });

      await expect(
        service.extendCall(customer.supabaseId, activeCall.id, { minutes: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(txMock.wallet.findUnique).not.toHaveBeenCalled();
    });

    it('rejects extension when consultation is not active', async () => {
      txMock.callSession.findUnique.mockResolvedValue({
        ...activeCall,
        status: 'COMPLETED',
        endedAt: new Date(),
      });

      await expect(
        service.extendCall(customer.supabaseId, activeCall.id, { minutes: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(txMock.wallet.findUnique).not.toHaveBeenCalled();
    });

    it('rejects unsupported extension duration', async () => {
      await expect(
        service.extendCall(customer.supabaseId, activeCall.id, { minutes: 7 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});
