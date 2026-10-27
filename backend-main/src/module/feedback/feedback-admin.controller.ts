import {UseFilters} from '@nestjs/common';
import {SupportErrorFilter} from '../support/support-error.filter';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import {CurrentUser} from '../../common/decorators/current-user.decorator';

@UseFilters(SupportErrorFilter)
@Controller('admin/feedback')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class FeedbackAdminController {
  constructor(private readonly feedbackService: FeedbackService) {}
  @Get('stats') stats(){return this.feedbackService.stats();}
  @Get(':id/audit') audit(@Param('id') id:string,@Query('page') page?:string){return this.feedbackService.audit(id,page===undefined?1:Number(page));}
  @Post(':id/escalate') escalate(@CurrentUser() user:{sub?:string},@Param('id') id:string){return this.feedbackService.escalate(user,id);}

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
    @Query('search') search?:string,
  ) {
    return this.feedbackService.getAdminList({
      page,
      limit,
      status,
      category,
      search,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.feedbackService.getAdminById(id);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() user:{sub?:string},@Param('id') id: string, @Body() dto: UpdateFeedbackStatusDto) {
    return this.feedbackService.updateStatus(id, dto,user);
  }
}
