import { BadRequestException } from '@nestjs/common';
import { hasSupportCredential } from './support-input-policy';

/** Owner-approved public contact; does not publish CMS drafts or FAQs. */
export const OFFICIAL_SUPPORT_EMAIL = 'support@astrosoulpath.com';

export const PUBLIC_SUPPORT_CATEGORIES = [
  'GENERAL',
  'CONSULTATION',
  'PAYMENT',
  'WALLET',
  'ACCOUNT',
  'ASTROLOGER',
  'TECHNICAL',
  'OTHER',
] as const;
export type PublicHelp = {
  published: boolean;
  email: string;
  hours: string;
  responseTime: string;
  faqs: {
    id: string;
    question: string;
    answer: string;
    category: string;
    enabled: boolean;
  }[];
};
export function validatePublicHelp(value: unknown): PublicHelp {
  if (value === undefined)
    return {
      published: false,
      email: '',
      hours: '',
      responseTime: '',
      faqs: [],
    };
  const input = value as PublicHelp;
  const safe = (value: unknown, max: number) =>
    typeof value === 'string' &&
    value.length <= max &&
    !hasSupportCredential(value) &&
    !/[<>]/.test(value) &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 &&
        ![9, 10, 13].includes(character.charCodeAt(0)),
    );
  if (
    !input ||
    typeof input.published !== 'boolean' ||
    !safe(input.email, 254) ||
    (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) ||
    !safe(input.hours, 200) ||
    !safe(input.responseTime, 300) ||
    !Array.isArray(input.faqs) ||
    input.faqs.length > 40
  )
    throw new BadRequestException('Invalid public support configuration');
  const ids = new Set<string>();
  for (const faq of input.faqs) {
    if (
      !faq ||
      typeof faq.id !== 'string' ||
      !/^[a-z0-9-]{1,80}$/.test(faq.id) ||
      ids.has(faq.id) ||
      !safe(faq.question, 200) ||
      !faq.question.trim() ||
      !safe(faq.answer, 2000) ||
      !faq.answer.trim() ||
      !PUBLIC_SUPPORT_CATEGORIES.some(
        (category) => category === faq.category,
      ) ||
      typeof faq.enabled !== 'boolean'
    )
      throw new BadRequestException('Invalid public support FAQ');
    ids.add(faq.id);
  }
  return {
    published: input.published,
    email: input.email.trim(),
    hours: input.hours.trim(),
    responseTime: input.responseTime.trim(),
    faqs: input.faqs.map((faq) => ({
      id: faq.id,
      question: faq.question.trim(),
      answer: faq.answer.trim(),
      category: faq.category,
      enabled: faq.enabled,
    })),
  };
}
