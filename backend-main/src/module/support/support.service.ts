import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SupportSenderType,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportAttachmentService } from './support-attachment.service';

type AuthUserLike = {
  id?: string;
  userId?: string;
  sub?: string;
  supabaseId?: string;
  email?: string;
  phone?: string;
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly attachmentService: SupportAttachmentService,
  ) {}

  private async resolveCustomer(authUser: AuthUserLike) {
    if (!authUser) {
      throw new UnauthorizedException('Authentication required.');
    }

    const directId = authUser.id?.trim() || authUser.userId?.trim();

    if (directId) {
      const user = await this.prisma.user.findUnique({
        where: { id: directId },
      });

      if (user) {
        return user;
      }
    }

    const supabaseId = authUser.supabaseId?.trim() || authUser.sub?.trim();

    if (supabaseId) {
      const user = await this.prisma.user.findUnique({
        where: { supabaseId },
      });

      if (user) {
        return user;
      }
    }

    const phone = authUser.phone?.trim();

    if (phone) {
      const user = await this.prisma.user.findUnique({
        where: { phone },
      });

      if (user) {
        return user;
      }
    }

    const email = authUser.email?.trim();

    if (email) {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        return user;
      }
    }

    throw new UnauthorizedException(
      'Authenticated customer could not be resolved.',
    );
  }

  private buildTicketNumber(): string {
    const now = new Date();

    const date =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, '0') +
      String(now.getUTCDate()).padStart(2, '0');

    const suffix = randomBytes(4).toString('hex').toUpperCase();

    return `ASP-${date}-${suffix}`;
  }

  async createTicket(authUser: AuthUserLike, dto: CreateSupportTicketDto) {
    const customer = await this.resolveCustomer(authUser);

    let ticketNumber = this.buildTicketNumber();

    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await this.prisma.supportTicket.findUnique({
        where: { ticketNumber },
        select: { id: true },
      });

      if (!exists) {
        break;
      }

      ticketNumber = this.buildTicketNumber();
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId: customer.id,
        contactEmail:
          dto.contactEmail?.trim().toLowerCase() || customer.email || null,

        subject: dto.subject.trim(),

        description: dto.description?.trim() || null,

        category: dto.category ?? SupportTicketCategory.GENERAL,

        // Customer cannot self-promote urgency.
        priority: SupportTicketPriority.NORMAL,

        status: SupportTicketStatus.OPEN,

        relatedCallSessionId: dto.relatedCallSessionId?.trim() || null,

        relatedPaymentId: dto.relatedPaymentId?.trim() || null,

        relatedWalletTxnId: dto.relatedWalletTxnId?.trim() || null,
      },
    });

    if (ticket.contactEmail) {
      try {
        await this.mailService.sendSupportTicketCreated({
          to: ticket.contactEmail!,
          customerName: customer.name,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
        });
      } catch (error) {
        this.logger.error(
          `Support acknowledgement email failed for ticket ${ticket.ticketNumber}. Ticket remains saved.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    } else {
      this.logger.warn(
        `Support acknowledgement email skipped for ticket ${ticket.ticketNumber}: customer has no email.`,
      );
    }

    return {
      success: true,
      ticket,
    };
  }

  async getMyTickets(authUser: AuthUserLike) {
    const customer = await this.resolveCustomer(authUser);

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        customerId: customer.id,
      },

      orderBy: [
        {
          lastMessageAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],

      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return {
      success: true,
      tickets,
    };
  }

  async getMyTicket(authUser: AuthUserLike, ticketId: string) {
    const customer = await this.resolveCustomer(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this support ticket.');
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

  async sendCustomerMessage(
    authUser: AuthUserLike,
    ticketId: string,
    dto: SendSupportMessageDto,
  ) {
    const customer = await this.resolveCustomer(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        customerId: true,
        status: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this support ticket.');
    }

    if (ticket.status === SupportTicketStatus.CLOSED) {
      throw new ForbiddenException('This support ticket is closed.');
    }

    const content = dto.content.trim();

    const clientMessageId = dto.clientMessageId?.trim() || null;

    if (clientMessageId) {
      const duplicate = await this.prisma.supportMessage.findFirst({
        where: {
          senderUserId: customer.id,
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

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: {
          ticketId,
          senderType: SupportSenderType.CUSTOMER,
          senderUserId: customer.id,
          content,
          clientMessageId,
          isRead: false,
        },
      });

      await tx.supportTicket.update({
        where: {
          id: ticketId,
        },

        data: {
          lastMessageAt: new Date(),

          // Customer response on resolved ticket
          // automatically re-opens it for support.
          status:
            ticket.status === SupportTicketStatus.RESOLVED
              ? SupportTicketStatus.OPEN
              : ticket.status,
        },
      });

      return created;
    });

    return {
      success: true,
      duplicate: false,
      message,
    };
  }

  async markAdminMessagesRead(authUser: AuthUserLike, ticketId: string) {
    const customer = await this.resolveCustomer(authUser);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        customerId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this support ticket.');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportMessage.updateMany({
        where: {
          ticketId,
          senderType: SupportSenderType.ADMIN,
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
          customerLastReadAt: now,
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

  async resolveCustomerIdForAttachment(
    authUser: AuthUserLike,
  ): Promise<string> {
    const customer = await this.resolveCustomer(authUser);
    return customer.id;
  }
}
