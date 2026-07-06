import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { GeoService } from './geo.service';
import { SearchCityDto } from './dto/search-city.dto';
import { Public } from '../../../../common/decorators/public.decorator';

@Public()
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  // 🔥 CITY AUTOCOMPLETE SEARCH
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchCity(@Body() dto: SearchCityDto) {
    return this.geoService.searchCity(dto.city);
  }
}
