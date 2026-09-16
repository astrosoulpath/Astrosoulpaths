import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AstrologerKundliReportStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';

describe('AstrologerKundliReportService', () => {
  let service: AstrologerKundliReportService;

  const prismaMock = {
    callSession: {
      findUnique: jest.fn(),
    },
    astrologerKundliReport: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologerKundliReportService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(AstrologerKundliReportService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('derives customer and astrologer ownership from CallSession', async () => {
    prismaMock.callSession.findUnique.mockResolvedValue({
      id: 'call-1',
      userId: 'customer-user-1',
      astrologerId: 'astrologer-user-1',
    });

    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue(null);

    prismaMock.astrologerKundliReport.create.mockResolvedValue({
      id: 'report-1',
      callSessionId: 'call-1',
      customerUserId: 'customer-user-1',
      astrologerId: 'astrologer-user-1',
      status: AstrologerKundliReportStatus.DRAFT,
      attachments: [],
    });

    await service.createOrGetDraft('call-1', 'astrologer-user-1');

    expect(prismaMock.astrologerKundliReport.create).toHaveBeenCalledWith({
      data: {
        callSessionId: 'call-1',
        customerUserId: 'customer-user-1',
        astrologerId: 'astrologer-user-1',
        status: AstrologerKundliReportStatus.DRAFT,
      },
      include: {
        attachments: true,
      },
    });
  });

  it('rejects an astrologer attempting to access another consultation', async () => {
    prismaMock.callSession.findUnique.mockResolvedValue({
      id: 'call-1',
      userId: 'customer-user-1',
      astrologerId: 'astrologer-user-owner',
    });

    await expect(
      service.createOrGetDraft('call-1', 'astrologer-user-attacker'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.astrologerKundliReport.create).not.toHaveBeenCalled();
  });

  it('returns not found for a nonexistent consultation', async () => {
    prismaMock.callSession.findUnique.mockResolvedValue(null);

    await expect(
      service.createOrGetDraft('missing-call', 'astrologer-user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.astrologerKundliReport.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate report for the same consultation', async () => {
    prismaMock.callSession.findUnique.mockResolvedValue({
      id: 'call-1',
      userId: 'customer-user-1',
      astrologerId: 'astrologer-user-1',
    });

    const existing = {
      id: 'report-existing',
      callSessionId: 'call-1',
      customerUserId: 'customer-user-1',
      astrologerId: 'astrologer-user-1',
      status: AstrologerKundliReportStatus.DRAFT,
      attachments: [],
    };

    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue(existing);

    const result = await service.createOrGetDraft(
      'call-1',
      'astrologer-user-1',
    );

    expect(result).toEqual(existing);

    expect(prismaMock.astrologerKundliReport.create).not.toHaveBeenCalled();
  });

  it('allows only the owning astrologer to edit a draft', async () => {
    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue({
      id: 'report-1',
      astrologerId: 'astrologer-user-owner',
      status: AstrologerKundliReportStatus.DRAFT,
    });

    await expect(
      service.updateDraft('report-1', 'astrologer-user-attacker', {
        title: 'Unauthorized edit',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.astrologerKundliReport.update).not.toHaveBeenCalled();
  });

  it('blocks editing after report is FINAL', async () => {
    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue({
      id: 'report-1',
      astrologerId: 'astrologer-user-1',
      status: AstrologerKundliReportStatus.FINAL,
    });

    await expect(
      service.updateDraft('report-1', 'astrologer-user-1', {
        title: 'Should not change',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.astrologerKundliReport.update).not.toHaveBeenCalled();
  });

  it('finalizes an owned DRAFT report', async () => {
    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue({
      id: 'report-1',
      astrologerId: 'astrologer-user-1',
      status: AstrologerKundliReportStatus.DRAFT,
    });

    prismaMock.astrologerKundliReport.update.mockResolvedValue({
      id: 'report-1',
      astrologerId: 'astrologer-user-1',
      status: AstrologerKundliReportStatus.FINAL,
      finalizedAt: new Date(),
      attachments: [],
    });

    await service.finalize('report-1', 'astrologer-user-1');

    expect(prismaMock.astrologerKundliReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'report-1',
        },
        data: expect.objectContaining({
          status: AstrologerKundliReportStatus.FINAL,
          finalizedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects another astrologer attempting to finalize a report', async () => {
    prismaMock.astrologerKundliReport.findUnique.mockResolvedValue({
      id: 'report-1',
      astrologerId: 'astrologer-user-owner',
      status: AstrologerKundliReportStatus.DRAFT,
    });

    await expect(
      service.finalize('report-1', 'astrologer-user-attacker'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.astrologerKundliReport.update).not.toHaveBeenCalled();
  });

  it('returns only FINAL reports for the authenticated customer', async () => {
    prismaMock.astrologerKundliReport.findMany.mockResolvedValue([
      {
        id: 'report-final',
        customerUserId: 'customer-user-1',
        status: AstrologerKundliReportStatus.FINAL,
      },
    ]);

    await service.listFinalForCustomer('customer-user-1');

    expect(prismaMock.astrologerKundliReport.findMany).toHaveBeenCalledWith({
      where: {
        customerUserId: 'customer-user-1',
        status: AstrologerKundliReportStatus.FINAL,
      },
      include: {
        attachments: true,
      },
      orderBy: {
        finalizedAt: 'desc',
      },
    });
  });

  it('scopes astrologer listing to authenticated internal User.id', async () => {
    prismaMock.astrologerKundliReport.findMany.mockResolvedValue([]);

    await service.listForAstrologer('astrologer-user-1');

    expect(prismaMock.astrologerKundliReport.findMany).toHaveBeenCalledWith({
      where: {
        astrologerId: 'astrologer-user-1',
      },
      include: {
        attachments: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });
});
