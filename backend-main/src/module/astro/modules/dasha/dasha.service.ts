import { Injectable } from '@nestjs/common';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { ProkeralaProvider } from '../provider/prokerala.provider';

@Injectable()
export class DashaService {
  constructor(private readonly provider: ProkeralaProvider) {}

  async generate(params: AstroParams) {
    const data = await this.provider.getDashaPeriods(params);

    return this.transform(data);
  }

  private transform(data: any) {
    return {
      raw: data,
      timeline: data?.dasha ?? data?.data?.dasha ?? data?.data ?? [],
    };
  }
}
