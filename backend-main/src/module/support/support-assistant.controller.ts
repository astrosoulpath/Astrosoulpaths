import { UseFilters } from '@nestjs/common';
import { SupportErrorFilter } from './support-error.filter';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsIdentityGuard } from '../notifications/notifications-identity.guard';
import { EscalateAssistantDto } from './dto/escalate-assistant.dto';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';
import { SupportAssistantService } from './support-assistant.service';
import { SupportCatalogueService } from './support-catalogue.service';

@UseFilters(SupportErrorFilter)
@Controller('support/assistant')
@UseGuards(NotificationsIdentityGuard)
export class SupportAssistantController {
  constructor(
    private readonly service: SupportAssistantService,
    private readonly catalogue: SupportCatalogueService,
  ) {}

  @Get('config')
  config(@CurrentUser() user: Record<string, any>) {
    return this.catalogue.customer(user);
  }

  @Get('health')
  getProviderHealth() {
    return this.service.getProviderHealth();
  }

  @Post('conversations')
  startConversation(
    @CurrentUser()
    user: Record<string, any>,
  ) {
    return this.service.startOrGetConversation(user);
  }

  @Get('conversations')
  getConversations(
    @CurrentUser()
    user: Record<string, any>,
  ) {
    return this.service.getMyConversations(user);
  }

  @Get('conversations/:conversationId')
  getConversation(
    @CurrentUser()
    user: Record<string, any>,

    @Param('conversationId')
    conversationId: string,
  ) {
    return this.service.getConversation(user, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser()
    user: Record<string, any>,

    @Param('conversationId')
    conversationId: string,

    @Body()
    dto: SendAssistantMessageDto,
  ) {
    return this.service.sendCustomerMessage(user, conversationId, dto);
  }

  @Post('conversations/:conversationId/escalate')
  escalate(
    @CurrentUser()
    user: Record<string, any>,

    @Param('conversationId')
    conversationId: string,

    @Body()
    dto: EscalateAssistantDto,
  ) {
    return this.service.escalateToHumanSupport(user, conversationId, dto);
  }

  @Patch('conversations/:conversationId/close')
  closeConversation(
    @CurrentUser()
    user: Record<string, any>,

    @Param('conversationId')
    conversationId: string,
  ) {
    return this.service.closeConversation(user, conversationId);
  }
}
