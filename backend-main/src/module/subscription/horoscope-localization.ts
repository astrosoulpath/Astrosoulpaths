import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export const HOROSCOPE_LOCALES = [
  'en',
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'gu',
  'kn',
  'ml',
  'pa',
  'es',
  'fr',
  'de',
  'pt',
  'it',
  'ja',
  'ko',
  'zh',
  'ar',
  'ru',
] as const;
export type HoroscopeLocale = (typeof HOROSCOPE_LOCALES)[number];
export function requireHoroscopeLocale(value: string): HoroscopeLocale {
  if (!(HOROSCOPE_LOCALES as readonly string[]).includes(value))
    throw new BadRequestException('Unsupported horoscope language');
  return value as HoroscopeLocale;
}

const scripts: Partial<Record<HoroscopeLocale, RegExp>> = {
  hi: /\p{Script=Devanagari}/u,
  mr: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u,
  ta: /\p{Script=Tamil}/u,
  te: /\p{Script=Telugu}/u,
  gu: /\p{Script=Gujarati}/u,
  kn: /\p{Script=Kannada}/u,
  ml: /\p{Script=Malayalam}/u,
  pa: /\p{Script=Gurmukhi}/u,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ko: /\p{Script=Hangul}/u,
  zh: /\p{Script=Han}/u,
  ar: /\p{Script=Arabic}/u,
  ru: /\p{Script=Cyrillic}/u,
};
// Script plausibility is a rejection guard, NOT semantic language identification.
export function validateHoroscopeText(locale: string, fields: string[]) {
  const code = requireHoroscopeLocale(locale);
  if (
    !fields.length ||
    fields.some(
      (text) =>
        typeof text !== 'string' ||
        !text.trim() ||
        /[\uFFFD\u0000]/u.test(text) ||
        (scripts[code] && !scripts[code]!.test(text)),
    )
  ) {
    throw new ServiceUnavailableException(
      'Horoscope localization validation failed; retry generation',
    );
  }
}

export const ACTIVATION_COPY: Record<
  HoroscopeLocale,
  readonly [string, string]
> = {
  en: [
    'Personalized Daily Horoscope activated',
    'Your subscription is active. Your personalized Vedic horoscope is now available.',
  ],
  hi: [
    'व्यक्तिगत राशिफल सक्रिय है',
    'आपका व्यक्तिगत दैनिक राशिफल अब उपलब्ध है।',
  ],
  bn: ['ব্যক্তিগত রাশিফল সক্রিয়', 'আপনার ব্যক্তিগত দৈনিক রাশিফল এখন উপলব্ধ।'],
  ta: [
    'தனிப்பட்ட ராசிபலன் செயல்படுத்தப்பட்டது',
    'உங்கள் தனிப்பட்ட தினசரி ராசிபலன் இப்போது கிடைக்கிறது.',
  ],
  te: [
    'వ్యక్తిగత జాతకం ప్రారంభమైంది',
    'మీ వ్యక్తిగత రోజువారీ జాతకం ఇప్పుడు అందుబాటులో ఉంది.',
  ],
  mr: [
    'वैयक्तिक राशिभविष्य सक्रिय झाले',
    'तुमचे वैयक्तिक दैनिक राशिभविष्य आता उपलब्ध आहे.',
  ],
  gu: [
    'વ્યક્તિગત રાશિફળ સક્રિય થયું',
    'તમારું વ્યક્તિગત દૈનિક રાશિફળ હવે ઉપલબ્ધ છે.',
  ],
  kn: [
    'ವೈಯಕ್ತಿಕ ಜಾತಕ ಸಕ್ರಿಯವಾಗಿದೆ',
    'ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ದೈನಂದಿನ ಜಾತಕ ಈಗ ಲಭ್ಯವಿದೆ.',
  ],
  ml: [
    'വ്യക്തിഗത ജാതകം സജീവമായി',
    'നിങ്ങളുടെ വ്യക്തിഗത പ്രതിദിന ജാതകം ഇപ്പോൾ ലഭ്യമാണ്.',
  ],
  pa: ['ਨਿੱਜੀ ਰਾਸ਼ੀਫਲ ਸਰਗਰਮ ਹੈ', 'ਤੁਹਾਡਾ ਨਿੱਜੀ ਰੋਜ਼ਾਨਾ ਰਾਸ਼ੀਫਲ ਹੁਣ ਉਪਲਬਧ ਹੈ।'],
  es: [
    'Horóscopo personalizado activado',
    'Tu horóscopo diario personalizado ya está disponible.',
  ],
  fr: [
    'Horoscope personnalisé activé',
    'Votre horoscope quotidien personnalisé est maintenant disponible.',
  ],
  de: [
    'Persönliches Horoskop aktiviert',
    'Dein persönliches Tageshoroskop ist jetzt verfügbar.',
  ],
  pt: [
    'Horóscopo personalizado ativado',
    'Seu horóscopo diário personalizado já está disponível.',
  ],
  it: [
    'Oroscopo personalizzato attivato',
    'Il tuo oroscopo giornaliero personalizzato è ora disponibile.',
  ],
  ja: [
    '個人向け占いが有効になりました',
    'あなたの今日の占いをご覧いただけます。',
  ],
  ko: [
    '맞춤 운세가 활성화되었습니다',
    '이제 나만의 일일 운세를 확인할 수 있습니다.',
  ],
  zh: ['个性化运势已启用', '现在可以查看您的每日个性化运势。'],
  ar: ['تم تفعيل توقعاتك الشخصية', 'توقعاتك اليومية الشخصية متاحة الآن.'],
  ru: [
    'Персональный гороскоп активирован',
    'Ваш персональный ежедневный гороскоп теперь доступен.',
  ],
};
