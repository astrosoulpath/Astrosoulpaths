import { AiAstroCategory } from '../domain/ai-astro-category';

export interface AiAstroProviderInput {
  category: AiAstroCategory;
  consultantType?: {
    code: string;
    name: string;
    safetyProfile: string;
    requiresKundli: boolean;
  };
  question: string;
  personaId?: string;
  astrologyContext?: Record<string, unknown>;
  consultantContext?: Record<string, unknown>;
  conversation?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export type AiAstroStreamChunkHandler = (chunk: string) => void | Promise<void>;
export interface AiAstroProviderResult {
  answer: string;
  provider: string;
  model: string;
}

export const AI_ASTRO_PROVIDER = Symbol('AI_ASTRO_PROVIDER');

export interface AiAstroProvider {
  generate(input: AiAstroProviderInput): Promise<AiAstroProviderResult>;

  generateStream(
    input: AiAstroProviderInput,
    onChunk: AiAstroStreamChunkHandler,
  ): Promise<AiAstroProviderResult>;

  health(): Promise<{
    available: boolean;
    provider: string;
    model: string;
  }>;
}
