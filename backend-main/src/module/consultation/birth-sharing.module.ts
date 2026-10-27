import { Body, Controller, Get, Header, Module, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { ConsultationKundliAuthGuard } from '../kundli/guards/consultation-kundli-auth.guard';
import { BirthSharingService } from './birth-sharing.service';

@Controller('consultations/:id/birth-sharing')
@UseGuards(ConsultationKundliAuthGuard)
export class BirthSharingController {
  constructor(private readonly sharing: BirthSharingService) {}
  @Get()
  @Header('Cache-Control', 'no-store, private')
  read(@Req() request: any, @Param('id') id: string, @Query('profileRef') profileRef?: string) {
    return this.sharing.access(request.user.asp_user_id, id, 'read', undefined, undefined, profileRef);
  }
  @Post('grant')
  @Header('Cache-Control', 'no-store, private')
  grant(@Req() request: any, @Param('id') id: string, @Body() body: { policyVersion?: unknown; birthVersion?: unknown; profileRef?: unknown; revision?: unknown }) {
    return this.sharing.access(request.user.asp_user_id, id, 'grant', body?.policyVersion, body?.birthVersion, body?.profileRef, body?.revision);
  }
  @Post('revoke')
  @Header('Cache-Control', 'no-store, private')
  revoke(@Req() request: any, @Param('id') id: string) {
    return this.sharing.access(request.user.asp_user_id, id, 'revoke');
  }
}

/** Routes remain fail-closed until separately approved migration and activation. */
@Module({ imports: [PrismaModule, SupabaseModule], controllers: [BirthSharingController],
  providers: [BirthSharingService, ConsultationKundliAuthGuard] })
export class BirthSharingModule {}
