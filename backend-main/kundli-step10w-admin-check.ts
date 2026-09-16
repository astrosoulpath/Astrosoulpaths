import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './src/app.module';

import { AdminService } from './src/module/admin/admin.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = app.get(AdminService);

    const result = await service.getKundliSettings();

    console.dir(result, {
      depth: null,
    });

    const data = result?.data;

    const pass =
      result?.success === true &&
      data?.name === 'ASTROLOGER_KUNDLI_YEARLY' &&
      Number(data?.price) === 3000 &&
      data?.durationDays === 365 &&
      data?.isActive === true &&
      Array.isArray(data?.features?.includedCharts) &&
      data.features.includedCharts.includes('D60');

    console.log(
      pass
        ? 'STEP 10W ADMIN SETTINGS = PASS'
        : 'STEP 10W ADMIN SETTINGS = FAIL',
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
