import { forwardRef, Module } from '@nestjs/common';
import { DashaService } from './dasha.service';
import { DashaController } from './dasha.controller';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';
import { KundliModule } from '../../../kundli/kundli.module';

@Module({
  imports: [AstroCoreModule, forwardRef(() => KundliModule)],
  providers: [DashaService],
  controllers: [DashaController],
  exports: [DashaService],
})
export class DashaModule {}


