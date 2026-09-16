import {
  AiReceptionistChannel,
  AiReceptionistLanguage,
  AiReceptionistSessionStatus,
} from './ai-receptionist.enums';

export interface AiReceptionistSession {
  id: string;
  channel: AiReceptionistChannel;
  status: AiReceptionistSessionStatus;
  language: AiReceptionistLanguage;
  customerPhone?: string;
  customerUserId?: string;
  startedAt: Date;
  endedAt?: Date;
  transferredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiReceptionistMessage {
  id: string;
  sessionId: string;
  role: 'CUSTOMER' | 'RECEPTIONIST' | 'SYSTEM';
  content: string;
  createdAt: Date;
}
