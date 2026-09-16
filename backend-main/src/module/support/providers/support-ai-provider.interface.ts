export interface SupportAiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SupportAiProviderInput {
  question: string;

  conversation?: SupportAiConversationMessage[];

  customerContext?: {
    customerId?: string;
    name?: string | null;
  };
}

export interface SupportAiProviderResult {
  answer: string;
  provider: string;
  model: string;
}

export const SUPPORT_AI_PROVIDER = Symbol('SUPPORT_AI_PROVIDER');

export interface SupportAiProvider {
  generate(input: SupportAiProviderInput): Promise<SupportAiProviderResult>;

  health(): Promise<{
    available: boolean;
    provider: string;
    model: string;
  }>;
}
