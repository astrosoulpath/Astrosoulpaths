import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { VedicProvider } from './src/module/astro/modules/provider/vedic.provider';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const provider = app.get(VedicProvider);

    // Existing production endpoint only.
    // Birth values here are strictly a probe fixture and are
    // NEVER returned to an ASP customer.
    const response = await provider.getPlanetPositions({
      dob: '1995-01-10',
      tob: '10:30:00',
      lat: 25.5941,
      lon: 85.1376,
      timezone: 5.5,
      lang: 'en',
    });

    const data = (response as any)?.response ?? response;

    console.log({
      providerReachable: response !== null && response !== undefined,

      responsePresent: data !== null && data !== undefined,

      source: 'VEDIC_ASTRO_API_REAL_ENDPOINT',
    });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(
    'REAL_PROVIDER_CHECK_FAILED',
    error?.response?.data ?? error?.message ?? error,
  );

  process.exitCode = 1;
});
