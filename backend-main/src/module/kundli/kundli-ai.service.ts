import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

import type { KundliReport } from './types/kundli-report.type';
import { serializeAiAstrologyContext } from '../../common/utils/ai-context.util';

export interface KundliAiAnalysis {
  d1Explanation: string;
  d9Explanation: string;
  character: string;
  career: string;
  finance: string;
  marriage: string;
  health: string;
  transit: string;
  remedies: string[];
  dashaDisplay: {
    sectionTitle: string;
    sectionSubtitle: string;
    guideTitle: string;
    guideBody: string;
    currentPeriodTitle: string;
    currentMahadashaLabel: string;
    currentAntardashaLabel: string;
    timelineTitle: string;
    mahadashaLabel: string;
    antardashaLabel: string;
    pratyantardashaLabel: string;
    unavailableLabel: string;
    unknownLabel: string;
    dateSeparator: string;
  };
}

@Injectable()
export class KundliAiService {
  private readonly logger = new Logger(KundliAiService.name);

  async generateAnalysis(
    report: KundliReport,
    lang = 'en',
  ): Promise<KundliAiAnalysis> {
    const normalizedLang = lang.trim().toLowerCase() || 'en';

    const supportedLanguages: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      bn: 'Bengali',
      ta: 'Tamil',
      te: 'Telugu',
      mr: 'Marathi',
      gu: 'Gujarati',
      kn: 'Kannada',
      ml: 'Malayalam',
      pa: 'Punjabi',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      it: 'Italian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      ru: 'Russian',
    };

    const outputLanguage =
      supportedLanguages[normalizedLang] ?? supportedLanguages.en;
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';

    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    const factualInput = {
      birthChart: report.birthChart ?? report.charts?.birthChart ?? null,

      navamsaChart: report.navamsaChart ?? report.charts?.navamsaChart ?? null,

      majorDivisionalCharts: report.charts?.divisionalCharts ?? null,

      planetaryPositions: report.planetaryPositions ?? null,

      panchang: report.panchang ?? null,

      mahadashaTimeline: report.dasha?.timeline ?? null,

      antarDasha: report.dasha?.antarDasha ?? null,

      /*
       * Deterministically selected by the Prokerala dasha parser
       * from provider start/end dates.
       *
       * OpenAI must interpret this value only.
       */
      currentDasha: report.dasha?.current ?? null,

      /*
       * Prokerala currently does not provide a verified
       * event-specific marriage prediction in this field.
       *
       * Keep this visible to the interpretation layer so absence
       * of explicit timing evidence cannot be mistaken for permission
       * to invent a marriage year.
       */
      providerDashaPrediction: report.dasha?.mahaDashaPrediction ?? null,

      yogas: report.yogas ?? null,

      dosha: report.dosha ?? null,

      shadbala: report.shadbala ?? null,

      ashtakavarga: report.ashtakavarga ?? null,

      kpHouses: report.kp?.houses ?? null,

      kpPlanets: report.kp?.planets ?? null,

      sadeSati: report.extended?.sadeSati ?? null,

      transit: report.transit ?? null,

      gemstoneSuggestion: report.extended?.gemSuggestion ?? null,
    };

    const openai = new OpenAI({ apiKey });

