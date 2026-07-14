import {
  Controller,
  Get,
  Header,
  Param,
} from '@nestjs/common';

import { AvailabilityService } from './availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Returns public availability information for an astrologer.
   */
  @Get(':astrologerId')
  @Header(
    'Cache-Control',
    'public, max-age=30, stale-while-revalidate=60',
  )
  getAvailability(
    @Param('astrologerId')
    astrologerId: string,
  ) {
    return this.availabilityService.getAvailability(
      astrologerId,
    );
  }
}