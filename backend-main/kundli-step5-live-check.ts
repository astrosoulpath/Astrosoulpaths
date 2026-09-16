import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './src/app.module';

import { VedicKundliProvider } from './src/module/kundli/providers/vedic-kundli.provider';
import { KundliAiService } from './src/module/kundli/kundli-ai.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const provider = app.get(VedicKundliProvider);
    const ai = app.get(KundliAiService);

    // --------------------------------------------------------
    // Known controlled test birth data
    // Patna, India
    // --------------------------------------------------------

    const params = {
      dob: '1995-01-10',
      tob: '10:30:00',
      lat: 25.5941,
      lon: 85.1376,
      timezone: 5.5,
      lang: 'en',
    };

    console.log('\n==============================================');
    console.log('LIVE VEDIC PROVIDER REQUEST');
    console.log('==============================================');

    console.log({
      dob: params.dob,
      tob: params.tob,
      latitude: params.lat,
      longitude: params.lon,
      timezone: params.timezone,
      lang: params.lang,
    });

    const startedAt = Date.now();

    const report = await provider.generate(params, 'en');

    const providerMs = Date.now() - startedAt;

    console.log('\n==============================================');
    console.log('VEDIC PROVIDER RESULT');
    console.log('==============================================');

    const planets = Array.isArray(report.planetaryPositions)
      ? report.planetaryPositions
      : [];

    const dashaTimeline = Array.isArray(report.dasha?.timeline)
      ? report.dasha?.timeline
      : [];

    const hasBirthChart = Boolean(report.birthChart);
    const hasNavamsa = Boolean(report.navamsaChart);
    const hasPlanets = planets.length >= 9;
    const hasDasha = Boolean(report.dasha) && dashaTimeline.length > 0;
    const hasPanchang = Boolean(report.panchang);

    const hasYogas = report.yogas !== null && report.yogas !== undefined;

    const hasDosha = report.dosha !== null && report.dosha !== undefined;

    const hasShadbala =
      report.shadbala !== null && report.shadbala !== undefined;

    const hasAshtakavarga =
      report.ashtakavarga !== null && report.ashtakavarga !== undefined;

    console.log({
      provider: report.provider,
      status: report.status,
      providerMs,

      birthChart: hasBirthChart,
      navamsaChart: hasNavamsa,

      planetCount: planets.length,

      dasha: Boolean(report.dasha),
      dashaPeriods: dashaTimeline.length,

      panchang: hasPanchang,
      yogas: hasYogas,
      dosha: hasDosha,
      shadbala: hasShadbala,
      ashtakavarga: hasAshtakavarga,

      completeness: report.completeness ?? null,
    });

    console.log('\n==============================================');
    console.log('PLANETARY POSITIONS');
    console.log('==============================================');

    console.table(
      planets.map((planet: any) => ({
        planet: planet.name ?? planet.full_name ?? planet.shortName ?? '-',

        sign: planet.sign ?? planet.zodiac ?? '-',

        degree:
          planet.degree ?? planet.local_degree ?? planet.global_degree ?? '-',

        house: planet.house ?? '-',

        nakshatra: planet.nakshatra ?? planet.nakshatra_name ?? '-',

        retrograde: Boolean(planet.retrograde ?? planet.retro),
      })),
    );

    console.log('\n==============================================');
    console.log('VIMSHOTTARI MAHADASHA TIMELINE');
    console.log('==============================================');

    console.table(
      dashaTimeline.map((period: any) => ({
        lord: period.lord ?? '-',
        level: period.level ?? '-',
        start: period.start ?? '-',
        end: period.end ?? '-',
      })),
    );

    console.log('\n==============================================');
    console.log('PANCHANG RAW CHECK');
    console.log('==============================================');

    if (report.panchang && typeof report.panchang === 'object') {
      console.dir(report.panchang, {
        depth: 3,
      });
    } else {
      console.log('PANCHANG MISSING');
    }

    // --------------------------------------------------------
    // STRICT PROFESSIONAL VEDIC GATE
    // --------------------------------------------------------

    const corePass =
      report.provider === 'vedicastro' &&
      hasBirthChart &&
      hasNavamsa &&
      hasPlanets &&
      hasDasha &&
      hasPanchang;

    const professionalSectionsPass =
      hasYogas && hasDosha && hasShadbala && hasAshtakavarga;

    console.log('\n==============================================');
    console.log('VEDIC VALIDATION GATES');
    console.log('==============================================');

    console.log({
      corePass,
      professionalSectionsPass,
    });

    // --------------------------------------------------------
    // OPENAI INTERPRETATION
    // Provider report is input.
    // OpenAI MUST NOT calculate planets.
    // --------------------------------------------------------

    console.log('\n==============================================');
    console.log('OPENAI GROUNDED INTERPRETATION TEST');
    console.log('==============================================');

    const aiStartedAt = Date.now();

    const analysis = await ai.generateAnalysis(report);

    const aiMs = Date.now() - aiStartedAt;

    console.log({
      aiMs,

      character:
        typeof analysis.character === 'string' &&
        analysis.character.trim().length > 0,

      career:
        typeof analysis.career === 'string' &&
        analysis.career.trim().length > 0,

      finance:
        typeof analysis.finance === 'string' &&
        analysis.finance.trim().length > 0,

      marriage:
        typeof analysis.marriage === 'string' &&
        analysis.marriage.trim().length > 0,

      health:
        typeof analysis.health === 'string' &&
        analysis.health.trim().length > 0,

      remedies: Array.isArray(analysis.remedies),
    });

    console.log('\n--- AI CHARACTER ---');
    console.log(analysis.character);

    console.log('\n--- AI CAREER ---');
    console.log(analysis.career);

    console.log('\n--- AI FINANCE ---');
    console.log(analysis.finance);

    console.log('\n--- AI MARRIAGE ---');
    console.log(analysis.marriage);

    console.log('\n--- AI HEALTH ---');
    console.log(analysis.health);

    console.log('\n--- AI REMEDIES ---');
    console.dir(analysis.remedies, {
      depth: null,
    });

    // --------------------------------------------------------
    // SAVE LOCAL AUDIT JSON ONLY
    // NO DATABASE WRITE
    // --------------------------------------------------------

    const fs = await import('node:fs');

    const result = {
      testedAt: new Date().toISOString(),

      testInput: params,

      validation: {
        corePass,
        professionalSectionsPass,
        provider: report.provider,
        status: report.status,
        planetCount: planets.length,
        dashaPeriods: dashaTimeline.length,
      },

      report,

      aiAnalysis: analysis,
    };

    fs.writeFileSync(
      './kundli-step5-live-result.json',
      JSON.stringify(result, null, 2),
      'utf8',
    );

    console.log('\n==============================================');

    if (corePass && professionalSectionsPass) {
      console.log('STEP 5 VEDIC RESULT = PASS');
    } else if (corePass) {
      console.log(
        'STEP 5 VEDIC RESULT = CORE PASS / PROFESSIONAL SECTIONS PARTIAL',
      );
    } else {
      console.log('STEP 5 VEDIC RESULT = FAIL / REVIEW REQUIRED');
    }

    console.log('JSON = kundli-step5-live-result.json');

    console.log('==============================================');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nSTEP 5 FAILED');
  console.error(error instanceof Error ? error.stack : error);

  process.exitCode = 1;
});
