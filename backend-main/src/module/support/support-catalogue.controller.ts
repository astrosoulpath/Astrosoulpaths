import {
  Body,
  Controller,
  Get,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsObject, Min, IsOptional, IsIn } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { SupportErrorFilter } from './support-error.filter';
import { SupportCatalogueService } from './support-catalogue.service';
class CatalogueDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsObject() config!: Record<string, unknown>;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISH']) action?: 'DRAFT' | 'PUBLISH';
}
@Controller('admin/support/assistant/config')
@UseFilters(SupportErrorFilter)
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class SupportCatalogueController {
  constructor(private readonly service: SupportCatalogueService) {}
  @Get() get(@CurrentUser() actor: any) {
    return this.service.admin(actor);
  }
  @Put() save(@CurrentUser() actor: any, @Body() body: CatalogueDto) {
    return this.service.save(actor, body);
  }
}
