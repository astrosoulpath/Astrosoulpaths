import 'dotenv/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AiAstrologerAvatarService } from '../src/module/profile/ai-astrologer-avatar.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const avatarService = app.get(AiAstrologerAvatarService);

    const user = await prisma.user.findUnique({
      where: {
        id: '533d3212-c540-4afc-8c54-ae5c92b4c72d',
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        astrologer: {
          select: {
            id: true,
            aiAvatarUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Sharma Jii user not found');
    }

    if (!user.astrologer) {
      throw new Error('Astrologer relation not found');
    }

    if (!user.avatarUrl) {
      throw new Error('Real profile photo is missing');
    }

    console.log('\n========== SOURCE ==========');
    console.log('Name        :', user.name);
    console.log('User ID     :', user.id);
    console.log('Astrologer  :', user.astrologer.id);
    console.log('Real photo  :', user.avatarUrl);
    console.log('Old AI      :', user.astrologer.aiAvatarUrl ?? 'MISSING');

    const response = await fetch(user.avatarUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to download real photo: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('Downloaded real photo is empty');
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/jpeg';

    console.log('Mime type   :', contentType);
    console.log('Bytes       :', buffer.length);

    const aiAvatarUrl = await avatarService.generateForUser({
      userId: user.id,
      buffer,
      mimeType: contentType,
    });

    console.log('\n========== RESULT ==========');
    console.log('AI AVATAR   :', aiAvatarUrl ?? 'MISSING / GENERATION FAILED');

    const updated = await prisma.astrologer.findUnique({
      where: {
        id: user.astrologer.id,
      },
      select: {
        aiAvatarUrl: true,
      },
    });

    console.log(
      'DB AI AVATAR:',
      updated?.aiAvatarUrl ?? 'MISSING',
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nAI AVATAR GENERATION FAILED');
  console.error(error);
  process.exit(1);
});
