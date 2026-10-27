jest.mock('../../infrastructure/supabase/supabase.module', () => ({
  SupabaseModule: class SupabaseModule {},
}));
jest.mock('./guards/consultation-kundli-auth.guard', () => ({
  ConsultationKundliAuthGuard: class ConsultationKundliAuthGuard {},
}));
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConsultationKundliV1Module } from './consultation-kundli-v1.module';
import { AstrologerKundliReportPdfService } from './astrologer-kundli-report-pdf.service';

describe('prepared default-off V1 integration', () => {
  it.each([
    {},
    { KUNDLI_CONSENT_V1_ENABLED: 'true' },
    { KUNDLI_CONSENT_POLICY_APPROVED: 'kundli-local-v1' },
    {
      KUNDLI_CONSENT_V1_ENABLED: 'true',
      KUNDLI_CONSENT_POLICY_APPROVED: 'wrong-version',
    },
  ])(
    'registers no routes/providers without both existing approvals: %j',
    (env) => {
      const module = ConsultationKundliV1Module.registerIfApproved(env);
      expect(module.controllers).toBeUndefined();
      expect(module.providers).toBeUndefined();
      expect(module.imports).toBeUndefined();
    },
  );
  it('prepares existing controllers/providers only with both approvals; does not bootstrap them', () => {
    const module = ConsultationKundliV1Module.registerIfApproved({
      KUNDLI_CONSENT_V1_ENABLED: 'true',
      KUNDLI_CONSENT_POLICY_APPROVED: 'kundli-local-v1',
    });
    expect(module.controllers).toHaveLength(1);
    expect(module.providers).toHaveLength(3);
    expect(module.imports).toHaveLength(2);
    expect(
      readFileSync(join(__dirname, 'kundli.module.ts'), 'utf8'),
    ).not.toContain('ConsultationKundliV1Module');
  });
});

type Renderer = {
  anyText(...values: unknown[]): string;
  compactTechnicalText(value: unknown): string;
  clean(value: string | null | undefined, fallback?: string): string;
  drawProfessionalNorthIndianChart(
    doc: unknown,
    title: string,
    source: unknown,
  ): void;
  writeChartAvailabilityCard(
    doc: unknown,
    title: string,
    source: unknown,
  ): void;
  writeTechnicalTextLine(doc: unknown, value: string): void;
  writeProfessionalHeading(...values: unknown[]): void;
  ensureRoom(...values: unknown[]): void;
};

describe('PDF supplied-data validation without inferred values', () => {
  const renderer = () =>
    new AstrologerKundliReportPdfService({} as never) as unknown as Renderer;
  it('never stringifies unknown objects into labels; preserves false/zero', () => {
    const service = renderer();
    expect(service.anyText({ private: 'not a label' }, [], 0)).toBe('0');
    expect(service.anyText({}, false)).toBe('false');
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(service.compactTechnicalText(cycle)).toBe('');
    expect(service.clean(' A\0B\r\nC ')).toBe('AB\nC');
  });
  it('omits a diagram when houses are absent, duplicated or not supplied', () => {
    const service = renderer();
    const card = jest
      .spyOn(service, 'writeChartAvailabilityCard')
      .mockImplementation(() => {});
    jest.spyOn(service, 'writeTechnicalTextLine').mockImplementation(() => {});
    for (const houses of [
      [],
      [{}],
      Array.from({ length: 12 }, () => ({ house: 1 })),
      Array.from({ length: 12 }, (_, i) => ({ house: i === 0 ? 13 : i })),
    ]) {
      service.drawProfessionalNorthIndianChart({}, 'Synthetic chart', {
        houses,
      });
    }
    expect(card).toHaveBeenCalledTimes(4);
  });
  it('renders explicit numbered houses in their own slots, not input array order', () => {
    const service = renderer(),
      labels: string[] = [];
    jest.spyOn(service, 'ensureRoom').mockImplementation(() => {});
    jest
      .spyOn(service, 'writeProfessionalHeading')
      .mockImplementation(() => {});
    const doc: Record<string, unknown> = {
      page: { width: 500, margins: { left: 20, right: 20 } },
      y: 0,
      save() {
        return doc;
      },
      restore() {
        return doc;
      },
      lineWidth() {
        return doc;
      },
      strokeColor() {
        return doc;
      },
      rect() {
        return doc;
      },
      stroke() {
        return doc;
      },
      moveTo() {
        return doc;
      },
      lineTo() {
        return doc;
      },
      closePath() {
        return doc;
      },
      fillColor() {
        return doc;
      },
      fontSize() {
        return doc;
      },
      text(value: string) {
        labels.push(value);
        return doc;
      },
    };
    service.drawProfessionalNorthIndianChart(doc, 'Synthetic chart', {
      houses: Array.from({ length: 12 }, (_, i) => ({ house: 12 - i })),
      planets: [],
    });
    expect(labels).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  });
});
