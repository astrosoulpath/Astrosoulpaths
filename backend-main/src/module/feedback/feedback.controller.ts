import {UseFilters} from '@nestjs/common';
import {SupportErrorFilter} from '../support/support-error.filter';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsIdentityGuard } from '../notifications/notifications-identity.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@UseFilters(SupportErrorFilter)
@Controller('feedback')
@UseGuards(NotificationsIdentityGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@CurrentUser() user: JWTPayload, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(user.sub as string, dto);
  }

  @Get('my')
  getMine(@CurrentUser() user: JWTPayload,@Query('page') page?:string) {
    return this.feedbackService.getMine(user.sub as string,page===undefined?1:Number(page));
  }
}
