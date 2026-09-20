import { Injectable, Logger } from '@nestjs/common';

import { DashaService } from './modules/dasha/dasha.service';
import { DoshaService } from './modules/dosha/dosha.service';

import { KundliService } from '../kundli/kundli.service';
import { AstroParams } from '../../common/types/astro-params.type';

@Injectable()
export class AstroService {
  private readonly logger = new Logger(AstroService.name);

  constructor(
    private readonly dashaService: DashaService,

    private readonly doshaService: DoshaService,

    private readonly kundliService: KundliService,
  ) {}

  private withTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
    return Promise.race([
      promise,

      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), ms),
      ),
    ]);
  }

  async generateAstro(params: AstroParams, lang: string) {
    this.logger.log(`Astro request lang=${lang}`);

    try {
      const generated = await this.kundliService.generateReport(
        {
          ...params,
          lang,
        },
        lang,
      );

      this.logger.log(`Astro Kundli ready source=${generated.source}`);

      return {
        success: true,
        message:
          generated.source === 'cache'
            ? 'Data fetched from cache'
            : 'Astro data generated successfully',
        kundliId: generated.kundli.id,
        source: generated.source,
        data: generated.report,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown astrology generation error';

      this.logger.error(
        `Astro generation failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}

