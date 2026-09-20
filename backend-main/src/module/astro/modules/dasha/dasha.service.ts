import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { LocalVedicKundliProvider } from '../../../kundli/providers/local-vedic-kundli.provider';

@Injectable()
export class DashaService {
  constructor(
    private readonly localVedicKundliProvider: LocalVedicKundliProvider,
  ) {}

  async generate(params: AstroParams) {
    const report = await this.localVedicKundliProvider.generate(
      params,
      params.lang ?? 'en',
    );

    if (!report.dasha) {
      throw new ServiceUnavailableException({
        code: 'LOCAL_VIMSHOTTARI_DASHA_UNAVAILABLE',
        message: 'Local Vimshottari Dasha calculation is unavailable.',
      });
    }

    return {
      raw: report.dasha,
      timeline: report.dasha.timeline ?? [],
      antarDasha: report.dasha.antarDasha ?? null,
      current: report.dasha.current ?? null,
      source: 'local-vedic',
    };
  }
}
