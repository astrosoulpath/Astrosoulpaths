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

  // ✅ TIMEOUT HELPER
  private withTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), ms),
      ),
    ]);
  }

  async generateAstro(params: AstroParams, lang: string) {
    this.logger.log(`📥 Astro request (lang=${lang})`);

    try {
      // ✅ 1. CACHE CHECK
      const existing = await this.kundliService.findKundliData(params, lang);

      if (existing?.vedic) {
        this.logger.log(`⚡ Cache hit`);

        return {
          success: true,
          message: 'Data fetched from cache',
          data: existing.vedic,
        };
      }

      this.logger.log(`🚀 Generating astro data`);

      // ✅ 2. TASKS
      const tasks = {
        dosha: () => this.doshaService.generate({ ...params, lang }),
        dasha: () => this.dashaService.generate({ ...params, lang }),
      };

      const entries = Object.entries(tasks);

      // ✅ 3. PARALLEL + TIMEOUT
      const results = await Promise.allSettled(
        entries.map(([_, fn]) => this.withTimeout(fn(), 6000)),
      );

      // ✅ 4. SAFE MAPPING
      const mapped = entries.reduce(
        (acc, [key], index) => {
          const res = results[index];

          if (res.status === 'fulfilled') {
            acc[key] = res.value;
          } else {
            acc[key] = null;

            this.logger.warn(
              `⚠️ ${key} failed: ${res.reason?.message || 'Unknown error'}`,
            );
          }

          return acc;
        },
        {} as Record<string, any>,
      );

      // ✅ 5. FINAL DATA
      const vedicData = {
        dosha: mapped.dosha,
        dasha: mapped.dasha,
      };

      const result = {
        vedic: vedicData,
      };

      // ✅ 6. SAVE ASYNC
      this.kundliService.saveKundliData(params, result, lang).catch((err) => {
        this.logger.error('❌ Save failed', err?.message);
      });

      this.logger.log('🎯 Astro generation completed');

      // ✅ 7. FINAL RESPONSE FORMAT
      return {
        success: true,
        message: 'Astro data generated successfully',
        data: vedicData,
      };
    } catch (error: any) {
      this.logger.error('❌ AstroService failed', error?.stack || error);

      return {
        success: false,
        message: error?.message || 'Astro generation failed',
        data: null,
      };
    }
  }
}
