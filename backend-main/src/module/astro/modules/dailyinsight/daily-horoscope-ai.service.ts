import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { serializeAiAstrologyContext } from '../../../../common/utils/ai-context.util';

type DailyHoroscopeAiInput = {
  name: string;
  targetDate: string;
  requestedDay: 'yesterday' | 'today' | 'tomorrow';
  languageCode: string;
  languageName: string;
  languageNativeName: string;
  vedicData: unknown;
};

export type DailyHoroscopeAiResult = {
  notificationTitle: string;
  shortReading: string;
  dailyAdvice: string;
  mood: string;
  focusArea: string;
  luckyColor: string;
  luckyNumber: number | null;
  favorableActivities: string[];
  cautionActivities: string[];
  generalGuidance: string;
  lifeAreas: {
    general: string;
    career: string;
    relationships: string;
    health: string;
    finance: string;
  };
  model: string;
};

@Injectable()
export class DailyHoroscopeAiService {
  private readonly logger = new Logger(DailyHoroscopeAiService.name);

  async generate(
    input: DailyHoroscopeAiInput,
  ): Promise<DailyHoroscopeAiResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';

    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    const configuredTimeout = Number(
      process.env.OPENAI_DAILY_HOROSCOPE_TIMEOUT_MS ?? '30000',
    );

    const timeout =
      Number.isFinite(configuredTimeout) &&
      configuredTimeout >= 5000 &&
      configuredTimeout <= 120000
        ? Math.trunc(configuredTimeout)
        : 30000;

    const configuredRetries = Number(
      process.env.OPENAI_DAILY_HOROSCOPE_MAX_RETRIES ?? '2',
    );

    const maxRetries =
      Number.isInteger(configuredRetries) &&
      configuredRetries >= 0 &&
      configuredRetries <= 3
        ? configuredRetries
        : 2;

    const openai = new OpenAI({
      apiKey,
      timeout,
      maxRetries,
    });

    const vedicJson = serializeAiAstrologyContext(input.vedicData, 30000);

    this.logger.log(
      `daily_horoscope.ai_context chars=${vedicJson.length} model=${model}`,
    );

    let response: Awaited<ReturnType<typeof openai.responses.create>>;

