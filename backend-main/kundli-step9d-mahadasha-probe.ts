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

    const response = await provider.getmahadasha({
      dob: '1995-01-10',
      tob: '10:30:00',
      lat: 25.5941,
      lon: 85.1376,
      timezone: 5.5,
      lang: 'en',
    });

    console.log('\n==============================================');
    console.log('RAW MAHADASHA RESPONSE');
    console.log('==============================================');

    console.dir(response, {
      depth: null,
      maxArrayLength: null,
    });

    const text = JSON.stringify(response);

    console.log('\n==============================================');
    console.log('ANTAR KEY CHECK');
    console.log('==============================================');

    console.log({
      hasAntar: text.toLowerCase().includes('antar'),

      hasChildren: text.toLowerCase().includes('children'),

      hasSub: text.toLowerCase().includes('sub'),
    });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
