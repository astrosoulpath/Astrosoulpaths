// Direct controller transport tests below do not exercise authentication. Keep
// Firebase/ESM bootstrap out of this in-memory suite; HTTP auth has its own tests.
jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';
import { AstrologerKundliReportPdfService } from './astrologer-kundli-report-pdf.service';
import { AstrologerKundliReportPdfController } from './astrologer-kundli-report-pdf.controller';

// In-memory ownership fixtures; PDFKit and the existing local font are real.
// No Prisma connection, identity provisioning, paid provider or generation call.
const finalReport = () => ({
  id: 'synthetic-report',
  callSessionId: 'synthetic-call',
  customerUserId: 'synthetic-customer',
  astrologerId: 'synthetic-astrologer',
  status: 'FINAL',
  title: 'Synthetic report',
  summary: 'Stored interpretation only',
  character: null,
  career: null,
  marriage: null,
  finance: null,
  health: null,
  remedies: null,
  notes: null,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  updatedAt: new Date('2026-10-02T12:00:00Z'),
  finalizedAt: new Date('2026-10-02T12:00:00Z'),
});

describe('Kundli report canonical identity isolation', () => {
  function setup(mapped: string | null, users: any[]) {
    const db = {
      userAuthIdentity: {
        findUnique: jest
          .fn()
          .mockResolvedValue(mapped ? { userId: mapped } : null),
      },
      user: { findMany: jest.fn().mockResolvedValue(users) },
    };
    return { db, service: new AstrologerKundliReportService(db as never) };
  }
  const active = (id: string) => ({ id, isActive: true, isBlocked: false });

  it('resolves a single linked owner without provisioning or changing identities', async () => {
    const { db, service } = setup('owner', [active('owner')]);
    await expect(
      service.resolveAuthenticatedUserId('verified-anchor'),
    ).resolves.toBe('owner');
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });
  it('rejects linked/legacy collisions regardless of row order', async () => {
    for (const users of [
      [active('owner'), active('other')],
      [active('other'), active('owner')],
    ]) {
      const { service } = setup('owner', users);
      await expect(
        service.resolveAuthenticatedUserId('verified-anchor'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
  it('does not fall back to another owner when an authoritative mapping is orphaned', async () => {
    const { service } = setup('missing-owner', [active('legacy-other')]);
    await expect(
      service.resolveAuthenticatedUserId('verified-anchor'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('preserves unique legacy access and rejects blocked accounts', async () => {
    await expect(
      setup(null, [active('legacy')]).service.resolveAuthenticatedUserId(
        'anchor',
      ),
    ).resolves.toBe('legacy');
    await expect(
      setup(null, [
        { ...active('legacy'), isBlocked: true },
      ]).service.resolveAuthenticatedUserId('anchor'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

type TechnicalLookup = {
  loadConsultationTechnicalKundli(
    report: ReturnType<typeof finalReport>,
  ): Promise<{ savedRecordId: string } | null>;
};
describe('Finalized Kundli PDF ownership and calculation provenance', () => {
  function setup(report = finalReport()) {
    const db = {
      astrologerKundliReport: {
        findUnique: jest.fn().mockResolvedValue(report),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ available: false }]),
      kundliSavedRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { db, service: new AstrologerKundliReportPdfService(db as never) };
  }
  for (const owner of ['synthetic-customer', 'synthetic-astrologer']) {
    it(`renders a real PDF for the owning ${owner.endsWith('customer') ? 'customer' : 'astrologer'} without optional V1 tables`, async () => {
      const { db, service } = setup();
      const pdf = await service.generateForAuthenticatedUser({
        reportId: 'synthetic-report',
        authenticatedUserId: owner,
      });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1000);
      expect(db.kundliSavedRecord.findMany).not.toHaveBeenCalled();
    });
  }
  it('rejects another account before reading chart data or rendering', async () => {
    const { db, service } = setup();
    await expect(
      service.generateForAuthenticatedUser({
        reportId: 'synthetic-report',
        authenticatedUserId: 'another-owner',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects drafts before reading chart data', async () => {
    const { db, service } = setup({ ...finalReport(), status: 'DRAFT' });
    await expect(
      service.generateForAuthenticatedUser({
        reportId: 'synthetic-report',
        authenticatedUserId: 'synthetic-customer',
      }),
    ).rejects.toMatchObject({
      response: { code: 'KUNDLI_REPORT_NOT_FINAL' },
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('only considers published same-consultation/same-astrologer charts predating finalization', async () => {
    const { db, service } = setup();
    db.$queryRaw.mockResolvedValue([{ available: true }]);
    const record = {
      id: 'saved',
      kundliId: 'chart',
      name: 'Synthetic',
      gender: 'OTHER',
      birthPlace: 'Synthetic city',
      lang: 'en',
      kundli: {
        dob: '2000-01-01',
        tob: '12:00',
        latitude: 0,
        longitude: 0,
        timezone: 0,
        data: { vedic: { supplied: true } },
      },
    };
    db.kundliSavedRecord.findMany.mockResolvedValue([record] as never);
    const result = await (
      service as unknown as TechnicalLookup
    ).loadConsultationTechnicalKundli(finalReport());
    expect(result?.savedRecordId).toBe('saved');
    expect(db.kundliSavedRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerUserId: 'synthetic-customer',
          createdByAstrologer: { userId: 'synthetic-astrologer' },
          createdAt: { lte: finalReport().finalizedAt },
          generationRequests: {
            some: {
              consultationId: 'synthetic-call',
              actorUserId: 'synthetic-astrologer',
              status: 'PUBLISHED',
            },
          },
        },
        take: 2,
      }),
    );
  });
  it('omits the optional appendix when more than one chart could match', async () => {
    const { db, service } = setup();
    db.$queryRaw.mockResolvedValue([{ available: true }]);
    db.kundliSavedRecord.findMany.mockResolvedValue([
      { id: 'first' },
      { id: 'second' },
    ] as never);
    await expect(
      (service as unknown as TechnicalLookup).loadConsultationTechnicalKundli(
        finalReport(),
      ),
    ).resolves.toBeNull();
  });
  it('uses protected PDF transport with non-cacheable content and a safe filename', async () => {
    const identity = {
      resolveAuthenticatedUserId: jest
        .fn()
        .mockResolvedValue('synthetic-customer'),
    };
    const renderer = {
      generateForAuthenticatedUser: jest
        .fn()
        .mockResolvedValue(Buffer.from('%PDF-synthetic')),
    };
    const response = { set: jest.fn() };
    const controller = new AstrologerKundliReportPdfController(
      identity as never,
      renderer as never,
    );
    await controller.downloadPdf(
      { sub: 'verified-anchor' },
      'safe\r\nunsafe',
      response as never,
    );
    expect(renderer.generateForAuthenticatedUser).toHaveBeenCalledWith({
      reportId: 'safe\r\nunsafe',
      authenticatedUserId: 'synthetic-customer',
    });
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition':
          'attachment; filename="astrologer-kundli-report-safeunsafe.pdf"',
      }),
    );
  });
});
