import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KundliRepository } from './kundli.repository';
import { AstroParams } from '../../common/types/astro-params.type';
import { generateKundliHash } from '../../common/utlis/hash.util';

@Injectable()
export class KundliService {
  private readonly logger = new Logger(KundliService.name);

  constructor(private readonly repo: KundliRepository) {}

  async findByParams(params: AstroParams) {
    const hash = generateKundliHash(params);
    return this.repo.findByHash(hash);
  }

  private mapToKundliData(params: AstroParams, hash: string) {
    return {
      dob: params.dob,
      tob: params.tob,
      latitude: params.lat,
      longitude: params.lon,
      timezone: params.timezone,
      hash,
    };
  }

  async getOrCreateKundli(params: AstroParams) {
    const hash = generateKundliHash(params);

    let kundli = await this.repo.findByHash(hash);

    if (!kundli) {
      this.logger.log('🆕 Creating new Kundli');

      kundli = await this.repo.createKundli(this.mapToKundliData(params, hash));
    }

    return kundli;
  }

  async findKundliData(params: AstroParams, lang: string) {
    const kundli = await this.getOrCreateKundli(params);

    if (!kundli?.id) {
      this.logger.error('❌ Kundli not found during find');
      throw new NotFoundException('Kundli not found');
    }

    return this.repo.findKundliData(kundli.id, lang);
  }

  async saveKundliData(params: AstroParams, data: any, lang: string) {
    const kundli = await this.getOrCreateKundli(params);

    if (!kundli?.id) {
      this.logger.error('❌ Kundli ID missing during save');
      throw new NotFoundException('Kundli ID not found');
    }

    this.logger.log(`💾 Saving KundliData for lang=${lang}`);

    return this.repo.saveKundliData(kundli.id, lang, data);
  }
}
