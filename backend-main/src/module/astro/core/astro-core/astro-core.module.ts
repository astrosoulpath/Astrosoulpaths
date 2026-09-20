import { Module } from '@nestjs/common';
import { AstroExecutor } from '../astro.executor';

@Module({
  providers: [AstroExecutor],
  exports: [AstroExecutor],
})
export class AstroCoreModule {}


