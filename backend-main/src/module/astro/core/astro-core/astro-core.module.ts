import { Module } from '@nestjs/common';
import { AstroExecutor } from '../astro.executor';
import { VedicProvider } from '../../modules/provider/vedic.provider';

@Module({
  providers: [AstroExecutor, VedicProvider],
  exports: [AstroExecutor, VedicProvider],
})
export class AstroCoreModule {}
