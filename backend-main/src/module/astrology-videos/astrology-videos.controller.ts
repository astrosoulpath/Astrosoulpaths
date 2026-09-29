import { Controller, Get, Param, Query } from '@nestjs/common';
import { AstrologyVideosService } from './astrology-videos.service';

@Controller('videos')
export class AstrologyVideosController {
  constructor(private readonly videosService: AstrologyVideosService) {}

  @Get()
  feed(
    @Query('locale') locale?: string,
    @Query('category') category?: string,
    @Query('country') country?: string,
  ) {
    return this.videosService.publicFeed(locale, category, country);
  }

  @Get(':id')
  detail(
    @Param('id') id: string,
    @Query('locale') locale?: string,
    @Query('country') country?: string,
  ) {
    return this.videosService.publicDetail(id, locale, country);
  }
}
