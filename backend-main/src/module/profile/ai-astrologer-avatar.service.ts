import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class AiAstrologerAvatarService {
  private readonly logger = new Logger(AiAstrologerAvatarService.name);

  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  private readonly client = this.apiKey
    ? new OpenAI({
        apiKey: this.apiKey,
      })
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async generateForUser(params: {
    userId: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string | null> {
    const astrologer = await this.prisma.astrologer.findUnique({
      where: {
        userId: params.userId,
      },
      select: {
        id: true,
        aiAvatarUrl: true,
      },
    });

    // Normal customer profile image:
    // no AI astrologer avatar is required.
    if (!astrologer) {
      return null;
    }

    if (!this.client) {
      this.logger.warn(
        `AI avatar skipped for astrologer ${astrologer.id}: OpenAI is not configured`,
      );
      return null;
    }

    try {
      const extension =
        params.mimeType === 'image/png'
          ? 'png'
          : params.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

      const sourceImage = await toFile(
        params.buffer,
        `astrologer-source.${extension}`,
        {
          type: params.mimeType,
        },
      );

      const result = await this.client.images.edit({
        model: 'gpt-image-1',
        image: sourceImage,
        size: '1024x1024',
        prompt: [
          'Create a premium astrology app avatar from this exact real person.',
          'Preserve the same person, facial identity, facial proportions, skin tone, age, hairstyle and recognizable features.',
          'Do not change identity.',
          'Professional friendly astrologer portrait.',
          'Head and shoulders composition, centered face.',
          'Elegant dark cosmic purple and deep navy background.',
          'Subtle zodiac stars and warm golden celestial glow.',
          'Premium polished digital portrait / tasteful illustrated avatar style.',
          'Clean circular-avatar friendly composition.',
          'No text, no logo, no watermark, no extra people.',
          'High-end astrology consultation app aesthetic.',
        ].join(' '),
      });

      const base64 = result.data?.[0]?.b64_json?.trim();

      if (!base64) {
        this.logger.warn(
          `AI avatar returned no image for astrologer ${astrologer.id}`,
        );
        return null;
      }

      const generatedBuffer = Buffer.from(base64, 'base64');

      if (generatedBuffer.length === 0) {
        return null;
      }

      /*
       * Reuse the existing PUBLIC profile-avatars bucket.
       * This avoids requiring another Supabase bucket.
       */
      const bucket = 'profile-avatars';

      const storagePath = `${params.userId}/ai-astro/${Date.now()}-${randomUUID()}.png`;

      const storage = this.supabaseService.getStorageClient();

      const { error: uploadError } = await storage.storage
        .from(bucket)
        .upload(storagePath, generatedBuffer, {
          contentType: 'image/png',
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        this.logger.error(
          `Unable to store AI avatar for astrologer ${astrologer.id}: ${uploadError.message}`,
        );
        return null;
      }

      const { data: publicData } = storage.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      const aiAvatarUrl = publicData?.publicUrl?.trim();

      if (!aiAvatarUrl) {
        await storage.storage.from(bucket).remove([storagePath]);
        return null;
      }

      await this.prisma.astrologer.update({
        where: {
          id: astrologer.id,
        },
        data: {
          aiAvatarUrl,
        },
      });

      await this.removePreviousAiAvatar(astrologer.aiAvatarUrl, aiAvatarUrl);

      this.logger.log(`AI avatar generated for astrologer ${astrologer.id}`);

      return aiAvatarUrl;
    } catch (error) {
      /*
       * CRITICAL:
       * Profile photo upload must NEVER fail just because
       * AI avatar generation failed.
       */
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `AI avatar generation failed for astrologer ${astrologer.id}: ${message}`,
      );

      return null;
    }
  }

  private async removePreviousAiAvatar(
    previousUrl: string | null,
    newUrl: string,
  ) {
    const normalizedPrevious = previousUrl?.trim();

    if (!normalizedPrevious || normalizedPrevious === newUrl) {
      return;
    }

    const marker = '/storage/v1/object/public/profile-avatars/';

    const markerIndex = normalizedPrevious.indexOf(marker);

    if (markerIndex < 0) {
      return;
    }

    const storagePath = decodeURIComponent(
      normalizedPrevious.substring(markerIndex + marker.length),
    );

    if (!storagePath.includes('/ai-astro/')) {
      return;
    }

    try {
      await this.supabaseService
        .getStorageClient()
        .storage.from('profile-avatars')
        .remove([storagePath]);
    } catch {
      // New AI avatar remains valid even if old cleanup fails.
    }
  }
}
