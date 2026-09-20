import { forwardRef, Module } from '@nestjs/common';
import { DoshaService } from './dosha.service';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';
import { KundliModule } from '../../../kundli/kundli.module';

@Module({
  imports: [AstroCoreModule, forwardRef(() => KundliModule)],
  providers: [DoshaService],
  exports: [DoshaService],
})
export class DoshaModule {}

