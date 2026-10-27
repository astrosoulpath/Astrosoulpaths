import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { NotificationsIdentityGuard } from './notifications-identity.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { requireAdminRequest } from '../../common/auth/admin-identity-policy';
import { SmartNotificationsService } from './smart-notifications.service';
import { SmartPolicyService } from './smart-policy.service';
import type { SmartPolicyControls } from './smart-policy.service';
import type { SmartCategory } from './smart-astrology.catalog';

@Controller('admin/notifications/policies')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class SmartPolicyController {
  constructor(private readonly policies:SmartPolicyService) {}
  @Get() list() {return this.policies.list();}
  @Get('metrics') metrics() {return this.policies.metrics();}
  @Get('preview/:category/:locale') preview(@Param('category') category:SmartCategory,@Param('locale') locale:string) {return this.policies.preview(category,locale);}
  @Post(':category/disable') disable(@Req() request:any,@Param('category') category:string) {return this.policies.disable(requireAdminRequest(request).id,category);}
  @Post(':category') update(@Req() request:any,@Param('category') category:string,@Body() input:SmartPolicyControls) {
    return this.policies.update(requireAdminRequest(request).id,category,input);
  }
}

@Controller('admin/notifications/campaigns')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class SmartCampaignController {
  constructor(private readonly smart: SmartNotificationsService) {}
  @Get() list() { return this.smart.listCampaigns(); }
  @Get('storage-readiness') readiness() { return this.smart.storageReadiness(); }
  @Get(':id/status') status(@Param('id') id: string) { return this.smart.campaignStatus(id); }
  @Post() create(@Req() request: any, @Body() body: Parameters<SmartNotificationsService['createCampaign']>[1]) {
    return this.smart.createCampaign(requireAdminRequest(request).id, body);
  }
  @Post(':id/transition') transition(@Req() request: any, @Param('id') id: string, @Body() body: Parameters<SmartNotificationsService['transition']>[2]) {
    return this.smart.transition(requireAdminRequest(request).id, id, body);
  }
  @Post(':id/draft') edit(@Req() request: any, @Param('id') id: string, @Body() body: Parameters<SmartNotificationsService['editDraft']>[2]) {
    return this.smart.editDraft(requireAdminRequest(request).id, id, body);
  }
}

@Controller('notifications/insights')
@UseGuards(NotificationsIdentityGuard)
export class SmartInsightController {
  constructor(private readonly smart: SmartNotificationsService) {}
  @Get(':id') get(@Req() request: any, @Param('id') id: string) {
    return this.smart.getInsight(request.user?.sub ?? '', id);
  }
  @Post(':id/open') opened(@Req() request:any,@Param('id') id:string) { return this.smart.markOpened(request.user?.sub??'',id); }
  @Post('preferences/:category') consent(@Req() request: any, @Param('category') category: string, @Body() body: Parameters<SmartNotificationsService['setConsent']>[2]) {
    return this.smart.setConsent(request.user?.sub ?? '', category, body);
  }
}
