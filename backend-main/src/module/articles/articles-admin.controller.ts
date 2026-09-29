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
  create(
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.create(body, user.sub as string);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.approve(
      id,
      user.sub as string,
      body?.publishedAt,
    );
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.reject(
      id,
      user.sub as string,
      body?.reviewNote,
    );
  }

  @Patch(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.setPublished(
      id,
      true,
      body?.publishedAt,
      user.sub as string,
    );
  }

  @Patch(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentUserDecorator() user: JWTPayload,
  ) {
    return this.articlesService.setPublished(
      id,
      false,
      undefined,
      user.sub as string,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.articlesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}