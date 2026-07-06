import { Module } from '@nestjs/common';
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

@Module({
  providers: [AstroService],
  controllers: [AstroController, DoshaController],
  imports: [
    DashaModule,
    DoshaModule,
    KundliModule,
    AstroCoreModule,
    NumerologyModule,
    DailyinsightModule,
    GeoModule,
  ],
  exports: [AstroService],
})
export class AstroModule {}
