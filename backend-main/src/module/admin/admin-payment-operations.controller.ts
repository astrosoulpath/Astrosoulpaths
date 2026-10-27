import { Body, Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { requireAdminRequest } from '../../common/auth/admin-identity-policy';
import { AdminPaymentOperationsService } from './admin-payment-operations.service';

@Controller('admin/payment-operations')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminPaymentOperationsController {
  constructor(private readonly operations:AdminPaymentOperationsService) {}
  @Get(':id')
  detail(@Req() request:object, @Param('id') id:string) {
    requireAdminRequest(request);
    return this.operations.detail(id);
  }
  @Post(':id/reconcile')
  reconcile(@Req() request:object, @Param('id') id:string,
    @Body() body:{reason?:unknown;requestKey?:unknown}) {
    const admin = requireAdminRequest(request);
    return this.operations.reconcile(admin.id,id,body);
  }
}
