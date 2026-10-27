import { requireSupportOperations, auditSupport } from './support-operations';
import {
  changeSupportTicket,
  resolveSupportActor,
  supportPage,
  supportText,
  supportLock,
  supportDuplicate,
} from './support-policy';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SupportSenderType,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AdminSendSupportMessageDto } from './dto/admin-send-support-message.dto';
import { SupportAttachmentService } from './support-attachment.service';

type AuthUserLike = {
  id?: string;
  userId?: string;
  sub?: string;
  supabaseId?: string;
  email?: string;
  phone?: string;
};

type AdminTicketFilters = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedAdminId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class SupportAdminService {
  private readonly logger = new Logger(SupportAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly attachmentService: SupportAttachmentService,
  ) {}

  private async resolveAdmin(authUser: AuthUserLike) {
    return resolveSupportActor(this.prisma, authUser, true);
  }

  async assistantConversations(authUser: AuthUserLike, page = 1) {
    await this.resolveAdmin(authUser);
    const paging = supportPage({ page, limit: 20 });
    const conversations = await this.prisma.assistantConversation.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (paging.page - 1) * 20,
      take: 20,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        supportTicketId: true,
      },
    });
    return { conversations, page: paging.page };
  }
  async assistantConversation(authUser: AuthUserLike, id: string) {
    await this.resolveAdmin(authUser);
    const conversation = await this.prisma.assistantConversation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        supportTicketId: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            content: true,
            senderType: true,
            createdAt: true,
          },
        },
      },
    });
    if (!conversation)
      throw new NotFoundException('Support conversation not found');
    return { ...conversation, messages: conversation.messages.reverse() };
  }

  async getTickets(filters: AdminTicketFilters) {
    const { page, limit } = supportPage(filters);

    const search = filters.search?.trim() || undefined;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assignedAdminId) {
      where.assignedAdminId = filters.assignedAdminId;
    }

    if (search) {
      where.OR = [
        {
          ticketNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          subject: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customer: {
            is: {
              OR: [
                {
                  email: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  phone: {
                    contains: search,
                  },
                },
              ],
            },
          },
        },
      ];
    }

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,

        skip: (page - 1) * limit,

        take: limit,

        orderBy: [
          {
            lastMessageAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
          { id: 'desc' },
        ],

        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          assignedAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      this.prisma.supportTicket.count({
        where,
      }),
    ]);

    return {
      success: true,

      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },

      tickets,
    };
  }

  async getTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },

        assignedAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        messages: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            senderUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },

        assistantConversation: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            escalatedAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const attachments = await Promise.all(
      ticket.attachments.map(async (attachment) => ({
        ...attachment,
        url: await this.attachmentService.createSignedUrl(
          attachment.storageBucket,
          attachment.storagePath,
          ticket.id,
        ),
      })),
    );

    return {
      success: true,
      ticket: {
        ...ticket,
        attachments,
      },
    };
  }

  async assignTicket(
    authUser: AuthUserLike,
    ticketId: string,
    requestedAdminUserId?: string,
  ) {
    const currentAdmin = await this.resolveAdmin(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const adminUserId = requestedAdminUserId?.trim() || currentAdmin.id;

    const targetAdmin = await this.prisma.user.findUnique({
      where: {
        id: adminUserId,
      },

      select: {
        id: true,
        roleId: true,
        isActive: true,
        isBlocked: true,
        name: true,
        email: true,

        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!targetAdmin) {
      throw new BadRequestException('Target support user was not found.');
    }

    const targetRole = targetAdmin.role?.name?.trim().toLowerCase();

    if (targetRole !== 'admin') {
      throw new BadRequestException(
        'Support ticket can only be assigned to an admin.',
      );
    }

    if (!targetAdmin.isActive || targetAdmin.isBlocked) {
      throw new BadRequestException(
        'Cannot assign ticket to an inactive admin.',
      );
    }

    const updated = await changeSupportTicket(
      this.prisma,
      currentAdmin.id,
      ticketId,
      'ASSIGNED',
      (current) => ({
        assignedAdminId: targetAdmin.id,
        status:
          current.status === SupportTicketStatus.OPEN
            ? SupportTicketStatus.IN_PROGRESS
            : current.status,
      }),
    );

    return {
      success: true,
      ticket: updated,
    };
  }

  async unassignTicket(ticketId: string, authUser: AuthUserLike) {
    const admin = await this.resolveAdmin(authUser);
    return {
      success: true,
      ticket: await changeSupportTicket(
        this.prisma,
        admin.id,
        ticketId,
        'UNASSIGNED',
        () => ({ assignedAdminId: null }),
      ),
    };
  }

  async updatePriority(
    ticketId: string,
    priority: SupportTicketPriority,
    authUser: AuthUserLike,
  ) {
    if (!Object.values(SupportTicketPriority).includes(priority))
      throw new BadRequestException('Invalid priority');
    const admin = await this.resolveAdmin(authUser);
    return {
      success: true,
      ticket: await changeSupportTicket(
        this.prisma,
        admin.id,
        ticketId,
        'PRIORITY_CHANGED',
        () => ({ priority }),
      ),
    };
  }

  async updateStatus(
    ticketId: string,
    status: SupportTicketStatus,
    authUser: AuthUserLike,
    resolutionNote?: string,
  ) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Support ticket not found.');
    }

    const now = new Date();

    const admin = await this.resolveAdmin(authUser);
    if (!Object.values(SupportTicketStatus).includes(status))
      throw new BadRequestException('Invalid status');
    if (resolutionNote) {
      requireSupportOperations();
      supportText(resolutionNote, 3000);
      if (status !== SupportTicketStatus.RESOLVED)
        throw new BadRequestException(
          'Resolution note requires resolved status',
        );
    }
    let changed = false;
    const ticket = await changeSupportTicket(
      this.prisma,
      admin.id,
      ticketId,
      'STATUS_CHANGED',
      (current) => {
        changed = current.status !== status;
        return changed
          ? {
              status,
              resolvedAt: status === SupportTicketStatus.RESOLVED ? now : null,
              closedAt: status === SupportTicketStatus.CLOSED ? now : null,
            }
          : {};
      },
      async (tx) => {
        if (resolutionNote)
          await tx.supportMessage.create({
            data: {
              ticketId,
              senderType: SupportSenderType.SYSTEM,
              senderUserId: admin.id,
              content: supportText(resolutionNote, 3000),
            },
          });
      },
    );

    if (changed) {
      const mailTicket = await this.prisma.supportTicket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          ticketNumber: true,
          subject: true,
          contactEmail: true,
          customer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (mailTicket && mailTicket.customer.email) {
        try {
          await this.mailService.sendSupportStatusChanged({
            to: mailTicket.customer.email!,
            customerName: mailTicket.customer.name,
            ticketNumber: mailTicket.ticketNumber,
            subject: mailTicket.subject,
            status,
          });
        } catch (error) {
          this.logger.error(
            `Support status email failed for ticket ${mailTicket.ticketNumber}. Status remains saved.`,
            'SUPPORT_MAIL_FAILED',
          );
        }
      } else if (mailTicket) {
        this.logger.warn(
          `Support status email skipped for ticket ${mailTicket.ticketNumber}: customer has no email.`,
        );
      }
    }

    return {
      success: true,
      ticket,
    };
  }

  async reply(
    authUser: AuthUserLike,
    ticketId: string,
    dto: AdminSendSupportMessageDto,
  ) {
    const admin = await this.resolveAdmin(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        status: true,
        assignedAdminId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.status === SupportTicketStatus.CLOSED) {
      throw new BadRequestException(
        'Closed ticket must be reopened before replying.',
      );
    }

    const content = supportText(dto.content, 5000);

    const clientMessageId = dto.clientMessageId?.trim() || null;

    if (clientMessageId) {
      const duplicate = await this.prisma.supportMessage.findFirst({
        where: {
          senderUserId: admin.id,
          clientMessageId,
        },
      });

      if (duplicate) {
        if (duplicate.ticketId !== ticketId)
          throw new BadRequestException(
            'Message key belongs to another ticket',
          );
        return {
          success: true,
          duplicate: true,
          message: duplicate,
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'sender:' + admin.id);
      await supportLock(tx, 'ticket:' + ticketId);
      const current = await tx.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!current || current.status === SupportTicketStatus.CLOSED)
        throw new BadRequestException('Reopen the ticket before replying');
      const duplicate = await supportDuplicate(
        tx,
        admin.id,
        ticketId,
        clientMessageId,
      );
      if (duplicate)
        return { message: duplicate, ticket: current, duplicate: true };
      const message = await tx.supportMessage.create({
        data: {
          ticketId,

          senderType: SupportSenderType.ADMIN,

          senderUserId: admin.id,

          content,

          clientMessageId,

          isRead: false,
        },
      });

      const updatedTicket = await tx.supportTicket.update({
        where: {
          id: ticketId,
        },

        data: {
          lastMessageAt: new Date(),

          assignedAdminId: current.assignedAdminId || admin.id,

          status:
            current.status === SupportTicketStatus.OPEN
              ? SupportTicketStatus.IN_PROGRESS
              : current.status,

          adminLastReadAt: new Date(),
        },
      });

      await auditSupport(
        tx,
        admin.id,
        'TICKET',
        ticketId,
        'ADMIN_REPLY',
        {},
        current.customerId,
        'message:' + message.id,
      );
      return {
        message,
        ticket: updatedTicket,
      };
    });

    if ('duplicate' in result && result.duplicate)
      return { success: true, ...result };
    const mailTicket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },
      select: {
        ticketNumber: true,
        subject: true,
        contactEmail: true,
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (mailTicket && mailTicket.customer.email) {
      try {
        await this.mailService.sendSupportAdminReply({
          to: mailTicket.customer.email!,
          customerName: mailTicket.customer.name,
          ticketNumber: mailTicket.ticketNumber,
          subject: mailTicket.subject,
          message: content,
        });
      } catch (error) {
        this.logger.error(
          `Support reply email failed for ticket ${mailTicket.ticketNumber}. Reply remains saved.`,
          'SUPPORT_MAIL_FAILED',
        );
      }
    } else if (mailTicket) {
      this.logger.warn(
        `Support reply email skipped for ticket ${mailTicket.ticketNumber}: customer has no email.`,
      );
    }

    return {
      success: true,
      duplicate: false,
      ...result,
    };
  }

  async markCustomerMessagesRead(authUser: AuthUserLike, ticketId: string) {
    await this.resolveAdmin(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportMessage.updateMany({
        where: {
          ticketId,

          senderType: SupportSenderType.CUSTOMER,

          isRead: false,
        },

        data: {
          isRead: true,
          readAt: now,
        },
      });

      await tx.supportTicket.update({
        where: {
          id: ticketId,
        },

        data: {
          adminLastReadAt: now,
        },
      });

      return updated;
    });

    return {
      success: true,
      markedRead: result.count,
      readAt: now,
    };
  }

  async dashboardStats() {
    const [open, inProgress, waiting, resolved, closed, urgent, unassigned] =
      await this.prisma.$transaction([
        this.prisma.supportTicket.count({
          where: {
            status: SupportTicketStatus.OPEN,
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            status: SupportTicketStatus.IN_PROGRESS,
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            status: SupportTicketStatus.WAITING_FOR_CUSTOMER,
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            status: SupportTicketStatus.RESOLVED,
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            status: SupportTicketStatus.CLOSED,
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            priority: SupportTicketPriority.URGENT,

            status: {
              in: [
                SupportTicketStatus.OPEN,
                SupportTicketStatus.IN_PROGRESS,
                SupportTicketStatus.WAITING_FOR_CUSTOMER,
              ],
            },
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            assignedAdminId: null,

            status: {
              in: [
                SupportTicketStatus.OPEN,
                SupportTicketStatus.IN_PROGRESS,
                SupportTicketStatus.WAITING_FOR_CUSTOMER,
              ],
            },
          },
        }),
      ]);

    return {
      success: true,

      stats: {
        open,
        inProgress,
        waitingForCustomer: waiting,
        resolved,
        closed,
        urgent,
        unassigned,

        active: open + inProgress + waiting,
      },
    };
  }
}
