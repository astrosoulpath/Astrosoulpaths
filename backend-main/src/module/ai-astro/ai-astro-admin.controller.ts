import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { AiAstroService } from './ai-astro.service';
import { UpdateAiAstroPricingDto } from './dto/update-ai-astro-pricing.dto';

@Controller('admin/ai-astro')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AiAstroAdminController {
  constructor(private readonly service: AiAstroService) {}

  @Get('pricing')
  getPricing() {
    return this.service.getAdminPricing();
  }

  @Put('pricing/:astrologerId')
  updatePricing(
    @Param('astrologerId')
    astrologerId: string,

    @Body()
    dto: UpdateAiAstroPricingDto,
  ) {
    return this.service.updateAdminPricing(astrologerId, dto);
  }
}
