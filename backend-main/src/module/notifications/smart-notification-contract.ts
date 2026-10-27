import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { SMART_CATEGORIES } from './smart-astrology.catalog';
import { requireHoroscopeLocale, validateHoroscopeText } from '../subscription/horoscope-localization';

export function smartSchemaEnabled() { return process.env.SMART_NOTIFICATIONS_SCHEMA_READY === 'true'; }
export function requireSmartSchema() {
  if (!smartSchemaEnabled()) throw new ServiceUnavailableException({
    statusCode: 503,
    code: 'SMART_SCHEMA_NOT_ACTIVATED',
    message: 'Smart notification schema is not activated',
  });
}
export function validateSmartContent(input: { category: string; locale: string; title: string; body: string }) {
  if (!input || !SMART_CATEGORIES.some(c => c.id === input.category) || !['title','body'].every(key => typeof input[key] === 'string'))
    throw new BadRequestException('Invalid smart content');
  requireHoroscopeLocale(input.locale);
  if (!input.title.trim() || input.title.length > 120 || !input.body.trim() || input.body.length > 3000 || /[\u0000-\u001f<>\u202a-\u202e\u2066-\u2069]/.test(input.title + input.body) || /\{\{?|\}|%[sd]/.test(input.title + input.body))
    throw new BadRequestException('Invalid smart content');
  validateHoroscopeText(input.locale, [input.title, input.body]);
}
export function smartId(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new BadRequestException('Invalid smart notification identifier');
  return id;
}
