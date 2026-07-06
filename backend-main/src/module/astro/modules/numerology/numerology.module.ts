import { Module } from '@nestjs/common';
import { NumerologyService } from './numerology.service';
import { NumerologyController } from './numerology.controller';

@Module({
  providers: [NumerologyService],
  controllers: [NumerologyController]
})
export class NumerologyModule {}
