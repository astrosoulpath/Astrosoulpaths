import { HttpException } from '@nestjs/common';

const SAFE_CODES = new Set(['AI_LANGUAGE_NOT_VALIDATED','INSUFFICIENT_BALANCE','AI_ASTRO_REQUEST_ALREADY_PROCESSED','AI_ASTRO_PRICING_NOT_CONFIGURED','AI_ASTRO_CURRENTLY_UNAVAILABLE','AI_ASTRO_PAID_PRICE_NOT_CONFIGURED','AI_CONSULTANT_TYPE_UNAVAILABLE','AI_ASTRO_SESSION_REQUIRED','AI_ASTRO_SESSION_MISMATCH','AI_ASTRO_SESSION_NOT_ACTIVE','AI_ASTRO_SESSION_FUNDS_EXHAUSTED','KP_CONTEXT_UNAVAILABLE','BIRTH_PROFILE_INCOMPLETE']);

export function safeAiStreamError(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const code = typeof response === 'object' && response !== null ? ((response as {code?: unknown}).code ?? error.message) : error.message;
    if (typeof code === 'string' && SAFE_CODES.has(code)) return code;
    if (error.getStatus() === 401) return 'AUTHENTICATION_REQUIRED';
    if (error.getStatus() === 403) return 'ACCESS_DENIED';
  }
  return 'AI_ASTRO_STREAM_FAILED';
}
