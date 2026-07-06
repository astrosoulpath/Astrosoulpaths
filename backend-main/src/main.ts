import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createBullMQQueueOptions } from './infrastructure/bullmq/bullmq.config';
import { Queue } from 'bullmq';
import { setupBullBoard } from './infrastructure/bullmq/bull-board';
import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const isBullBoardEnabled = process.env.ENABLE_BULL_BOARD === 'true';

  if (isBullBoardEnabled) {
    const username = process.env.BULL_BOARD_USERNAME;
    const password = process.env.BULL_BOARD_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD are required when ENABLE_BULL_BOARD=true',
      );
    }

    const kundliQueue = new Queue('Kundli', createBullMQQueueOptions());

    app.use(
      '/admin/queues',
      basicAuth({
        users: {
          [username]: password,
        },
        challenge: true,
      }),
    );

    setupBullBoard(app, [kundliQueue]);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Server running on port ${port}`);
}
void bootstrap();
