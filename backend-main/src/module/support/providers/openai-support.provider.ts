import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import {
  SupportAiProvider,
  SupportAiProviderInput,
  SupportAiProviderResult,
} from './support-ai-provider.interface';

@Injectable()
export class OpenAiSupportProvider implements SupportAiProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  private readonly model = process.env.OPENAI_MODEL?.trim() || 'gpt-5';

  private readonly client = this.apiKey
    ? new OpenAI({
        apiKey: this.apiKey,
      })
    : null;

  async health() {
    return {
      available: Boolean(this.client),
      provider: 'openai',
      model: this.model,
    };
  }

  async generate(
    input: SupportAiProviderInput,
  ): Promise<SupportAiProviderResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OpenAI support provider is not configured',
      );
    }

    const previousConversation = (input.conversation ?? [])
      .slice(-16)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const instructions = [
      'You are Astro Soul Path 24x7 Support Assistant.',
      'You help customers use the Astro Soul Path app and understand support processes.',
      'Be concise, professional, friendly, and action-oriented.',
      'Never invent wallet balances, transactions, consultation details, astrologer availability, subscription status, ticket status, account details, or backend records.',
      'Never claim that an action was completed unless the backend context explicitly confirms it.',
      'Do not expose internal admin data, API keys, secrets, tokens, infrastructure details, or private user data.',
      'Do not provide personal phone numbers or tell the customer to call an admin.',
      'Support is handled inside the app through chat and support tickets.',
      'If the customer needs a human, tell them they can use the Talk to Human Support option.',
      'If account-specific information is required but has not been supplied by the backend, clearly say that you cannot verify that information yet.',
      'Do not pretend to be a human support agent.',
      'For astrology predictions or personal astrology interpretation, direct the customer to the appropriate Astro Soul Path astrology feature rather than fabricating an answer.',
      'Do not promise refunds, credits, wallet adjustments, or account changes. Those require authorized admin/backend action.',
    ].join('\n');

    const response = await this.client.responses.create({
      model: this.model,

      instructions,

      input: [
        ...previousConversation,
        {
          role: 'user',
          content: input.question,
        },
      ],
    });

    const usage = response.usage;

    console.log(
      `cost.openai feature=support input_tokens=${usage?.input_tokens ?? 0} output_tokens=${usage?.output_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0}`,
    );

    const answer = response.output_text?.trim();

    if (!answer) {
      throw new ServiceUnavailableException(
        'Support AI provider returned an empty response',
      );
    }

    return {
      answer,
      provider: 'openai',
      model: this.model,
    };
  }
}


