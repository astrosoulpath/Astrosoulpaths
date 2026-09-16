import {
  AiReceptionistMessage,
  AiReceptionistSession,
} from '../domain/ai-receptionist-session';

export const AI_RECEPTIONIST_PROVIDER = Symbol('AI_RECEPTIONIST_PROVIDER');

export interface CreateReceptionistSessionInput {
  customerPhone?: string;
  customerUserId?: string;
  language?: string;
}

export interface SendReceptionistMessageInput {
  sessionId: string;
  message: string;
}

export interface AiReceptionistProvider {
  readonly providerName: string;

  createSession(
    input: CreateReceptionistSessionInput,
  ): Promise<AiReceptionistSession>;

  sendMessage(
    input: SendReceptionistMessageInput,
  ): Promise<AiReceptionistMessage>;

  endSession(sessionId: string): Promise<AiReceptionistSession>;

  health(): Promise<{
    available: boolean;
    provider: string;
    mode: string;
  }>;
}
