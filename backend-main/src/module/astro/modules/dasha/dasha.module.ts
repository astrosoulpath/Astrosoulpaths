import { Module } from '@nestjs/common';
import { DashaService } from './dasha.service';
import { DashaController } from './dasha.controller';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';

@Module({
  imports: [AstroCoreModule],
  providers: [DashaService],
  controllers: [DashaController],
  exports: [DashaService],
})
export class DashaModule {}
