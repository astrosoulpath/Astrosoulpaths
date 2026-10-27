import { BadRequestException } from '@nestjs/common';
export const ABOUT_DEFAULT = {
  title: 'Astro Soul Path',
  introduction:
    'Astro Soul Path is a modern astrology and spiritual guidance platform designed to bring the timeless wisdom of Vedic astrology closer to everyday life.',
  mission:
    'Make astrological guidance more accessible, transparent and convenient.',
  vision:
    'A trusted global platform where traditional astrological knowledge meets innovative digital experiences.',
  services:
    'Explore Kundli insights, horoscope guidance and existing astrologer consultation services. Availability and access depend on the relevant service and entitlement.',
  why: 'A thoughtful, user-friendly space for exploring career questions, relationships, personal growth and spiritual interests. Astrology offers interpretive guidance, not guaranteed outcomes or a substitute for professional medical, legal or financial advice.',
  commitment: '',
};
export type AboutContent = typeof ABOUT_DEFAULT;
export function validateAbout(value: unknown): AboutContent {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid About content');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !Object.hasOwn(ABOUT_DEFAULT, key)))
    throw new BadRequestException('Unsupported About field');
  const result = {} as AboutContent;
  for (const key of Object.keys(ABOUT_DEFAULT) as (keyof AboutContent)[]) {
    const text = input[key];
    if (
      typeof text !== 'string' ||
      text.length > (key === 'title' ? 120 : 8000) ||
      /[<>]/.test(text) ||
      [...text].some(
        (char) => char.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(char),
      ) ||
      (['title', 'introduction'].includes(key) && !text.trim())
    )
      throw new BadRequestException('Invalid About text');
    result[key] = text.trim();
  }
  return result;
}
