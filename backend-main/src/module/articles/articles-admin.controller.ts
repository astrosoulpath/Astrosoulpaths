import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser as CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ArticlesService } from './articles.service';

@Controller('admin/articles')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ArticlesAdminController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.articlesService.adminList(status);
  }

  @Post()
  create(@Body() body: any, @CurrentUserDecorator() user: JWTPayload) {
    return this.articlesService.adminMutation(
      'CREATE',
      user.sub as string,
      undefined,
      body,
    );
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.adminMutation(
      'APPROVE',
      user.sub as string,
      id,
      body || {},
    );
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.adminMutation(
      'REJECT',
      user.sub as string,
      id,
      body || {},
    );
  }

  @Patch(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.adminMutation(
      'PUBLISH',
      user.sub as string,
      id,
      body || {},
    );
  }

  @Patch(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentUserDecorator() user: JWTPayload,
    @Body() body: unknown,
  ) {
    return this.articlesService.adminMutation(
      'UNPUBLISH',
      user.sub as string,
      id,
      body || {},
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.adminMutation(
      'UPDATE',
      user.sub as string,
      id,
      body,
    );
  }

  @Get(':id/audit') audit(@Param('id') id: string) {
    return this.articlesService.adminAudit(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserDecorator() user: JWTPayload) {
    return this.articlesService.adminMutation('DELETE', user.sub as string, id);
  }
}
