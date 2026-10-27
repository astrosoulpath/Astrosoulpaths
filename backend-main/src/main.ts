import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createBullMQQueueOptions } from './infrastructure/bullmq/bullmq.config';
import { Queue } from 'bullmq';
import { setupBullBoard } from './infrastructure/bullmq/bull-board';
import { UserService } from './module/user/user.service';
import { createAdminHttpMiddleware } from './common/auth/admin-identity-policy';
import { createHttpCorsOptions } from './config/http-cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableCors(createHttpCorsOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const isBullBoardEnabled = process.env.ENABLE_BULL_BOARD === 'true';

  if (isBullBoardEnabled) {
    const kundliQueue = new Queue('Kundli', createBullMQQueueOptions());

    app.use('/admin/queues', createAdminHttpMiddleware(app.get(UserService)));

    setupBullBoard(app, [kundliQueue]);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Server running on port ${port}`);
}
void bootstrap();
