import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DailyinsightModule } from './module/astro/modules/dailyinsight/dailyinsight.module';
import { NakshatraDailyInsightService } from './module/astro/modules/dailyinsight/dailyinsight.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dailyModule = app.select(DailyinsightModule);

    const service = dailyModule.get(
      NakshatraDailyInsightService,
      { strict: true },
    );

    // Existing internal User.id supported by service resolution.
    const userId = 'b5daa437-f714-4033-88d0-c3cd462b3ce5';

    const result = await service.getNakshatraDailyInsight(
      userId,
      'today',
    );

    console.log('\n===== OWN ENGINE HOROSCOPE RESULT =====');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n===== TEST FAILED =====');
    console.error(error);
  } finally {
    await app.close();
  }
}

void run();
