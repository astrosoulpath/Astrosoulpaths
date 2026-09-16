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

    // Probe fixture only.
    // Never returned to an ASP production customer.
    const raw = await vedic.getmahadasha({
      dob: '1995-01-10',
      tob: '10:30:00',
      lat: 25.5941,
      lon: 85.1376,
      timezone: 5.5,
      lang: 'en',
    });

    const providerData = (raw as any)?.response ?? raw;

    const normalized = kundli.normalizeMahadasha(providerData);

    const timeline = normalized.timeline ?? [];

    const problems: string[] = [];

    for (const maha of timeline) {
      const children = Array.isArray(maha.children) ? maha.children : [];

      if (children.length !== 9) {
        problems.push(
          `${maha.lord}: expected 9 Antardashas, got ${children.length}`,
        );

        continue;
      }

      const first = children[0];
      const last = children[children.length - 1];

      const mahaStart = kundli.formatDashaDate(
        kundli.parseDashaDate(maha.start),
      );

      const mahaEnd = kundli.formatDashaDate(kundli.parseDashaDate(maha.end));

      if (first.start !== mahaStart) {
        problems.push(
          `${maha.lord}: first Antar starts ${first.start}, Mahadasha starts ${mahaStart}`,
        );
      }

      if (last.end !== mahaEnd) {
        problems.push(
          `${maha.lord}: last Antar ends ${last.end}, Mahadasha ends ${mahaEnd}`,
        );
      }

      for (let index = 1; index < children.length; index++) {
        if (children[index - 1].end !== children[index].start) {
          problems.push(
            `${maha.lord}: gap/overlap between ${children[index - 1].lord} and ${children[index].lord}`,
          );
        }
      }
    }

    console.log({
      mahadashaCount: timeline.length,

      antardashaCount: normalized.antarDasha?.length ?? 0,

      activeMahadasha: normalized.activeMahadasha,

      activeAntardasha: normalized.activeAntardasha,

      boundaryProblems: problems,
    });

    const pass =
      timeline.length === 9 &&
      normalized.antarDasha?.length === 81 &&
      problems.length === 0;

    console.log(
      pass ? 'STEP 10P DATE BOUNDARY = PASS' : 'STEP 10P DATE BOUNDARY = FAIL',
    );

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
