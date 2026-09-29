import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  feed(
    @Query('locale') locale?: string,
    @Query('country') country?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.articlesService.publicFeed(locale, country, category, limit);
  }

  @Get('astrologer/:astrologerId')
  astrologerPosts(
    @Param('astrologerId') astrologerId: string,
    @Query('locale') locale?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    return this.articlesService.publicAstrologerPosts(
      astrologerId,
      locale,
      country,
      limit,
    );
  }
  @Get(':slug')
  detail(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
    @Query('country') country?: string,
  ) {
    return this.articlesService.publicDetail(slug, locale, country);
  }
}
