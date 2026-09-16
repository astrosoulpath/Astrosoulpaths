import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FeedbackCategory, FeedbackStatus } from '@prisma/client';

import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';
import { FeedbackService } from './feedback.service';

@Controller('admin/feedback')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class FeedbackAdminController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('status')
    status?: FeedbackStatus,
    @Query('category')
    category?: FeedbackCategory,
  ) {
    return this.feedbackService.getAdminList({
      page,
      limit,
      status,
      category,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.feedbackService.getAdminById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFeedbackStatusDto) {
    return this.feedbackService.updateStatus(id, dto);
  }
}
