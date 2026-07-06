import { Injectable } from '@nestjs/common';
import { AstroExecutor } from '../../core/astro.executor';
import { VedicProvider } from '../provider/vedic.provider';
import { AstroParams } from '../../../../common/types/astro-params.type';

@Injectable()
export class DashaService {
  constructor(
    private readonly executor: AstroExecutor,
    private readonly provider: VedicProvider,
  ) {}

  async generate(params: AstroParams) {
    return this.executor.execute({
      params,
      fetcher: this.provider.getmahadasha.bind(this.provider),
      transformer: this.transform,
    });
  }

  private transform(data: any) {
    return {
      raw: data,
      timeline: data?.dasha || data?.data || [],
    };
  }
}
