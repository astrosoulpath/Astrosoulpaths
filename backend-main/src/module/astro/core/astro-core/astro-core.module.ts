import { Module } from '@nestjs/common';
import { AstroExecutor } from '../astro.executor';
import { VedicProvider } from '../../modules/provider/vedic.provider';
import { ProkeralaProvider } from '../../modules/provider/prokerala.provider';

@Module({
  providers: [AstroExecutor, VedicProvider, ProkeralaProvider],
  exports: [AstroExecutor, VedicProvider, ProkeralaProvider],
})
export class AstroCoreModule {}

