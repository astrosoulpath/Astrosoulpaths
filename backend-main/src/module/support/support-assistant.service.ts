import {
  resolveSupportActor,
  supportLock,
  supportText,
} from './support-policy';
import { hasSupportCredential } from './support-input-policy';
import { auditSupport } from './support-operations';
import { SupportCatalogueService } from './support-catalogue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AssistantConversationStatus,
  AssistantSenderType,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EscalateAssistantDto } from './dto/escalate-assistant.dto';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';
import {
  SUPPORT_AI_PROVIDER,
  type SupportAiProvider,
  type SupportAiProviderInput,
} from './providers/support-ai-provider.interface';

type AuthUserLike = {
  id?: string;
  userId?: string;
  sub?: string;
  supabaseId?: string;
  email?: string;
  phone?: string;
};

@Injectable()
export class SupportAssistantService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject(SUPPORT_AI_PROVIDER)
    private readonly aiProvider: SupportAiProvider,
    private readonly catalogue: SupportCatalogueService,
    private readonly redis: RedisService,
  ) {}

  async getProviderHealth() {
    const provider = await this.aiProvider.health();

    return {
      success: true,
      provider,
    };
  }

  private async resolveCustomer(authUser: AuthUserLike) {
    return resolveSupportActor(this.prisma, authUser, false);
  }

  private createTicketNumber() {
    const now = new Date();

    const date =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, '0') +
      String(now.getUTCDate()).padStart(2, '0');

    const suffix = randomBytes(4).toString('hex').toUpperCase();

    return `ASP-${date}-${suffix}`;
  }

  async startOrGetConversation(authUser: AuthUserLike) {
    const customer = await this.resolveCustomer(authUser);
    return this.prisma.$transaction(async (tx) => {
      await supportLock(tx, `assistant-start:${customer.id}`);
      const existing = await tx.assistantConversation.findFirst({
        where: {
          customerId: customer.id,
          status: AssistantConversationStatus.ACTIVE,
        },
        orderBy: { updatedAt: 'desc' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (existing)
        return { success: true, created: false, conversation: existing };
      const conversation = await tx.assistantConversation.create({
        data: {
          customerId: customer.id,
          status: AssistantConversationStatus.ACTIVE,
        },
        include: { messages: true },
      });
      return { success: true, created: true, conversation };
    });
  }
  async getMyConversations(authUser: AuthUserLike) {
    const customer = await this.resolveCustomer(authUser);

    const conversations = await this.prisma.assistantConversation.findMany({
      where: {
        customerId: customer.id,
      },

      orderBy: {
        updatedAt: 'desc',
      },

      include: {
        supportTicket: {
          select: {
            id: true,
            ticketNumber: true,
            status: true,
          },
        },

        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return {
      success: true,
      conversations,
    };
  }

  async getConversation(authUser: AuthUserLike, conversationId: string) {
    const customer = await this.resolveCustomer(authUser);

    const conversation = await this.prisma.assistantConversation.findUnique({
      where: {
        id: conversationId,
      },

      include: {
        supportTicket: true,

        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Assistant conversation not found.');
    }

    if (conversation.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this conversation.');
    }

    return {
      success: true,
      conversation,
    };
  }

  async sendCustomerMessage(
    authUser: AuthUserLike,
    conversationId: string,
    dto: SendAssistantMessageDto,
  ) {
    const customer = await this.resolveCustomer(authUser);
    const key = createHash('sha256').update(customer.id).digest('hex');
    const owner = randomBytes(16).toString('hex');
    const lock = `support-ai-inflight:${key}`;
    if (!(await this.redis.setNX(lock, owner, 60)))
      throw new HttpException(
        'A support message is already processing, or support is temporarily unavailable. Retry shortly.',
        409,
      );
    try {
      const rateKey = `support-ai-rate:${key}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.redis.increment(rateKey);
      if (count === 1) await this.redis.expire(rateKey, 90);
      if (count < 1 || (await this.redis.ttl(rateKey)) < 0)
        throw new ServiceUnavailableException(
          'Support rate protection is unavailable',
        );
      if (count > 10)
        throw new HttpException(
          'Please wait a minute before sending more support messages.',
          429,
        );
      return await this.processCustomerMessage(authUser, conversationId, dto);
    } finally {
      await this.redis.releaseLock(lock, owner);
    }
  }

  private async processCustomerMessage(
    authUser: AuthUserLike,
    conversationId: string,
    dto: SendAssistantMessageDto,
  ) {
    const customer = await this.resolveCustomer(authUser);

    const conversation = await this.prisma.assistantConversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        id: true,
        customerId: true,
        status: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Assistant conversation not found.');
    }

    if (conversation.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this conversation.');
    }

    if (conversation.status === AssistantConversationStatus.CLOSED) {
      throw new BadRequestException('This assistant conversation is closed.');
    }

    const content = supportText(dto.content, 5000);
    if (hasSupportCredential(content))
      throw new BadRequestException(
        'Do not share passwords, API keys or credentials in support chat.',
      );
    if (Boolean(dto.questionId) !== Boolean(dto.categoryId))
      throw new BadRequestException('Select a valid support question');
    if (dto.questionId && dto.categoryId) {
      const expected = await this.catalogue.question(
        dto.categoryId,
        dto.questionId,
      );
      if (content !== expected)
        throw new BadRequestException(
          'Support question changed. Reload the topics or send your own message.',
        );
    }

    const clientMessageId = dto.clientMessageId?.trim() || null;

    // --------------------------------------------------------
    // IDEMPOTENCY
    // --------------------------------------------------------

    if (clientMessageId) {
      const existingCustomerMessage =
        await this.prisma.assistantMessage.findFirst({
          where: {
            senderUserId: customer.id,

            clientMessageId,
          },
        });

      if (existingCustomerMessage) {
        if (
          existingCustomerMessage.conversationId !== conversationId ||
          existingCustomerMessage.content !== content
        )
          throw new BadRequestException(
            'Message reference belongs to a different request',
          );
        return {
          success: true,
          duplicate: true,

          message: existingCustomerMessage,

          assistantReply: null,

          assistantProviderStatus: 'MESSAGE_ALREADY_PROCESSED',
        };
      }
    }

    // --------------------------------------------------------
    // REAL CONVERSATION CONTEXT FROM DATABASE
    // --------------------------------------------------------

    const previousMessages = await this.prisma.assistantMessage.findMany({
      where: {
        conversationId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 16,

      select: {
        senderType: true,
        content: true,
      },
    });

    const history = previousMessages
      .reverse()
      .filter(
        (message) =>
          message.senderType === AssistantSenderType.CUSTOMER ||
          message.senderType === AssistantSenderType.ASSISTANT,
      )
      .map((message) => ({
        role:
          message.senderType === AssistantSenderType.CUSTOMER
            ? ('user' as const)
            : ('assistant' as const),

        content: message.content,
      }));

    // --------------------------------------------------------
    // REAL OPENAI CALL
    // No mock / no canned answer / no fake fallback.
    // --------------------------------------------------------

    const verifiedContext: NonNullable<
      SupportAiProviderInput['verifiedContext']
    > = { refundStatus: 'NOT_VERIFIED', accountStatus: 'ACTIVE' };
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId: customer.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        subscriptionStatus: true,
        endDate: true,
        subscriptionPlan: { select: { name: true } },
      },
    });
    verifiedContext.subscriptions = subscriptions.map((s) => ({
      plan: s.subscriptionPlan?.name ?? null,
      recordedStatus: s.subscriptionStatus,
      expiresAt: s.endDate?.toISOString() ?? null,
      entitlement: 'NOT_VERIFIED',
    }));
    if (dto.paymentOrderId) {
      const payment = await this.prisma.paymentOrder.findFirst({
        where: { id: dto.paymentOrderId, userId: customer.id },
        select: { status: true },
      });
      if (!payment)
        throw new NotFoundException(
          'Payment reference is unavailable for this account',
        );
      verifiedContext.paymentStatus = payment.status;
    }
    if (dto.consultationId) {
      const consultation = await this.prisma.callSession.findFirst({
        where: { id: dto.consultationId, userId: customer.id },
        select: { status: true },
      });
      if (!consultation)
        throw new NotFoundException(
          'Consultation reference is unavailable for this account',
        );
      verifiedContext.consultationStatus = /^[A-Z_]{1,32}$/.test(
        consultation.status,
      )
        ? consultation.status
        : 'UNKNOWN';
    }
    const aiResult = await this.aiProvider.generate({
      verifiedContext,
      approvedKnowledge: await this.catalogue.reference(),
      question: content,

      conversation: history,
    });

    // --------------------------------------------------------
    // ONLY AFTER A REAL AI RESULT:
    // persist both customer message + AI response atomically.
    // --------------------------------------------------------

    const result = await this.prisma.$transaction(async (tx) => {
      const customerMessage = await tx.assistantMessage.create({
        data: {
          conversationId,

          senderType: AssistantSenderType.CUSTOMER,

          senderUserId: customer.id,

          content,

          clientMessageId,

          isRead: false,
        },
      });

      const assistantMessage = await tx.assistantMessage.create({
        data: {
          conversationId,

          senderType: AssistantSenderType.ASSISTANT,

          senderUserId: null,

          content: aiResult.answer,

          provider: aiResult.provider,

          model: aiResult.model,

          isRead: false,
        },
      });

      await tx.assistantConversation.update({
        where: {
          id: conversationId,
        },

        data: {
          lastMessageAt: new Date(),
        },
      });

      return {
        customerMessage,
        assistantMessage,
      };
    });

    return {
      success: true,
      duplicate: false,

      message: result.customerMessage,

      assistantReply: result.assistantMessage,

      assistantProviderStatus: 'CONNECTED',

      provider: aiResult.provider,

      model: aiResult.model,
    };
  }

  async escalateToHumanSupport(
    authUser: AuthUserLike,
    conversationId: string,
    dto: EscalateAssistantDto,
  ) {
    const customer = await this.resolveCustomer(authUser);

    const conversation = await this.prisma.assistantConversation.findUnique({
      where: {
        id: conversationId,
      },

      include: {
        supportTicket: true,

        messages: {
          orderBy: {
            createdAt: 'asc',
          },

          take: 20,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Assistant conversation not found.');
    }

    if (conversation.customerId !== customer.id) {
      throw new ForbiddenException('You cannot access this conversation.');
    }

    if (conversation.supportTicket) {
      return {
        success: true,
        alreadyEscalated: true,
        ticket: conversation.supportTicket,
      };
    }

    let ticketNumber = this.createTicketNumber();

    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await this.prisma.supportTicket.findUnique({
        where: {
          ticketNumber,
        },

        select: {
          id: true,
        },
      });

      if (!exists) {
        break;
      }

      ticketNumber = this.createTicketNumber();
    }

    const recentContext = (
      dto.includeConversation === true ? conversation.messages : []
    )
      .map((message) => `${message.senderType}: ${message.content}`)
      .join('\n')
      .slice(0, 3500);

    const subject = dto.subject?.trim() || '24x7 Assistant Support';

    const description =
      dto.description?.trim() ||
      (recentContext
        ? `Escalated from assistant conversation.\n\n${recentContext}`
        : 'Escalated from assistant conversation.');

    const result = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, `assistant-escalation:${conversationId}`);
      const current = await tx.assistantConversation.findFirst({
        where: { id: conversationId, customerId: customer.id },
        include: { supportTicket: true },
      });
      if (!current)
        throw new NotFoundException('Assistant conversation not found.');
      if (current.supportTicket) {
        return {
          ticket: current.supportTicket,
          conversation: current,
          alreadyEscalated: true,
        };
      }
      const ticket = await tx.supportTicket.create({
        data: {
          ticketNumber,

          customerId: customer.id,

          subject,

          description,

          category: SupportTicketCategory.ASSISTANT_ESCALATION,

          priority: SupportTicketPriority.NORMAL,

          status: SupportTicketStatus.OPEN,

          lastMessageAt: new Date(),
        },
      });

      const updatedConversation = await tx.assistantConversation.update({
        where: {
          id: conversationId,
        },

        data: {
          status: AssistantConversationStatus.ESCALATED,

          supportTicketId: ticket.id,

          escalatedAt: new Date(),
        },
      });

      await auditSupport(
        tx,
        customer.id,
        'TICKET',
        ticket.id,
        'CREATED_FROM_ASSISTANT',
        { conversationIncluded: dto.includeConversation === true },
        customer.id,
        `assistant:${conversationId}`,
      );
      return {
        ticket,
        conversation: updatedConversation,
        alreadyEscalated: false,
      };
    });

    return {
      success: true,
      ...result,
    };
  }

  async closeConversation(authUser: AuthUserLike, conversationId: string) {
    const customer = await this.resolveCustomer(authUser);

    const conversation = await this.prisma.assistantConversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        id: true,
        customerId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Assistant conversation not found.');
    }

    if (conversation.customerId !== customer.id) {
      throw new ForbiddenException('You cannot close this conversation.');
    }

    const updated = await this.prisma.assistantConversation.update({
      where: {
        id: conversationId,
      },

      data: {
        status: AssistantConversationStatus.CLOSED,

        closedAt: new Date(),
      },
    });

    return {
      success: true,
      conversation: updated,
    };
  }
}
