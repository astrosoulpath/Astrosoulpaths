import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AstrologerKundliReportStatus } from '@prisma/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type TechnicalKundliForPdf = {
  savedRecordId: string;
  kundliId: string;
  name: string;
  gender: string;
  birthPlace: string;
  lang: string;
  dob: string;
  tob: string;
  latitude: number;
  longitude: number;
  timezone: number;
  report: Record<string, any>;
};
type ManualReportForPdf = {
  id: string;
  callSessionId: string;
  customerUserId: string;
  astrologerId: string;
  status: AstrologerKundliReportStatus;
  title: string | null;
  summary: string | null;
  character: string | null;
  career: string | null;
  marriage: string | null;
  finance: string | null;
  health: string | null;
  remedies: string | null;
  notes: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AstrologerKundliReportPdfService {
  private readonly logger = new Logger(AstrologerKundliReportPdfService.name);

  private readonly fontPath = join(
    process.cwd(),
    'assets',
    'fonts',
    'NotoSansDevanagari.ttf',
  );

  constructor(private readonly prisma: PrismaService) {}

  private async requireFinalAccessibleReport(
    reportId: string,
    authenticatedUserId: string,
  ): Promise<ManualReportForPdf> {
    const normalizedReportId = reportId?.trim();
    const normalizedUserId = authenticatedUserId?.trim();

    if (!normalizedReportId || !normalizedUserId) {
      throw new ForbiddenException('Authenticated report access is required.');
    }

    const report = await this.prisma.astrologerKundliReport.findUnique({
      where: {
        id: normalizedReportId,
      },
      select: {
        id: true,
        callSessionId: true,
        customerUserId: true,
        astrologerId: true,
        status: true,
        title: true,
        summary: true,
        character: true,
        career: true,
        marriage: true,
        finance: true,
        health: true,
        remedies: true,
        notes: true,
        finalizedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Professional Kundli report was not found.');
    }

    const ownsReport =
      report.customerUserId === normalizedUserId ||
      report.astrologerId === normalizedUserId;

    if (!ownsReport) {
      throw new ForbiddenException('You cannot access this Kundli report.');
    }

    if (report.status !== AstrologerKundliReportStatus.FINAL) {
      throw new ConflictException({
        success: false,
        code: 'KUNDLI_REPORT_NOT_FINAL',
        message:
          'PDF is available only after the professional Kundli report is finalized.',
      });
    }

    return report;
  }

  private async loadCustomerTechnicalKundli(
    customerUserId: string,
  ): Promise<TechnicalKundliForPdf | null> {
    const record = await this.prisma.kundliSavedRecord.findFirst({
      where: {
        customerUserId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        kundliId: true,
        name: true,
        gender: true,
        birthPlace: true,
        lang: true,
        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
            data: {
              select: {
                vedic: true,
              },
            },
          },
        },
      },
    });

    if (!record?.kundli?.data?.vedic) {
      return null;
    }

    const report =
      record.kundli.data.vedic && typeof record.kundli.data.vedic === 'object'
        ? (record.kundli.data.vedic as Record<string, any>)
        : null;

    if (!report) {
      return null;
    }

    return {
      savedRecordId: record.id,
      kundliId: record.kundliId,
      name: record.name,
      gender: record.gender?.toString() ?? 'NOT_SPECIFIED',
      birthPlace: record.birthPlace ?? 'Not available',
      lang: record.lang,
      dob: record.kundli.dob,
      tob: record.kundli.tob,
      latitude: record.kundli.latitude,
      longitude: record.kundli.longitude,
      timezone: record.kundli.timezone,
      report,
    };
  }
  async generateForAuthenticatedUser(params: {
    reportId: string;
    authenticatedUserId: string;
  }): Promise<Buffer> {
    const report = await this.requireFinalAccessibleReport(
      params.reportId,
      params.authenticatedUserId,
    );

    const technicalKundli = await this.loadCustomerTechnicalKundli(
      report.customerUserId,
    );

    if (!existsSync(this.fontPath)) {
      this.logger.error(`manual_kundli_pdf.font_missing path=${this.fontPath}`);

      throw new InternalServerErrorException({
        success: false,
        code: 'KUNDLI_PDF_FONT_MISSING',
        message: 'The professional Kundli PDF font is not configured.',
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
          Title: report.title?.trim() || 'Professional Kundli Report',
          Author: 'Astro Soul Path',
          Subject: 'Astrologer Professional Kundli Report',
          Keywords: 'Astro Soul Path, Kundli, Astrology, Professional Report',
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

      this.writeReport(document, report, technicalKundli);
      this.writePageFooters(document);

      document.end();

      const pdf = await completed;

      if (pdf.length === 0) {
        throw new Error('Generated professional Kundli PDF is empty.');
      }

      this.logger.log(
        `manual_kundli_pdf.generated reportId=${report.id} bytes=${pdf.length}`,
      );

      return pdf;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `manual_kundli_pdf.failed reportId=${report.id} reason=${message}`,
      );

      throw new InternalServerErrorException({
        success: false,
        code: 'MANUAL_KUNDLI_PDF_GENERATION_FAILED',
        message: 'Unable to generate the professional Kundli PDF.',
      });
    }
  }

  private writeReport(
    document: PDFKit.PDFDocument,
    report: ManualReportForPdf,
    technicalKundli: TechnicalKundliForPdf | null,
  ): void {
    this.writeProfessionalCover(document, report);

    document.addPage();

    this.writeReportIndex(document);

    if (technicalKundli) {
      this.writeTechnicalKundliFoundation(document, technicalKundli);
      this.writeAstrologerTechnicalAppendix(document, technicalKundli);
    }

    this.writeProfessionalHeading(
      document,
      'Professional Astrologer Interpretation',
      'Finalized guidance prepared by the astrologer for this consultation.',
    );

    this.writeSection(document, 'Overall Summary', report.summary);
    this.writeSection(document, 'Character & Personality', report.character);
    this.writeSection(document, 'Career & Profession', report.career);
    this.writeSection(document, 'Marriage & Relationships', report.marriage);
    this.writeSection(document, 'Finance & Resources', report.finance);
    this.writeSection(document, 'Health Tendencies', report.health);
    this.writeSection(document, 'Traditional Remedies', report.remedies);
    this.writeSection(document, 'Astrologer Notes', report.notes);

    this.ensureRoom(document, 85);

    document.moveDown(0.6);

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const y = document.y;

    document
      .save()
      .roundedRect(document.page.margins.left, y, width, 62, 6)
      .fillAndStroke('#F8F2DF', '#D9C37A')
      .restore();

    document
      .fillColor('#687083')
      .fontSize(7.7)
      .text(
        'This professional astrologer report is intended for personal guidance. Technical birth-chart calculations will be shown only when verified Kundli calculation data is available; no planetary or divisional-chart values are fabricated by this PDF renderer.',
        document.page.margins.left + 12,
        y + 12,
        {
          width: width - 24,
          lineGap: 2,
        },
      );

    document.y = y + 72;
  }

  private writeTechnicalKundliFoundation(
    document: PDFKit.PDFDocument,
    kundli: TechnicalKundliForPdf,
  ): void {
    document.addPage();

    this.writeProfessionalHeading(
      document,
      'Verified Technical Kundli',
      'Provider-backed birth-chart calculations linked to the customer consultation.',
    );

    this.writeProfessionalHeading(document, '1. Birth & Calculation Details');

    this.writeTechnicalKeyValueRows(document, [
      ['Name', kundli.name],
      ['Gender', kundli.gender],
      ['Date of Birth', kundli.dob],
      ['Time of Birth', kundli.tob],
      ['Birth Place', kundli.birthPlace],
      ['Latitude', String(kundli.latitude)],
      ['Longitude', String(kundli.longitude)],
      ['Timezone', `UTC ${this.signedNumber(kundli.timezone)}`],
      ['Language', kundli.lang.toUpperCase()],
      ['Kundli ID', kundli.kundliId],
    ]);

    const report = kundli.report;

    const planets = Array.isArray(report?.planetaryPositions)
      ? report.planetaryPositions
      : [];

    this.writeProfessionalHeading(
      document,
      '2. Planetary Positions',
      planets.length > 0
        ? `${planets.length} calculated planetary points available in the verified Kundli dataset.`
        : 'Planetary position data is not present in this saved Kundli response.',
    );

    if (planets.length > 0) {
      this.writePlanetaryRows(document, planets);
    }

    const d1 =
      report?.birthChart ??
      report?.charts?.birthChart ??
      report?.charts?.d1 ??
      report?.d1 ??
      null;

    const d9 =
      report?.navamsaChart ??
      report?.charts?.navamsaChart ??
      report?.charts?.d9 ??
      report?.d9 ??
      null;

    this.writeProfessionalHeading(
      document,
      '3. Core Vedic Charts',
      'D1 and D9 availability from the verified Kundli calculation response.',
    );

    this.drawProfessionalNorthIndianChart(
      document,
      'D1 - Rashi / Birth Chart',
      d1,
    );

    this.drawProfessionalNorthIndianChart(document, 'D9 - Navamsa Chart', d9);

    this.writeAdvancedVedicSections(document, report);

    document.moveDown(0.8);

    document
      .fillColor('#687083')
      .fontSize(7.6)
      .text(
        'Only stored provider-backed Kundli values are included in this section. Missing values are omitted rather than estimated or fabricated.',
        {
          lineGap: 2,
        },
      );
  }

  private writeAdvancedVedicSections(
    document: PDFKit.PDFDocument,
    report: Record<string, any>,
  ): void {
    const dasha =
      report?.vimshottariDasha ??
      report?.dasha ??
      report?.dashas ??
      report?.currentMahaDasha ??
      report?.extended?.vimshottariDasha ??
      null;

    const panchang =
      report?.panchang ??
      report?.panchanga ??
      report?.extended?.panchang ??
      null;

    const yogas =
      report?.yogas ?? report?.yoga ?? report?.extended?.yogas ?? null;

    const doshas =
      report?.doshas ?? report?.dosha ?? report?.extended?.doshas ?? null;

    const ashtakavarga =
      report?.ashtakavarga ??
      report?.ashtakaVarga ??
      report?.extended?.ashtakavarga ??
      null;

    const transit =
      report?.transit ??
      report?.gochar ??
      report?.transits ??
      report?.extended?.transit ??
      null;

    const charts =
      report?.charts && typeof report.charts === 'object' ? report.charts : {};

    const divisional =
      charts?.divisionalCharts ??
      report?.divisionalCharts ??
      report?.vargas ??
      report?.extended?.divisionalCharts ??
      null;

    document.addPage();

    this.writeProfessionalHeading(
      document,
      '4. Advanced Vedic Analysis',
      'Advanced technical sections available from the linked verified Kundli calculation.',
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.1 Vimshottari Dasha',
      'Mahadasha / Antardasha timing data from the stored Kundli calculation.',
      dasha,
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.2 Panchang',
      'Tithi, Nakshatra, Yoga, Karana and related Panchang factors when supplied by the calculation engine.',
      panchang,
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.3 Yogas',
      'Calculated Vedic Yoga combinations present in the verified report.',
      yogas,
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.4 Dosha Analysis',
      'Calculated Dosha indicators supplied by the verified Kundli report.',
      doshas,
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.5 Ashtakavarga',
      'Ashtakavarga technical values from the stored calculation response.',
      ashtakavarga,
    );

    this.writeAdvancedDatasetSection(
      document,
      '4.6 Transit / Gochar',
      'Transit information available in the verified Kundli calculation dataset.',
      transit,
    );

    this.writeDivisionalChartDataAtlas(document, divisional);
  }

  private writeAdvancedDatasetSection(
    document: PDFKit.PDFDocument,
    title: string,
    subtitle: string,
    value: unknown,
  ): void {
    if (!this.hasTechnicalValue(value)) {
      return;
    }

    this.ensureRoom(document, 90);

    this.writeProfessionalHeading(document, title, subtitle);

    this.writeStructuredTechnicalValue(document, value, 0, 32);

    document.moveDown(0.8);
  }

  private writeDivisionalChartDataAtlas(
    document: PDFKit.PDFDocument,
    source: unknown,
  ): void {
    if (!this.hasTechnicalValue(source)) {
      return;
    }

    document.addPage();

    this.writeProfessionalHeading(
      document,
      '5. Divisional Chart / Varga Atlas',
      'Advanced divisional-chart calculation data available from the verified Kundli response.',
    );

    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const entries = Object.entries(source as Record<string, unknown>);

      for (const [chartName, chartData] of entries) {
        if (!this.hasTechnicalValue(chartData)) {
          continue;
        }

        this.ensureRoom(document, 90);

        const normalizedName = chartName
          .replace(/[_-]+/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        this.writeTechnicalSubheading(document, normalizedName);

        this.writeStructuredTechnicalValue(document, chartData, 0, 18);

        document.moveDown(0.6);
      }

      return;
    }

    this.writeStructuredTechnicalValue(document, source, 0, 30);
  }

  private writeStructuredTechnicalValue(
    document: PDFKit.PDFDocument,
    value: unknown,
    depth = 0,
    maxItems = 30,
  ): void {
    if (value === null || value === undefined) {
      return;
    }

    if (depth > 3) {
      const text = this.compactTechnicalText(value);

      if (text) {
        this.writeTechnicalTextLine(document, text);
      }

      return;
    }

    if (Array.isArray(value)) {
      const limited = value.slice(0, maxItems);

      for (let index = 0; index < limited.length; index += 1) {
        const item = limited[index];

        if (item !== null && typeof item === 'object') {
          this.ensureRoom(document, 45);

          this.writeTechnicalSubheading(document, `Entry ${index + 1}`);

          this.writeStructuredTechnicalValue(
            document,
            item,
            depth + 1,
            Math.min(maxItems, 18),
          );
        } else {
          const text = this.compactTechnicalText(item);

          if (text) {
            this.writeTechnicalTextLine(document, `${index + 1}. ${text}`);
          }
        }
      }

      if (value.length > limited.length) {
        this.writeTechnicalTextLine(
          document,
          `Additional ${value.length - limited.length} calculated entries are present in the source dataset.`,
        );
      }

      return;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => this.hasTechnicalValue(entryValue))
        .slice(0, maxItems);

      for (const [key, entryValue] of entries) {
        const label = key
          .replace(/[_-]+/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        if (entryValue !== null && typeof entryValue === 'object') {
          this.ensureRoom(document, 42);

          this.writeTechnicalSubheading(document, label);

          this.writeStructuredTechnicalValue(
            document,
            entryValue,
            depth + 1,
            Math.min(maxItems, 15),
          );
        } else {
          const text = this.compactTechnicalText(entryValue);

          if (text) {
            this.writeTechnicalKeyValueLine(document, label, text);
          }
        }
      }

      return;
    }

    const text = this.compactTechnicalText(value);

    if (text) {
      this.writeTechnicalTextLine(document, text);
    }
  }

  private writeTechnicalSubheading(
    document: PDFKit.PDFDocument,
    title: string,
  ): void {
    this.ensureRoom(document, 32);

    document.fillColor('#B58A12').fontSize(8.8).text(title, {
      lineGap: 1,
    });

    document.moveDown(0.35);
  }

  private writeTechnicalKeyValueLine(
    document: PDFKit.PDFDocument,
    label: string,
    value: string,
  ): void {
    this.ensureRoom(document, 30);

    const left = document.page.margins.left;

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const valueHeight = document.heightOfString(value, {
      width: width - 165,
      lineGap: 1.5,
    });

    const rowHeight = Math.max(25, valueHeight + 14);

    this.ensureRoom(document, rowHeight + 6);

    const y = document.y;

    document
      .save()
      .roundedRect(left, y, width, rowHeight, 4)
      .fillAndStroke('#FAF8F2', '#E8E0CF')
      .restore();

    document
      .fillColor('#687083')
      .fontSize(7.1)
      .text(label.toUpperCase(), left + 9, y + 8, {
        width: 140,
      });

    document
      .fillColor('#252A3A')
      .fontSize(7.8)
      .text(value, left + 155, y + 8, {
        width: width - 165,
        lineGap: 1.5,
      });

    document.y = y + rowHeight + 6;
  }

  private writeTechnicalTextLine(
    document: PDFKit.PDFDocument,
    text: string,
  ): void {
    if (!text.trim()) {
      return;
    }

    this.ensureRoom(document, 28);

    document.fillColor('#252A3A').fontSize(7.8).text(text, {
      lineGap: 2,
    });

    document.moveDown(0.35);
  }

  private compactTechnicalText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    try {
      const json = JSON.stringify(value);

      if (json.length <= 260) {
        return json;
      }

      return `${json.slice(0, 257)}...`;
    } catch {
      return String(value);
    }
  }

  private hasTechnicalValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
  }
  private writeTechnicalKeyValueRows(
    document: PDFKit.PDFDocument,
    items: Array<[string, string]>,
  ): void {
    const left = document.page.margins.left;

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    for (const [label, value] of items) {
      this.ensureRoom(document, 30);

      const y = document.y;

      document
        .save()
        .roundedRect(left, y, width, 25, 4)
        .fillAndStroke('#FAF8F2', '#E8E0CF')
        .restore();

      document
        .fillColor('#687083')
        .fontSize(7.4)
        .text(label.toUpperCase(), left + 9, y + 8, {
          width: 130,
        });

      document
        .fillColor('#252A3A')
        .fontSize(8.2)
        .text(value || 'Not available', left + 145, y + 8, {
          width: width - 155,
        });

      document.y = y + 31;
    }

    document.moveDown(0.5);
  }

  private writePlanetaryRows(
    document: PDFKit.PDFDocument,
    planets: Array<Record<string, any>>,
  ): void {
    const left = document.page.margins.left;

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    for (const planet of planets) {
      this.ensureRoom(document, 38);

      const name = this.anyText(planet?.name, planet?.planet, 'Unknown');

      const sign = this.anyText(planet?.sign, planet?.rashi, planet?.signName);

      const degree = this.anyText(
        planet?.degree,
        planet?.longitude,
        planet?.fullDegree,
      );

      const house = this.anyText(planet?.house, planet?.houseNumber);

      const nakshatra = this.anyText(planet?.nakshatra, planet?.nakshatraName);

      const values = [
        sign ? `Sign: ${sign}` : '',
        degree ? `Degree: ${degree}` : '',
        house ? `House: ${house}` : '',
        nakshatra ? `Nakshatra: ${nakshatra}` : '',
      ].filter(Boolean);

      const y = document.y;

      document
        .save()
        .roundedRect(left, y, width, 31, 4)
        .fillAndStroke('#FFFFFF', '#E2D5AD')
        .restore();

      document
        .fillColor('#B58A12')
        .fontSize(8.5)
        .text(name, left + 9, y + 7, {
          width: 100,
        });

      document
        .fillColor('#252A3A')
        .fontSize(7.5)
        .text(
          values.length > 0 ? values.join(' | ') : 'Calculated point available',
          left + 115,
          y + 7,
          {
            width: width - 125,
          },
        );

      document.y = y + 37;
    }
  }

  private drawProfessionalNorthIndianChart(
    document: PDFKit.PDFDocument,
    title: string,
    chart: Record<string, any> | null,
  ): void {
    if (!chart || typeof chart !== 'object') {
      this.writeChartAvailabilityCard(document, title, chart);

      return;
    }

    const houses = Array.isArray(chart?.houses) ? chart.houses : [];

    const planets = Array.isArray(chart?.planets) ? chart.planets : [];

    if (houses.length === 0) {
      this.writeChartAvailabilityCard(document, title, chart);

      return;
    }

    this.ensureRoom(document, 345);

    this.writeProfessionalHeading(
      document,
      title,
      'North Indian Vedic chart rendered from the verified linked Kundli dataset.',
    );

    const size = 280;
    const x = (document.page.width - size) / 2;
    const y = document.y + 6;
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
      [x + half, y + 40],
      [x + size - 54, y + 54],
      [x + size - 40, y + half],
      [x + size - 54, y + size - 54],
      [x + half, y + size - 40],
      [x + 54, y + size - 54],
      [x + 40, y + half],
      [x + 54, y + 54],
      [x + half, y + 91],
      [x + size - 91, y + half],
      [x + half, y + size - 91],
      [x + 91, y + half],
    ];

    for (let index = 0; index < Math.min(12, houses.length); index += 1) {
      const house = houses[index] ?? {};

      const houseNumber =
        typeof house?.house === 'number' ? house.house : index + 1;

      const sign = this.anyText(house?.sign, house?.signName, house?.rashi);

      const housePlanets = planets
        .filter((planet: Record<string, any>) => {
          const planetHouse = planet?.house ?? planet?.houseNumber;

          return Number(planetHouse) === Number(houseNumber);
        })
        .map((planet: Record<string, any>) =>
          this.anyText(planet?.shortName, planet?.name, planet?.planet),
        )
        .filter(Boolean)
        .join(', ');

      const [cx, cy] = centers[index];

      document
        .fillColor('#B58A12')
        .fontSize(7)
        .text(String(houseNumber), cx - 25, cy - 18, {
          width: 50,
          align: 'center',
        });

      if (sign) {
        document
          .fillColor('#687083')
          .fontSize(6)
          .text(sign, cx - 37, cy - 7, {
            width: 74,
            align: 'center',
          });
      }

      if (housePlanets) {
        document
          .fillColor('#071936')
          .fontSize(6.2)
          .text(housePlanets, cx - 43, cy + 5, {
            width: 86,
            align: 'center',
            lineGap: 1,
          });
      }
    }

    document.y = y + size + 20;
  }
  private writeChartAvailabilityCard(
    document: PDFKit.PDFDocument,
    title: string,
    chart: unknown,
  ): void {
    this.ensureRoom(document, 58);

    const left = document.page.margins.left;

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const available =
      chart !== null &&
      chart !== undefined &&
      (typeof chart !== 'object' ||
        Object.keys(chart as Record<string, any>).length > 0);

    const y = document.y;

    document
      .save()
      .roundedRect(left, y, width, 48, 5)
      .fillAndStroke(
        available ? '#F8F2DF' : '#F7F7F7',
        available ? '#D9C37A' : '#D8D8D8',
      )
      .restore();

    document
      .fillColor(available ? '#071936' : '#687083')
      .fontSize(9)
      .text(title, left + 12, y + 9, {
        width: width - 24,
      });

    document
      .fillColor('#687083')
      .fontSize(7.5)
      .text(
        available
          ? 'Verified chart data is present in the linked Kundli calculation.'
          : 'This chart is not present in the linked saved Kundli response.',
        left + 12,
        y + 27,
        {
          width: width - 24,
        },
      );

    document.y = y + 58;
  }

  private anyText(...values: unknown[]): string {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }

      const text =
        typeof value === 'string' ? value.trim() : String(value).trim();

      if (text) {
        return text;
      }
    }

    return '';
  }

  private signedNumber(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
  }
  private writeAstrologerTechnicalAppendix(
    document: PDFKit.PDFDocument,
    kundli: TechnicalKundliForPdf,
  ): void {
    document.addPage();

    this.writeProfessionalHeading(
      document,
      'Technical Appendix',
      'Audit reference for the verified customer-linked Kundli dataset used in this astrologer report.',
    );

    this.writeTechnicalKeyValueRows(document, [
      ['Saved Record ID', kundli.savedRecordId],
      ['Kundli ID', kundli.kundliId],
      ['Calculation Language', kundli.lang],
      ['Birth Coordinates', `${kundli.latitude}, ${kundli.longitude}`],
      ['Timezone', `UTC ${this.signedNumber(kundli.timezone)}`],
      ['Data Policy', 'Stored verified Kundli data only'],
      ['Fabricated Astrology Values', 'None'],
      ['Provider Recalculation During PDF Download', 'None'],
    ]);

    document.moveDown(0.8);

    document
      .fillColor('#687083')
      .fontSize(7.7)
      .text(
        'Astrologer interpretations and technical calculation data are intentionally separated. The calculation dataset remains the authoritative source for planetary placements, charts, Dashas and other technical Vedic values.',
        {
          lineGap: 2,
          align: 'justify',
        },
      );
  }
  private writeProfessionalCover(
    document: PDFKit.PDFDocument,
    report: ManualReportForPdf,
  ): void {
    const pageWidth = document.page.width;
    const pageHeight = document.page.height;

    // Premium Kundli cover background.
    // Customer/report-specific text is rendered dynamically below.
    const coverImagePath = join(
      process.cwd(),
      'assets',
      'kundli',
      'kundli-premium-cover-bg.png',
    );

    if (existsSync(coverImagePath)) {
      document.image(coverImagePath, 0, 0, {
        width: pageWidth,
        height: pageHeight,
      });
} else {
      document
        .save()
        .rect(0, 0, pageWidth, pageHeight)
        .fill('#071936')
        .restore();
    }

    document
      .save()
      .roundedRect(34, 34, pageWidth - 68, pageHeight - 68, 16)
      .lineWidth(1.4)
      .strokeColor('#D4AF37')
      .stroke()
      .restore();

    document
      .fillColor('#D4AF37')
      .fontSize(11)
      .text('ASTRO SOUL PATH', 70, 105, {
        width: pageWidth - 140,
        align: 'center',
      });

    document
      .fillColor('#FFF7E6')
      .fontSize(24)
      .text(
        this.clean(report.title, 'Professional Vedic Kundli Report'),
        70,
        125,
        {
          width: pageWidth - 140,
          align: 'center',
          lineGap: 4,
        },
      );

    document
      .fillColor('#D4AF37')
      .fontSize(9)
      .text('ASTROLOGER PREPARED REPORT', 70, 205, {
        width: pageWidth - 140,
        align: 'center',
      });

    const finalizedText = report.finalizedAt
      ? report.finalizedAt.toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Finalized';

    // Premium bottom information bar.
    // Values below remain dynamic for every generated Kundli.
    const infoBarX = 58;
    const infoBarY = pageHeight - 155;
    const infoBarWidth = pageWidth - 116;
    const infoBarHeight = 72;
    const columnWidth = infoBarWidth / 3;

    document
      .save()
      .roundedRect(infoBarX, infoBarY, infoBarWidth, infoBarHeight, 10)
      .fillOpacity(0.88)
      .fillAndStroke('#160A38', '#D4AF37')
      .fillOpacity(1)
      .restore();

    document
      .save()
      .moveTo(infoBarX + columnWidth, infoBarY + 13)
      .lineTo(infoBarX + columnWidth, infoBarY + infoBarHeight - 13)
      .moveTo(infoBarX + columnWidth * 2, infoBarY + 13)
      .lineTo(infoBarX + columnWidth * 2, infoBarY + infoBarHeight - 13)
      .strokeColor('#D4AF37')
      .lineWidth(0.5)
      .stroke()
      .restore();

    document
      .fillColor('#D4AF37')
      .fontSize(6.5)
      .text('FINALIZED DATE', infoBarX, infoBarY + 15, {
        width: columnWidth,
        align: 'center',
      })
      .text('REPORT ID', infoBarX + columnWidth, infoBarY + 15, {
        width: columnWidth,
        align: 'center',
      })
      .text('CONSULTATION ID', infoBarX + columnWidth * 2, infoBarY + 15, {
        width: columnWidth,
        align: 'center',
      });

    document
      .fillColor('#FFF7E6')
      .fontSize(6)
      .text(finalizedText, infoBarX + 6, infoBarY + 37, {
        width: columnWidth - 12,
        align: 'center',
      })
      .text(report.id, infoBarX + columnWidth + 6, infoBarY + 37, {
        width: columnWidth - 12,
        align: 'center',
      })
      .text(report.callSessionId, infoBarX + columnWidth * 2 + 6, infoBarY + 37, {
        width: columnWidth - 12,
        align: 'center',
      });
    document
      .fillColor('#8E9BB3')
      .fontSize(7)
      .text(
        'Prepared through the Astro Soul Path professional astrologer workflow',
        70,
        pageHeight - 105,
        {
          width: pageWidth - 140,
          align: 'center',
        },
      );
  }

  private writeReportIndex(document: PDFKit.PDFDocument): void {
    this.writeProfessionalHeading(
      document,
      'Report Index',
      'Sections included in this astrologer-prepared professional Kundli report.',
    );

    const sections = [
      'Professional Astrologer Interpretation',
      'Overall Summary',
      'Character & Personality',
      'Career & Profession',
      'Marriage & Relationships',
      'Finance & Resources',
      'Health Tendencies',
      'Traditional Remedies',
      'Astrologer Notes',
      'Verified Technical Kundli',
      'Birth & Calculation Details',
      'Planetary Positions',
      'D1 Rashi / Birth Chart',
      'D9 Navamsa Chart',
      'Vimshottari Dasha',
      'Panchang',
      'Yogas',
      'Dosha Analysis',
      'Ashtakavarga',
      'Transit / Gochar',
      'Divisional Chart / Varga Atlas',
    ];

    for (let index = 0; index < sections.length; index += 1) {
      this.ensureRoom(document, 27);

      const y = document.y;

      document
        .fillColor('#B58A12')
        .fontSize(8)
        .text(
          String(index + 1).padStart(2, '0'),
          document.page.margins.left,
          y,
          {
            width: 28,
          },
        );

      document
        .fillColor('#252A3A')
        .fontSize(8.6)
        .text(sections[index], document.page.margins.left + 36, y, {
          width: 430,
        });

      document.y = y + 23;
    }

    document.moveDown(1.2);
  }

  private writeProfessionalHeading(
    document: PDFKit.PDFDocument,
    title: string,
    subtitle?: string,
  ): void {
    this.ensureRoom(document, subtitle ? 58 : 44);

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
  private writeSection(
    document: PDFKit.PDFDocument,
    title: string,
    value: string | null,
  ): void {
    const body = this.clean(value);

    if (!body) {
      return;
    }

    // Keep the section heading with the first few lines of content.
    // The body itself is allowed to flow naturally onto the next page.
    this.ensureRoom(document, 65);

    const left = document.page.margins.left;

    const width =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;

    const titleY = document.y;

    document.fillColor('#B58A12').fontSize(10.5).text(title, left, titleY, {
      width,
    });

    document.y = titleY + 22;

    document
      .save()
      .moveTo(left, document.y)
      .lineTo(left + width, document.y)
      .strokeColor('#E2D5AD')
      .lineWidth(0.6)
      .stroke()
      .restore();

    document.y += 10;

    document.fillColor('#252A3A').fontSize(8.8).text(body, {
      width,
      lineGap: 3,
      align: 'justify',
    });

    document.moveDown(1.1);
  }

  private ensureRoom(
    document: PDFKit.PDFDocument,
    requiredHeight: number,
  ): void {
    const bottom = document.page.height - document.page.margins.bottom;

    if (document.y + requiredHeight > bottom) {
      document.addPage();
      document.font('AspUnicode');
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

      const footerY = document.page.height - document.page.margins.bottom + 18;

      document
        .fillColor('#98A2B3')
        .fontSize(7)
        .text(
          `Astro Soul Path | Professional Kundli | Page ${index - range.start + 1} of ${range.count}`,
          document.page.margins.left,
          footerY,
          {
            width:
              document.page.width -
              document.page.margins.left -
              document.page.margins.right,
            align: 'center',
          },
        );
    }
  }

  private clean(value: string | null | undefined, fallback = ''): string {
    const cleaned = value
      ?.replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .trim();

    return cleaned || fallback;
  }
}






