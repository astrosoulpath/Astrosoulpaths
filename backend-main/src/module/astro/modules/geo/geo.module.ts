import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';

@Module({
  imports: [AstroCoreModule],
  providers: [GeoService],
  controllers: [GeoController],
})
export class GeoModule {}
