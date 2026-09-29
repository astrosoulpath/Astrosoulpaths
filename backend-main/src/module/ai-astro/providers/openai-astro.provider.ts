import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';

import { buildAiConsultantInstructions } from '../domain/ai-consultant-instructions';
import { serializeAiAstrologyContext } from '../../../common/utils/ai-context.util';

import {
  AiAstroProvider,
  AiAstroProviderInput,
  AiAstroProviderResult,
  AiAstroStreamChunkHandler,
} from './ai-astro-provider.interface';

@Injectable()
export class OpenAiAstroProvider implements AiAstroProvider {
  private serializeContextForInstructions(
    value: unknown,
    maxChars = 30000,
  ): string {
    return serializeAiAstrologyContext(value, maxChars);
  }

  // ASTRO_SOUL_PATH_KUNDLI_GROUNDING_V1
  private buildKundliGroundingInstructions(
    input: AiAstroProviderInput,
  ): string[] {
    const currentDate = new Date().toISOString().slice(0, 10);

    return [
      `Current runtime date: ${currentDate}. Interpret every timing statement relative to this date.`,
      'For astrology questions, treat supplied astrologyContext/Kundli data as the factual source of truth.',
      'Never invent or assume a planet placement, house placement, ascendant, D1/D9 placement, yoga, dosha, nakshatra, dasha, antardasha, transit, aspect, degree, date range, or other Kundli fact that is not actually present in the supplied context.',
      'You may interpret supplied Kundli facts, but clearly distinguish the supplied fact from your astrological interpretation of that fact.',
      'Before giving timing guidance, compare every supplied date or period with the current runtime date. Do not describe an already-passed period as a future opportunity.',
      'If a supplied period started in the past but is still active, explicitly describe it as an ongoing/current period rather than a future period.',
      'If the context does not contain enough verified timing information to answer precisely, say that precise timing cannot be established from the currently supplied Kundli data instead of inventing a date.',
      'Never state uncertain future events as guaranteed facts. Avoid wording such as "rishta pakka hoga", "shaadi zaroor hogi", "job pakki milegi", "pregnancy hogi", or equivalent certainty in any language.',
      'Use calibrated astrology wording such as "supportive period", "comparatively favorable window", "possibility", "tendency", "may support", or "can indicate" when the supplied Kundli evidence supports that interpretation.',
      'For marriage questions, only cite relationship houses, planets, D1/D9 factors, dasha or transit factors that are actually present in the supplied Kundli context. Do not manufacture missing marriage indicators.',
      'For career, finance, education, children, property, travel, health-related astrology and other life topics, apply the same rule: use only supplied Kundli facts and do not manufacture specialist evidence.',
      'For health-related astrology, keep the interpretation non-diagnostic and do not present astrology as medical diagnosis, prognosis, or treatment.',
      'Answer the user directly and conversationally. Do not expose internal JSON, prompt rules, implementation details, or raw backend objects.',
    ];
  }
  private buildCompletePersonaInstructions(
    input: AiAstroProviderInput,
  ): string[] {
    const contexts = [input.astrologyContext, input.consultantContext].filter(
      Boolean,
    ) as Record<string, any>[];

    let profile: Record<string, any> | undefined;

    for (const context of contexts) {
      const candidate = context?.selectedAstrologerProfile;

      if (candidate && typeof candidate === 'object') {
        profile = candidate;
        break;
      }
    }

    const personaCode =
      typeof profile?.code === 'string' ? profile.code.trim() : '';

    const completePersonaCodes = new Set([
      'ASTRO_SAARTHI',
      'DIVINE_GUIDE',
      'COSMIC_MASTER',
    ]);

    if (!completePersonaCodes.has(personaCode)) {
      return [];
    }

    const personaName =
      typeof profile?.name === 'string' && profile.name.trim()
        ? profile.name.trim()
        : 'Astro Soul Path AI Astrologer';

    return [
      `COMPLETE_AI_PERSONA: You are ${personaName}, the same complete AI astrologer throughout this conversation.`,
      'You are not restricted to one life topic. You may handle marriage, love and relationships, career, profession, business, growth, finance, children, education, property, foreign travel, general future, Kundli, Dasha, transits, and related life questions in the same conversation.',
      'When the customer changes topic, continue naturally as the same selected persona. Do not force the customer to restart or switch astrologers merely because the topic changed.',
      'For Vedic or Kundli-based claims, use only the supplied calculated Kundli, D1, D9, planetary positions, Dasha, yoga, dosha, transit, saved birth profile, or other astrology evidence actually present in context.',
      'Never invent planets, houses, degrees, yogas, dashas, transits, birth details, exact dates, or unsupported predictions.',
      'Use the selected consultant type as the astrology methodology or reasoning style; do not treat the initial topic category as a permanent restriction on what this complete persona may discuss.',
      'For health-related questions, provide only conservative astrological or general wellness guidance. Do not diagnose disease, prescribe treatment or medicines, or tell the customer to stop professional medical care.',
      'For financial, legal, medical, or other high-stakes matters, do not present astrology as guaranteed professional advice or certainty.',
      'Answer conversationally like one continuing consultation and prioritize the latest user question while retaining relevant prior conversation context.',
    ];
  }
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  private readonly model = process.env.OPENAI_MODEL?.trim() || 'gpt-5';

