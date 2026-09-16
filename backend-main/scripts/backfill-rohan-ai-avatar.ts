import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AiAstrologerAvatarService } from '../src/module/profile/ai-astrologer-avatar.service';

async function main() {
  const app = await NestFactory.createApplicationContext(
    AppModule,
    {
      logger: ['error', 'warn', 'log'],
    },
  );

  try {
    const prisma = app.get(PrismaService);
    const avatarService = app.get(AiAstrologerAvatarService);

    const astrologer = await prisma.astrologer.findFirst({
      where: {
        user: {
          name: {
            equals: 'Rohan',
            mode: 'insensitive',
          },
          avatarUrl: {
            not: null,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!astrologer) {
      throw new Error('Rohan astrologer with real avatarUrl not found');
    }

    const sourceUrl = astrologer.user.avatarUrl?.trim();

    if (!sourceUrl) {
      throw new Error('Rohan real profile photo URL is empty');
    }

    console.log('\nTARGET');
    console.log({
      astrologerId: astrologer.id,
      userId: astrologer.user.id,
      name: astrologer.user.name,
      currentAiAvatarUrl: astrologer.aiAvatarUrl,
      sourceAvatarUrl: sourceUrl,
    });

    console.log('\nDownloading real source photo...');

    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to download real photo: HTTP ${response.status}`,
      );
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/jpeg';

    if (![
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ].includes(contentType)) {
      throw new Error(
        `Unsupported source image content type: ${contentType}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log({
      contentType,
      sourceBytes: buffer.length,
    });

    console.log('\nGenerating premium AI astrology avatar...');

    const aiAvatarUrl = await avatarService.generateForUser({
      userId: astrologer.user.id,
      buffer,
      mimeType:
        contentType === 'image/jpg'
          ? 'image/jpeg'
          : contentType,
    });

    if (!aiAvatarUrl) {
      throw new Error(
        'AI avatar was not generated. Check backend/OpenAI logs.',
      );
    }

    const updated = await prisma.astrologer.findUnique({
      where: {
        id: astrologer.id,
      },
      select: {
        id: true,
        aiAvatarUrl: true,
      },
    });

    console.log('\nSUCCESS');
    console.log(updated);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nBACKFILL FAILED');
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
