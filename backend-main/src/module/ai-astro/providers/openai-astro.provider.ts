import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';

import { buildAiConsultantInstructions } from '../domain/ai-consultant-instructions';

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
    maxChars = 180_000,
  ): string {
    const serialized = JSON.stringify(value ?? {});

    if (serialized.length <= maxChars) {
      return serialized;
    }

    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return JSON.stringify({
        truncated: true,
        reason: 'CONTEXT_SIZE_LIMIT',
      });
    }

    const compact: Record<string, unknown> = {};
    const source = value as Record<string, unknown>;

    for (const [key, item] of Object.entries(source)) {
      if (
        key === 'report' ||
        key === 'raw' ||
        key === 'rawData' ||
        key === 'rawResponse'
      ) {
        continue;
      }

      compact[key] = item;

      const candidate = JSON.stringify(compact);

      if (candidate.length > maxChars) {
        delete compact[key];
      }
    }

    return JSON.stringify(compact);
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
      80_000,
    );

    const previousConversation = (input.conversation ?? [])
      .slice(-2)
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

    const isAstrologyConsultant =
      consultant.code === 'VEDIC_ASTROLOGER' ||
      consultant.code === 'KP_ASTROLOGER';

    const instructions = [
      ...specialistInstructions,

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
              ? `Supplied specialist context:\n${consultantContext}`
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
    ]
      .filter(Boolean)
      .join('\n');

    const responseStyleInstructions = `
RESPONSE STYLE — MUST FOLLOW:

1. Match the language of the user's latest message.
   - English => English.
   - Devanagari Hindi => Hindi.
   - Roman Hindi / Hinglish => natural Roman Hinglish.

2. Reply like a fast mobile chat consultation.
   - Treat the latest customer message as the primary intent.
   - Begin the useful answer immediately; do not wait for unnecessary details.
   - Give the useful answer immediately.
   - Usually 25-60 words.
   - Maximum 2 short paragraphs.
   - No long introduction.
   - No large checklist.
   - Ask maximum 1 short follow-up question.

3. Preserve the selected consultant's specialist identity, but never leave a normal customer question unanswered.
   - If the latest question belongs to this specialist's domain, answer as that specialist.
   - If the latest question is outside the specialist domain, still give a concise, useful general-guidance response.
   - Clearly avoid pretending that general guidance is a specialist calculation or prediction.
   - Never force the customer to restart the chat merely because the topic changed.
   - The latest customer message is authoritative for conversational intent.

4. Never invent planets, houses, dashas, exact dates, salary,
   birth details, directions, room placements or calculations.

5. Avoid headings and bullets unless absolutely necessary.
`;

    const stream = await this.client.responses.create({
      model: this.model,
      max_output_tokens: 240,
      instructions: instructions + '\n\n' + responseStyleInstructions,
      input: [
        ...previousConversation,
        {
          role: 'user',
          content: input.question,
        },
      ],
      stream: true,
    });

    let answer = '';

    for await (const event of stream) {
      if (event.type !== 'response.output_text.delta') {
        continue;
      }

      const chunk = event.delta;

      if (!chunk) {
        continue;
      }

      answer += chunk;

      await onChunk(chunk);
    }

    const finalAnswer = answer.trim();

    if (!finalAnswer) {
      throw new ServiceUnavailableException(
        'AI provider returned an empty streamed response',
      );
    }

    return {
      answer: finalAnswer,
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
      80_000,
    );

    const previousConversation = (input.conversation ?? [])
      .slice(-12)
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

    const isAstrologyConsultant =
      consultant.code === 'VEDIC_ASTROLOGER' ||
      consultant.code === 'KP_ASTROLOGER';

    const instructions = [
      ...specialistInstructions,

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
RESPONSE STYLE — MUST FOLLOW:

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
      max_output_tokens: 120,
      instructions: instructions + '\n\n' + responseStyleInstructions,
      input: [
        ...previousConversation.slice(-2),
        {
          role: 'user',
          content: input.question,
        },
      ],
    });

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
