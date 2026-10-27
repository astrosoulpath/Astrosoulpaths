import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConsultationKundliAuthGuard } from './guards/consultation-kundli-auth.guard';
import type { JWTPayload } from 'jose';
import { ConsultationKundliV1Service } from './consultation-kundli-v1.service';
import {
  GenerateConsultationKundliDto,
  GrantConsultationKundliDto,
} from './dto/consultation-kundli.dto';
import { ConsultationKundliErrorFilter } from './consultation-kundli-error.filter';

/** Prepared API. Deliberately NOT registered in KundliModule/AppModule. */
@Controller('kundli/v1/consultations')
@UseGuards(ConsultationKundliAuthGuard)
@UseFilters(ConsultationKundliErrorFilter)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ConsultationKundliV1Controller {
  constructor(private readonly service: ConsultationKundliV1Service) {}
  private subject(user: JWTPayload) {
    if (typeof user?.sub !== 'string' || !user.sub.trim())
      throw new UnauthorizedException('Canonical authentication required');
    return user.sub;
  }
  @Get(':id/consent')
  status(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.service.status(
      this.subject(user),
      id,
      typeof user.asp_context === 'string' ? user.asp_context : undefined,
    );
  }
  @Post(':id/consent')
  grant(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() body: GrantConsultationKundliDto,
  ) {
    return this.service.grant(this.subject(user), id, body);
  }
  @Delete(':id/consent')
  revoke(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.service.revoke(this.subject(user), id);
  }
  @Post(':id/generate')
  generate(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() body: GenerateConsultationKundliDto,
  ) {
    return this.service.generate(
      this.subject(user),
      id,
      body?.requestKey ?? '',
      body?.lang ?? 'en',
      user.exp,
    );
  }
}
