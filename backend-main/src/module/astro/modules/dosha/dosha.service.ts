import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { LocalVedicKundliProvider } from '../../../kundli/providers/local-vedic-kundli.provider';

@Injectable()
export class DoshaService {
  constructor(
    private readonly localVedicKundliProvider: LocalVedicKundliProvider,
  ) {}

  private async getLocalMangal(params: AstroParams) {
    const report = await this.localVedicKundliProvider.generate(
      params,
      params.lang ?? 'en',
    );

    const mangal = report.dosha?.mangal ?? null;

    if (!mangal) {
      throw new ServiceUnavailableException({
        code: 'LOCAL_MANGAL_DOSHA_UNAVAILABLE',
        message: 'Local Mangal Dosha calculation is unavailable.',
      });
    }

    return mangal;
  }

  async getMangal(params: AstroParams) {
    return this.getLocalMangal(params);
  }

  async getManglik(params: AstroParams) {
    return this.getLocalMangal(params);
  }

  async getKaalsarp(_params: AstroParams) {
    return null;
  }

  async getPitra(_params: AstroParams) {
    return null;
  }

  async getPapasamaya(_params: AstroParams) {
    return null;
  }

  async generate(params: AstroParams) {
    const mangal = await this.getLocalMangal(params);

    return {
      mangal,
      manglik: mangal,
      kaalsarp: null,
      pitra: null,
      papasamaya: null,
      source: 'local-vedic',
    };
  }
}
