import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { requireAdminRequest } from '../../common/auth/admin-identity-policy';
import { ProductRefundService } from '../payments/product-refund.service';
@Controller('admin/payment-refunds')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminProductRefundController {
  constructor(private readonly refunds:ProductRefundService) {}
  @Post(':orderId/prepare')
  prepare(@Req() request:object,@Param('orderId') id:string,@Body() body:{reason?:unknown}) {
    return this.refunds.prepare(requireAdminRequest(request).id,id,body?.reason);
  }
  @Post(':orderId/submit')
  submit(@Req() request:object,@Param('orderId') id:string,@Body() body:{reason?:unknown}) {
    return this.refunds.submit(requireAdminRequest(request).id,id,body?.reason);
  }
  @Post(':orderId/reconcile')
  reconcile(@Req() request:object,@Param('orderId') id:string,@Body() body:{reason?:unknown}) {
    return this.refunds.reconcile(requireAdminRequest(request).id,id,body?.reason);
  }
}
