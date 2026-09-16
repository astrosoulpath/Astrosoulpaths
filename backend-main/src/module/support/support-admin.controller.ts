import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AdminAssignSupportTicketDto } from './dto/admin-assign-support-ticket.dto';
import { AdminSendSupportMessageDto } from './dto/admin-send-support-message.dto';
import { AdminUpdateSupportPriorityDto } from './dto/admin-update-support-priority.dto';
import { AdminUpdateSupportStatusDto } from './dto/admin-update-support-status.dto';
import { SupportAdminService } from './support-admin.service';

@Controller('admin/support')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class SupportAdminController {
  constructor(private readonly service: SupportAdminService) {}

  @Get('stats')
  getStats() {
    return this.service.dashboardStats();
  }

  @Get('tickets')
  getTickets(
    @Query('status')
    status?: SupportTicketStatus,

    @Query('priority')
    priority?: SupportTicketPriority,

    @Query('assignedAdminId')
    assignedAdminId?: string,

    @Query('search')
    search?: string,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.service.getTickets({
      status,
      priority,
      assignedAdminId: assignedAdminId?.trim() || undefined,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('tickets/:ticketId')
  getTicket(
    @Param('ticketId')
    ticketId: string,
  ) {
    return this.service.getTicket(ticketId);
  }

  @Patch('tickets/:ticketId/assign')
  assignTicket(
    @CurrentUser()
    user: Record<string, any>,

    @Param('ticketId')
    ticketId: string,

    @Body()
    dto: AdminAssignSupportTicketDto,
  ) {
    return this.service.assignTicket(user, ticketId, dto.adminUserId);
  }

  @Patch('tickets/:ticketId/unassign')
  unassignTicket(
    @Param('ticketId')
    ticketId: string,
  ) {
    return this.service.unassignTicket(ticketId);
  }

  @Patch('tickets/:ticketId/priority')
  updatePriority(
    @Param('ticketId')
    ticketId: string,

    @Body()
    dto: AdminUpdateSupportPriorityDto,
  ) {
    return this.service.updatePriority(ticketId, dto.priority);
  }

  @Patch('tickets/:ticketId/status')
  updateStatus(
    @Param('ticketId')
    ticketId: string,

    @Body()
    dto: AdminUpdateSupportStatusDto,
  ) {
    return this.service.updateStatus(ticketId, dto.status);
  }

  @Post('tickets/:ticketId/messages')
  reply(
    @CurrentUser()
    user: Record<string, any>,

    @Param('ticketId')
    ticketId: string,

    @Body()
    dto: AdminSendSupportMessageDto,
  ) {
    return this.service.reply(user, ticketId, dto);
  }

  @Patch('tickets/:ticketId/read')
  markRead(
    @CurrentUser()
    user: Record<string, any>,

    @Param('ticketId')
    ticketId: string,
  ) {
    return this.service.markCustomerMessagesRead(user, ticketId);
  }
}
