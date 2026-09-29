import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

export type GeneralHoroscopeTransitEvidence = {
  name: string;
  sign: string;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
  houseFromMoon: number;
};

export type GeneralHoroscopeDailyInterpretation = {
  summary: string;
  advice: string;
  language: string;
  model: string;
};

export type GeneralHoroscopePeriodEvidence = {
  date: string;
  planets: GeneralHoroscopeTransitEvidence[];
};

export type GeneralHoroscopePeriodInterpretation = {
  summary: string;
  advice: string;
  language: string;
  model: string;
};

export type GeneralHoroscopePeriod =
  | 'weekly'
  | 'weekly-love'
  | 'monthly'
  | 'yearly';
@Injectable()
export class GeneralHoroscopeInterpretationService {
  private readonly logger = new Logger(
    GeneralHoroscopeInterpretationService.name,
  );

  async generateDaily(input: {
    moonSign: string;
    date: string;
    languageCode: string;
    evidence: GeneralHoroscopeTransitEvidence[];
  }): Promise<GeneralHoroscopeDailyInterpretation> {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';

    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    if (!input.evidence.length) {
      throw new ServiceUnavailableException(
        'Vedic transit evidence is unavailable',
      );
    }

    const openai = new OpenAI({ apiKey });

    const evidenceJson = JSON.stringify({
      moonSign: input.moonSign,
      date: input.date,
      evidence: input.evidence,
    });

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You write a concise general Vedic horoscope interpretation. ' +
                'Use ONLY the supplied deterministic Vedic transit evidence. ' +
                'Do not invent planet positions, houses, nakshatras, dashas, ' +
                'events, scores, remedies, lucky values, dates, or personal facts. ' +
                'The Moon sign is the interpretation reference point. ' +
                'Write all customer-facing text in the requested language. ' +
                'Use the supplied Vedic astrology evidence internally, but translate its meaning into simple everyday language for the customer. ' +
                'The customer must be able to understand the horoscope without knowing astrology terminology. ' +
                'Do not expose planet names, Rahu, Ketu, nakshatra names, house numbers, house positions, transits, retrograde mechanics, dashas, yogas, planetary lords, or similar technical astrology terminology in summary or advice. ' +
                'Do not write phrases such as Rahu in the fourth house, Ketu in the tenth, Mercury in the twelfth house, Venus transit, retrograde Saturn, or similar chart mechanics. ' +
                'Instead, convert that evidence into its practical meaning for everyday life, such as relationships, communication, work, money, home, confidence, wellbeing, decisions, opportunities, or caution. ' +
                'Use clear, natural, modern wording suitable for an international customer. ' +
                'Avoid mystical, academic, overly technical, or unnecessarily complex wording. ' +
                'Return JSON only with keys summary and advice. ' +
                'summary should be one natural readable horoscope paragraph. ' +
                'advice should be one short practical sentence. ' +
                'Do not include numeric ratings because those come from the deterministic engine.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                `Requested language code: ${input.languageCode}\n` +
                `Calculated Vedic evidence:\n${evidenceJson}`,
            },
          ],
        },
      ],
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      throw new ServiceUnavailableException(
        'OpenAI returned an empty general horoscope',
      );
    }

    let parsed: unknown;

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      throw new ServiceUnavailableException(
        'OpenAI returned invalid general horoscope JSON',
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ServiceUnavailableException(
        'General horoscope response has invalid shape',
      );
    }

    const record = parsed as Record<string, unknown>;
    const summary =
      typeof record.summary === 'string' ? record.summary.trim() : '';
    const advice =
      typeof record.advice === 'string' ? record.advice.trim() : '';

    if (!summary || !advice) {
      throw new ServiceUnavailableException(
        'General horoscope interpretation is incomplete',
      );
    }

    this.logger.log(
      `general_horoscope.ai.success period=daily model=${response.model ?? model}`,
    );

    return {
      summary,
      advice,
      language: input.languageCode,
      model: response.model ?? model,
    };
  }

  async generatePeriod(input: {
    period: GeneralHoroscopePeriod;
    moonSign: string;
    startDate: string;
    endDate: string;
    languageCode: string;
    evidence: GeneralHoroscopePeriodEvidence[];
  }): Promise<GeneralHoroscopePeriodInterpretation> {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';

    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    if (!input.evidence.length) {
      throw new ServiceUnavailableException(
        'Vedic period evidence is unavailable',
      );
    }

    const openai = new OpenAI({ apiKey });

    const evidenceJson = JSON.stringify({
      period: input.period,
      moonSign: input.moonSign,
      startDate: input.startDate,
      endDate: input.endDate,
      evidence: input.evidence,
    });

    const focusInstruction =
      input.period === 'weekly-love'
        ? 'Focus the interpretation only on love, marriage, emotional connection, and relationship themes that are supported by the supplied evidence. '
        : 'Give a balanced general horoscope interpretation for the requested period. ';

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You write a concise general Vedic horoscope interpretation. ' +
                'Use ONLY the supplied deterministic Moon-sign-relative Vedic transit evidence. ' +
                'The houseFromMoon values are already calculated by the astrology engine and must not be changed. ' +
                'Do not invent planet positions, houses, nakshatras, dashas, yogas, events, scores, remedies, lucky values, dates, or personal facts. ' +
                'Do not claim certainty about future events. ' +
                focusInstruction +
                'Write all customer-facing text in the requested language. ' +
                'Use the supplied Vedic astrology evidence internally, but translate its meaning into simple everyday language for the customer. ' +
                'The customer must be able to understand the horoscope without knowing astrology terminology. ' +
                'Do not expose planet names, Rahu, Ketu, nakshatra names, house numbers, house positions, transits, retrograde mechanics, dashas, yogas, planetary lords, or similar technical astrology terminology in summary or advice. ' +
                'Do not write phrases such as Rahu in the fourth house, Ketu in the tenth, Mercury in the twelfth house, Venus transit, retrograde Saturn, or similar chart mechanics. ' +
                'Instead, convert that evidence into its practical meaning for everyday life, such as relationships, communication, work, money, home, confidence, wellbeing, decisions, opportunities, or caution. ' +
                'Use clear, natural, modern wording suitable for an international customer. ' +
                'Avoid mystical, academic, overly technical, or unnecessarily complex wording. ' +
                'Return JSON only with keys summary and advice. ' +
                'summary must be one natural readable horoscope paragraph for the requested period. ' +
                'advice must be one short practical sentence. ' +
                'Do not include numeric ratings.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                `Requested language code: ${input.languageCode}\n` +
                `Requested period: ${input.period}\n` +
                `Calculated Vedic evidence:\n${evidenceJson}`,
            },
          ],
        },
      ],
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      throw new ServiceUnavailableException(
        'OpenAI returned an empty period horoscope',
      );
    }

    let parsed: unknown;

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      throw new ServiceUnavailableException(
        'OpenAI returned invalid period horoscope JSON',
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ServiceUnavailableException(
        'Period horoscope response has invalid shape',
      );
    }

    const record = parsed as Record<string, unknown>;

    const summary =
      typeof record.summary === 'string' ? record.summary.trim() : '';

    const advice =
      typeof record.advice === 'string' ? record.advice.trim() : '';

    if (!summary || !advice) {
      throw new ServiceUnavailableException(
        'Period horoscope interpretation is incomplete',
      );
    }

    this.logger.log(
      `general_horoscope.ai.success period=${input.period} model=${
        response.model ?? model
      }`,
    );

    return {
      summary,
      advice,
      language: input.languageCode,
      model: response.model ?? model,
    };
  }
}