    try {
      response = await openai.responses.create({
        model,
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_horoscope',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: [
                'notificationTitle',
                'shortReading',
                'dailyAdvice',
                'mood',
                'focusArea',
                'luckyColor',
                'luckyNumber',
                'favorableActivities',
                'cautionActivities',
                'generalGuidance',
                'lifeAreas',
              ],
              properties: {
                notificationTitle: { type: 'string', minLength: 1 },
                shortReading: { type: 'string', minLength: 1 },
                dailyAdvice: { type: 'string', minLength: 1 },
                mood: { type: 'string' },
                focusArea: { type: 'string' },
                luckyColor: { type: 'string' },
                luckyNumber: { type: ['number', 'null'] },
                favorableActivities: {
                  type: 'array',
                  items: { type: 'string' },
                },
                cautionActivities: {
                  type: 'array',
                  items: { type: 'string' },
                },
                generalGuidance: { type: 'string', minLength: 1 },
                lifeAreas: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'general',
                    'career',
                    'relationships',
                    'health',
                    'finance',
                  ],
                  properties: {
                    general: { type: 'string', minLength: 1 },
                    career: { type: 'string', minLength: 1 },
                    relationships: { type: 'string', minLength: 1 },
                    health: { type: 'string', minLength: 1 },
                    finance: { type: 'string', minLength: 1 },
                  },
                },
              },
            },
          },
        },
        instructions: [
          'You are the personalized daily horoscope interpretation layer for Astro Soul Path.',
          'Use only the supplied real Vedic astrology calculation data.',
          'Do not generate Western zodiac-sign horoscope content.',
          'Do not invent planetary positions, dashas, transits, nakshatras, yogas, lucky values, or events.',
          'Convert technical Vedic astrology into simple, warm, practical language for a normal customer.',
          'GLOBAL CUSTOMER LANGUAGE POLICY:',
          'Use Vedic astrology calculations internally, but explain the result in simple everyday language.',
          'The customer does not need to understand astrology terminology to understand the prediction.',
          'Do not expose Nakshatra names, Tarabala, Mahadasha, Antardasha, Dasha, Tithi, Yoga, Karana, planetary lords, houses, or similar technical Vedic terminology in normal customer-facing text.',
          'Do not explain planet mechanics such as Jupiter transit, Saturn influence, Rahu to Mercury, favorable house, planetary positioning, or chart mechanics.',
          'Translate all such evidence into its practical everyday meaning.',
          'Write like a modern daily horoscope: clear, friendly, direct, useful, and easy to understand internationally.',
          'shortReading must directly explain how the requested day is likely to go.',
          'Use 3 to 5 short natural sentences for shortReading.',
          'Cover the most relevant everyday themes such as work, relationships, communication, money, wellbeing, decisions, opportunities, energy, or caution.',
          'dailyAdvice must be one simple practical action for that day.',
          'Avoid complicated, mystical, overly poetic, or academic wording.',
          'The prediction must still be derived from the supplied Vedic calculations and the exact requested calendar date.',
          'Never replace personalization with a generic random horoscope.',
          'notificationTitle and notification text must be especially short, simple, useful, and understandable from a phone lock screen.',
          'Never include technical Vedic or planetary terminology in notificationTitle, shortReading, dailyAdvice, generalGuidance, favorableActivities, cautionActivities, mood, focusArea, or lifeAreas.',
          ,
          'Avoid deterministic guarantees, fear-based predictions, medical claims, legal claims, and financial certainty.',
          'Return JSON only.',
          'The JSON must contain exactly these keys:',
          'notificationTitle, shortReading, dailyAdvice, mood, focusArea, luckyColor, luckyNumber, favorableActivities, cautionActivities, generalGuidance, lifeAreas.',
          'Write every customer-facing string value in the requested language.',
          'Keep JSON property names exactly as specified in English.',
          'notificationTitle must be a short natural daily-horoscope notification title in the requested language.',
          'Do not translate, alter, or fabricate technical source data.',
          'If luckyColor is unsupported by supplied Vedic data, use the exact sentinel "Not specified".',
          'shortReading should be concise and personal.',
          'dailyAdvice should be one practical sentence.',
          'mood should be a short phrase.',
          'focusArea should be a short phrase.',
          'luckyColor should be one simple color name if supported by supplied Vedic data; otherwise use "Not specified".',
          'luckyNumber should be a number only if supported by supplied Vedic data; otherwise null.',
          'favorableActivities and cautionActivities must be arrays of short practical strings.',
          'generalGuidance should summarize the day in clear language.',
          'The temporal perspective of every customer-facing sentence must exactly match requestedDay: yesterday describes the requested previous day, today describes the requested current day, and tomorrow describes the requested next day.',
          'Never describe requestedDay=today as tomorrow or yesterday, never describe requestedDay=tomorrow as today or yesterday, and never describe requestedDay=yesterday as today or tomorrow. Express the correct temporal perspective naturally in the requested language.',
          'lifeAreas must be an object with exactly these keys: general, career, relationships, health, finance.',
          'Each lifeAreas value must be an interpretation grounded only in the supplied real Vedic astrology provider data.',
          'Do not invent or recalculate planetary positions, houses, dashas, transits, nakshatras, yogas, doshas, scores, lucky values, or astrological events.',
          'Do not invent specific career, relationship, health, or financial events.',
          'When the supplied Vedic data does not support a specific claim, give cautious practical guidance based only on the available Vedic context instead of fabricating an astrological fact.',
        ].join('\n'),
        input: [
          `Customer: ${input.name}`,
          `Target date: ${input.targetDate}`,
          `Requested day: ${input.requestedDay}`,
          `Requested language code: ${input.languageCode}`,
          `Requested language name: ${input.languageName}`,
          `Requested language native name: ${input.languageNativeName}`,
          'All customer-facing output strings must use this requested language.',
          '',
          'Real Vedic astrology provider data:',
          vedicJson,
          '',
          'Generate the personalized daily horoscope JSON now.',
        ].join('\n'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `daily_horoscope.ai.request_failed timeoutMs=${timeout} maxRetries=${maxRetries} error=${message}`,
      );

      throw new ServiceUnavailableException(
        'Daily horoscope AI interpretation is temporarily unavailable',
      );
    }

    const usage = response.usage;

    this.logger.log(
      `cost.openai feature=daily_horoscope input_tokens=${usage?.input_tokens ?? 0} output_tokens=${usage?.output_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0}`,
    );

    const output = response.output_text?.trim();

    if (!output) {
      throw new ServiceUnavailableException(
        'OpenAI returned an empty daily horoscope',
      );
    }

    let parsed: Record<string, unknown>;

    try {
      const normalized = output
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsed = JSON.parse(normalized) as Record<string, unknown>;
    } catch {
      this.logger.error('daily_horoscope.ai.invalid_json');

      throw new ServiceUnavailableException(
        'OpenAI returned invalid daily horoscope JSON',
      );
    }

    const stringValue = (value: unknown, fallback = ''): string => {
      return typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback;
    };

    const stringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const parsedLifeAreas =
      parsed.lifeAreas &&
      typeof parsed.lifeAreas === 'object' &&
      !Array.isArray(parsed.lifeAreas)
        ? (parsed.lifeAreas as Record<string, unknown>)
        : {};

    const result: DailyHoroscopeAiResult = {
      notificationTitle: stringValue(parsed.notificationTitle),
      shortReading: stringValue(parsed.shortReading),
      dailyAdvice: stringValue(parsed.dailyAdvice),
      mood: stringValue(parsed.mood),
      focusArea: stringValue(parsed.focusArea),
      // AI is interpretation-only. Lucky values must come from
      // deterministic/provider-backed Vedic data, never model output.
      luckyColor: 'Not specified',
      luckyNumber: null,
      favorableActivities: stringArray(parsed.favorableActivities),
      cautionActivities: stringArray(parsed.cautionActivities),
      generalGuidance: stringValue(parsed.generalGuidance),
      lifeAreas: {
        general: stringValue(parsedLifeAreas.general),
        career: stringValue(parsedLifeAreas.career),
        relationships: stringValue(parsedLifeAreas.relationships),
        health: stringValue(parsedLifeAreas.health),
        finance: stringValue(parsedLifeAreas.finance),
      },
      model: response.model ?? model,
    };

    if (
      !result.notificationTitle ||
      !result.shortReading ||
      !result.dailyAdvice ||
      !result.generalGuidance ||
      !result.lifeAreas.general ||
      !result.lifeAreas.career ||
      !result.lifeAreas.relationships ||
      !result.lifeAreas.health ||
      !result.lifeAreas.finance
    ) {
      throw new ServiceUnavailableException(
        'OpenAI daily horoscope response is incomplete',
      );
    }

    this.logger.log(`daily_horoscope.ai.success model=${result.model}`);

    return result;
  }
}
