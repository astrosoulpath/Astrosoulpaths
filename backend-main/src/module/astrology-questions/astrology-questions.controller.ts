import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { AstrologyAiService } from './astrology-ai.service';
import { AstrologyQuestionsService } from './astrology-questions.service';
import { GenerateAstrologyAnswerDto } from './dto/generate-astrology-answer.dto';

@Controller('astrology-questions')
export class AstrologyQuestionsController {
  constructor(
    private readonly astrologyQuestionsService: AstrologyQuestionsService,
    private readonly astrologyAiService: AstrologyAiService,
  ) {}

  @Get('categories')
  getCategories() {
    return this.astrologyQuestionsService.getCategories();
  }

  @Get('categories/:slug/questions')
  getQuestionsByCategory(@Param('slug') slug: string) {
    return this.astrologyQuestionsService.getQuestionsByCategory(slug);
  }

  @Post('answer')
  @UseGuards(SupabaseAuthGuard)
  generateAnswer(
    @CurrentUser() user: JWTPayload,
    @Body() body: GenerateAstrologyAnswerDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    return this.astrologyAiService.generateAnswer(
      supabaseUserId,
      body.questionId,
      body.categorySlug,
    );
  }
}
