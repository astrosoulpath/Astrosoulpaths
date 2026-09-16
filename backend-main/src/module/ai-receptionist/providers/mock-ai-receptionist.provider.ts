import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  AiReceptionistMessage,
  AiReceptionistSession,
} from '../domain/ai-receptionist-session';
import {
  AiReceptionistChannel,
  AiReceptionistLanguage,
  AiReceptionistSessionStatus,
} from '../domain/ai-receptionist.enums';
import {
  AiReceptionistProvider,
  CreateReceptionistSessionInput,
  SendReceptionistMessageInput,
} from './ai-receptionist-provider.interface';

@Injectable()
export class MockAiReceptionistProvider implements AiReceptionistProvider {
  readonly providerName = 'mock';

  private readonly sessions = new Map<string, AiReceptionistSession>();

  async createSession(
    input: CreateReceptionistSessionInput,
  ): Promise<AiReceptionistSession> {
    const now = new Date();

    const requestedLanguage = input.language as
      | AiReceptionistLanguage
      | undefined;

    const session: AiReceptionistSession = {
      id: randomUUID(),
      channel: AiReceptionistChannel.DEMO,
      status: AiReceptionistSessionStatus.ACTIVE,
      language: requestedLanguage ?? AiReceptionistLanguage.AUTO,
      customerPhone: input.customerPhone,
      customerUserId: input.customerUserId,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);

    return session;
  }

  async sendMessage(
    input: SendReceptionistMessageInput,
  ): Promise<AiReceptionistMessage> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    if (session.status !== AiReceptionistSessionStatus.ACTIVE) {
      throw new NotFoundException('AI receptionist session is not active');
    }

    return {
      id: randomUUID(),
      sessionId: session.id,
      role: 'RECEPTIONIST',
      content:
        'Demo receptionist is connected. Production AI provider will be enabled after provider configuration.',
      createdAt: new Date(),
    };
  }

  async endSession(sessionId: string): Promise<AiReceptionistSession> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new NotFoundException('AI receptionist session not found');
    }

    const now = new Date();

    const updated: AiReceptionistSession = {
      ...session,
      status: AiReceptionistSessionStatus.COMPLETED,
      endedAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, updated);

    return updated;
  }

  async health() {
    return {
      available: true,
      provider: this.providerName,
      mode: 'development-preview',
    };
  }
}
