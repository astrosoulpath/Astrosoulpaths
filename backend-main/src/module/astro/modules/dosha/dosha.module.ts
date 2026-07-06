import { Module } from '@nestjs/common';
import { DoshaService } from './dosha.service';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';

@Module({
  imports: [AstroCoreModule],
  providers: [DoshaService],
  exports: [DoshaService],
})
export class DoshaModule {}
