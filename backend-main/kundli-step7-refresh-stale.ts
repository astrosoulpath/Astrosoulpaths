import 'reflect-metadata';

import * as fs from 'node:fs';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './src/app.module';
import { PrismaService } from './src/infrastructure/prisma/prisma.service';
import { KundliService } from './src/module/kundli/kundli.service';

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
    Boolean(value.birthChart) &&
    Boolean(value.navamsaChart) &&
    planets.length >= 9 &&
    timeline.length > 0 &&
    Boolean(value.panchang) &&
    value.yogas !== null &&
    value.yogas !== undefined &&
    value.dosha !== null &&
    value.dosha !== undefined &&
    value.shadbala !== null &&
    value.shadbala !== undefined &&
    value.ashtakavarga !== null &&
    value.ashtakavarga !== undefined
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const kundliService = app.get(KundliService);

    // ========================================================
    // 1. LOAD ALL EXISTING KUNDLI DATA WITH MASTER BIRTH DATA
    // ========================================================

    const rows = await prisma.kundliData.findMany({
      include: {
        kundli: {
          select: {
            id: true,
            dob: true,
            tob: true,
            latitude: true,
            longitude: true,
            timezone: true,
            hash: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    const stale = rows.filter((row) => !isProfessionalComplete(row.vedic));

    console.log('\n==============================================');
    console.log('HISTORICAL KUNDLI MIGRATION');
    console.log('==============================================');

    console.log({
      totalRows: rows.length,
      staleRows: stale.length,
      alreadyProfessional: rows.length - stale.length,
    });

    // ========================================================
    // 2. BACKUP STALE DATA LOCALLY BEFORE DATABASE CHANGES
    // ========================================================

    const backupFile =
      './kundli-step7-stale-backup-' +
      new Date().toISOString().replace(/[:.]/g, '-') +
      '.json';

    fs.writeFileSync(
      backupFile,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          count: stale.length,
          rows: stale,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`BACKUP = ${backupFile}`);

    if (stale.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    // ========================================================
    // 3. REGENERATE EACH STALE RECORD THROUGH CURRENT
    //    PRODUCTION KUNDLI SERVICE
    //
    //    This ensures:
    //    Vedic provider -> strict completeness -> OpenAI
    // ========================================================

    const results: Array<Record<string, unknown>> = [];

    for (const row of stale) {
      console.log('\n----------------------------------------------');
      console.log(`Refreshing KundliData: ${row.id}`);
      console.log(`Master Kundli: ${row.kundliId}`);
      console.log(`Old provider: ${(row.vedic as any)?.provider ?? 'unknown'}`);
      console.log(`Old status: ${(row.vedic as any)?.status ?? 'unknown'}`);
      console.log('----------------------------------------------');

      try {
        const params = {
          dob: row.kundli.dob,
          tob: row.kundli.tob,
          lat: Number(row.kundli.latitude),
          lon: Number(row.kundli.longitude),
          timezone: Number(row.kundli.timezone),
          lang: row.lang,
        };

        const generated = await kundliService.generateReport(params, row.lang);

        const report = generated.report as any;

        const pass = isProfessionalComplete(report);

        console.log({
          source: generated.source,
          provider: report?.provider ?? null,
          status: report?.status ?? null,

          birthChart: Boolean(report?.birthChart),
          navamsaChart: Boolean(report?.navamsaChart),

          planets: Array.isArray(report?.planetaryPositions)
            ? report.planetaryPositions.length
            : 0,

          dashaPeriods: Array.isArray(report?.dasha?.timeline)
            ? report.dasha.timeline.length
            : 0,

          panchang: Boolean(report?.panchang),
          yogas: report?.yogas !== null && report?.yogas !== undefined,

          dosha: report?.dosha !== null && report?.dosha !== undefined,

          shadbala: report?.shadbala !== null && report?.shadbala !== undefined,

          ashtakavarga:
            report?.ashtakavarga !== null && report?.ashtakavarga !== undefined,

          professionalPass: pass,
        });

        if (!pass) {
          throw new Error(
            `Regenerated report still fails professional completeness for ${row.id}`,
          );
        }

        results.push({
          kundliDataId: row.id,
          kundliId: row.kundliId,
          success: true,
          provider: report.provider,
          status: report.status,
          source: generated.source,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        console.error(`FAILED KundliData ${row.id}: ${message}`);

        results.push({
          kundliDataId: row.id,
          kundliId: row.kundliId,
          success: false,
          error: message,
        });
      }
    }

    // ========================================================
    // 4. FINAL DATABASE VERIFICATION
    // ========================================================

    const finalRows = await prisma.kundliData.findMany({
      select: {
        id: true,
        kundliId: true,
        lang: true,
        vedic: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    const finalGood = finalRows.filter((row) =>
      isProfessionalComplete(row.vedic),
    );

    const finalBad = finalRows.filter(
      (row) => !isProfessionalComplete(row.vedic),
    );

    console.log('\n==============================================');
    console.log('FINAL DATABASE QUALITY');
    console.log('==============================================');

    console.log({
      total: finalRows.length,
      professionalComplete: finalGood.length,
      staleOrPartial: finalBad.length,
    });

    if (finalBad.length > 0) {
      console.log('\nREMAINING STALE RECORDS:');

      console.table(
        finalBad.map((row) => {
          const report = row.vedic as any;

          return {
            id: row.id,
            kundliId: row.kundliId,
            provider: report?.provider ?? null,
            status: report?.status ?? null,

            planets: Array.isArray(report?.planetaryPositions)
              ? report.planetaryPositions.length
              : 0,

            updatedAt: row.updatedAt,
          };
        }),
      );
    }

    console.log('\n==============================================');
    console.log('MIGRATION RESULTS');
    console.log('==============================================');

    console.table(results);

    const failures = results.filter((item) => item.success !== true);

    if (failures.length === 0 && finalBad.length === 0) {
      console.log(
        'STEP 7 RESULT = PASS: ALL HISTORICAL KUNDLIS ARE PROFESSIONAL VEDIC',
      );
    } else {
      console.log('STEP 7 RESULT = PARTIAL: REVIEW FAILED RECORDS');

      process.exitCode = 2;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nSTEP 7 FATAL ERROR');

  console.error(error instanceof Error ? error.stack : error);

  process.exitCode = 1;
});
