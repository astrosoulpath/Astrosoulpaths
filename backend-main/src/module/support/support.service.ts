import {
  resolveSupportActor,
  supportPage,
  supportText,
  supportLock,
  supportDuplicate,
} from './support-policy';
import {
  BadRequestException,
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
import { auditSupport } from './support-operations';

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
    return resolveSupportActor(this.prisma, authUser, false);
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

    const ticket = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'create:' + customer.id);
      if (
        (await tx.supportTicket.count({
          where: {
            customerId: customer.id,
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
        })) >= 10
      )
        throw new BadRequestException(
          'Support request limit reached. Please try later.',
        );
      for (const [id, model, where] of [
        [
          dto.relatedCallSessionId,
          tx.callSession,
          { OR: [{ userId: customer.id }, { astrologerId: customer.id }] },
        ],
        [dto.relatedPaymentId, tx.paymentOrder, { userId: customer.id }],
        [dto.relatedWalletTxnId, tx.walletLedger, { userId: customer.id }],
      ] as const) {
        if (
          id &&
          !(await (model as any).findFirst({
            where: { id: id.trim(), ...where },
            select: { id: true },
          }))
        )
          throw new BadRequestException('Related record is not accessible');
      }
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber,
          customerId: customer.id,
          contactEmail:
            dto.contactEmail?.trim().toLowerCase() || customer.email || null,

          subject: supportText(dto.subject, 160, 3),

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
      await auditSupport(
        tx,
        customer.id,
        'TICKET',
        created.id,
        'CREATED',
        {},
        customer.id,
        'created:' + created.id,
      );
      return created;
    });

    if (customer.email) {
      try {
        await this.mailService.sendSupportTicketCreated({
          to: customer.email,
          customerName: customer.name,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
        });
      } catch (error) {
        this.logger.error(
          `Support acknowledgement email failed for ticket ${ticket.ticketNumber}. Ticket remains saved.`,
          'SUPPORT_MAIL_FAILED',
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

  async getMyTickets(
    authUser: AuthUserLike,
    input: {
      page?: number;
      limit?: number;
      search?: string;
      status?: SupportTicketStatus;
    } = {},
  ) {
    const customer = await this.resolveCustomer(authUser);
    const { page, limit, search } = supportPage(input);
    const where = {
      customerId: customer.id,
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' as const } },
              {
                ticketNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,

      orderBy: [
        {
          lastMessageAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
        { id: 'desc' },
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
      pagination: {
        page,
        limit,
        total: await this.prisma.supportTicket.count({ where }),
      },
    };
  }

  async getMyTicket(authUser: AuthUserLike, ticketId: string) {
    const customer = await this.resolveCustomer(authUser);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        customerId: customer.id,
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

  async sendCustomerMessage(
    authUser: AuthUserLike,
    ticketId: string,
    dto: SendSupportMessageDto,
  ) {
    const customer = await this.resolveCustomer(authUser);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        customerId: customer.id,
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

    const content = supportText(dto.content, 5000);

    const clientMessageId = dto.clientMessageId?.trim() || null;

    if (clientMessageId) {
      const duplicate = await this.prisma.supportMessage.findFirst({
        where: {
          senderUserId: customer.id,
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

    const message = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'sender:' + customer.id);
      await supportLock(tx, 'ticket:' + ticketId);
      const current = await tx.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!current || current.customerId !== customer.id)
        throw new NotFoundException('Support ticket not found');
      if (current.status === SupportTicketStatus.CLOSED)
        throw new ForbiddenException('This support ticket is closed.');
      const duplicate = await supportDuplicate(
        tx,
        customer.id,
        ticketId,
        clientMessageId,
      );
      if (duplicate) return duplicate;
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
            current.status === SupportTicketStatus.RESOLVED
              ? SupportTicketStatus.OPEN
              : current.status,
          ...(current.status === SupportTicketStatus.RESOLVED
            ? { resolvedAt: null, closedAt: null }
            : {}),
        },
      });

      await auditSupport(
        tx,
        customer.id,
        'TICKET',
        ticketId,
        current.status === SupportTicketStatus.RESOLVED
          ? 'REOPENED'
          : 'CUSTOMER_REPLY',
        {},
        current.status === SupportTicketStatus.RESOLVED
          ? customer.id
          : undefined,
        'message:' + created.id,
      );

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

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        customerId: customer.id,
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
