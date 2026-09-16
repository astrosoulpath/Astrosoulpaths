import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AssistantConversationStatus,
  AssistantSenderType,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EscalateAssistantDto } from './dto/escalate-assistant.dto';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';
import {
  SUPPORT_AI_PROVIDER,
  type SupportAiProvider,
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
  ) {}

  async getProviderHealth() {
    const provider = await this.aiProvider.health();

    return {
      success: true,
      provider,
    };
  }

  private async resolveCustomer(authUser: AuthUserLike) {
    if (!authUser) {
      throw new UnauthorizedException('Authentication required.');
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

    const phone = authUser.phone?.trim();

    if (phone) {
      const user = await this.prisma.user.findUnique({
        where: {
          phone,
        },
      });

      if (user) {
        return user;
      }
    }

    const email = authUser.email?.trim();

    if (email) {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (user) {
        return user;
      }
    }

    throw new UnauthorizedException(
      'Authenticated customer could not be resolved.',
    );
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

    const existing = await this.prisma.assistantConversation.findFirst({
      where: {
        customerId: customer.id,
        status: AssistantConversationStatus.ACTIVE,
      },

      orderBy: {
        updatedAt: 'desc',
      },

      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (existing) {
      return {
        success: true,
        created: false,
        conversation: existing,
      };
    }

    const conversation = await this.prisma.assistantConversation.create({
      data: {
        customerId: customer.id,
        status: AssistantConversationStatus.ACTIVE,
      },

      include: {
        messages: true,
      },
    });

    return {
      success: true,
      created: true,
      conversation,
    };
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

    const content = dto.content.trim();

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

    const aiResult = await this.aiProvider.generate({
      question: content,

      conversation: history,

      customerContext: {
        customerId: customer.id,

        name: customer.name,
      },
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

    const recentContext = conversation.messages
      .map((message) => `${message.senderType}: ${message.content}`)
      .join('\n')
      .slice(0, 8000);

    const subject = dto.subject?.trim() || '24x7 Assistant Support';

    const description =
      dto.description?.trim() ||
      (recentContext
        ? `Escalated from assistant conversation.\n\n${recentContext}`
        : 'Escalated from assistant conversation.');

    const result = await this.prisma.$transaction(async (tx) => {
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

      return {
        ticket,
        conversation: updatedConversation,
      };
    });

    return {
      success: true,
      alreadyEscalated: false,
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
