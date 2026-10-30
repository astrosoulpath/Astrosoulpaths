import { LocalVedicKundliProvider } from './providers/local-vedic-kundli.provider';
import { KundliPdfService } from './kundli-pdf.service';
import { AstrologerKundliReportPdfService } from './astrologer-kundli-report-pdf.service';
import { validateProfessionalKundliReport } from './professional-kundli-report.validator';

describe('dashboard real offline Kundli calculation and PDF rendering', () => {
  const params = {
    dob: '1995-08-15',
    tob: '10:30',
    lat: 25.5941,
    lon: 85.1376,
    timezone: 5.5,
  };
  for (const lang of ['en', 'hi']) {
    it(`calculates synthetic charts and renders actual ${lang} PDF bytes without AI/network/database`, async () => {
      const report = await new LocalVedicKundliProvider().generate(
        params,
        lang,
      );
      expect(validateProfessionalKundliReport(report).valid).toBe(true);
      const pdf = await new KundliPdfService().generateSavedKundliPdf({
        ...params,
        latitude: params.lat,
        longitude: params.lon,
        kundliId: 'synthetic-offline',
        savedRecordId: 'synthetic-offline',
        name: lang === 'hi' ? 'परीक्षण' : 'Synthetic',
        gender: 'NOT_SPECIFIED',
        birthPlace: 'Synthetic',
        lang,
        report,
      });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('latin1')).toContain('%%EOF');
      expect(pdf.length).toBeGreaterThan(10000);
      expect(pdf.toString('latin1')).toMatch(/\/Type \/Page\b/);
    }, 30000);
  }
  it('renders an actual final manual-report PDF, rejecting foreign access before technical lookup', async () => {
    const row = {
      id: 'synthetic',
      callSessionId: 'synthetic',
      customerUserId: 'customer',
      astrologerId: 'astrologer',
      status: 'FINAL',
      title: 'Synthetic professional report',
      summary: 'Synthetic authored text; no AI request.',
      character: null,
      career: null,
      marriage: null,
      finance: null,
      health: null,
      remedies: null,
      notes: null,
      finalizedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{available:false}]),
      astrologerKundliReport: { findUnique: jest.fn().mockResolvedValue(row) },
      kundliSavedRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AstrologerKundliReportPdfService(db as any);
    await expect(
      service.generateForAuthenticatedUser({
        reportId: row.id,
        authenticatedUserId: 'foreign',
      }),
    ).rejects.toThrow('cannot access');
    expect(db.kundliSavedRecord.findFirst).not.toHaveBeenCalled();
    const pdf = await service.generateForAuthenticatedUser({
      reportId: row.id,
      authenticatedUserId: 'customer',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
  });
});
