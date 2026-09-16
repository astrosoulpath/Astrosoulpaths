import { forwardRef, Module } from '@nestjs/common';

import { AstroService } from './astro.service';
import { AstroController } from './astro.controller';

import { DashaModule } from './modules/dasha/dasha.module';
import { DoshaController } from './modules/dosha/dosha.controller';
import { DoshaModule } from './modules/dosha/dosha.module';

import { AstroCoreModule } from './core/astro-core/astro-core.module';

import { KundliModule } from '../kundli/kundli.module';

import { NumerologyModule } from './modules/numerology/numerology.module';

import { DailyinsightModule } from './modules/dailyinsight/dailyinsight.module';

import { GeoModule } from './modules/geo/geo.module';

import { VedicProvider } from './modules/provider/vedic.provider';
import { ProkeralaProvider } from './modules/provider/prokerala.provider';

@Module({
  imports: [
    DashaModule,

    DoshaModule,

    forwardRef(() => KundliModule),

    AstroCoreModule,

    NumerologyModule,

    DailyinsightModule,

    GeoModule,
  ],

  controllers: [AstroController, DoshaController],

  providers: [AstroService, VedicProvider, ProkeralaProvider],

  exports: [AstroService, VedicProvider, ProkeralaProvider],
})
export class AstroModule {}
