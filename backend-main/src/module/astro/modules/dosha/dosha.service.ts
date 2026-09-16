import { Injectable } from '@nestjs/common';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { ProkeralaProvider } from '../provider/prokerala.provider';

@Injectable()
export class DoshaService {
  constructor(private readonly provider: ProkeralaProvider) {}

  async getMangal(params: AstroParams) {
    return this.provider.getMangalDosha(params);
  }

  async getManglik(params: AstroParams) {
    return this.provider.getAdvancedMangalDosha(params);
  }

  async getKaalsarp(params: AstroParams) {
    return this.provider.getKaalSarpDosha(params);
  }

  /*
   * Production rule:
   * Never fall back to Vedic/AstrologyAPI.
   *
   * These sections stay unavailable until a verified
   * Prokerala endpoint is wired.
   */
  async getPitra(_params: AstroParams) {
    return null;
  }

  async getPapasamaya(_params: AstroParams) {
    return null;
  }

  async generate(params: AstroParams) {
    const tasks = [
      { key: 'mangal', fn: this.getMangal.bind(this) },
      { key: 'manglik', fn: this.getManglik.bind(this) },
      { key: 'kaalsarp', fn: this.getKaalsarp.bind(this) },
      { key: 'pitra', fn: this.getPitra.bind(this) },
      { key: 'papasamaya', fn: this.getPapasamaya.bind(this) },
    ];

    const results = await Promise.allSettled(
      tasks.map((task) => task.fn(params)),
    );

    return tasks.reduce(
      (acc, task, index) => {
        acc[task.key] =
          results[index].status === 'fulfilled' ? results[index].value : null;

        return acc;
      },
      {} as Record<string, unknown>,
    );
  }
}
