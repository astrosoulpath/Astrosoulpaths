import { Module } from '@nestjs/common';
import { GeneralHoroscopeController } from './general-horoscope.controller';
import { GeneralHoroscopeService } from './general-horoscope.service';
import { GeneralHoroscopeInterpretationService } from './general-horoscope-interpretation.service';

@Module({
  controllers: [GeneralHoroscopeController],
  providers: [GeneralHoroscopeService, GeneralHoroscopeInterpretationService],
  exports: [GeneralHoroscopeService],
})
export class GeneralHoroscopeModule {}
