import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(SupabaseAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@CurrentUser() user: JWTPayload, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(user.sub as string, dto);
  }

  @Get('my')
  getMine(@CurrentUser() user: JWTPayload) {
    return this.feedbackService.getMine(user.sub as string);
  }
}
