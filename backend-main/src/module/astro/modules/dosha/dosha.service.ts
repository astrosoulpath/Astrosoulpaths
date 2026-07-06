import { Injectable } from '@nestjs/common';
import { AstroExecutor } from '../../core/astro.executor';
import { VedicProvider } from '../provider/vedic.provider';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { transformDosha } from './dosha.transformer';

@Injectable()
export class DoshaService {
  constructor(
    private readonly executor: AstroExecutor,
    private readonly provider: VedicProvider,
  ) {}

  async getMangal(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getmangaldosha.bind(this.provider),
      transformer: (data) => transformDosha(data, params.lang || 'en'),
    });
  }
  async getManglik(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getmanglikdosha.bind(this.provider),
      transformer: (data) => data,
    });
  }

  async getKaalsarp(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getkaalsarpdosha.bind(this.provider),
      transformer: (data) => data,
    });
  }

  async getPitra(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getpitradosha.bind(this.provider),
      transformer: (data) => data,
    });
  }

  async getPapasamaya(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getpapasamaya.bind(this.provider),
      transformer: (data) => data,
    });
  }

  // 🔥 MAIN AGGREGATOR
  async generate(params: AstroParams) {
    const tasks = [
      { key: 'mangal', fn: this.getMangal.bind(this) },
      { key: 'manglik', fn: this.getManglik.bind(this) },
      { key: 'kaalsarp', fn: this.getKaalsarp.bind(this) },
      { key: 'pitra', fn: this.getPitra.bind(this) },
      { key: 'papasamaya', fn: this.getPapasamaya.bind(this) },
    ];

    const results = await Promise.allSettled(tasks.map((t) => t.fn(params)));

    return tasks.reduce(
      (acc, task, index) => {
        acc[task.key] =
          results[index].status === 'fulfilled' ? results[index].value : null;
        return acc;
      },
      {} as Record<string, any>,
    );
  }
}