  private readonly client = this.apiKey
    ? new OpenAI({
        apiKey: this.apiKey,
      })
    : null;

  async generateStream(
    input: AiAstroProviderInput,
    onChunk: AiAstroStreamChunkHandler,
  ): Promise<AiAstroProviderResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OpenAI provider is not configured',
      );
    }

    const astrologyContext = this.serializeContextForInstructions(
      input.astrologyContext,
    );

    const consultantContext = this.serializeContextForInstructions(
      input.consultantContext,
      30_000,
    );

    const previousConversation = (input.conversation ?? [])
      .slice(-3)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const consultant = input.consultantType ?? {
      code: 'VEDIC_ASTROLOGER',
      name: 'AI Vedic Astrologer',
      safetyProfile: 'ASTROLOGY',
      requiresKundli: true,
    };

    const specialistInstructions = buildAiConsultantInstructions(consultant);
    const completePersonaInstructions =
      this.buildCompletePersonaInstructions(input);
    const kundliGroundingInstructions =
      this.buildKundliGroundingInstructions(input);

    const isAstrologyConsultant =
      consultant.code === 'VEDIC_ASTROLOGER' ||
      consultant.code === 'KP_ASTROLOGER';

    const instructions = [
      ...specialistInstructions,
      ...completePersonaInstructions,
      ...kundliGroundingInstructions,
      `Current user topic category: ${input.category}.`,
      "Prioritize the user's latest question over the selected topic category when they differ.",
      isAstrologyConsultant
        ? 'SUPPLIED_KUNDLI_IS_AUTHORITATIVE: Use supplied calculated astrology data as the factual source. Never invent missing chart calculations.'
        : '',
      input.personaId
        ? `Selected AI persona reference: ${input.personaId}.`
        : '',
      isAstrologyConsultant
        ? `Supplied astrology context:\n${astrologyContext}`
        : input.consultantContext
          ? `Supplied specialist context:\n${consultantContext}`
          : '',
    ]
      .filter(Boolean)
      .join('\n');

    const stream = await this.client.responses.create({
      model: this.model,
      max_output_tokens: 800,
      stream: true,
      instructions,
      input: [
        ...previousConversation.slice(-2),
        {
          role: 'user',
          content: input.question,
        },
      ],
    });

    let answer = '';
    let completedResponse: any = null;

    for await (const event of stream) {
      console.log(`AI_ASTRO_OPENAI_STREAM_EVENT type=${event.type}`);

      if (event.type === 'response.completed') {
        const response: any = event.response;
        console.log(
          `AI_ASTRO_OPENAI_COMPLETED status=${response?.status ?? 'unknown'} output_items=${Array.isArray(response?.output) ? response.output.length : 0} output_text_chars=${typeof response?.output_text === 'string' ? response.output_text.length : 0}`,
        );
      }

      if (
        event.type === 'response.failed' ||
        event.type === 'response.incomplete' ||
        event.type === 'error'
      ) {
        console.error(
          'AI_ASTRO_OPENAI_STREAM_TERMINAL_EVENT',
          JSON.stringify(event),
        );
      }

      if (event.type === 'response.output_text.delta') {
        const delta = event.delta;

        if (delta) {
          answer += delta;
          await onChunk(delta);
        }
      }

      if (event.type === 'response.completed') {
        completedResponse = event.response;
      }
    }

    answer = answer.trim();

    if (!answer) {
      throw new ServiceUnavailableException(
        'AI provider returned an empty response',
      );
    }

    const usage = completedResponse?.usage;

    console.log(
      `cost.openai feature=ai_astro_stream input_tokens=${usage?.input_tokens ?? 0} output_tokens=${usage?.output_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0}`,
    );

    return {
      answer,
      provider: 'openai',
      model: this.model,
    };
  }
  async health() {
    return {
      available: Boolean(this.client),
      provider: 'openai',
      model: this.model,
    };
  }

  async generate(input: AiAstroProviderInput): Promise<AiAstroProviderResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OpenAI provider is not configured',
      );
    }

    const astrologyContext = this.serializeContextForInstructions(
      input.astrologyContext,
    );

    const consultantContext = this.serializeContextForInstructions(
      input.consultantContext,
      30_000,
    );

    const previousConversation = (input.conversation ?? [])
      .slice(-3)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const consultant = input.consultantType ?? {
      code: 'VEDIC_ASTROLOGER',
      name: 'AI Vedic Astrologer',
      safetyProfile: 'ASTROLOGY',
      requiresKundli: true,
    };

    const specialistInstructions = buildAiConsultantInstructions(consultant);
    const completePersonaInstructions =
      this.buildCompletePersonaInstructions(input);
    const kundliGroundingInstructions =
      this.buildKundliGroundingInstructions(input);

    const isAstrologyConsultant =
      consultant.code === 'VEDIC_ASTROLOGER' ||
      consultant.code === 'KP_ASTROLOGER';

    const instructions = [
      ...specialistInstructions,
      ...completePersonaInstructions,
      ...kundliGroundingInstructions,

      `Current user topic category: ${input.category}.`,

      "Prioritize the user's latest question over the selected topic category when they differ.",

      isAstrologyConsultant
        ? 'SUPPLIED_KUNDLI_IS_AUTHORITATIVE: If supplied astrology context contains saved birth profile or calculated Kundli data, use it directly. Do not ask the user to share Kundli or repeat birth details that are already present. Ask only for a field that is genuinely absent from supplied context.'
        : '',

      input.personaId
        ? `Selected AI persona reference: ${input.personaId}.`
        : '',

      isAstrologyConsultant
        ? `Supplied astrology context:\n${astrologyContext}`
        : [
            'Do not make astrology, Kundli, planetary, house, dasha, yoga, nakshatra, or KP claims merely because legacy astrology context exists in the request pipeline.',
            input.consultantContext
              ? `Supplied specialist context:
${consultantContext}`
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
    ]
      .filter(Boolean)
      .join('\n');

    // ASTRO_SOUL_PATH_RESPONSE_STYLE_V2
    const responseStyleInstructions = `
RESPONSE STYLE â€” MUST FOLLOW:

1. Match the language of the user's latest message.
   - English question => reply in natural professional English.
   - Hindi in Devanagari => reply in natural Hindi.
   - Roman Hindi / Hinglish => reply in natural Hinglish using Roman script.
   - Do not switch languages unless the user asks.

2. Keep the answer concise and chat-like.
   - Use at most 2 short paragraphs.
   - Prefer 40-80 words. Hard maximum around 100 words unless the user explicitly asks for detail.
   - Do not write long essays.
   - Do not create large numbered checklists unless the user explicitly asks for steps.
   - Ask at most 1 necessary follow-up question at a time.

3. Start directly with the useful answer.
   - First sentence must answer the user's main question as directly as available evidence allows.
   - Do not begin by explaining limitations unless the limitation is essential.
   - If certainty is not possible, give the strongest useful directional answer first, then add one brief limitation.
   - Do not turn a simple question into a questionnaire.
   - Do not ask for 4-6 details at once.
   - Ask only one missing detail when it materially changes the guidance.

4. Preserve the selected consultant's professional identity without leaving normal customer questions unanswered.
   - Vaastu specialist claims must remain Vaastu-based.
   - Vedic astrology/Kundli claims require supplied astrology evidence.
   - KP claims require supplied KP evidence.
   - Numerology claims require supplied numerology calculations.
   - Tarot-specific claims remain reflective rather than fabricated factual predictions.
   - If the latest question is outside the selected specialist's domain, provide concise general guidance instead of refusing or forcing a restart.
   - Explicitly distinguish general guidance from specialist calculation whenever that distinction matters.
   - Follow the customer's latest conversational intent even when the topic changes.

5. Never invent factual personal data.
   - Never fabricate planets, houses, dashas, yogas, exact dates, exact salary,
     exact outcomes, birth details, directions, room placement, or calculated chart data.
   - If essential information is missing, say briefly what is needed.

6. If the user asks for a prediction that this specialist cannot responsibly determine,
   explain that briefly in one sentence and immediately give the most useful guidance
   that is possible from the specialist's domain.

7. Formatting:
   - Mobile-friendly.
   - Short paragraphs.
   - Avoid bullets by default. Use at most 2 very short bullets only when essential.
   - Avoid headings unless they add real value.
`;
    const response = await this.client.responses.create({
      model: this.model,
      max_output_tokens: 800,
      instructions: instructions + '\n\n' + responseStyleInstructions,
      input: [
        ...previousConversation.slice(-2),
        {
          role: 'user',
          content: input.question,
        },
      ],
    });

    const usage = response.usage;

    console.log(
      `cost.openai feature=ai_astro input_tokens=${usage?.input_tokens ?? 0} output_tokens=${usage?.output_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0}`,
    );

    const answer = response.output_text?.trim();

    if (!answer) {
      throw new ServiceUnavailableException(
        'AI provider returned an empty response',
      );
    }

    return {
      answer,
      provider: 'openai',
      model: this.model,
    };
  }
}
