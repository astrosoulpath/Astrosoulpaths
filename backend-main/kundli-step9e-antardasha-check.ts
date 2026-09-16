import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './src/app.module';

import { VedicProvider } from './src/module/astro/modules/provider/vedic.provider';

import { VedicKundliProvider } from './src/module/kundli/providers/vedic-kundli.provider';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const vedic = app.get(VedicProvider);

    const kundli = app.get(VedicKundliProvider) as any;

    const raw = await vedic.getmahadasha({
      dob: '1995-01-10',
      tob: '10:30:00',
      lat: 25.5941,
      lon: 85.1376,
      timezone: 5.5,
      lang: 'en',
    });

    const providerData = raw?.response ?? raw;

    const normalized = kundli.normalizeMahadasha(providerData);

    const timeline = Array.isArray(normalized.timeline)
      ? normalized.timeline
      : [];

    const allAntar = Array.isArray(normalized.antarDasha)
      ? normalized.antarDasha
      : [];

    console.log('\n==============================================');
    console.log('VIMSHOTTARI ANTARDASHA VALIDATION');
    console.log('==============================================');

    console.log({
      mahadashaCount: timeline.length,

      antardashaCount: allAntar.length,

      everyMahadashaHasNineAntardashas:
        timeline.length > 0 &&
        timeline.every(
          (period: any) =>
            Array.isArray(period.children) && period.children.length === 9,
        ),

      activeMahadasha: normalized.activeMahadasha,

      activeAntardasha: normalized.activeAntardasha,
    });

    console.log('\nCURRENT MAHADASHA DETAIL:');

    const current = timeline.find(
      (period: any) =>
        normalized.activeMahadasha &&
        period.lord === normalized.activeMahadasha.lord,
    );

    console.dir(current, {
      depth: null,
    });

    const pass =
      timeline.length === 9 &&
      allAntar.length === 81 &&
      timeline.every(
        (period: any) =>
          Array.isArray(period.children) && period.children.length === 9,
      ) &&
      normalized.activeMahadasha !== null &&
      normalized.activeAntardasha !== null;

    console.log('\n==============================================');

    console.log(pass ? 'STEP 9E RESULT = PASS' : 'STEP 9E RESULT = FAIL');

    console.log('==============================================');

    if (!pass) {
      process.exitCode = 2;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
});
