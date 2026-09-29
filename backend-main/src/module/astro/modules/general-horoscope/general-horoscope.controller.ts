import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeneralHoroscopeService } from './general-horoscope.service';

@Controller('general-horoscope')
export class GeneralHoroscopeController {
  constructor(
    private readonly generalHoroscopeService: GeneralHoroscopeService,
  ) {}

  @Get('daily')
  async daily(
    @Query('moonSign') moonSign?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ) {
    if (!moonSign) {
      throw new BadRequestException('moonSign is required');
    }

    try {
      return this.generalHoroscopeService.daily(moonSign, date, lang ?? 'en');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid request',
      );
    }
  }

  @Get('weekly')
  weekly(
    @Query('moonSign') moonSign?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ) {
    if (!moonSign?.trim()) {
      throw new BadRequestException('moonSign is required');
    }

    try {
      return this.generalHoroscopeService.weekly(moonSign, date, lang ?? 'en');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid request',
      );
    }
  }

  @Get('weekly-love')
  weeklyLove(
    @Query('moonSign') moonSign?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ) {
    if (!moonSign?.trim()) {
      throw new BadRequestException('moonSign is required');
    }

    try {
      return this.generalHoroscopeService.weeklyLove(
        moonSign,
        date,
        lang ?? 'en',
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid request',
      );
    }
  }

  @Get('monthly')
  monthly(
    @Query('moonSign') moonSign?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ) {
    if (!moonSign?.trim()) {
      throw new BadRequestException('moonSign is required');
    }

    try {
      return this.generalHoroscopeService.monthly(moonSign, date, lang ?? 'en');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid request',
      );
    }
  }

  @Get('yearly')
  yearly(
    @Query('moonSign') moonSign?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ) {
    if (!moonSign?.trim()) {
      throw new BadRequestException('moonSign is required');
    }

    try {
      return this.generalHoroscopeService.yearly(moonSign, date, lang ?? 'en');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid request',
      );
    }
  }
  @Get('panchang')
  panchang(
    @Query('date') date?: string,
    @Query('lang') lang?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('timezone') timezone?: string,
    @Query('timezoneName') timezoneName?: string,
    @Query('place') place?: string,
  ) {
    try {
      const hasLocation =
        lat !== undefined ||
        lon !== undefined ||
        timezone !== undefined ||
        Boolean(timezoneName?.trim()) ||
        Boolean(place?.trim());

      const latitude = lat === undefined ? undefined : Number(lat);
      const longitude = lon === undefined ? undefined : Number(lon);
      const timezoneOffset =
        timezone === undefined ? undefined : Number(timezone);

      if (
        lat !== undefined &&
        (!Number.isFinite(latitude) || latitude! < -90 || latitude! > 90)
      ) {
        throw new Error('Invalid latitude.');
      }

      if (
        lon !== undefined &&
        (!Number.isFinite(longitude) || longitude! < -180 || longitude! > 180)
      ) {
        throw new Error('Invalid longitude.');
      }

      if (
        timezone !== undefined &&
        (!Number.isFinite(timezoneOffset) ||
          timezoneOffset! < -12 ||
          timezoneOffset! > 14)
      ) {
        throw new Error('Invalid timezone.');
      }

      return this.generalHoroscopeService.panchang(
        date,
        lang ?? 'en',
        hasLocation ? latitude : undefined,
        hasLocation ? longitude : undefined,
        hasLocation ? timezoneOffset : undefined,
        timezoneName,
        place,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid Panchang request',
      );
    }
  }
}
