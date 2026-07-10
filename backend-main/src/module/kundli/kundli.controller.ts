import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { KundliService } from './kundli.service';
import { AstroService } from '../astro/astro.service';
import { AstroParams } from '../../common/types/astro-params.type';

type GenerateKundliDto = {
  name?: string;
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang?: string;
};

@Controller('kundli')
export class KundliController {
  constructor(
    private readonly kundliService: KundliService,
    private readonly astroService: AstroService,
  ) {}

  @Post('generate')
  async generate(@Body() body: GenerateKundliDto) {
    const lang = body.lang || 'en';

    const params: AstroParams = {
      dob: body.dob,
      tob: body.tob,
      lat: Number(body.lat),
      lon: Number(body.lon),
      timezone: Number(body.timezone),
    };

    const kundli =
      await this.kundliService.getOrCreateKundli(params);

    const astro =
      await this.astroService.generateAstro(params, lang);

    const astroData =
      astro?.data &&
      typeof astro.data === 'object' &&
      !Array.isArray(astro.data)
        ? (astro.data as Record<string, unknown>)
        : {};

    return {
      success: true,
      message: 'Kundli generated successfully',
      data: {
        id: kundli.id,
        name: body.name || null,
        dob: params.dob,
        tob: params.tob,
        lat: params.lat,
        lon: params.lon,
        timezone: params.timezone,
        lang,
        hash: kundli.hash,
        createdAt: kundli.createdAt,

        report: {
          dasha: astroData.dasha ?? null,
          dosha: astroData.dosha ?? null,

          // Real providers will be connected next.
          birthChart: null,
          navamsaChart: null,
          planetaryPositions: null,
        },
      },
    };
  }
}