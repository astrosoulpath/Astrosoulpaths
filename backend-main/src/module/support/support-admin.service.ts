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
    if (!authUser) {
      throw new UnauthorizedException('Admin authentication required.');
    }

    const directId = authUser.id?.trim() || authUser.userId?.trim();

    if (directId) {
      const user = await this.prisma.user.findUnique({
        where: {
          id: directId,
        },
      });

      if (user) {
        return user;
      }
    }

    const supabaseId = authUser.supabaseId?.trim() || authUser.sub?.trim();

    if (supabaseId) {
      const user = await this.prisma.user.findUnique({
        where: {
          supabaseId,
        },
      });

      if (user) {
        return user;
      }
    }

    if (authUser.email?.trim()) {
      const user = await this.prisma.user.findUnique({
        where: {
          email: authUser.email.trim(),
        },
      });

      if (user) {
        return user;
      }
    }

    throw new UnauthorizedException('Admin user could not be resolved.');
  }

  async getTickets(filters: AdminTicketFilters) {
    const page = Math.max(1, filters.page ?? 1);

    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

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

    if (!targetAdmin.isActive) {
      throw new BadRequestException(
        'Cannot assign ticket to an inactive admin.',
      );
    }

    const updated = await this.prisma.supportTicket.update({
      where: {
        id: ticketId,
      },

      data: {
        assignedAdminId: targetAdmin.id,

        status:
          ticket.status === SupportTicketStatus.OPEN
            ? SupportTicketStatus.IN_PROGRESS
            : ticket.status,
      },

      include: {
        assignedAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      ticket: updated,
    };
  }

  async unassignTicket(ticketId: string) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: {
        id: ticketId,
      },

      data: {
        assignedAdminId: null,
      },
    });

    return {
      success: true,
      ticket,
    };
  }

  async updatePriority(ticketId: string, priority: SupportTicketPriority) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: {
        id: ticketId,
      },

      data: {
        priority,
      },
    });

    return {
      success: true,
      ticket,
    };
  }

  async updateStatus(ticketId: string, status: SupportTicketStatus) {
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

    const ticket = await this.prisma.supportTicket.update({
      where: {
        id: ticketId,
      },

      data: {
        status,

        resolvedAt:
          status === SupportTicketStatus.RESOLVED
            ? now
            : status === SupportTicketStatus.OPEN ||
                status === SupportTicketStatus.IN_PROGRESS
              ? null
              : undefined,

        closedAt: status === SupportTicketStatus.CLOSED ? now : null,
      },
    });

    if (existing.status !== status) {
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

      if (
        mailTicket &&
        (mailTicket.contactEmail || mailTicket.customer.email)
      ) {
        try {
          await this.mailService.sendSupportStatusChanged({
            to: (mailTicket.contactEmail || mailTicket.customer.email)!,
            customerName: mailTicket.customer.name,
            ticketNumber: mailTicket.ticketNumber,
            subject: mailTicket.subject,
            status,
          });
        } catch (error) {
          this.logger.error(
            `Support status email failed for ticket ${mailTicket.ticketNumber}. Status remains saved.`,
            error instanceof Error ? error.stack : String(error),
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

    const content = dto.content.trim();

    const clientMessageId = dto.clientMessageId?.trim() || null;

    if (clientMessageId) {
      const duplicate = await this.prisma.supportMessage.findFirst({
        where: {
          senderUserId: admin.id,
          clientMessageId,
        },
      });

      if (duplicate) {
        return {
          success: true,
          duplicate: true,
          message: duplicate,
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
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

          assignedAdminId: ticket.assignedAdminId || admin.id,

          status:
            ticket.status === SupportTicketStatus.OPEN
              ? SupportTicketStatus.IN_PROGRESS
              : ticket.status,

          adminLastReadAt: new Date(),
        },
      });

      return {
        message,
        ticket: updatedTicket,
      };
    });

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

    if (mailTicket && (mailTicket.contactEmail || mailTicket.customer.email)) {
      try {
        await this.mailService.sendSupportAdminReply({
          to: (mailTicket.contactEmail || mailTicket.customer.email)!,
          customerName: mailTicket.customer.name,
          ticketNumber: mailTicket.ticketNumber,
          subject: mailTicket.subject,
          message: content,
        });
      } catch (error) {
        this.logger.error(
          `Support reply email failed for ticket ${mailTicket.ticketNumber}. Reply remains saved.`,
          error instanceof Error ? error.stack : String(error),
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
              not: SupportTicketStatus.CLOSED,
            },
          },
        }),

        this.prisma.supportTicket.count({
          where: {
            assignedAdminId: null,

            status: {
              in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
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
