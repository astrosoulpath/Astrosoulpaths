import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  Header,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsObject, Min } from 'class-validator';
import type { Request } from 'express';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { requireAdminRequest } from '../../common/auth/admin-identity-policy';
import { AboutCmsService } from './about-cms.service';
class AboutSaveDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsObject() content!: Record<string, unknown>;
  @IsBoolean() publish!: boolean;
}
type AdminRequest = Request & { user?: { sub?: unknown } };
@Controller('app-config/about')
export class AboutPublicController {
  constructor(private readonly service: AboutCmsService) {}
  @Get() @Header('Cache-Control', 'no-store') get() {
    return this.service.published();
  }
}
@Controller('admin/content/about')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AboutAdminController {
  constructor(private readonly service: AboutCmsService) {}
  @Get() get(@Req() request: AdminRequest) {
    requireAdminRequest(request);
    return this.service.admin();
  }
  @Put() save(@Req() request: AdminRequest, @Body() body: AboutSaveDto) {
    const actor = requireAdminRequest(request);
    return this.service.save(
      actor.id,
      body.expectedRevision,
      body.content,
      body.publish,
    );
  }
}
