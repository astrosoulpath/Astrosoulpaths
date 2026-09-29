import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologyVideosService } from './astrology-videos.service';

@Controller('admin/videos')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AstrologyVideosAdminController {
  constructor(private readonly videosService: AstrologyVideosService) {}

  @Get()
  list() {
    return this.videosService.adminList();
  }

  @Post()
  create(@Body() body: any) {
    return this.videosService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.videosService.update(id, body);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.videosService.setPublished(id, true);
  }

  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.videosService.setPublished(id, false);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }
}
