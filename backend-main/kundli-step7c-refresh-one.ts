import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './src/app.module';
import { PrismaService } from './src/infrastructure/prisma/prisma.service';
import { KundliService } from './src/module/kundli/kundli.service';

const TARGET_KUNDLI_DATA_ID = 'cmswxankj0002v17kjzwpoa1m';

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function isProfessionalComplete(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const planets = Array.isArray(value.planetaryPositions)
    ? value.planetaryPositions
    : [];

  const timeline = Array.isArray(value?.dasha?.timeline)
    ? value.dasha.timeline
    : [];

  return (
    value.provider === 'vedicastro' &&
    value.status === 'COMPLETE' &&
    hasValue(value.birthChart) &&
    hasValue(value.navamsaChart) &&
    planets.length >= 9 &&
    timeline.length > 0 &&
    hasValue(value.panchang) &&
    hasValue(value.yogas) &&
    hasValue(value.dosha) &&
    hasValue(value.shadbala) &&
    hasValue(value.ashtakavarga)
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const kundliService = app.get(KundliService);

    const row = await prisma.kundliData.findUnique({
      where: {
        id: TARGET_KUNDLI_DATA_ID,
      },
      include: {
        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
          },
        },
      },
    });

    if (!row) {
      throw new Error(`Target KundliData not found: ${TARGET_KUNDLI_DATA_ID}`);
    }

    console.log('\n==============================================');
    console.log('TARGET BEFORE REFRESH');
    console.log('==============================================');

    console.log({
      id: row.id,
      kundliId: row.kundliId,
      provider: (row.vedic as any)?.provider ?? null,
      status: (row.vedic as any)?.status ?? null,
      professionalComplete: isProfessionalComplete(row.vedic),
    });

    if (isProfessionalComplete(row.vedic)) {
      console.log(
        'Target is already professional-complete. No provider call needed.',
      );
      return;
    }

    const params = {
      dob: row.kundli.dob,
      tob: row.kundli.tob,
      lat: Number(row.kundli.latitude),
      lon: Number(row.kundli.longitude),
      timezone: Number(row.kundli.timezone),
      lang: row.lang,
    };

    console.log('\nRefreshing only target record...');

    const generated = await kundliService.generateReport(params, row.lang);

    const report = generated.report as any;

    console.log('\n==============================================');
    console.log('TARGET AFTER REFRESH');
    console.log('==============================================');

    console.log({
      source: generated.source,
      provider: report?.provider ?? null,
      status: report?.status ?? null,

      planets: Array.isArray(report?.planetaryPositions)
        ? report.planetaryPositions.length
        : 0,

      dashaPeriods: Array.isArray(report?.dasha?.timeline)
        ? report.dasha.timeline.length
        : 0,

      birthChart: hasValue(report?.birthChart),
      navamsa: hasValue(report?.navamsaChart),
      panchang: hasValue(report?.panchang),
      yogas: hasValue(report?.yogas),
      dosha: hasValue(report?.dosha),
      shadbala: hasValue(report?.shadbala),
      ashtakavarga: hasValue(report?.ashtakavarga),

      professionalComplete: isProfessionalComplete(report),
    });

    if (!isProfessionalComplete(report)) {
      throw new Error(
        'Target report still fails professional completeness after regeneration.',
      );
    }

    console.log('\nSTEP 7C TARGET RESULT = PASS');

    // ========================================================
    // FINAL 6/6 CHECK
    // ========================================================

    const rows = await prisma.kundliData.findMany({
      select: {
        id: true,
        vedic: true,
      },
    });

    const good = rows.filter((item) => isProfessionalComplete(item.vedic));

    const bad = rows.filter((item) => !isProfessionalComplete(item.vedic));

    console.log('\n==============================================');
    console.log('FINAL DATABASE SUMMARY');
    console.log('==============================================');

    console.log({
      total: rows.length,
      professionalComplete: good.length,
      staleOrPartial: bad.length,
    });

    if (bad.length === 0) {
      console.log('STEP 7 FINAL RESULT = PASS: ALL KUNDLIS PROFESSIONAL VEDIC');
    } else {
      console.log('STEP 7 FINAL RESULT = NOT COMPLETE');

      console.log(bad.map((item) => item.id));

      process.exitCode = 2;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nSTEP 7C FAILED');

  console.error(error instanceof Error ? error.stack : error);

  process.exitCode = 1;
});
