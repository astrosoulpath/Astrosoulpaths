import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KundliService } from '../kundli/kundli.service';

@Injectable()
export class AstrologyAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kundliService: KundliService,
  ) {}

  async generateAnswer(
    supabaseUserId: string,
    questionId: string,
    categorySlug: string,
  ) {
    const question = await this.prisma.astrologyQuestion.findFirst({
      where: {
        id: questionId,
        isActive: true,
        category: {
          slug: categorySlug,
          isActive: true,
        },
      },
      include: {
        category: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Selected astrology question was not found.');
    }
    if (!supabaseUserId?.trim()) {
      throw new NotFoundException('Authenticated customer was not found.');
    }

    const kundliResult = await this.kundliService.generateMyKundli(
      supabaseUserId.trim(),
      'en',
    );

    const report = kundliResult.report as Record<string, unknown>;

    const kundliContext = {
      profile: {
        name: kundliResult.profile.name,
        gender: kundliResult.profile.gender,
        birthPlace: kundliResult.profile.birthPlace,
        dob: kundliResult.profile.dob,
        tob: kundliResult.profile.tob,
        latitude: kundliResult.profile.lat,
        longitude: kundliResult.profile.lon,
        timezone: kundliResult.profile.timezone,
      },
      birthChart: report.birthChart ?? null,
      navamsaChart: report.navamsaChart ?? null,
      planetaryPositions: report.planetaryPositions ?? null,
      dasha: report.dasha ?? null,
      yogas: report.yogas ?? null,
      dosha: report.dosha ?? null,
      ashtakavarga: report.ashtakavarga ?? null,
      shadbala: report.shadbala ?? null,
      analysis: report.analysis ?? null,
    };

    const serializedKundliContext = JSON.stringify(kundliContext);

    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5';

    if (!apiKey) {
      return {
        success: true,
        configured: false,
        data: {
          questionId: question.id,
          question: question.text,
          category: {
            slug: question.category.slug,
            name: question.category.name,
          },
          answer: null,
          message:
            'AI astrology answers are ready but the AI service is not configured yet.',
        },
      };
    }

    try {
      const openai = new OpenAI({
        apiKey,
      });

      const response = await openai.responses.create({
        model,
        store: false,
        instructions: [
          'You are the automated astrology guidance assistant for Astro Soul Path.',
          'Give a warm, concise and useful astrology-style response.',
          'Do not claim certainty about the future.',
          'Do not present medical, legal or financial guidance as professional advice.',
          'For health, legal and financial topics, clearly keep the response general and reflective.',
          'Do not invent a Kundli, planetary placement, birth chart, dasha or transit unless such data was explicitly provided.',
          'The authenticated customer Kundli and birth-chart data is provided below. Base the answer on that real data.',
          'Refer to relevant chart factors such as ascendant, planetary placements, houses, Navamsa, dasha, yogas or doshas only when supported by the supplied Kundli.',
          'Do not say that the customer birth details are unavailable when Kundli data is present.',
          'Answer in clear natural English.',
          'End with a short invitation to consult a professional astrologer for a personalized birth-chart reading.',
        ].join(' '),
        input: [
          `Category: ${question.category.name}`,
          `Selected question: ${question.text}`,
          '',
          'Authenticated customer real Vedic Kundli data:',
          serializedKundliContext,
          '',
          'Provide personalized astrology guidance using only the supplied Kundli data. Explain the most relevant chart factors in natural language. Do not fabricate missing partner data or unsupported transits.',
        ].join('\n'),
      });

      const answer = response.output_text.trim();

      if (!answer) {
        throw new ServiceUnavailableException(
          'AI service returned an empty response.',
        );
      }

      return {
        success: true,
        configured: true,
        data: {
          questionId: question.id,
          question: question.text,
          category: {
            slug: question.category.slug,
            name: question.category.name,
          },
          answer,
          model,
          personalized: true,
          kundliSource: 'customer-profile',
        },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to generate astrology guidance right now.',
      );
    }
  }
}
