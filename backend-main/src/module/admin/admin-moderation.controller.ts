import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AdminModerationService } from './admin-moderation.service';
import { ModerationKind } from './admin-moderation.policy';
function kind(value: string): ModerationKind {
  if (value === 'customers') return 'CUSTOMER';
  if (value === 'astrologers') return 'ASTROLOGER';
  throw new NotFoundException('Moderation subject not found');
}
@Controller('admin/moderation')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminModerationController {
  constructor(private readonly service: AdminModerationService) {}
  @Get('capabilities') capabilities() {
    return this.service.capabilities();
  }
  @Get(':kind/:id') snapshot(
    @Req() request: Parameters<AdminModerationService['snapshot']>[0],
    @Param('kind') subject: string,
    @Param('id') id: string,
  ) {
    return this.service.snapshot(request, kind(subject), id);
  }
  @Patch(':kind/:id') execute(
    @Req() request: Parameters<AdminModerationService['execute']>[0],
    @Param('kind') subject: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.execute(request, kind(subject), id, body);
  }
}
