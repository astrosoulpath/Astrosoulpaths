import { existsSync } from 'fs';
import { join } from 'path';

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { validateProfessionalKundliReport } from './professional-kundli-report.validator';

type KundliPdfReport = Record<string, any>;

export type GenerateSavedKundliPdfInput = {
  savedRecordId?: string;
  profileId?: string;
  kundliId: string;
  name: string;
  gender: string;
  birthPlace: string;
  dob: string;
  tob: string;
  latitude: number;
  longitude: number;
  timezone: number;
  lang: string;
  report: KundliPdfReport;
};

@Injectable()
export class KundliPdfService {
  private readonly logger = new Logger(KundliPdfService.name);

  private readonly fontPath = join(
    process.cwd(),
    'assets',
    'fonts',
    'NotoSansDevanagari.ttf',
  );

  async generateProfileKundliPdf(
    input: GenerateSavedKundliPdfInput & {
      profileId: string;
    },
  ): Promise<Buffer> {
    return this.generateSavedKundliPdf(input);
  }
  async generateSavedKundliPdf(
    input: GenerateSavedKundliPdfInput,
  ): Promise<Buffer> {
    const reportValidation = validateProfessionalKundliReport(input.report);

    if (!reportValidation.valid) {
      throw new ConflictException({
        success: false,
        code: 'KUNDLI_PDF_REGENERATION_REQUIRED',
        message:
          'Professional Kundli PDF cannot be generated from incomplete calculation data. Regenerate the Kundli first.',
        missingSections: reportValidation.missingSections,
        completenessPercent: reportValidation.corePercent,
      });
    }

    if (!existsSync(this.fontPath)) {
      this.logger.error(`kundli_pdf.font_missing path=${this.fontPath}`);

      throw new InternalServerErrorException({
        success: false,
        code: 'KUNDLI_PDF_FONT_MISSING',
        message: 'The Kundli PDF font is not configured.',
      });
    }

    try {
      const document = new PDFDocument({
        size: 'A4',
        margins: {
          top: 48,
          bottom: 55,
          left: 48,
          right: 48,
        },
        bufferPages: true,
        info: {
          Title: `${input.name} - Vedic Kundli`,
          Author: 'Astro Soul Path',
          Subject: 'Professional Vedic Kundli Report',
          Keywords: 'Kundli, Vedic Astrology, Birth Chart, Dasha',
          CreationDate: new Date(),
        },
      });

      document.registerFont('AspUnicode', this.fontPath);

      document.font('AspUnicode');

      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.from(chunk));
      });

      const completed = new Promise<Buffer>((resolve, reject) => {
        document.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        document.on('error', reject);
      });

      this.writeReport(document, input);
      this.writePageFooters(document);

      document.end();

      const pdf = await completed;

      this.logger.log(
        `kundli_pdf.generated referenceId=${input.savedRecordId ?? input.profileId ?? 'unknown'} kundliId=${input.kundliId} bytes=${pdf.length}`,
      );

      return pdf;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `kundli_pdf.failed referenceId=${input.savedRecordId ?? input.profileId ?? 'unknown'} reason=${message}`,
      );

      throw new InternalServerErrorException({
        success: false,
        code: 'KUNDLI_PDF_GENERATION_FAILED',
        message: 'Unable to generate the Kundli PDF.',
      });
    }
  }

  async triggerGeneration(input: {
    kundliOrderId: string;
    kundliId?: string;
    lang?: string;
  }): Promise<void> {
    this.logger.log(
      `kundli_pdf.legacy_order_triggered kundliOrderId=${input.kundliOrderId} kundliId=${input.kundliId ?? 'unknown'} lang=${input.lang ?? 'default'}`,
    );
  }

  private writeReport(
    document: PDFKit.PDFDocument,
    input: GenerateSavedKundliPdfInput,
  ): void {
    const report = input.report ?? {};
    const reportData = report as Record<string, any>;

    const analysis =
      reportData.analysis && typeof reportData.analysis === 'object'
        ? reportData.analysis
        : {};

    const extended =
      reportData.extended && typeof reportData.extended === 'object'
        ? reportData.extended
        : {};

    const kp =
      reportData.kp && typeof reportData.kp === 'object' ? reportData.kp : {};

    const planets = Array.isArray(report.planetaryPositions)
      ? report.planetaryPositions
      : [];

    const sun = planets.find(
      (planet: Record<string, any>) =>
        this.text(planet?.name).toLowerCase() === 'sun',
    );

    const moon = planets.find(
      (planet: Record<string, any>) =>
        this.text(planet?.name).toLowerCase() === 'moon',
    );

    this.drawCover(document, input);
    this.writeReportIndex(document);

    this.writeTechnicalReportIntroduction(document, reportData);

    this.sectionTitle(document, 'Birth Details');

    this.keyValueGrid(document, [
      ['Full Name', input.name],
      ['Gender', input.gender],
      ['Date of Birth', input.dob],
      ['Time of Birth', input.tob],
      ['Place of Birth', input.birthPlace],
      ['Coordinates', `${input.latitude}, ${input.longitude}`],
      ['Timezone', `UTC ${this.signed(input.timezone)}`],
      ['Language', input.lang.toUpperCase()],
    ]);

    this.ensureSpace(document, 150);

    this.sectionTitle(document, 'Vedic Summary');

    this.keyValueGrid(document, [
      ['Ascendant', this.text(report.ascendant?.sign) || 'Not available'],
      ['Sun Sign', this.text(sun?.sign) || 'Not available'],
      ['Moon Sign', this.text(moon?.sign) || 'Not available'],
      [
        'Nakshatra',
        this.text(moon?.nakshatra) ||
          this.text(report.ascendant?.nakshatra?.name) ||
          'Not available',
      ],
    ]);

    this.writeChartNotationGuide(document);

    this.drawNorthIndianChart(document, 'Birth Chart (D1)', report.birthChart);

    this.drawNorthIndianChart(
      document,
      'Navamsa Chart (D9)',
      report.navamsaChart,
    );

    this.writeDivisionalChartAtlas(document, reportData);

    this.writeVedicDataSection(
      document,
      'Major Divisional Charts (Vargas)',
      report.charts?.divisionalCharts,
    );

    this.writeProfessionalSectionHeading(
      document,
      'Planetary Positions',
      'Verified sidereal planetary positions used throughout this Kundli report.',
    );

    this.writePlanetaryPositions(document, planets);

    this.writePlanetaryTechnicalSummary(document, planets);

    this.writeProfessionalSectionHeading(
      document,
      'Vimshottari Dasha',
      'Major and sub-period timeline calculated from the verified birth chart.',
    );

    this.writeDashaReadingGuide(document, report.dasha);
    this.writeCurrentDashaSummary(document, report.dasha);
    this.writeFullDashaHierarchy(document, report.dasha);

    this.writeProfessionalSectionHeading(
      document,
      'Panchang',
      'Traditional Vedic birth-day factors derived from the calculation provider.',
    );

    this.writeVedicDataSection(document, 'Panchang', report.panchang);

    this.writeProfessionalSectionHeading(
      document,
      'Yogas & Special Combinations',
      'Only combinations present in the verified provider response are shown.',
    );

    this.writeVedicDataSection(document, 'Important Yogas', report.yogas);

    this.writeVedicDataSection(
      document,
      'Shadbala - Planetary Strength',
      report.shadbala,
    );

    this.writeVedicDataSection(document, 'Ashtakavarga', report.ashtakavarga);

    if (
      report.transit &&
      typeof report.transit === 'object' &&
      Object.keys(report.transit).length > 0
    ) {
      this.writeProfessionalSectionHeading(
        document,
        'Transit / Gochar',
        'Current planetary transit information supplied by the verified calculation engine.',
      );

      this.writeVedicDataSection(document, 'Transit Details', report.transit);
    }

    this.writeVedicDataSection(document, 'Dosha Analysis', report.dosha);
    // ======================================================
    // ASP PROFESSIONAL KUNDLI REPORT
    // Real provider/report data only - no dummy predictions.
    // ======================================================

    this.writeVedicDataSection(
      document,
      'House Analysis',
      analysis.houses ?? kp.houses ?? reportData.houses,
    );

    this.writeVedicDataSection(
      document,
      'Character Analysis',
      analysis.character ??
        reportData.character ??
        reportData.predictions?.character,
    );

    this.writeVedicDataSection(
      document,
      'Career Analysis',
      analysis.career ?? reportData.career ?? reportData.predictions?.career,
    );

    this.writeVedicDataSection(
      document,
      'Marriage Analysis',
      analysis.marriage ??
        reportData.marriage ??
        reportData.predictions?.marriage,
    );

    this.writeVedicDataSection(
      document,
      'Finance Analysis',
      analysis.finance ?? reportData.finance ?? reportData.predictions?.finance,
    );

    this.writeVedicDataSection(
      document,
      'Health Overview',
      analysis.health ?? reportData.health ?? reportData.predictions?.health,
    );

    this.writeVedicDataSection(
      document,
      'Transit Overview',
      analysis.transit ?? extended.transit ?? reportData.transit,
    );

    this.writeVedicDataSection(
      document,
      'Astrological Remedies',
      reportData.remedies ?? analysis.remedies ?? extended.remedies,
    );

    this.writeVedicDataSection(
      document,
      'Gemstone Suggestions',
      extended.gemSuggestion ?? reportData.gemSuggestion,
    );

    this.writeVedicDataSection(
      document,
      'Sade Sati Analysis',
      extended.sadeSati ?? reportData.sadeSati,
    );

    this.ensureSpace(document, 100);

    this.sectionTitle(document, 'Important Notice');

    this.writeProfessionalInterpretation(document, analysis);
    this.writeTechnicalAppendix(document, reportData);

    document
      .fillColor('#5F6473')
      .fontSize(9)
      .text(
        'This Kundli report is intended for astrology guidance and informational purposes. It should not replace professional medical, legal or financial advice.',
        {
          lineGap: 3,
        },
      );

    document
      .moveDown(1)
      .fillColor('#0B1026')
      .fontSize(9)
      .text(
        input.savedRecordId
          ? `Saved record: ${input.savedRecordId}`
          : `Profile: ${input.profileId ?? 'unknown'}`,
      );
  }

  private writeChart(
    document: PDFKit.PDFDocument,
    title: string,
    chart: Record<string, any> | null,
  ): void {
    const houses = Array.isArray(chart?.houses) ? chart.houses : [];

    const planets = Array.isArray(chart?.planets) ? chart.planets : [];

    if (houses.length === 0) {
      return;
    }

    this.ensureSpace(document, 180);
    this.sectionTitle(document, title);

    const left = 55;
    const width = 480;
    const rowHeight = 28;

    for (let index = 0; index < houses.length; index += 1) {
      const house = houses[index];

      if (document.y + rowHeight > 770) {
        document.addPage();
      }

      const rowY = document.y;

      const houseNumber =
        typeof house?.house === 'number' ? house.house : index + 1;

      const housePlanets = planets
        .filter((planet: Record<string, any>) => planet?.house === house?.house)
        .map((planet: Record<string, any>) => this.text(planet?.name))
        .filter(Boolean)
        .join(', ');

      if (index % 2 === 0) {
        document
          .save()
          .roundedRect(left, rowY, width, rowHeight, 3)
          .fill('#F8F5EC')
          .restore();
      }

      document
        .fillColor('#071936')
        .fontSize(8.5)
        .text(`House ${houseNumber}`, left + 8, rowY + 8, {
          width: 72,
          lineBreak: false,
        });

      document
        .fillColor('#545B6D')
        .fontSize(8)
        .text(this.text(house?.sign) || 'Not available', left + 88, rowY + 8, {
          width: 120,
          lineBreak: false,
        });

      document
        .fillColor('#252A3A')
        .text(housePlanets || 'No planets', left + 215, rowY + 8, {
          width: 255,
          height: 15,
          ellipsis: true,
          lineBreak: false,
        });

      document.y = rowY + rowHeight;
    }

    document.y += 10;
  }

  private writePlanetaryTechnicalSummary(
    document: PDFKit.PDFDocument,
    planets: Array<Record<string, any>>,
  ): void {
    if (planets.length === 0) {
      return;
    }

    this.ensureSpace(document, 110);

    this.writeProfessionalSectionHeading(
      document,
      '3. Planetary Technical Summary',
      'Compact reference of sign, longitude, nakshatra, motion and house information available from the verified calculation.',
    );

    const meaningful = planets.filter(
      (planet) => planet && typeof planet === 'object',
    );

    document
      .fillColor('#5F6473')
      .fontSize(8)
      .text(
        `${meaningful.length} calculated points are available in the planetary dataset.`,
        {
          lineGap: 2,
        },
      );

    document.moveDown(0.7);

    const retrograde = meaningful
      .filter(
        (planet) =>
          planet?.retrograde === true ||
          String(planet?.motion ?? '')
            .toLowerCase()
            .includes('retro'),
      )
      .map((planet) => this.text(planet?.name))
      .filter(Boolean);

    const nakshatras = meaningful
      .map((planet) => this.text(planet?.nakshatra))
      .filter(Boolean);

    const summary: Array<[string, string]> = [
      ['Calculated points', String(meaningful.length)],
      [
        'Retrograde points',
        retrograde.length > 0 ? retrograde.join(', ') : 'None reported',
      ],
      ['Nakshatra records', String(nakshatras.length)],
      [
        'Precision policy',
        'Provider values preserved without invented positions',
      ],
    ];

    for (const [label, value] of summary) {
      this.ensureSpace(document, 24);

      document.fillColor('#7A5B08').fontSize(7.4).text(`${label}: `, {
        continued: true,
      });

      document.fillColor('#252A3A').fontSize(8.2).text(value, {
        lineGap: 1.5,
      });
    }

    document.moveDown(0.7);
  }
  private writePlanetaryPositions(
    document: PDFKit.PDFDocument,
    planets: Array<Record<string, any>>,
  ): void {
    if (planets.length === 0) {
      return;
    }

    this.ensureSpace(document, 190);
    this.sectionTitle(document, 'Planetary Positions');

    const left = 50;
    const right = 545;
    const tableWidth = right - left;

    const columns = [
      { label: 'Planet', x: 50, width: 72 },
      { label: 'Sign', x: 122, width: 76 },
      { label: 'House', x: 198, width: 47 },
      { label: 'Degree', x: 245, width: 65 },
      { label: 'Nakshatra', x: 310, width: 140 },
      { label: 'Motion', x: 450, width: 95 },
    ];

    const headerHeight = 24;
    const rowHeight = 27;

    const writeHeader = (): void => {
      if (document.y > 730) {
        document.addPage();
      }

      const y = document.y;

      document
        .save()
        .roundedRect(left, y, tableWidth, headerHeight, 4)
        .fill('#071936')
        .restore();

      document.fillColor('#FFF7E6').fontSize(7.8);

      for (const column of columns) {
        document.text(column.label.toUpperCase(), column.x + 5, y + 8, {
          width: column.width - 10,
          lineBreak: false,
        });
      }

      document.y = y + headerHeight;
    };

    writeHeader();

    for (let index = 0; index < planets.length; index += 1) {
      const planet = planets[index];

      if (document.y + rowHeight > 770) {
        document.addPage();
        writeHeader();
      }

      const rowY = document.y;

      if (index % 2 === 0) {
        document
          .save()
          .rect(left, rowY, tableWidth, rowHeight)
          .fill('#F7F3E8')
          .restore();
      }

      document
        .save()
        .rect(left, rowY, tableWidth, rowHeight)
        .lineWidth(0.35)
        .strokeColor('#DDD4BE')
        .stroke()
        .restore();

      const degree =
        planet?.degree_in_sign ?? planet?.degree ?? planet?.absolute_degree;

      const retrograde = planet?.is_retrograde ?? planet?.retrograde ?? false;

      const values = [
        this.text(planet?.name) || '-',
        this.text(planet?.sign) || '-',
        this.text(planet?.house) || '-',
        this.number(degree),
        this.text(planet?.nakshatra) || '-',
        retrograde ? 'Retrograde' : 'Direct',
      ];

      document.fillColor('#182038').fontSize(8);

      values.forEach((value, valueIndex) => {
        const column = columns[valueIndex];

        document.text(value, column.x + 5, rowY + 8, {
          width: column.width - 10,
          height: rowHeight - 8,
          ellipsis: true,
          lineBreak: false,
        });
      });

      document.y = rowY + rowHeight;
    }

    document.y += 12;
  }

  private writeDasha(
    document: PDFKit.PDFDocument,
    dasha: Record<string, any> | null,
  ): void {
    const timeline = Array.isArray(dasha?.timeline) ? dasha.timeline : [];

    if (timeline.length === 0) {
      return;
    }

    this.ensureSpace(document, 180);
    this.sectionTitle(document, 'Vimshottari Dasha Timeline');

    const left = 55;
    const width = 480;
    const rowHeight = 36;

    for (let index = 0; index < timeline.length; index += 1) {
      const period = timeline[index];

      if (document.y + rowHeight > 770) {
        document.addPage();
      }

      const rowY = document.y;

      document
        .save()
        .roundedRect(left, rowY, width, rowHeight - 4, 5)
        .fillAndStroke(index % 2 === 0 ? '#FBF7EA' : '#FFFFFF', '#E0D4AD')
        .restore();

      document
        .fillColor('#071936')
        .fontSize(9)
        .text(
          `${this.text(period?.lord) || 'Unknown'} ${
            this.text(period?.level) || 'Dasha'
          }`,
          left + 10,
          rowY + 7,
          {
            width: 150,
            lineBreak: false,
          },
        );

      document
        .fillColor('#5F6473')
        .fontSize(7.8)
        .text(this.text(period?.start) || '-', left + 170, rowY + 8, {
          width: 130,
          align: 'center',
          lineBreak: false,
        });

      document
        .fillColor('#B28B18')
        .fontSize(8)
        .text('->', left + 305, rowY + 8, {
          width: 25,
          align: 'center',
          lineBreak: false,
        });

      document
        .fillColor('#5F6473')
        .fontSize(7.8)
        .text(this.text(period?.end) || '-', left + 335, rowY + 8, {
          width: 130,
          align: 'center',
          lineBreak: false,
        });

      document.y = rowY + rowHeight;
    }

    document.y += 8;
  }

  private writeVedicDataSection(
    document: PDFKit.PDFDocument,
    title: string,
    data: unknown,
  ): void {
    if (data === null || data === undefined) {
      return;
    }

    if (Array.isArray(data) && data.length === 0) {
      return;
    }

    if (
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data as Record<string, unknown>).length === 0
    ) {
      return;
    }

    this.ensureSpace(document, 120);

    this.sectionTitle(document, title);

    this.writeVedicValue(document, data, 0);

    document.moveDown(0.8);
  }

  private writeVedicValue(
    document: PDFKit.PDFDocument,
    value: unknown,
    depth: number,
  ): void {
    if (value === null || value === undefined) {
      return;
    }

    if (depth > 4) {
      return;
    }

    const left = 55 + Math.min(depth, 3) * 12;

    const right = 535;

    const availableWidth = right - left;

    if (Array.isArray(value)) {
      for (const item of value.slice(0, 40)) {
        if (item === null || item === undefined) {
          continue;
        }

        if (typeof item === 'object' && !Array.isArray(item)) {
          this.writeVedicValue(document, item, depth + 1);

          continue;
        }

        this.ensureSpace(document, 26);

        const y = document.y;

        document.fillColor('#B28B18').fontSize(8).text('-', left, y, {
          width: 10,
        });

        document
          .fillColor('#252A3A')
          .fontSize(8.5)
          .text(this.text(item), left + 14, y, {
            width: availableWidth - 14,
            lineGap: 2,
          });

        document.y += 5;
      }

      return;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, item]) => item !== null && item !== undefined && item !== '',
      );

      const primitiveEntries = entries.filter(
        ([, item]) => typeof item !== 'object',
      );

      const complexEntries = entries.filter(
        ([, item]) => typeof item === 'object',
      );

      for (const [key, item] of primitiveEntries.slice(0, 60)) {
        this.ensureSpace(document, 32);

        const rowY = document.y;
        const rowHeight = Math.max(
          24,
          document.heightOfString(this.text(item), {
            width: availableWidth * 0.64 - 14,
            lineGap: 1.5,
          }) + 12,
        );

        if (rowY + rowHeight > 770) {
          document.addPage();
        }

        const y = document.y;

        document
          .save()
          .roundedRect(left, y, availableWidth, rowHeight, 4)
          .fillAndStroke('#FAF8F2', '#E8E0CF')
          .restore();

        const labelWidth = Math.min(150, availableWidth * 0.34);

        document
          .fillColor('#687083')
          .fontSize(7.5)
          .text(this.humanizeKey(key), left + 9, y + 8, {
            width: labelWidth - 12,
          });

        document
          .fillColor('#11182B')
          .fontSize(8.5)
          .text(this.text(item), left + labelWidth, y + 7, {
            width: availableWidth - labelWidth - 10,
            lineGap: 1.5,
          });

        document.y = y + rowHeight + 4;
      }

      for (const [key, item] of complexEntries.slice(0, 30)) {
        this.ensureSpace(document, 50);

        document.y += 4;

        const headingY = document.y;

        document
          .fillColor('#8B6508')
          .fontSize(8.5)
          .text(this.humanizeKey(key).toUpperCase(), left, headingY, {
            width: availableWidth,
            characterSpacing: 0.3,
          });

        document
          .strokeColor('#D9C37A')
          .lineWidth(0.5)
          .moveTo(left, headingY + 14)
          .lineTo(right, headingY + 14)
          .stroke();

        document.y = headingY + 20;

        this.writeVedicValue(document, item, depth + 1);

        document.y += 3;
      }

      return;
    }

    this.ensureSpace(document, 24);

    document.fillColor('#252A3A').fontSize(8.5).text(this.text(value), {
      width: availableWidth,
      lineGap: 2,
    });

    document.y += 3;
  }

  private writeTechnicalAppendix(
    document: PDFKit.PDFDocument,
    report: Record<string, any>,
  ): void {
    document.addPage();

    this.writeProfessionalSectionHeading(
      document,
      '11. Technical Appendix',
      'Audit-oriented reference for the calculation dataset used by this Kundli report.',
    );

    const items: Array<[string, string]> = [
      [
        'Provider',
        this.text(report?.provider) || 'Verified Vedic calculation engine',
      ],
      ['Report Status', this.text(report?.status) || 'Complete'],
      [
        'Core Completeness',
        this.text(report?.completeness?.corePercent)
          ? `${this.text(report?.completeness?.corePercent)}%`
          : 'Provider reported',
      ],
      [
        'Planetary Dataset',
        Array.isArray(report?.planetaryPositions)
          ? `${report.planetaryPositions.length} points`
          : 'Unavailable',
      ],
      [
        'Dasha Dataset',
        Array.isArray(report?.dasha?.timeline)
          ? `${report.dasha.timeline.length} timeline records`
          : 'Unavailable',
      ],
      [
        'Divisional Charts',
        report?.charts?.divisionalCharts &&
        typeof report.charts.divisionalCharts === 'object'
          ? Object.keys(report.charts.divisionalCharts).join(', ')
          : 'Unavailable',
      ],
      [
        'Data Integrity',
        'No unsupported astrology values are fabricated by the PDF renderer',
      ],
    ];

    this.keyValueGrid(document, items);

    document.moveDown(1);

    document
      .fillColor('#687083')
      .fontSize(7.8)
      .text(
        'This appendix is intended to help astrologers distinguish calculated data, provider-supplied advanced factors and interpretive text.',
        {
          lineGap: 2,
        },
      );
  }
  private writeProfessionalInterpretation(
    document: PDFKit.PDFDocument,
    analysis: Record<string, any>,
  ): void {
    if (!analysis || typeof analysis !== 'object') {
      return;
    }

    const sections: Array<[string, string]> = [
      ['Character & Temperament', 'character'],
      ['Career & Profession', 'career'],
      ['Finance & Resources', 'finance'],
      ['Marriage & Relationships', 'marriage'],
      ['Health Tendencies', 'health'],
    ];

    const available = sections.filter(
      ([, key]) => this.text(analysis?.[key]).length > 0,
    );

    const remedies = Array.isArray(analysis?.remedies) ? analysis.remedies : [];

    if (available.length === 0 && remedies.length === 0) {
      return;
    }

    document.addPage();

    this.writeProfessionalSectionHeading(
      document,
      '8. Interpretive Synthesis',
      'Interpretation grounded in the verified Kundli calculation. Calculated placements remain the authoritative technical data.',
    );

    for (const [title, key] of available) {
      this.ensureSpace(document, 90);

      this.sectionTitle(document, title);

      document
        .fillColor('#252A3A')
        .fontSize(8.7)
        .text(this.text(analysis[key]), {
          lineGap: 3,
          align: 'justify',
        });

      document.moveDown(1);
    }

    if (remedies.length > 0) {
      this.ensureSpace(document, 100);

      this.sectionTitle(document, 'Traditional Remedies / Reflection');

      for (const remedy of remedies) {
        const text = this.text(remedy);

        if (!text) {
          continue;
        }

        this.ensureSpace(document, 28);

        document
          .fillColor('#B58A12')
          .fontSize(8)
          .text('-', document.page.margins.left, document.y, {
            width: 10,
          });

        document
          .fillColor('#252A3A')
          .fontSize(8.5)
          .text(text, document.page.margins.left + 14, document.y - 8, {
            width:
              document.page.width -
              document.page.margins.left -
              document.page.margins.right -
              14,
            lineGap: 2,
          });

        document.y += 6;
      }
    }
  }
  private writeReportIndex(document: PDFKit.PDFDocument): void {
    this.writeProfessionalSectionHeading(
      document,
      'Report Index',
      'Professional Vedic Kundli sections included in this report.',
    );

    const sections = [
      '1. Technical Foundation',
      '2. Birth Details & Vedic Summary',
      '3. D1 Rashi Chart',
      '4. D9 Navamsa Chart',
      '5. Divisional Chart Atlas',
      '6. Planetary Positions & Technical Summary',
      '7. Vimshottari Dasha',
      '8. Panchang, Yogas, Dosha & Ashtakavarga',
      '9. Transit / Gochar',
      '10. Interpretive Synthesis',
      '11. Technical Appendix',
    ];

    const left = document.page.margins.left;

    for (let index = 0; index < sections.length; index += 1) {
      this.ensureSpace(document, 28);

      const y = document.y;

      document
        .fillColor('#7A5B08')
        .fontSize(8)
        .text(String(index + 1).padStart(2, '0'), left, y, {
          width: 28,
        });

      document
        .fillColor('#252A3A')
        .fontSize(8.6)
        .text(sections[index], left + 35, y, {
          width: 445,
          lineGap: 1.5,
        });

      document.y = y + 23;
    }

    document.moveDown(1);
  }
  private writeTechnicalReportIntroduction(
    document: PDFKit.PDFDocument,
    report: Record<string, any>,
  ): void {
    this.ensureSpace(document, 215);

    this.writeProfessionalSectionHeading(
      document,
      '1. Technical Foundation',
      'Core calculation settings and report scope used for this professional Vedic Kundli.',
    );

    const meta =
      report?.meta && typeof report.meta === 'object' ? report.meta : {};

    const rows: Array<[string, string]> = [
      [
        'Calculation Provider',
        this.text(report?.provider) || 'Verified Vedic calculation engine',
      ],
      ['Calculation Status', this.text(report?.status) || 'Complete'],
      [
        'Ayanamsa',
        this.text(meta?.ayanamsa ?? report?.ayanamsa) || 'Provider verified',
      ],
      ['Chart System', 'Sidereal Vedic Astrology'],
      ['Primary Charts', 'D1 Rashi and D9 Navamsa'],
      ['Dasha System', 'Vimshottari Dasha where available'],
    ];

    const left = document.page.margins.left;
    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    for (let index = 0; index < rows.length; index += 1) {
      this.ensureSpace(document, 31);

      const [label, value] = rows[index];
      const y = document.y;

      document
        .save()
        .roundedRect(left, y, width, 25, 4)
        .fillAndStroke(index % 2 === 0 ? '#FAF7EE' : '#FFFFFF', '#E5D9B8')
        .restore();

      document
        .fillColor('#7A5B08')
        .fontSize(7.4)
        .text(label.toUpperCase(), left + 9, y + 8, {
          width: 155,
          lineBreak: false,
        });

      document
        .fillColor('#11182B')
        .fontSize(8.4)
        .text(value, left + 168, y + 7, {
          width: width - 178,
          lineBreak: false,
          ellipsis: true,
        });

      document.y = y + 29;
    }

    document.moveDown(0.6);

    document
      .fillColor('#687083')
      .fontSize(7.7)
      .text(
        'Technical rule: this report renders only calculation data actually supplied by the Kundli engine. Unsupported or unavailable advanced factors are omitted rather than estimated.',
        {
          lineGap: 2,
        },
      );

    document.moveDown(1);
  }
  private writeProfessionalSectionHeading(
    document: PDFKit.PDFDocument,
    title: string,
    subtitle?: string,
  ): void {
    this.ensureSpace(document, subtitle ? 58 : 44);

    const left = document.page.margins.left;
    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const y = document.y;

    document
      .save()
      .roundedRect(left, y, width, subtitle ? 48 : 36, 7)
      .fillAndStroke('#F8F2DF', '#D9C37A')
      .restore();

    document
      .fillColor('#071936')
      .fontSize(12)
      .text(title, left + 14, y + 10, {
        width: width - 28,
      });

    if (subtitle) {
      document
        .fillColor('#687083')
        .fontSize(7.8)
        .text(subtitle, left + 14, y + 28, {
          width: width - 28,
          lineGap: 1,
        });
    }

    document.y = y + (subtitle ? 58 : 46);
  }
  private humanizeKey(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (character) => character.toUpperCase())
      .trim();
  }
  private drawCover(
    document: PDFKit.PDFDocument,
    input: GenerateSavedKundliPdfInput,
  ): void {
    const pageWidth = document.page.width;
    const pageHeight = document.page.height;

    document.save().rect(0, 0, pageWidth, pageHeight).fill('#071936').restore();

    document
      .save()
      .roundedRect(34, 34, pageWidth - 68, pageHeight - 68, 18)
      .lineWidth(1.4)
      .strokeColor('#D4AF37')
      .stroke()
      .restore();

    document.fillColor('#D4AF37').fontSize(13).text('ASTRO SOUL PATH', 0, 92, {
      align: 'center',
      width: pageWidth,
      characterSpacing: 2.2,
    });

    document
      .fillColor('#FFF7E6')
      .fontSize(28)
      .text('Professional Vedic Kundli', 50, 135, {
        align: 'center',
        width: pageWidth - 100,
      });

    document
      .fillColor('#E8D59A')
      .fontSize(11)
      .text('Traditional Vedic Astrology Report', 50, 178, {
        align: 'center',
        width: pageWidth - 100,
      });

    document
      .moveTo(130, 210)
      .lineTo(pageWidth - 130, 210)
      .strokeColor('#D4AF37')
      .lineWidth(0.8)
      .stroke();

    document
      .fillColor('#FFFFFF')
      .fontSize(23)
      .text(input.name, 60, 255, {
        align: 'center',
        width: pageWidth - 120,
      });

    document
      .fillColor('#D5D9E4')
      .fontSize(10)
      .text(`${input.dob}  |  ${input.tob}`, 60, 302, {
        align: 'center',
        width: pageWidth - 120,
      });

    document.text(input.birthPlace || 'Birth place unavailable', 60, 322, {
      align: 'center',
      width: pageWidth - 120,
    });

    document
      .roundedRect(92, 390, pageWidth - 184, 118, 14)
      .fillAndStroke('#0C2145', '#3F5680');

    document.fillColor('#D4AF37').fontSize(10).text('REPORT DETAILS', 112, 410);

    const rows: Array<[string, string]> = [
      ['Gender', input.gender],
      ['Coordinates', `${input.latitude}, ${input.longitude}`],
      ['Timezone', `UTC ${this.signed(input.timezone)}`],
      ['Language', input.lang.toUpperCase()],
    ];

    let y = 435;

    for (const [label, value] of rows) {
      document.fillColor('#AAB4C8').fontSize(8).text(label, 112, y, {
        width: 105,
      });

      document
        .fillColor('#FFFFFF')
        .fontSize(9)
        .text(value || '-', 225, y - 1, {
          width: 250,
        });

      y += 18;
    }

    document
      .fillColor('#B8C1D5')
      .fontSize(8)
      .text(
        `Generated ${new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`,
        70,
        pageHeight - 110,
        {
          align: 'center',
          width: pageWidth - 140,
        },
      );

    document.addPage();
  }

  private writeDivisionalChartAtlas(
    document: PDFKit.PDFDocument,
    report: Record<string, any>,
  ): void {
    const charts =
      report?.charts && typeof report.charts === 'object' ? report.charts : {};

    const source =
      charts?.divisionalCharts && typeof charts.divisionalCharts === 'object'
        ? charts.divisionalCharts
        : report?.divisionalCharts &&
            typeof report.divisionalCharts === 'object'
          ? report.divisionalCharts
          : {};

    const definitions: Array<[string, string]> = [
      ['D2', 'Hora - Wealth & Resources'],
      ['D3', 'Drekkana - Siblings & Courage'],
      ['D4', 'Chaturthamsa - Property & Fortune'],
      ['D7', 'Saptamsa - Children & Lineage'],
      ['D10', 'Dashamsa - Career & Profession'],
      ['D12', 'Dwadasamsa - Parents & Ancestry'],
      ['D16', 'Shodasamsa - Vehicles & Comforts'],
      ['D20', 'Vimsamsa - Spiritual Practice'],
      ['D24', 'Chaturvimsamsa - Education & Learning'],
      ['D27', 'Bhamsa - Strengths & Weaknesses'],
      ['D30', 'Trimsamsa - Challenges & Misfortunes'],
      ['D40', 'Khavedamsa - Auspicious Effects'],
      ['D45', 'Akshavedamsa - Character & Conduct'],
      ['D60', 'Shashtiamsa - Deep Karmic Indications'],
    ];

    const available: Array<{
      code: string;
      title: string;
      chart: Record<string, any>;
    }> = [];

    for (const [code, title] of definitions) {
      const raw = source?.[code];

      if (!raw || typeof raw !== 'object') {
        continue;
      }

      const candidate =
        raw?.chart && typeof raw.chart === 'object' && !Array.isArray(raw.chart)
          ? raw.chart
          : raw;

      const houses = Array.isArray(candidate?.houses) ? candidate.houses : [];

      const planets = Array.isArray(candidate?.planets)
        ? candidate.planets
        : [];

      /*
       * Do not manufacture a chart from incomplete/provider-placeholder
       * values. Render only a real structured chart.
       */
      if (houses.length === 0 && planets.length === 0) {
        continue;
      }

      available.push({
        code,
        title,
        chart: candidate,
      });
    }

    if (available.length === 0) {
      return;
    }

    document.addPage();

    this.writeProfessionalSectionHeading(
      document,
      'Divisional Chart Atlas',
      'Advanced Vargas available from the verified Kundli calculation response. Missing charts are intentionally omitted rather than fabricated.',
    );

    document
      .fillColor('#5F6473')
      .fontSize(8.5)
      .text(
        `${available.length} advanced divisional chart${
          available.length === 1 ? '' : 's'
        } available for this birth record.`,
        {
          lineGap: 2,
        },
      );

    document.moveDown(1);

    for (const item of available) {
      this.ensureSpace(document, 330);

      this.drawNorthIndianChart(
        document,
        `${item.code} - ${item.title}`,
        item.chart,
      );

      document.moveDown(0.5);
    }
  }
  private writeChartNotationGuide(document: PDFKit.PDFDocument): void {
    this.ensureSpace(document, 150);

    this.writeProfessionalSectionHeading(
      document,
      'Chart Notation Guide',
      'Reference used when reading the D1, D9 and divisional Vedic charts.',
    );

    const notes = [
      ['D1', 'Rashi / natal chart'],
      ['D9', 'Navamsa chart'],
      ['D10', 'Dashamsa - career and profession'],
      ['D7', 'Saptamsa - children and lineage'],
      ['D12', 'Dwadasamsa - parents and ancestry'],
      ['R', 'Retrograde status when supplied by provider'],
    ];

    for (const [code, meaning] of notes) {
      this.ensureSpace(document, 24);

      document.fillColor('#7A5B08').fontSize(8).text(code, {
        continued: true,
      });

      document.fillColor('#252A3A').fontSize(8.3).text(`  ${meaning}`, {
        lineGap: 1.5,
      });
    }

    document.moveDown(0.7);
  }
  private drawNorthIndianChart(
    document: PDFKit.PDFDocument,
    title: string,
    chart: Record<string, any> | null,
  ): void {
    if (!chart || typeof chart !== 'object') {
      return;
    }

    const houses = Array.isArray(chart.houses) ? chart.houses : [];
    const planets = Array.isArray(chart.planets) ? chart.planets : [];

    if (houses.length === 0) {
      return;
    }

    this.ensureSpace(document, 330);

    this.sectionTitle(document, title);

    const size = 285;
    const x = (document.page.width - size) / 2;
    const y = document.y + 8;
    const half = size / 2;

    document
      .save()
      .lineWidth(1)
      .strokeColor('#22355F')
      .rect(x, y, size, size)
      .stroke()
      .moveTo(x, y)
      .lineTo(x + size, y + size)
      .moveTo(x + size, y)
      .lineTo(x, y + size)
      .moveTo(x + half, y)
      .lineTo(x + size, y + half)
      .lineTo(x + half, y + size)
      .lineTo(x, y + half)
      .closePath()
      .stroke()
      .restore();

    const centers: Array<[number, number]> = [
      [x + half, y + 42],
      [x + size - 55, y + 55],
      [x + size - 42, y + half],
      [x + size - 55, y + size - 55],
      [x + half, y + size - 42],
      [x + 55, y + size - 55],
      [x + 42, y + half],
      [x + 55, y + 55],
      [x + half, y + 94],
      [x + size - 94, y + half],
      [x + half, y + size - 94],
      [x + 94, y + half],
    ];

    for (let index = 0; index < Math.min(12, houses.length); index += 1) {
      const house = houses[index];
      const [cx, cy] = centers[index];

      const houseNumber =
        typeof house?.house === 'number' ? house.house : index + 1;

      const sign = this.text(house?.sign) || this.text(house?.sign_name);

      const housePlanets = planets
        .filter(
          (planet: Record<string, any>) =>
            Number(planet?.house) === Number(houseNumber),
        )
        .map((planet: Record<string, any>) =>
          this.text(planet?.name ?? planet?.planet ?? planet?.planet_name),
        )
        .filter(Boolean)
        .slice(0, 4);

      document
        .fillColor('#B58A12')
        .fontSize(7)
        .text(String(houseNumber), cx - 28, cy - 18, {
          width: 56,
          align: 'center',
        });

      if (sign) {
        document
          .fillColor('#5F6473')
          .fontSize(6)
          .text(sign, cx - 38, cy - 7, {
            width: 76,
            align: 'center',
          });
      }

      if (housePlanets.length > 0) {
        document
          .fillColor('#0B1026')
          .fontSize(6.5)
          .text(housePlanets.join(', '), cx - 40, cy + 4, {
            width: 80,
            align: 'center',
          });
      }
    }

    document.y = y + size + 18;
  }

  private writeDashaReadingGuide(
    document: PDFKit.PDFDocument,
    dasha: Record<string, any> | null,
  ): void {
    const timeline = Array.isArray(dasha?.timeline) ? dasha.timeline : [];

    if (timeline.length === 0) {
      return;
    }

    this.ensureSpace(document, 125);

    document
      .save()
      .roundedRect(
        document.page.margins.left,
        document.y,
        document.page.width -
          document.page.margins.left -
          document.page.margins.right,
        94,
        6,
      )
      .fillAndStroke('#F8F2DF', '#D9C37A')
      .restore();

    const startY = document.y;

    document
      .fillColor('#7A5B08')
      .fontSize(8)
      .text(
        'DASHA READING GUIDE',
        document.page.margins.left + 12,
        startY + 11,
      );

    document
      .fillColor('#252A3A')
      .fontSize(8)
      .text(
        'Mahadasha describes the broader planetary period. Antardasha refines the active sub-period. Dates shown in this report come from the verified calculation dataset and should be interpreted together with the natal chart, divisional charts and current transit context.',
        document.page.margins.left + 12,
        startY + 29,
        {
          width:
            document.page.width -
            document.page.margins.left -
            document.page.margins.right -
            24,
          lineGap: 2,
        },
      );

    document.y = startY + 108;
  }
  private writeCurrentDashaSummary(
    document: PDFKit.PDFDocument,
    dasha: Record<string, any> | null,
  ): void {
    const current =
      dasha?.current && typeof dasha.current === 'object'
        ? dasha.current
        : null;

    if (!current) {
      return;
    }

    const maha =
      current.mahaDasha && typeof current.mahaDasha === 'object'
        ? current.mahaDasha
        : null;

    const antar =
      current.antarDasha && typeof current.antarDasha === 'object'
        ? current.antarDasha
        : null;

    if (!maha && !antar) {
      return;
    }

    this.ensureSpace(document, 125);

    this.sectionTitle(document, 'Current Vimshottari Period');

    const startY = document.y;

    document
      .roundedRect(50, startY, 497, 86, 10)
      .fillAndStroke('#FFF8E6', '#D4AF37');

    document
      .fillColor('#7A5B08')
      .fontSize(8)
      .text('CURRENT MAHADASHA', 66, startY + 14);

    document
      .fillColor('#0B1026')
      .fontSize(13)
      .text(this.text(maha?.lord) || 'Unavailable', 66, startY + 29);

    document
      .fillColor('#5F6473')
      .fontSize(7.5)
      .text(
        `${this.text(maha?.start) || '-'} to ${this.text(maha?.end) || '-'}`,
        66,
        startY + 48,
      );

    document
      .fillColor('#7A5B08')
      .fontSize(8)
      .text('CURRENT ANTARDASHA', 310, startY + 14);

    document
      .fillColor('#0B1026')
      .fontSize(13)
      .text(this.text(antar?.lord) || 'Unavailable', 310, startY + 29);

    document
      .fillColor('#5F6473')
      .fontSize(7.5)
      .text(
        `${this.text(antar?.start) || '-'} to ${this.text(antar?.end) || '-'}`,
        310,
        startY + 48,
      );

    document.y = startY + 102;
  }

  private writeFullDashaHierarchy(
    document: PDFKit.PDFDocument,
    dasha: Record<string, any> | null,
  ): void {
    const timeline = Array.isArray(dasha?.timeline) ? dasha.timeline : [];

    if (timeline.length === 0) {
      return;
    }

    this.sectionTitle(document, 'Vimshottari Dasha Timeline');

    for (const maha of timeline) {
      this.ensureSpace(document, 80);

      const y = document.y;

      document
        .roundedRect(50, y, 497, 46, 7)
        .fillAndStroke('#F5F0E2', '#C8A84B');

      document
        .fillColor('#0B1026')
        .fontSize(10)
        .text(`${this.text(maha?.lord) || 'Unknown'} Mahadasha`, 62, y + 10, {
          width: 220,
        });

      document
        .fillColor('#5F6473')
        .fontSize(7.5)
        .text(
          `${this.text(maha?.start) || '-'} to ${this.text(maha?.end) || '-'}`,
          300,
          y + 12,
          {
            width: 230,
            align: 'right',
          },
        );

      document.y = y + 56;

      const children = Array.isArray(maha?.children)
        ? maha.children
        : Array.isArray(maha?.subPeriods)
          ? maha.subPeriods
          : [];

      for (const antar of children) {
        this.ensureSpace(document, 28);

        document.fillColor('#B58A12').fontSize(7).text('-', 68, document.y);

        document
          .fillColor('#252A3A')
          .fontSize(8)
          .text(
            `${this.text(antar?.lord) || 'Unknown'} Antardasha`,
            82,
            document.y - 8,
            {
              width: 160,
            },
          );

        document
          .fillColor('#5F6473')
          .fontSize(7)
          .text(
            `${this.text(antar?.start) || '-'} to ${this.text(antar?.end) || '-'}`,
            245,
            document.y - 8,
            {
              width: 280,
              align: 'right',
            },
          );

        document.moveDown(0.65);
      }

      document.moveDown(0.4);
    }
  }
  private sectionTitle(document: PDFKit.PDFDocument, title: string): void {
    this.ensureSpace(document, 38);

    const y = document.y;

    document.roundedRect(48, y, 499, 28, 6).fillAndStroke('#F5F0E2', '#D4AF37');

    document
      .fillColor('#7A5B08')
      .fontSize(10)
      .text(title.toUpperCase(), 60, y + 8, {
        width: 475,
        characterSpacing: 0.6,
      });

    document.y = y + 38;
  }

  private keyValueGrid(
    document: PDFKit.PDFDocument,
    rows: Array<[string, string]>,
  ): void {
    for (const [label, value] of rows) {
      this.ensureSpace(document, 32);

      document.fillColor('#5F6473').fontSize(8).text(label, 55, document.y, {
        width: 125,
      });

      document
        .fillColor('#0B1026')
        .fontSize(9)
        .text(value, 185, document.y - 10, {
          width: 350,
        });

      document.moveDown(0.65);
    }

    document.moveDown(0.5);
  }

  private ensureSpace(
    document: PDFKit.PDFDocument,
    requiredHeight: number,
  ): void {
    if (document.y + requiredHeight > document.page.height - 60) {
      document.addPage();
    }
  }

  private writePageFooters(document: PDFKit.PDFDocument): void {
    const range = document.bufferedPageRange();

    for (
      let index = range.start;
      index < range.start + range.count;
      index += 1
    ) {
      document.switchToPage(index);

      const y = document.page.height - 38;

      document
        .strokeColor('#D4AF37')
        .lineWidth(0.5)
        .moveTo(48, y - 8)
        .lineTo(document.page.width - 48, y - 8)
        .stroke();

      document
        .fillColor('#7A7F8D')
        .fontSize(7)
        .text(
          `Astro Soul Path | Professional Vedic Kundli | Page ${index + 1}`,
          48,
          y,
          {
            align: 'center',
            width: document.page.width - 96,
          },
        );
    }
  }

  private text(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  private number(value: unknown): string {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return '-';
    }

    return numeric.toFixed(2);
  }

  private signed(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
  }
}
