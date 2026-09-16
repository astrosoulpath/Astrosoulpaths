import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateAiReceptionistSessionDto } from './dto/create-ai-receptionist-session.dto';
import { SendAiReceptionistMessageDto } from './dto/send-ai-receptionist-message.dto';
import { AI_RECEPTIONIST_PROVIDER } from './providers/ai-receptionist-provider.interface';
import type { AiReceptionistProvider } from './providers/ai-receptionist-provider.interface';

@Injectable()
export class AiReceptionistService {
  constructor(
    @Inject(AI_RECEPTIONIST_PROVIDER)
    private readonly provider: AiReceptionistProvider,
    private readonly prisma: PrismaService,
  ) {}

  getStatus() {
    return {
      enabled: true,
      productionProviderConfigured: false,
      externalKeysRequired: false,
      phase: 'PERSISTENCE',
    };
  }

  async providerHealth() {
    return this.provider.health();
  }

  async createSession(dto: CreateAiReceptionistSessionDto) {
    const providerSession = await this.provider.createSession(dto);

    return this.prisma.aiReceptionistSession.create({
      data: {
        id: providerSession.id,
        provider: this.provider.providerName,
        providerSessionId: providerSession.id,
        channel: providerSession.channel,
        status: providerSession.status,
        language: providerSession.language,
        customerPhone: providerSession.customerPhone,
        customerUserId: providerSession.customerUserId,
        startedAt: providerSession.startedAt,
        connectedAt:
          providerSession.status === 'ACTIVE'
            ? providerSession.startedAt
            : null,
        metadata: {
          mode: 'provider-abstraction',
        },
      },
    });
  }

  async sendMessage(sessionId: string, dto: SendAiReceptionistMessageDto) {
    const session = await this.prisma.aiReceptionistSession.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    await this.prisma.aiReceptionistMessage.create({
      data: {
        sessionId,
        role: 'CUSTOMER',
        content: dto.message,
      },
    });

    const response = await this.provider.sendMessage({
      sessionId,
      message: dto.message,
    });

    const receptionistMessage = await this.prisma.aiReceptionistMessage.create({
      data: {
        id: response.id,
        sessionId,
        role: response.role,
        content: response.content,
        providerMessageId: response.id,
      },
    });

    await this.prisma.aiReceptionistSession.update({
      where: {
        id: sessionId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return receptionistMessage;
  }

  async endSession(sessionId: string) {
    const session = await this.prisma.aiReceptionistSession.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    const providerSession = await this.provider.endSession(sessionId);

    return this.prisma.aiReceptionistSession.update({
      where: {
        id: sessionId,
      },
      data: {
        status: providerSession.status,
        endedAt: providerSession.endedAt ?? new Date(),
      },
    });
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.aiReceptionistSession.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    return session;
  }

  async getTranscript(sessionId: string) {
    const session = await this.prisma.aiReceptionistSession.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    return this.prisma.aiReceptionistMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