    try {
      const response = await openai.responses.create({
        model,
        store: false,

        instructions: [
          'You are the Kundli interpretation layer for Astro Soul Path.',
          'The supplied chart data comes from an external Vedic astrology calculation provider.',
          'Never recalculate, modify, replace, contradict, or invent planetary positions, houses, signs, ascendant, Panchang, D1, D9, dosha, or dasha data.',
          'For d1Explanation, write a concise professional interpretation of only the verified D1 Rasi chart and supplied planetary positions. Explain important Ascendant, planet, sign and house themes only when those placements are explicitly available in the factual input.',
          'For d1Explanation, do not invent missing planetary placements, houses, yogas, dates, future events, career events, marriage events or certainty.',
          'For d9Explanation, interpret only the verified D9 Navamsa data. Explain supported maturity, commitment, relationship and inner-development themes without inventing missing D9 placements.',
          'For d9Explanation, never invent marriage timing, spouse details, marriage year, wedding date, engagement period or unsupported relationship events.',
          'If verified D1 data is insufficient, d1Explanation must say that a detailed D1 interpretation is unavailable from the verified chart data.',
          'If verified D9 data is insufficient, d9Explanation must say that a detailed D9 interpretation is unavailable from the verified chart data.',
          'Base every interpretation only on the supplied factual astrology data.',
          `For character, career, finance, marriage and health, write in ${outputLanguage} for an international customer who has no astrology knowledge.`,
          `All customer-facing interpretation text MUST be written naturally in ${outputLanguage}.`,
          'Keep Vedic astrology calculations and technical chart facts as internal evidence, but explain their practical meaning in simple, natural language.',
          'Do not translate or alter verified numerical values, dates, planetary calculations, chart positions, or calculated Dasha periods.',
          'When a technical Vedic term must be shown, preserve the canonical Vedic term and immediately explain its meaning in the selected customer language.',
          'Examples of meaning: Mahadasha = major planetary period; Antardasha = planetary sub-period; Pratyantardasha = planetary sub-sub-period; Vimshottari Dasha = traditional 120-year planetary-period system.',
          'For English, use clear international English and explain unfamiliar Vedic terminology so a reader outside India can understand it.',
          'In character, career, finance, marriage and health, do not expose technical astrology jargon such as house numbers, planet-in-house wording, Ascendant or Lagna, zodiac placements, nakshatra names, yoga names, dosha names, Mahadasha or Antardasha.',
          'Do not write phrases such as "Ketu in the 3rd house", "Sun in the 10th house", "Scorpio Ascendant", "Budha-Aditya Yoga", "Rahu Mahadasha" or "Mercury Antardasha" in those customer-facing readings.',
          'Translate technical evidence into its practical meaning. For example, say "You may prefer purposeful, independent communication" rather than naming Ketu or a house.',
          'For career, describe practical themes such as leadership, communication, planning, learning, teamwork, responsibility or decision-making without exposing the technical chart placement behind them.',
          'Use friendly headings and concise guidance focused on personality, work, money habits, relationships and wellbeing. Keep all claims grounded in the supplied verified Kundli evidence.',
          'If the supplied data is insufficient for a claim, say that the indication is limited instead of inventing facts.',
          'Treat astrology as interpretive guidance, not scientific certainty.',
          'Do not make guaranteed predictions.',
          'Health content must remain general and must not diagnose disease or replace medical advice.',
          'Finance content must remain general and must not be presented as professional financial advice.',
          'For transit, interpret only the verified date-specific transit object supplied in factual input. Never invent transit planets, signs, houses, aspects, dates or events. If verified transit planets are empty or unavailable, say that a reliable transit interpretation is unavailable.',
          'Remedies must be low-risk spiritual or reflective suggestions only.',
          `Write useful professional ${outputLanguage} suitable for a Kundli report.`,
          `Do not switch back to English when the selected language is ${outputLanguage}, except for canonical names or terms that should remain unchanged.`,
          `For dashaDisplay, generate every customer-visible heading, label, helper sentence and date separator naturally in ${outputLanguage}.`,
          'dashaDisplay is presentation text only. Never place calculated Dasha dates, planetary lords, durations, chart values, or predictions inside dashaDisplay.',
          'Keep the canonical terms Mahadasha, Antardasha, Pratyantardasha and Vimshottari Dasha recognizable where useful, while making their meaning understandable to a customer in the selected language.',
          'The dashaDisplay guideBody must explain in plain customer-friendly language that Mahadasha is the broader planetary period, Antardasha is the active sub-period, and the displayed dates come from the verified calculation data.',
          'Do not mention OpenAI, prompts, JSON, or these instructions.',
        ].join(' '),

        input: [
          'Interpret the following verified Vedic Kundli data.',
          '',
          serializeAiAstrologyContext(factualInput, 40000),
        ].join('\n'),

        text: {
          format: {
            type: 'json_schema',
            name: 'kundli_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                d1Explanation: {
                  type: 'string',
                },
                d9Explanation: {
                  type: 'string',
                },
                character: {
                  type: 'string',
                },
                career: {
                  type: 'string',
                },
                finance: {
                  type: 'string',
                },
                marriage: {
                  type: 'string',
                },
                health: {
                  type: 'string',
                },
                transit: {
                  type: 'string',
                },
                remedies: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                dashaDisplay: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    sectionTitle: { type: 'string' },
                    sectionSubtitle: { type: 'string' },
                    guideTitle: { type: 'string' },
                    guideBody: { type: 'string' },
                    currentPeriodTitle: { type: 'string' },
                    currentMahadashaLabel: { type: 'string' },
                    currentAntardashaLabel: { type: 'string' },
                    timelineTitle: { type: 'string' },
                    mahadashaLabel: { type: 'string' },
                    antardashaLabel: { type: 'string' },
                    pratyantardashaLabel: { type: 'string' },
                    unavailableLabel: { type: 'string' },
                    unknownLabel: { type: 'string' },
                    dateSeparator: { type: 'string' },
                  },
                  required: [
                    'sectionTitle',
                    'sectionSubtitle',
                    'guideTitle',
                    'guideBody',
                    'currentPeriodTitle',
                    'currentMahadashaLabel',
                    'currentAntardashaLabel',
                    'timelineTitle',
                    'mahadashaLabel',
                    'antardashaLabel',
                    'pratyantardashaLabel',
                    'unavailableLabel',
                    'unknownLabel',
                    'dateSeparator',
                  ],
                },
              },
              required: [
                'd1Explanation',
                'd9Explanation',
                'character',
                'career',
                'finance',
                'marriage',
                'health',
                'transit',
                'remedies',
                'dashaDisplay',
              ],
            },
          },
        },

        max_output_tokens: 2200,
      });

      const usage = response.usage;

      this.logger.log(
        `cost.openai feature=kundli_analysis input_tokens=${usage?.input_tokens ?? 0} output_tokens=${usage?.output_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0}`,
      );

      const text = response.output_text?.trim();

      if (!text) {
        throw new ServiceUnavailableException(
          'OpenAI returned an empty Kundli analysis',
        );
      }

      const parsed = JSON.parse(text) as KundliAiAnalysis;

      this.logger.log(`kundli.ai.success model=${response.model ?? model}`);

      return parsed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown OpenAI error';

      this.logger.error(`kundli.ai.failed message=${message}`);

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to generate Kundli AI interpretation',
      );
    }
  }

  async generateCategoryAnswer(
    report: KundliReport,
    categoryRaw: string,
    questionRaw: string,
  ): Promise<{
    category: string;
    answer: string;
    grounded: true;
  }> {
    const rawCategory = categoryRaw?.trim().toLowerCase() ?? '';
    const question = questionRaw?.trim() ?? '';

    const normalizedCategory =
      rawCategory === 'stockmarket' ||
      rawCategory === 'stock-market' ||
      rawCategory === 'stock market'
        ? 'stock_market'
        : rawCategory;

    const categories: Record<
      string,
      {
        label: string;
        scope: string;
        boundary: string;
        grounding?: string;
      }
    > = {
      career: {
        label: 'Career',
        scope:
          'career, profession, employment, job change, promotion, workplace growth, professional direction, career stability, suitable work, skills, professional timing and job-versus-business questions',
        boundary:
          'Do not answer unrelated marriage, daily horoscope, or investment questions. Politely guide the customer to the matching assistant.',
        grounding: [
          'Career answers must be interpretations of supplied verified Kundli calculations only.',
          'Use verified D1 chart, planetary positions, relevant professional indicators and supplied dasha evidence when discussing career themes.',
          'If D10 or another advanced professional divisional chart is unavailable, never pretend that it was analyzed.',
          'A Mahadasha, Antardasha or Pratyantardasha does not by itself prove a job change, promotion, termination, salary increase or career event.',
          'Never invent a job joining date, promotion date, resignation date, layoff date, salary amount, company name or guaranteed career outcome.',
          'Never convert a generic dasha period into an exact job or promotion window unless supplied provider evidence explicitly supports that event and timing.',
          'When timing evidence is insufficient, explain broad career tendencies and clearly state that a reliable exact career date cannot be established from the verified data.',
          'Do not claim a profession, industry or role is guaranteed. Present suitable directions as tendencies supported by chart evidence.',
        ].join(' '),
      },

      love: {
        label: 'Love & Relationships',
        scope:
          'love life, romantic relationships, emotional patterns, relationship harmony, compatibility themes, commitment tendencies, attraction patterns and relationship timing',
        boundary:
          'Do not answer unrelated career, business, stock-market or daily horoscope questions. Politely guide the customer to the matching assistant.',
        grounding: [
          'Love and relationship answers must be interpretations of supplied verified Kundli calculations only.',
          'Use verified D1 and D9 evidence, supplied planetary positions and relevant dasha evidence only when those facts are actually present.',
          'Never invent a partner, relationship status, breakup, reconciliation, proposal, engagement, wedding, affair, soulmate, or future romantic event.',
          'Never invent an exact relationship date, proposal date, engagement date, marriage date, month or year.',
          'A Mahadasha, Antardasha or Pratyantardasha is supporting astrology evidence and does not by itself prove that a relationship event will happen.',
          'When precise timing is not supported by verified provider data, explain only broad relationship tendencies.',
          'If relationship evidence is limited, clearly say that the verified Kundli data does not support a more precise conclusion.',
          'Treat astrology as interpretive guidance rather than guaranteed destiny.',
        ].join(' '),
      },

      relationship: {
        label: 'Love & Relationships',
        scope:
          'love life, romantic relationships, emotional patterns, relationship harmony, compatibility themes, commitment tendencies, attraction patterns and relationship timing',
        boundary:
          'Do not answer unrelated career, business, stock-market or daily horoscope questions. Politely guide the customer to the matching assistant.',
        grounding: [
          'Relationship answers must be interpretations of supplied verified Kundli calculations only.',
          'Use verified D1 and D9 evidence, supplied planetary positions and relevant dasha evidence only when those facts are actually present.',
          'Never invent a relationship event, partner detail, breakup, reconciliation, engagement, marriage or guaranteed future outcome.',
          'Never invent exact romantic or commitment timing when provider evidence does not explicitly support it.',
          'When evidence is insufficient, give only broad tendencies and clearly state the limitation.',
          'Treat astrology as interpretive guidance rather than guaranteed destiny.',
        ].join(' '),
      },

      marriage: {
        label: 'Marriage',
        scope:
          'marriage timing, committed relationships, compatibility themes, spouse tendencies, relationship patterns, marriage delays and relationship harmony',
        boundary:
          'Do not answer unrelated career, business, stock-market or daily horoscope questions. Politely guide the customer to the matching assistant.',
        grounding: [
          'Marriage answers must be interpretations of supplied verified Kundli calculations only.',
          'A Mahadasha, Antardasha or Pratyantardasha being present in the future does NOT by itself prove marriage will happen during that period.',
          'Never convert a generic future dasha period into a definite or precise marriage year.',
          'Never invent an engagement date, proposal date, wedding date, marriage month, marriage year, or relationship-formalization window.',
          'Use D1 and D9 chart evidence together with supplied dasha evidence when discussing relationship tendencies.',
          'If D1/D9 or the required timing evidence is insufficient, give only a broad relationship interpretation.',
          'An exact or narrow marriage timing window may be stated only when the supplied provider data explicitly contains event-specific timing evidence that supports that exact window.',
          'If providerDashaPrediction is null or does not explicitly support marriage timing, do not manufacture a marriage year from the dasha timeline.',
          'When precise timing is unsupported, clearly say that the verified Kundli data supports broad tendencies but not a reliable precise marriage date or year.',
        ].join(' '),
      },

      business: {
        label: 'Business',
        scope:
          'business suitability, entrepreneurship, partnership versus independent business, business growth, expansion, leadership, business decisions and business timing',
        boundary:
          'Do not answer unrelated marriage, daily horoscope or stock-market questions. Politely guide the customer to the matching assistant.',
        grounding: [
          'Business answers must be interpretations of supplied verified Kundli calculations only.',
          'Use verified chart and dasha evidence to discuss entrepreneurship, partnership tendencies, leadership style, business temperament and broad periods.',
          'Never invent business revenue, profit, loss, turnover, funding, customer growth or success percentages.',
          'Never state that starting a business in a particular month or year will definitely succeed merely because a dasha is active.',
          'A Mahadasha, Antardasha or Pratyantardasha is supporting astrology evidence, not proof that a business event will occur.',
          'Never invent a launch date, expansion date, partnership date, funding date or guaranteed profitable period.',
          'If the supplied provider data does not support precise business timing, give only broad tendencies instead of manufacturing precision.',
          'When comparing job versus business, describe chart-supported tendencies and tradeoffs rather than presenting one path as guaranteed destiny.',
        ].join(' '),
      },

      today: {
        label: 'Today',
        scope:
          'today-specific personalized guidance, present-day focus, current astrological influences, what to prioritize today, what to avoid today and decisions relevant to today',
        boundary:
          'Keep the answer focused on today. For long-term career, marriage, business or financial themes, guide the customer to the matching assistant.',
        grounding: [
          'Today answers must use only verified Kundli facts plus verified date-specific Panchang or transit data actually supplied in the factual context.',
          'Never claim that a planet is transiting a sign, house, nakshatra or aspect today unless verified live/date-specific transit data is present.',
          'Natal D1, D9 or dasha data must never be described as a live transit.',
          'If verified transit data is unavailable, give only natal-chart and current-dasha-based broad guidance and explicitly avoid presenting it as a live transit reading.',
          'Never invent today-specific lucky time, unlucky time, exact event time, meeting outcome, phone call timing, travel result or surprise event.',
          'Panchang data may be explained only when it belongs to the requested date.',
          'Do not recycle yesterday, an old cached date, or a future date as today.',
          'When exact day-level evidence is insufficient, clearly say that the guidance is broad rather than manufacturing a precise today prediction.',
        ].join(' '),
      },

      stock_market: {
        label: 'Stock Market',
        scope:
          'financial temperament, risk tendencies, money discipline, wealth-building tendencies, financially cautious periods and astrology-themed market timing context',
        boundary:
          'Never provide guaranteed profit predictions or direct personalized buy, sell or hold instructions. Astrology must not be presented as investment certainty.',
        grounding: [
          'Stock Market answers must be interpretations of verified Kundli data only and must remain astrology-themed temperament or risk-discipline guidance.',
          'Never predict the price, direction, return, target, support, resistance, rally, crash or movement of any stock, index, cryptocurrency, commodity or security from astrology.',
          'Never provide personalized buy, sell, hold, entry, exit, stop-loss, target-price, position-size or leverage instructions.',
          'Never claim guaranteed profit, guaranteed loss, certain market success or a specific investment return percentage.',
          'A Mahadasha, Antardasha or Pratyantardasha may be used only to discuss broad financial temperament or caution, not to prove that a market trade will succeed.',
          'Never convert a dasha period into a guaranteed trading or investment window.',
          'If discussing risk-taking tendencies, clearly separate chart-based personality interpretation from real financial-market facts.',
          'Do not invent current market prices, market news, company fundamentals, earnings, index levels or real-time financial data.',
          'For actual investing decisions, keep the astrology answer general and encourage normal financial research and appropriate professional advice rather than presenting astrology as investment evidence.',
        ].join(' '),
      },
    };

    const config = categories[normalizedCategory];

    if (!config) {
      throw new ServiceUnavailableException('Unsupported Kundli AI category');
    }

    if (!question) {
      throw new ServiceUnavailableException('Question is required');
    }

    if (question.length > 1200) {
      throw new ServiceUnavailableException('Question is too long');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';

    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    /*
     * IMPORTANT:
     * These are provider-backed facts from the customer's generated Kundli.
     * OpenAI only interprets them. It must never calculate or invent chart data.
     */
    const factualInput = {
      birthChart: report.birthChart ?? report.charts?.birthChart ?? null,

      navamsaChart: report.navamsaChart ?? report.charts?.navamsaChart ?? null,

      majorDivisionalCharts: report.charts?.divisionalCharts ?? null,

      planetaryPositions: report.planetaryPositions ?? null,

      panchang: report.panchang ?? null,

      mahadashaTimeline: report.dasha?.timeline ?? null,

      antarDasha: report.dasha?.antarDasha ?? null,

      /*
       * Deterministically selected by the Prokerala dasha parser
       * from provider start/end dates.
       *
       * OpenAI must interpret this value only.
       */
      currentDasha: report.dasha?.current ?? null,

      /*
       * Prokerala currently does not provide a verified
       * event-specific marriage prediction in this field.
       *
       * Keep this visible to the interpretation layer so absence
       * of explicit timing evidence cannot be mistaken for permission
       * to invent a marriage year.
       */
      providerDashaPrediction: report.dasha?.mahaDashaPrediction ?? null,

      yogas: report.yogas ?? null,

      dosha: report.dosha ?? null,

      shadbala: report.shadbala ?? null,

      ashtakavarga: report.ashtakavarga ?? null,

      transit: (report as any).transit ?? (report as any).transits ?? null,
    };

    const client = new OpenAI({ apiKey });

    try {
      const currentDate = new Date().toISOString().slice(0, 10);

      const systemPrompt = [
        'You are ASP AI inside Astro Soul Path.',
        `You are currently the ${config.label} Vedic astrology assistant.`,
        '',
        'GROUNDING:',
        'Use only the supplied verified Kundli/Vedic data for astrology facts.',
        'Never invent planets, houses, signs, dashas, yogas, doshas, transits, dates or chart placements.',
        `Current server date is ${currentDate}. Treat this as TODAY when interpreting any dated Kundli or Dasha period.`,
        'Before presenting any prediction window, compare its start and end dates with the current date.',
        'Never describe an already-finished date range as upcoming, future, current, or a recommended future window.',
        'If an important Kundli period is already over, clearly label it as a past/historical period and do not use it as the primary answer to a future-looking question.',
        'For questions like "kab hoga", "when", "next", "upcoming", or "future", prioritize only supported periods that are current or after the current date.',
        'If the supplied Kundli data contains no supported future period, say clearly that the available verified data does not support a precise future date instead of recycling an expired period.',
        'For the Today assistant, never claim a live transit unless verified transit data is actually supplied in the factual Kundli context.',
        'Return readable plain text. Do not use Markdown bold markers such as **text**, heading markers such as ##, or other raw Markdown decoration.',
        'If the available Kundli data cannot support a precise prediction, clearly and naturally say that the indication is broad rather than inventing precision.',
        '',
        'FINAL ANSWER RULE - HIGHEST PRIORITY FOR PRESENTATION:',
        'For a normal customer question, the final answer MUST contain only the practical interpretation, not the technical chart evidence used to reach it.',
        'Treat planet names, signs, houses, house lords, Lagna, Ascendant, Navamsa, nakshatra, yoga, dosha, dasha, antardasha and transit placements as hidden reasoning evidence.',
        'Do not reveal technical evidence merely to justify or prove the answer. The customer does not need to see the chart calculation behind each conclusion.',
        'Before returning the final answer, silently rewrite any sentence that contains a house number, house lord, planet placement, Lagna, Ascendant, Navamsa, nakshatra, yoga, dosha, Mahadasha, Antardasha or technical transit reference into plain everyday English.',
        'Example: rewrite "Sun and Mercury in the 10th house support leadership" as "Your strengths support leadership, communication and confident decision-making."',
        'Example: rewrite "Moon in the 7th house shows emotional security needs" as "You are likely to value emotional security, loyalty and stability in relationships."',
        'Example: rewrite "Rahu-Mercury Antardasha supports networking" as "This current phase may be useful for communication, networking and building professional connections."',
        'The final answer should sound like practical personal guidance for an international customer, not like an astrology report.',
        'Only if the customer explicitly asks to see the technical astrology, chart placements, houses, planets, dashas or the astrological reason behind the answer may those technical details be shown.',
        '',
        'CUSTOMER-FACING LANGUAGE:',
        'The verified Vedic Kundli data below is internal evidence for your reasoning. Do not expose raw technical astrology terminology to the customer unless the customer explicitly asks for technical chart details.',
        'For normal customer questions, answer in simple, natural, internationally understandable English for someone with no astrology knowledge.',
        'Translate chart evidence into practical meaning instead of naming the technical placement behind it.',
        'Do not normally mention house numbers, planet-in-house wording, lord terminology, Lagna, Ascendant, Navamsa, nakshatra names, yoga names, dosha names, Mahadasha, Antardasha, or transit-house terminology.',
        'Do not write phrases such as "10th lord Sun", "Sun in the 10th house", "Moon in the 7th house", "Scorpio Lagna", "Budha-Aditya Yoga", "Rahu Mahadasha", "Mercury Antardasha", or "Jupiter transiting the 9th house" in a normal customer answer.',
        'Instead explain the practical meaning directly, using themes such as leadership, communication, emotional security, relationships, patience, learning, responsibility, planning, confidence, or career growth when those themes are supported by the verified chart.',
        'Dates or time windows may be stated when supported by the verified Kundli, but describe them as a current, upcoming, or supportive period rather than exposing technical dasha or transit names.',
        'Keep the answer warm, clear and useful. Prefer short readable paragraphs over dense technical explanations.',
        'Never invent a conclusion while simplifying. Every customer-facing statement must remain grounded in the supplied verified Kundli evidence.',
        '',
        'CATEGORY SCOPE:',
        config.scope,
        '',
        'CATEGORY BOUNDARY:',
        config.boundary,
        '',
        'CATEGORY-SPECIFIC EVIDENCE RULES:',
        config.grounding ?? 'No additional category-specific evidence rules.',
        '',
        'STYLE:',
        'Reply like a warm and experienced astrologer having a real conversation with the customer.',
        'Do not sound like a PDF report or database dump.',
        'Be friendly, personal, calm and useful.',
        'Start directly with the insight instead of introducing yourself.',
        'If the customer writes Hindi/Hinglish in Latin script, naturally reply in Hinglish.',
        'If the customer writes English, reply in friendly natural English.',
        'Use short readable paragraphs.',
        'Explain relevant planetary or dasha reasoning only when it genuinely exists in the supplied data.',
        'A calculated dasha period is astrology evidence, not by itself proof that a specific real-world event will occur during that period.',
        'Never transform a generic dasha range into a precise event date unless explicit supplied provider evidence supports that event and timing.',
        'Do not repeat "according to your Kundli" in every paragraph.',
        'Never use fear-based language.',
        'Never present difficult periods as unavoidable fate.',
        'Avoid absolute words such as definitely, guaranteed, 100%, pakka, certainly when predicting future events.',
        'Use balanced phrases such as "chances look stronger", "this period appears supportive", "the chart suggests", or "you may notice".',
        '',
        'ASTROLOGY DISCLAIMER STYLE:',
        'Do not add a long generic disclaimer to normal answers.',
        'Treat astrology as interpretive guidance rather than scientific certainty.',
        '',
        'OUT-OF-SCOPE:',
        `If the question is substantially outside ${config.label}, do not answer it in detail. Briefly tell the customer that this is the ${config.label} assistant and suggest the correct Astro Soul Path category.`,
      ].join('\n');

      const userPrompt = [
        'CUSTOMER QUESTION:',
        question,
        '',
        'VERIFIED KUNDLI DATA:',
        serializeAiAstrologyContext(factualInput, 30000),
      ].join('\n');

      const response = await client.responses.create({
        model,
        input: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_output_tokens: 1200,
      });

      const categoryUsage = response.usage;

      this.logger.log(
        `cost.openai feature=kundli_category input_tokens=${categoryUsage?.input_tokens ?? 0} output_tokens=${categoryUsage?.output_tokens ?? 0} total_tokens=${categoryUsage?.total_tokens ?? 0}`,
      );

      const answer = response.output_text?.trim();

      if (!answer) {
        throw new ServiceUnavailableException(
          'OpenAI returned an empty category answer',
        );
      }

      this.logger.log(
        `kundli.category_ai.success category=${normalizedCategory} model=${response.model ?? model}`,
      );

      return {
        category: normalizedCategory,
        answer,
        grounded: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown category AI error';

      this.logger.error(
        `kundli.category_ai.failed category=${normalizedCategory} message=${message}`,
      );

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to generate personalized astrology guidance',
      );
    }
  }
}
