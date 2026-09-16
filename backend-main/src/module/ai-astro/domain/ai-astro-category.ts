export enum AiAstroCategory {
  GENERAL = 'GENERAL',
  LOVE = 'LOVE',
  MARRIAGE = 'MARRIAGE',
  CAREER = 'CAREER',
  HEALTH = 'HEALTH',
  FINANCE = 'FINANCE',
  BUSINESS = 'BUSINESS',
  EDUCATION = 'EDUCATION',
  LEGAL = 'LEGAL',
}

export const AI_ASTRO_CATEGORIES = [
  AiAstroCategory.LOVE,
  AiAstroCategory.MARRIAGE,
  AiAstroCategory.CAREER,
  AiAstroCategory.HEALTH,
  AiAstroCategory.FINANCE,
  AiAstroCategory.BUSINESS,
  AiAstroCategory.EDUCATION,
  AiAstroCategory.LEGAL,
] as const;
