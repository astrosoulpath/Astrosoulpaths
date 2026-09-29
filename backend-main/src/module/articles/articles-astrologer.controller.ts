import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ArticlesService } from './articles.service';

@Controller('astrologer/articles')
@UseGuards(SupabaseAuthGuard)
export class ArticlesAstrologerController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  list(@CurrentUser() user: JWTPayload) {
    return this.articlesService.listAstrologerArticles(user.sub as string);
  }

  @Post()
  submit(@CurrentUser() user: JWTPayload, @Body() body: any) {
    return this.articlesService.submitAstrologerArticle(
      user.sub as string,
      body,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.articlesService.updateAstrologerArticle(
      user.sub as string,
      id,
      body,
    );
  }
}