import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('astrologers')
  getAstrologers() {
    return this.adminService.getAstrologers();
  }

  @Patch('astrologers/:id/approve')
  approveAstrologer(@Param('id') id: string) {
    return this.adminService.approveAstrologer(id);
  }

  @Patch('astrologers/:id/suspend')
  suspendAstrologer(@Param('id') id: string) {
    return this.adminService.suspendAstrologer(id);
  }
}