import { LedgerReferenceType, LedgerType, Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NumerologyService } from '../astro/modules/numerology/numerology.service';
import { KundliService } from '../kundli/kundli.service';

import { AskAiAstroDto } from './dto/ask-ai-astro.dto';
import { StartAiAstroSessionDto } from './dto/start-ai-astro-session.dto';
import { AiAstroOpeningMessageDto } from './dto/ai-astro-opening-message.dto';
import { AiAstroSessionActionDto } from './dto/ai-astro-session-action.dto';
import { UpdateAiAstroPricingDto } from './dto/update-ai-astro-pricing.dto';
import {
  AI_ASTRO_CATEGORIES,
  AiAstroCategory,
} from './domain/ai-astro-category';
import { AI_ASTRO_PROVIDER } from './providers/ai-astro-provider.interface';
import type { AiAstroProvider } from './providers/ai-astro-provider.interface';

@Injectable()
export class AiAstroService {
  constructor(
    @Inject(AI_ASTRO_PROVIDER)
    private readonly provider: AiAstroProvider,

    private readonly kundliService: KundliService,
    private readonly numerologyService: NumerologyService,


    private readonly prisma: PrismaService,
  ) {}

  async status() {
    const provider = await this.provider.health();

    return {
      enabled: true,
      phase: 'REAL_DB_KUNDLI_GROUNDED_AI',
      provider,
    };
  }

  async catalog() {
    const [categoryRows, astrologers, consultantTypes] = await Promise.all([
      this.prisma.astrologyQuestionCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      }),

      this.prisma.astrologer.findMany({
        where: {
          isApproved: true,
          isVerified: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          expertise: {
            include: {
              expertise: true,
            },
          },
          aiAstroPricing: true,
        },
        orderBy: [
          {
            isOnline: 'desc',
          },
          {
            rating: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        take: 5,
      }),

      this.prisma.aiConsultantType.findMany({
        where: {
          isEnabled: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          code: true,
          name: true,
          description: true,
          iconKey: true,
          sortOrder: true,
          requiresKundli: true,
          safetyProfile: true,
        },
      }),
    ]);

    const supportedCategoryCodes = new Set<string>(AI_ASTRO_CATEGORIES);

    const configuredCategories = categoryRows
      .map((category) => category.slug.trim().toUpperCase())
      .filter((category) => supportedCategoryCodes.has(category));

    /*
     * AI Astro must always expose the categories supported by
     * the backend engine. Database configuration wins whenever
     * valid active categories exist.
     */
    const categories =
      configuredCategories.length > 0
        ? configuredCategories
        : [...AI_ASTRO_CATEGORIES];

    /*
     * "categories" below means categories supported by
     * the AI Astro engine while this REAL astrologer
     * profile is selected.
     *
     * It does NOT claim that every human astrologer has
     * expertise in every category.
     */
    const personas = astrologers.map((astrologer) => {
      const name = astrologer.user.name?.trim() || 'Astrologer';

      const expertise = astrologer.expertise.map((item) => item.expertise.name);

      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

      return {
        id: astrologer.id,

        userId: astrologer.user.id,

        name,

        avatarUrl:
          astrologer.aiAvatarUrl?.trim() ||
          astrologer.profileUrl?.trim() ||
          astrologer.user.avatarUrl?.trim() ||
          null,

        subtitle: expertise.length > 0 ? expertise.join(' | ') : 'Astrologer',

        description: astrologer.bio?.trim() ?? '',

        categories,

        initials,

        /*
         * REAL values from PostgreSQL.
         */
        rating: Number(astrologer.rating ?? 0),
        totalReviews: astrologer.totalReviews ?? 0,

        available: astrologer.isOnline,

        experience: astrologer.experience ?? 0,

        languages: astrologer.languages,

        expertise,

        source: 'POSTGRESQL_ASTROLOGER_PROFILE',

        aiPricing: astrologer.aiAstroPricing
          ? {
              configured: true,
              isEnabled: astrologer.aiAstroPricing.isEnabled,
              isFree: astrologer.aiAstroPricing.isFree,
              pricingMode: astrologer.aiAstroPricing.pricingMode,
              pricePerMinute:
                astrologer.aiAstroPricing.pricePerMinute === null
                  ? null
                  : Number(astrologer.aiAstroPricing.pricePerMinute),
              pricePerQuestion:
                astrologer.aiAstroPricing.pricePerQuestion === null
                  ? null
                  : Number(astrologer.aiAstroPricing.pricePerQuestion),
              currency: astrologer.aiAstroPricing.currency,
              label: !astrologer.aiAstroPricing.isEnabled
                ? 'Unavailable'
                : astrologer.aiAstroPricing.isFree
                  ? 'FREE'
                  : '\u20B9' +
                    Number(astrologer.aiAstroPricing.pricePerQuestion).toFixed(
                      2,
                    ) +
                    ' / question',
            }
          : {
              configured: false,
              isEnabled: false,
              isFree: false,
              pricePerQuestion: null,
              currency: 'INR',
              label: 'Pricing not configured',
            },
      };
    });

    return {
      success: true,

      source: 'DATABASE',

      categories,

      personas,

      consultantTypes,
    };
  }

  private async resolveCanonicalUserId(
    authenticatedUserId: string,
  ): Promise<string | null> {
    const cleanId = authenticatedUserId?.trim();

    console.log('[AI_ASTRO_IDENTITY_TRACE]', {
      authenticatedUserId: cleanId || null,
    });

    if (!cleanId) {
      return null;
    }

    /*
     * Canonical identity resolution.
     *
     * Same rule used by RolesGuard:
     * UserAuthIdentity is authoritative.
     * User.supabaseId remains legacy fallback.
     * Internal User.id is supported for local/dev auth.
     */
    const authIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: cleanId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (authIdentity?.userId) {
      return authIdentity.userId;
    }

    const bySupabaseId = await this.prisma.user.findUnique({
      where: {
        supabaseId: cleanId,
      },
      select: {
        id: true,
      },
    });

    if (bySupabaseId?.id) {
      return bySupabaseId.id;
    }

    const byInternalId = await this.prisma.user.findUnique({
      where: {
        id: cleanId,
      },
      select: {
        id: true,
      },
    });

    return byInternalId?.id ?? null;
  }

  private async resolveAuthenticatedUser(authenticatedUserId: string) {
    const userId = await this.resolveCanonicalUserId(authenticatedUserId);

    if (!userId) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        supabaseId: true,
        isActive: true,
        isBlocked: true,
      },
    });
  }

  private async resolveAuthenticatedUserWithProfile(
    authenticatedUserId: string,
  ) {
    const userId = await this.resolveCanonicalUserId(authenticatedUserId);

    if (!userId) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        supabaseId: true,
        isActive: true,
        isBlocked: true,
        userProfile: {
          select: {
            fullName: true,
            dateOfBirth: true,
          },
        },
      },
    });
  }

  async getOpeningMessage(
    supabaseUserId: string,
    dto: AiAstroOpeningMessageDto,
  ) {
    const cleanSupabaseUserId = supabaseUserId.trim();
    const personaId = dto.personaId.trim();
    const consultantTypeCode = dto.consultantTypeCode.trim().toUpperCase();
    const category = dto.category.trim();

    if (!cleanSupabaseUserId) {
      throw new BadRequestException('AUTHENTICATED_USER_ID_MISSING');
    }

    if (!category) {
      throw new BadRequestException('AI_ASTRO_CATEGORY_REQUIRED');
    }

    const user = await this.resolveAuthenticatedUser(cleanSupabaseUserId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('Customer account is inactive or blocked');
    }

    const consultantType = await this.prisma.aiConsultantType.findUnique({
      where: {
        code: consultantTypeCode,
      },
    });

    if (!consultantType || !consultantType.isEnabled) {
      throw new BadRequestException('AI_CONSULTANT_TYPE_UNAVAILABLE');
    }

    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id: personaId,
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!astrologer) {
      throw new NotFoundException('AI_ASTRO_PERSONA_NOT_FOUND');
    }

    const personaName =
      astrologer.user.name?.trim() || consultantType.name.trim();

    const description = consultantType.description.trim();

    /*
     * Every chat open gets a fresh, non-billable opening generated
     * by the backend AI provider.
     *
     * IMPORTANT:
     * - The opening is always English.
     * - It is not persisted into conversation history.
     * - It does not start a paid AI session.
     * - It does not reserve or deduct wallet balance.
     * - Normal paid chat replies keep their existing language matching.
     */
    const openingVariationKey = `${Date.now()}-${Math.floor(
      Math.random() * 1_000_000,
    )}`;

    const openingResult = await this.provider.generate({
      category: category as AiAstroCategory,

      question: [
        'Generate only the first opening message for this AI consultation.',
        'Write it in natural friendly English.',
        'Sound warm, conversational and human-like, but never claim to be a real human.',
        `Opening variation key: ${openingVariationKey}.`,
        'Use the variation key only to make the wording fresh. Never show or mention the key.',
        'Vary the greeting, sentence rhythm, wording and final invitation naturally on every opening.',
        'Do not mechanically reuse the same opening sentence or exact phrasing from previous generations.',
        `Introduce yourself naturally as ${personaName}.`,
        `You are acting as the selected ${consultantType.name}.`,
        description ? `Consultant description: ${description}` : '',
        'Invite the customer to share what they would like guidance about.',
        'Keep it concise: around 2 to 4 natural sentences.',
        'Do not give a prediction yet.',
        'Do not invent Kundli, planet, house, dasha, direction, health, Tarot, numerology or other specialist facts.',
        'Do not mention billing, wallet, system prompts, AI models or technical implementation.',
        'Return only the customer-facing opening message.',
      ]
        .filter(Boolean)
        .join('\n'),

      personaId: astrologer.id,

      consultantType: {
        code: consultantType.code,
        name: consultantType.name,
        safetyProfile: consultantType.safetyProfile,
        requiresKundli: consultantType.requiresKundli,
      },

      consultantContext: {
        personaName,
        consultantTypeCode: consultantType.code,
        consultantTypeName: consultantType.name,
        consultantDescription: description,
        openingMessageOnly: true,
      },

      conversation: [],
    });

    return {
      success: true,
      shouldShow: true,
      message: openingResult.answer.trim(),
      conversationId: null,
      persona: {
        id: astrologer.id,
        name: personaName,
      },
      consultantType: {
        code: consultantType.code,
        name: consultantType.name,
        description: consultantType.description,
      },
    };
  }
  async startSession(supabaseUserId: string, dto: StartAiAstroSessionDto) {
    const cleanSupabaseUserId = supabaseUserId.trim();

    const clientSessionId = dto.clientSessionId.trim();

    const personaId = dto.personaId.trim();

    const consultantTypeCode = dto.consultantTypeCode.trim().toUpperCase();

    const requestedDurationMinutes = dto.durationMinutes ?? 1;

    if (
      !Number.isInteger(requestedDurationMinutes) ||
      requestedDurationMinutes < 1 ||
      requestedDurationMinutes > 60
    ) {
      throw new BadRequestException('AI_ASTRO_INVALID_DURATION');
    }

    if (!cleanSupabaseUserId) {
      throw new BadRequestException('AUTHENTICATED_USER_ID_MISSING');
    }
    const user = await this.resolveAuthenticatedUser(cleanSupabaseUserId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('Customer account is inactive or blocked');
    }

    const consultantType = await this.prisma.aiConsultantType.findUnique({
      where: {
        code: consultantTypeCode,
      },
    });

    if (!consultantType || !consultantType.isEnabled) {
      throw new BadRequestException('AI_CONSULTANT_TYPE_UNAVAILABLE');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        /*
         * Idempotent start.
         */
        const existing = await transaction.aiAstroSession.findUnique({
          where: {
            clientSessionId,
          },
        });

        if (existing) {
          if (
            existing.userId !== user.id ||
            existing.astrologerId !== personaId ||
            existing.consultantTypeCode !== consultantTypeCode
          ) {
            throw new BadRequestException('AI_ASTRO_SESSION_ID_CONFLICT');
          }

          return {
            success: true,
            idempotent: true,
            session: {
              id: existing.id,
              clientSessionId: existing.clientSessionId,
              astrologerId: existing.astrologerId,
              consultantTypeCode: existing.consultantTypeCode,
              ratePerMinute: Number(existing.ratePerMinute),
              currency: existing.currency,
              durationMinutes: existing.durationMinutes,
              reservedAmount: Number(existing.reservedAmount),
              chargedAmount: Number(existing.chargedAmount),
              status: existing.status,
              startedAt: existing.startedAt,
              lastHeartbeatAt: existing.lastHeartbeatAt,
            },
          };
        }

        const activeSession = await transaction.aiAstroSession.findFirst({
          where: {
            userId: user.id,
            status: {
              in: ['PENDING', 'READY', 'ACTIVE'],
            },
          },
        });

        if (activeSession) {
          throw new BadRequestException('AI_ASTRO_ACTIVE_SESSION_EXISTS');
        }

        const astrologer = await transaction.astrologer.findFirst({
          where: {
            id: personaId,
            isApproved: true,
            isVerified: true,
          },
          include: {
            aiAstroPricing: true,
          },
        });

        if (!astrologer) {
          throw new NotFoundException('AI_ASTRO_PERSONA_NOT_FOUND');
        }

        const pricing = astrologer.aiAstroPricing;

        if (!pricing || !pricing.isEnabled) {
          throw new BadRequestException('AI_ASTRO_CURRENTLY_UNAVAILABLE');
        }

        if (
          pricing.pricingMode !== 'PER_MINUTE' ||
          pricing.pricePerMinute === null ||
          pricing.pricePerMinute.lte(0)
        ) {
          throw new BadRequestException(
            'AI_ASTRO_PER_MINUTE_PRICE_NOT_CONFIGURED',
          );
        }

        /*
         * First minute capacity is reserved.
         * ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹15/min currently comes from DB.
         *
         * Actual settlement remains per second.
         */
        /*
         * Reserve the complete customer-selected duration.
         *
         * Example:
         * rate = 15/min
         * duration = 10 min
         * required balance = 150
         *
         * Price comes from DB. Never trust a client-supplied amount.
         */
        const initialReserve = pricing.pricePerMinute.mul(
          requestedDurationMinutes,
        );

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId: user.id,
          },
        });

        if (!wallet) {
          throw new BadRequestException('WALLET_NOT_FOUND');
        }

        const availableBalance = wallet.balance.minus(wallet.lockedBalance);

        if (availableBalance.lessThan(initialReserve)) {
          throw new BadRequestException('INSUFFICIENT_BALANCE_FOR_ONE_MINUTE');
        }

        const lockedBalanceAfter = wallet.lockedBalance.plus(initialReserve);

        await transaction.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            lockedBalance: lockedBalanceAfter,
          },
        });

        const session = await transaction.aiAstroSession.create({
          data: {
            clientSessionId,
            userId: user.id,
            astrologerId: astrologer.id,
            consultantTypeCode,
            pricingMode: 'PER_MINUTE',
            ratePerMinute: pricing.pricePerMinute,
            currency: pricing.currency,
            durationMinutes: requestedDurationMinutes,
            reservedAmount: initialReserve,
            chargedAmount: new Prisma.Decimal(0),
            billableSeconds: 0,
            status: 'PENDING',
          },
        });

        return {
          success: true,
          idempotent: false,

          billing: {
            mode: 'MINIMUM_ONE_MINUTE',
            ratePerMinute: Number(session.ratePerMinute),
            ratePerSecond: Number(session.ratePerMinute.div(60)),
            initialReservedAmount: Number(initialReserve),
            currency: session.currency,
          },

          wallet: {
            balance: Number(wallet.balance),
            lockedBalance: Number(lockedBalanceAfter),
            availableBalance: Number(wallet.balance.minus(lockedBalanceAfter)),
            currency: wallet.currency,
          },

          session: {
            id: session.id,
            clientSessionId: session.clientSessionId,
            astrologerId: session.astrologerId,
            consultantTypeCode: session.consultantTypeCode,
            ratePerMinute: Number(session.ratePerMinute),
            durationMinutes: session.durationMinutes,
            reservedAmount: Number(session.reservedAmount),
            status: session.status,
            startedAt: session.startedAt,
            lastHeartbeatAt: session.lastHeartbeatAt,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async activateSession(supabaseUserId: string, dto: AiAstroSessionActionDto) {
    const cleanSupabaseUserId = supabaseUserId.trim();
    const clientSessionId = dto.clientSessionId.trim();

    if (!cleanSupabaseUserId) {
      throw new BadRequestException('AUTHENTICATED_USER_ID_MISSING');
    }

    const user = await this.resolveAuthenticatedUser(cleanSupabaseUserId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('Customer account is inactive or blocked');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.aiAstroSession.findUnique({
          where: {
            clientSessionId,
          },
        });

        if (!session || session.userId !== user.id) {
          throw new NotFoundException('AI_ASTRO_SESSION_NOT_FOUND');
        }

        if (session.status === 'ACTIVE') {
          return {
            success: true,
            idempotent: true,
            active: true,
            session: {
              id: session.id,
              clientSessionId: session.clientSessionId,
              status: session.status,
              startedAt: session.startedAt,
              lastHeartbeatAt: session.lastHeartbeatAt,
              ratePerMinute: Number(session.ratePerMinute),
              reservedAmount: Number(session.reservedAmount),
              currency: session.currency,
            },
          };
        }

        if (session.status !== 'READY') {
          throw new ConflictException('AI_ASTRO_SESSION_RESPONSE_NOT_READY');
        }

        const now = new Date();

        const claim = await transaction.aiAstroSession.updateMany({
          where: {
            id: session.id,
            userId: user.id,
            status: 'READY',
          },
          data: {
            status: 'ACTIVE',
            startedAt: now,
            lastHeartbeatAt: now,
          },
        });

        if (claim.count !== 1) {
          throw new ConflictException('AI_ASTRO_SESSION_ACTIVATION_CONFLICT');
        }

        const activated = await transaction.aiAstroSession.findUnique({
          where: {
            id: session.id,
          },
        });

        if (!activated) {
          throw new NotFoundException('AI_ASTRO_SESSION_NOT_FOUND');
        }

        return {
          success: true,
          idempotent: false,
          active: true,
          session: {
            id: activated.id,
            clientSessionId: activated.clientSessionId,
            status: activated.status,
            startedAt: activated.startedAt,
            lastHeartbeatAt: activated.lastHeartbeatAt,
            ratePerMinute: Number(activated.ratePerMinute),
            reservedAmount: Number(activated.reservedAmount),
            currency: activated.currency,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
  async heartbeatSession(supabaseUserId: string, dto: AiAstroSessionActionDto) {
    const cleanSupabaseUserId = supabaseUserId.trim();

    const clientSessionId = dto.clientSessionId.trim();

    if (!cleanSupabaseUserId) {
      throw new BadRequestException('AUTHENTICATED_USER_ID_MISSING');
    }
    const user = await this.resolveAuthenticatedUser(cleanSupabaseUserId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('Customer account is inactive or blocked');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.aiAstroSession.findUnique({
          where: {
            clientSessionId,
          },
        });

        if (!session || session.userId !== user.id) {
          throw new NotFoundException('AI_ASTRO_SESSION_NOT_FOUND');
        }

        if (session.status !== 'ACTIVE') {
          return {
            success: true,
            active: false,
            canContinue: false,
            status: session.status,
            chargedAmount: Number(session.chargedAmount),
          };
        }

        const now = new Date();

        const elapsedSeconds = Math.max(
          0,
          Math.ceil((now.getTime() - session.startedAt.getTime()) / 1000),
        );

        /*
         * Keep a 15-second funded safety window.
         * Flutter will later heartbeat every ~10 sec.
         *
         * Example:
         * 0-45 sec => ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹15 reserved
         * after 45 sec => reserve next ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹15
         */
        const maxSessionSeconds = session.durationMinutes * 60;

        const finalReservedAmount = session.reservedAmount;

        const addedReserve = new Prisma.Decimal(0);

        const canContinue = elapsedSeconds < maxSessionSeconds;

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId: user.id,
          },
        });

        if (!wallet) {
          throw new BadRequestException('WALLET_NOT_FOUND');
        }

        const updatedSession = await transaction.aiAstroSession.update({
          where: {
            id: session.id,
          },
          data: {
            lastHeartbeatAt: now,
            reservedAmount: finalReservedAmount,
          },
        });

        const fundedSeconds = Math.min(
          maxSessionSeconds,
          Math.floor(
            finalReservedAmount.div(session.ratePerMinute).mul(60).toNumber(),
          ),
        );

        const secondsRemaining = Math.max(0, fundedSeconds - elapsedSeconds);

        return {
          success: true,
          active: true,
          canContinue,

          session: {
            id: updatedSession.id,
            clientSessionId: updatedSession.clientSessionId,
            status: updatedSession.status,
            elapsedSeconds,
            fundedSeconds,
            secondsRemaining,
            ratePerMinute: Number(updatedSession.ratePerMinute),
            reservedAmount: Number(updatedSession.reservedAmount),
            addedReserve: Number(addedReserve),
            lastHeartbeatAt: updatedSession.lastHeartbeatAt,
          },

          wallet: {
            balance: Number(wallet.balance),
            lockedBalance: Number(wallet.lockedBalance),
            availableBalance: Number(
              wallet.balance.minus(wallet.lockedBalance),
            ),
            currency: wallet.currency,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async endSession(supabaseUserId: string, dto: AiAstroSessionActionDto) {
    const cleanSupabaseUserId = supabaseUserId.trim();

    const clientSessionId = dto.clientSessionId.trim();

    if (!cleanSupabaseUserId) {
      throw new BadRequestException('AUTHENTICATED_USER_ID_MISSING');
    }
    const user = await this.resolveAuthenticatedUser(cleanSupabaseUserId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.aiAstroSession.findUnique({
          where: {
            clientSessionId,
          },
        });

        if (!session || session.userId !== user.id) {
          throw new NotFoundException('AI_ASTRO_SESSION_NOT_FOUND');
        }

        /*
         * Idempotent END.
         * Repeated end call must never charge twice.
         */
        if (session.status === 'PENDING' || session.status === 'READY') {
          const wallet = await transaction.wallet.findUnique({
            where: {
              userId: user.id,
            },
          });

          if (!wallet) {
            throw new BadRequestException('WALLET_NOT_FOUND');
          }

          if (wallet.lockedBalance.lessThan(session.reservedAmount)) {
            throw new ConflictException('AI_ASTRO_LOCKED_BALANCE_INCONSISTENT');
          }

          const now = new Date();
          const lockedBalanceAfter = wallet.lockedBalance.minus(
            session.reservedAmount,
          );

          const claim = await transaction.aiAstroSession.updateMany({
            where: {
              id: session.id,
              userId: user.id,
              status: {
                in: ['PENDING', 'READY'],
              },
            },
            data: {
              status: 'CANCELLED',
              endedAt: now,
              lastHeartbeatAt: now,
              billableSeconds: 0,
              chargedAmount: new Prisma.Decimal(0),
            },
          });

          if (claim.count !== 1) {
            throw new ConflictException('AI_ASTRO_SESSION_ALREADY_SETTLED');
          }

          await transaction.wallet.update({
            where: {
              id: wallet.id,
            },
            data: {
              lockedBalance: lockedBalanceAfter,
            },
          });

          return {
            success: true,
            idempotent: false,
            billing: {
              amountCharged: 0,
              amountReleased: Number(session.reservedAmount),
              currency: session.currency,
            },
            session: {
              id: session.id,
              clientSessionId: session.clientSessionId,
              status: 'CANCELLED',
              billableSeconds: 0,
              chargedAmount: 0,
              endedAt: now,
            },
          };
        }

        if (session.status !== 'ACTIVE') {
          return {
            success: true,
            idempotent: true,

            session: {
              id: session.id,
              status: session.status,
              billableSeconds: session.billableSeconds,
              chargedAmount: Number(session.chargedAmount),
              currency: session.currency,
              endedAt: session.endedAt,
            },
          };
        }

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId: user.id,
          },
        });

        if (!wallet) {
          throw new BadRequestException('WALLET_NOT_FOUND');
        }

        const now = new Date();

        const actualElapsedSeconds = Math.max(
          0,
          Math.ceil((now.getTime() - session.startedAt.getTime()) / 1000),
        );

        /*
         * User can only be billed for funded time.
         */
        const purchasedSeconds = session.durationMinutes * 60;

        const fundedSeconds = Math.min(
          purchasedSeconds,
          Math.floor(
            session.reservedAmount
              .div(session.ratePerMinute)
              .mul(60)
              .toNumber(),
          ),
        );

        const elapsedSeconds = session.startedAt
          ? Math.max(
              0,
              Math.ceil((now.getTime() - session.startedAt.getTime()) / 1000),
            )
          : 0;

        /*
         * Billing policy:
         * - minimum charge: 1 minute once ACTIVE
         * - after first minute: exact elapsed seconds
         * - never exceed purchased/funded duration
         */
        const billableSeconds = Math.min(
          fundedSeconds,
          Math.max(60, elapsedSeconds),
        );

        const calculatedCharge = session.ratePerMinute
          .div(60)
          .mul(billableSeconds);

        const finalCharge = Prisma.Decimal.min(
          calculatedCharge,
          session.reservedAmount,
        );

        if (wallet.lockedBalance.lessThan(session.reservedAmount)) {
          throw new ConflictException('AI_ASTRO_LOCKED_BALANCE_INCONSISTENT');
        }

        if (wallet.balance.lessThan(finalCharge)) {
          throw new ConflictException('AI_ASTRO_WALLET_BALANCE_INCONSISTENT');
        }

        const balanceBefore = wallet.balance;

        const balanceAfter = balanceBefore.minus(finalCharge);

        const lockedBalanceAfter = wallet.lockedBalance.minus(
          session.reservedAmount,
        );

        /*
         * Claim ACTIVE -> ENDED exactly once.
         */
        const claim = await transaction.aiAstroSession.updateMany({
          where: {
            id: session.id,
            userId: user.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'ENDED',
            endedAt: now,
            lastHeartbeatAt: now,
            billableSeconds,
            chargedAmount: finalCharge,
          },
        });

        if (claim.count !== 1) {
          throw new ConflictException('AI_ASTRO_SESSION_ALREADY_SETTLED');
        }

        await transaction.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            balance: balanceAfter,
            lockedBalance: lockedBalanceAfter,
          },
        });

        if (finalCharge.greaterThan(0)) {
          await transaction.walletLedger.create({
            data: {
              walletId: wallet.id,
              userId: user.id,
              type: LedgerType.AI_ASTRO_DEDUCTION,
              amount: finalCharge,
              balanceBefore,
              balanceAfter,
              referenceId: session.id,
              referenceType: LedgerReferenceType.AI_ASTRO_USAGE,
              description: `AI Astro timed session: ${billableSeconds}s at ${Number(
                session.ratePerMinute,
              ).toFixed(2)} ${session.currency}/min`,
            },
          });
        }

        return {
          success: true,
          idempotent: false,

          billing: {
            pricingMode: 'MINIMUM_ONE_MINUTE',
            ratePerMinute: Number(session.ratePerMinute),
            ratePerSecond: Number(session.ratePerMinute.div(60)),
            billableSeconds,
            amountCharged: Number(finalCharge),
            amountReleased: Number(session.reservedAmount.minus(finalCharge)),
            currency: session.currency,
          },

          wallet: {
            balanceBefore: Number(balanceBefore),
            balanceAfter: Number(balanceAfter),
            lockedBalanceAfter: Number(lockedBalanceAfter),
            currency: wallet.currency,
          },

          session: {
            id: session.id,
            clientSessionId: session.clientSessionId,
            status: 'ENDED',
            startedAt: session.startedAt,
            endedAt: now,
            billableSeconds,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
  async ask(
    supabaseUserId: string,
    dto: AskAiAstroDto,
    onChunk?: (chunk: string) => void | Promise<void>,
  ) {
    const timedSessionId = dto.clientSessionId?.trim() ?? '';
    const normalizedSupabaseId = supabaseUserId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated customer is required');
    }
    const user =
      await this.resolveAuthenticatedUserWithProfile(normalizedSupabaseId);

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('Customer account is inactive or blocked');
    }

    /*
     * Idempotency pre-check.
     */
    const alreadyProcessed = await this.prisma.aiAstroUsage.findUnique({
      where: {
        userId_clientRequestId: {
          userId: user.id,
          clientRequestId: dto.clientRequestId,
        },
      },
    });

    if (alreadyProcessed) {
      throw new ConflictException('AI_ASTRO_REQUEST_ALREADY_PROCESSED');
    }

    /*
     * REAL selected astrologer +
     * REAL admin-configured AI pricing.
     */
    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id: dto.personaId,
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
        aiAstroPricing: true,
      },
    });

    if (!astrologer) {
      throw new BadRequestException(
        'Selected astrologer profile is not available',
      );
    }

    const pricing = astrologer.aiAstroPricing;

    if (!pricing) {
      throw new BadRequestException('AI_ASTRO_PRICING_NOT_CONFIGURED');
    }

    if (!pricing.isEnabled) {
      throw new BadRequestException('AI_ASTRO_CURRENTLY_UNAVAILABLE');
    }

    if (
      !pricing.isFree &&
      pricing.pricingMode !== 'PER_MINUTE' &&
      pricing.pricePerQuestion === null
    ) {
      throw new BadRequestException('AI_ASTRO_PAID_PRICE_NOT_CONFIGURED');
    }

    const chargeAmount =
      pricing.isFree || pricing.pricingMode === 'PER_MINUTE'
        ? new Prisma.Decimal(0)
        : pricing.pricePerQuestion!;

    /*
     * Paid request:
     * check wallet BEFORE expensive OpenAI call.
     *
     * Actual deduction still happens only
     * AFTER successful AI generation.
     */
    if (!pricing.isFree) {
      const wallet = await this.prisma.wallet.findUnique({
        where: {
          userId: user.id,
        },
      });

      if (!wallet) {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }

      const availableBalance = wallet.balance.minus(wallet.lockedBalance);

      if (availableBalance.lessThan(chargeAmount)) {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }
    }

    /*
     * DB-backed consultant routing.
     *
     * Flutter now sends consultantTypeCode.
     * Legacy fallback remains temporarily until end-to-end API testing passes.
     */
    const consultantTypeCode =
      dto.consultantTypeCode?.trim() || 'VEDIC_ASTROLOGER';

    const consultantType = await this.prisma.aiConsultantType.findUnique({
      where: {
        code: consultantTypeCode,
      },
    });

    if (!consultantType || !consultantType.isEnabled) {
      throw new BadRequestException('AI_CONSULTANT_TYPE_UNAVAILABLE');
    }

    /*
     * Paid timed AI:
     * every new AI generation requires
     * the authenticated user's ACTIVE funded session.
     */
    if (!timedSessionId) {
      throw new BadRequestException('AI_ASTRO_SESSION_REQUIRED');
    }

    const activeTimedSession = await this.prisma.aiAstroSession.findUnique({
      where: {
        clientSessionId: timedSessionId,
      },
    });

    if (
      !activeTimedSession ||
      activeTimedSession.userId !== user.id ||
      activeTimedSession.astrologerId !== astrologer.id ||
      activeTimedSession.consultantTypeCode !== consultantTypeCode
    ) {
      throw new BadRequestException('AI_ASTRO_SESSION_MISMATCH');
    }

    if (
      activeTimedSession.status !== 'PENDING' &&
      activeTimedSession.status !== 'ACTIVE'
    ) {
      throw new BadRequestException('AI_ASTRO_SESSION_NOT_ACTIVE');
    }

    const sessionNow = new Date();

    const sessionElapsedSeconds =
      activeTimedSession.status === 'ACTIVE'
        ? Math.max(
            0,
            Math.ceil(
              (sessionNow.getTime() - activeTimedSession.startedAt.getTime()) /
                1000,
            ),
          )
        : 0;

    const sessionFundedSeconds = Math.min(
      activeTimedSession.durationMinutes * 60,
      Math.floor(
        activeTimedSession.reservedAmount
          .div(activeTimedSession.ratePerMinute)
          .mul(60)
          .toNumber(),
      ),
    );

    /*
     * Important:
     * heartbeat can only extend when wallet
     * has enough available balance.
     *
     * Ask cannot generate AI beyond funded time.
     */
    if (sessionElapsedSeconds >= sessionFundedSeconds) {
      throw new BadRequestException('AI_ASTRO_SESSION_FUNDS_EXHAUSTED');
    }
    const selectedAstrologerProfile = {
      id: astrologer.id,

      name: astrologer.user.name?.trim() ?? null,

      bio: astrologer.bio?.trim() ?? null,

      experience: astrologer.experience ?? 0,

      languages: astrologer.languages,

      expertise: astrologer.expertise.map((item) => item.expertise.name),

      /*
       * OpenAI must NOT impersonate
       * this real human astrologer.
       */
      profileContextOnly: true,
    };

    let astrologyContext: Record<string, unknown> | undefined;

    let consultantContext: Record<string, unknown> | undefined;

    let groundingSource: string | null = null;

    /*
     * VEDIC / KP:
     * Generate the customer's real Kundli only for astrology specialists.
     */
    if (
      consultantType.code === 'VEDIC_ASTROLOGER' ||
      consultantType.code === 'KP_ASTROLOGER'
    ) {
      const kundli = await this.kundliService.generateMyKundli(
        normalizedSupabaseId,
        'en',
      );

      groundingSource = kundli.source;

      const profileContext = {
        name: kundli.profile.name,
        gender: kundli.profile.gender,
        birthPlace: kundli.profile.birthPlace,
        dob: kundli.profile.dob,
        tob: kundli.profile.tob,
        latitude: kundli.profile.lat,
        longitude: kundli.profile.lon,
        timezone: kundli.profile.timezone,
      };

      if (consultantType.code === 'VEDIC_ASTROLOGER') {
        astrologyContext = {
          profile: profileContext,
          // LOCAL_VEDIC_AI_GROUNDING
          // Keep OpenAI grounding compact while preserving calculated facts.
          // The full Kundli remains unchanged in the application/database.
          kundli: {
            provider: kundli.report.provider,
            input: kundli.report.input,
            ascendant: kundli.report.ascendant,
            planetaryPositions: kundli.report.planetaryPositions,

            charts: {
              birthChart:
                kundli.report.birthChart ??
                kundli.report.charts?.birthChart,
              navamsaChart:
                kundli.report.navamsaChart ??
                kundli.report.charts?.navamsaChart,
            },

            dasha: kundli.report.dasha,
            yogas: kundli.report.yogas,
            dosha: kundli.report.dosha,

            extended: {
              sadeSati: kundli.report.extended?.sadeSati,
            },

            transit: kundli.report.transit,
          },

          source: kundli.source,

          requestedCategory: dto.category,

          selectedAstrologerProfile,
        };
      } else {
        /*
         * KP is already generated inside the same real Kundli report.
         * Do NOT make duplicate KP provider calls here.
         */
        const report = kundli.report as {
          kp?: {
            houses?: unknown;
            planets?: unknown;
          };
        };

        const kpHouses = report.kp?.houses;
        const kpPlanets = report.kp?.planets;

        if (kpHouses == null || kpPlanets == null) {
          throw new BadRequestException('KP_CONTEXT_UNAVAILABLE');
        }

        astrologyContext = {
          profile: profileContext,

          kp: {
            houses: kpHouses,
            planets: kpPlanets,
          },

          source: kundli.source,

          requestedCategory: dto.category,

          selectedAstrologerProfile,
        };
      }
    } else if (consultantType.code === 'NUMEROLOGIST') {
      /*
       * Numerology uses only the real saved name + DOB.
       * Full Kundli generation is intentionally skipped.
       */
      const profile = user.userProfile;

      const fullName = profile?.fullName?.trim();
      const birthDate = profile?.dateOfBirth;

      if (!fullName || !birthDate) {
        throw new BadRequestException({
          code: 'BIRTH_PROFILE_INCOMPLETE',
          message: 'Name and birth date are required for numerology',
        });
      }

      const dob = birthDate.toISOString().split('T')[0];

      const numerologyRaw = this.numerologyService.calculate(
        fullName,
        dob,
      );

      /*
       * Vedic numerology responses may wrap the real calculation
       * inside a top-level `response` field. The AI specialist must
       * receive the actual calculated payload rather than transport
       * metadata such as { status, response }.
       */
      const numerologyRecord =
        numerologyRaw &&
        typeof numerologyRaw === 'object' &&
        !Array.isArray(numerologyRaw)
          ? (numerologyRaw as unknown as Record<string, unknown>)
          : null;

      const numerology =
        numerologyRecord && 'response' in numerologyRecord
          ? numerologyRecord.response
          : numerologyRaw;

      const numerologyText =
        typeof numerology === 'string' ? numerology.trim() : '';

      const providerStatus =
        numerologyRecord && typeof numerologyRecord.status === 'number'
          ? numerologyRecord.status
          : null;

      const numerologyProviderError =
        (providerStatus !== null && providerStatus >= 400) ||
        /out of api calls|bad request|invalid api|unauthorized|forbidden|quota|limit exceeded/i.test(
          numerologyText,
        );

      const numerologyUnavailable =
        numerology == null ||
        (typeof numerology === 'string' && numerologyText.length === 0) ||
        (Array.isArray(numerology) && numerology.length === 0) ||
        (typeof numerology === 'object' &&
          !Array.isArray(numerology) &&
          Object.keys(numerology as Record<string, unknown>).length === 0);

      if (numerologyUnavailable || numerologyProviderError) {
        throw new BadRequestException({
          code: 'NUMEROLOGY_CONTEXT_UNAVAILABLE',
          message: 'Numerology calculation could not be generated',
        });
      }

      groundingSource = 'vedic-provider';

      consultantContext = {
        profile: {
          name: fullName,
          dob,
        },

        numerology,

        source: 'vedic-provider',

        requestedCategory: dto.category,

        selectedAstrologerProfile,
      };
    } else {
      /*
       * Vaastu / Tarot / Life Coach / General Psychologist /
       * Feng Shui / Ayurveda / Yoga:
       *
       * No Kundli or astrology calculation is forced into these specialists.
       */
      consultantContext = {
        requestedCategory: dto.category,

        selectedAstrologerProfile,
      };
    }
    /*
     * Reuse the latest ACTIVE AI Astro conversation
     * for this customer + selected astrologer.
     */
    let conversationRecord = await this.prisma.aiAstroConversation.findFirst({
      where: {
        userId: user.id,
        astrologerId: astrologer.id,
        consultantTypeCode: consultantType.code,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!conversationRecord) {
      conversationRecord = await this.prisma.aiAstroConversation.create({
        data: {
          userId: user.id,
          astrologerId: astrologer.id,
          consultantTypeCode: consultantType.code,
          startingCategory: dto.category,
          status: 'ACTIVE',
        },
      });
    }

    const previousMessages = await this.prisma.aiAstroMessage.findMany({
      where: {
        conversationId: conversationRecord.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 12,
    });

    const conversationHistory = previousMessages.reverse().map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

    /*
     * IMPORTANT:
     * If provider fails here,
     * NOTHING has been charged.
     */
    const providerInput = {
      category: dto.category,

      question: dto.question,

      personaId: dto.personaId,

      consultantType: {
        code: consultantType.code,
        name: consultantType.name,
        safetyProfile: consultantType.safetyProfile,
        requiresKundli: consultantType.requiresKundli,
      },

      astrologyContext,

      consultantContext,

      conversation: conversationHistory,
    };

    let responseReadyMarked = false;

    const markResponseReady = async () => {
      if (responseReadyMarked || activeTimedSession.status !== 'PENDING') {
        return;
      }

      const readyClaim = await this.prisma.aiAstroSession.updateMany({
        where: {
          id: activeTimedSession.id,
          userId: user.id,
          status: 'PENDING',
        },
        data: {
          status: 'READY',
          lastHeartbeatAt: new Date(),
        },
      });

      if (readyClaim.count !== 1) {
        const latestSession = await this.prisma.aiAstroSession.findUnique({
          where: {
            id: activeTimedSession.id,
          },
        });

        if (
          !latestSession ||
          (latestSession.status !== 'READY' &&
            latestSession.status !== 'ACTIVE')
        ) {
          throw new ConflictException(
            'AI_ASTRO_SESSION_READY_TRANSITION_FAILED',
          );
        }
      }

      responseReadyMarked = true;
    };

    const streamChunkHandler = onChunk
      ? async (chunk: string) => {
          if (chunk.trim().length > 0) {
            await markResponseReady();
          }

          await onChunk(chunk);
        }
      : undefined;

    let result;

    try {
      result = streamChunkHandler
        ? await this.provider.generateStream(providerInput, streamChunkHandler)
        : await this.provider.generate(providerInput);
    } catch (error) {
      /*
       * Provider/OpenAI failed before the customer received
       * a billable response.
       *
       * Release only a non-active reservation.
       * Never end/charge an already ACTIVE consultation here.
       */
      const latestTimedSession = await this.prisma.aiAstroSession.findUnique({
        where: {
          id: activeTimedSession.id,
        },
      });

      if (
        latestTimedSession &&
        (latestTimedSession.status === 'PENDING' ||
          latestTimedSession.status === 'READY')
      ) {
        try {
          await this.endSession(supabaseUserId, {
            clientSessionId: activeTimedSession.clientSessionId,
          });
        } catch (cleanupError) {
          console.error(
            'AI_ASTRO_PROVIDER_FAILURE_SESSION_CLEANUP_FAILED',
            cleanupError,
          );
        }
      }

      throw error;
    }

    if (!streamChunkHandler && result.answer.trim().length > 0) {
      await markResponseReady();
    }

    await this.prisma.$transaction([
      this.prisma.aiAstroMessage.create({
        data: {
          conversationId: conversationRecord.id,
          role: 'user',
          content: dto.question,
          category: dto.category,
        },
      }),
      this.prisma.aiAstroMessage.create({
        data: {
          conversationId: conversationRecord.id,
          role: 'assistant',
          content: result.answer,
          category: dto.category,
        },
      }),
      this.prisma.aiAstroConversation.update({
        where: {
          id: conversationRecord.id,
        },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);

    /*
     * Successful AI response only now enters
     * atomic accounting transaction.
     */
    const billing = await this.prisma.$transaction(
      async (transaction) => {
        /*
         * Re-check pricing inside transaction
         * so admin changes cannot be bypassed.
         */
        const currentPricing = await transaction.aiAstroPricing.findUnique({
          where: {
            astrologerId: astrologer.id,
          },
        });

        if (!currentPricing || !currentPricing.isEnabled) {
          throw new BadRequestException('AI_ASTRO_CURRENTLY_UNAVAILABLE');
        }

        const finalCharge =
          currentPricing.isFree || currentPricing.pricingMode === 'PER_MINUTE'
            ? new Prisma.Decimal(0)
            : currentPricing.pricePerQuestion;

        if (
          !currentPricing.isFree &&
          currentPricing.pricingMode !== 'PER_MINUTE' &&
          finalCharge === null
        ) {
          throw new BadRequestException('AI_ASTRO_PAID_PRICE_NOT_CONFIGURED');
        }

        /*
         * Create usage FIRST.
         * Unique [userId, clientRequestId]
         * protects concurrent double-submit.
         */
        const usage = await transaction.aiAstroUsage.create({
          data: {
            userId: user.id,

            astrologerId: astrologer.id,

            clientRequestId: dto.clientRequestId,

            category: dto.category,

            consultantTypeCode: consultantType.code,

            amountCharged: finalCharge ?? new Prisma.Decimal(0),

            currency: currentPricing.currency,

            isFree: currentPricing.isFree,

            provider: result.provider,

            model: result.model,
          },
        });

        /*
         * FREE = usage only.
         * No wallet mutation.
         */
        if (
          currentPricing.isFree ||
          currentPricing.pricingMode === 'PER_MINUTE'
        ) {
          return {
            usage,
            charged: false,
            amount: new Prisma.Decimal(0),
            balanceAfter: null,
          };
        }

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId: user.id,
          },
        });

        if (!wallet) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }

        const amount = finalCharge!;

        const availableBalance = wallet.balance.minus(wallet.lockedBalance);

        if (availableBalance.lessThan(amount)) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }

        const balanceBefore = wallet.balance;

        const balanceAfter = balanceBefore.minus(amount);

        await transaction.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            balance: balanceAfter,
          },
        });

        await transaction.walletLedger.create({
          data: {
            walletId: wallet.id,

            userId: user.id,

            type: LedgerType.AI_ASTRO_DEDUCTION,

            amount,

            balanceBefore,

            balanceAfter,

            referenceType: LedgerReferenceType.AI_ASTRO_USAGE,

            referenceId: usage.id,

            description: `AI Astro question - ${dto.category}`,
          },
        });

        return {
          usage,
          charged: true,
          amount,
          balanceAfter,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,

      conversationId: conversationRecord.id,

      category: dto.category,

      selectedAstrologer: {
        id: astrologer.id,

        name: astrologer.user.name?.trim() ?? null,
      },

      /*
       * OpenAI-generated answer.
       * NOT written by selected human astrologer.
       */
      answer: result.answer,

      provider: result.provider,

      model: result.model,

      billing: {
        usageId: billing.usage.id,

        isFree: billing.usage.isFree,

        charged: billing.charged,

        amountCharged: Number(billing.amount),

        currency: billing.usage.currency,

        balanceAfter:
          billing.balanceAfter === null ? null : Number(billing.balanceAfter),
      },

      grounding: {
        birthProfileUsed:
          consultantType.code === 'VEDIC_ASTROLOGER' ||
          consultantType.code === 'KP_ASTROLOGER' ||
          consultantType.code === 'NUMEROLOGIST',

        kundliUsed:
          consultantType.code === 'VEDIC_ASTROLOGER' ||
          consultantType.code === 'KP_ASTROLOGER',

        source: groundingSource,

        astrologerProfileSource: 'POSTGRESQL',
      },
    };
  }
  async getAdminPricing() {
    const astrologers = await this.prisma.astrologer.findMany({
      where: {
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        aiAstroPricing: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: astrologers.map((astrologer) => ({
        astrologerId: astrologer.id,
        userId: astrologer.user.id,
        name: astrologer.user.name?.trim() || 'Astrologer',
        avatarUrl:
          astrologer.aiAvatarUrl?.trim() ||
          astrologer.profileUrl?.trim() ||
          astrologer.user.avatarUrl?.trim() ||
          null,

        pricing: astrologer.aiAstroPricing
          ? {
              configured: true,
              isEnabled: astrologer.aiAstroPricing.isEnabled,
              isFree: astrologer.aiAstroPricing.isFree,
              pricingMode: astrologer.aiAstroPricing.pricingMode,
              pricePerMinute:
                astrologer.aiAstroPricing.pricePerMinute === null
                  ? null
                  : Number(astrologer.aiAstroPricing.pricePerMinute),
              pricePerQuestion:
                astrologer.aiAstroPricing.pricePerQuestion === null
                  ? null
                  : Number(astrologer.aiAstroPricing.pricePerQuestion),
              currency: astrologer.aiAstroPricing.currency,
            }
          : {
              configured: false,
              isEnabled: false,
              isFree: false,
              pricePerQuestion: null,
              currency: 'INR',
            },
      })),
    };
  }

  async updateAdminPricing(astrologerId: string, dto: UpdateAiAstroPricingDto) {
    const normalizedAstrologerId = astrologerId?.trim();

    if (!normalizedAstrologerId) {
      throw new BadRequestException('Astrologer ID is required');
    }

    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id: normalizedAstrologerId,
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!astrologer) {
      throw new BadRequestException(
        'Approved and verified astrologer not found',
      );
    }

    if (
      dto.isEnabled &&
      !dto.isFree &&
      (typeof dto.pricePerQuestion !== 'number' ||
        !Number.isFinite(dto.pricePerQuestion) ||
        dto.pricePerQuestion <= 0)
    ) {
      throw new BadRequestException(
        'Paid AI Astro pricing requires a positive pricePerQuestion',
      );
    }

    const currency = dto.currency?.trim().toUpperCase() || 'INR';

    if (currency !== 'INR') {
      throw new BadRequestException('Only INR is currently supported');
    }

    const price =
      dto.isEnabled && !dto.isFree
        ? new Prisma.Decimal(dto.pricePerQuestion!.toFixed(2))
        : null;

    const pricing = await this.prisma.aiAstroPricing.upsert({
      where: {
        astrologerId: normalizedAstrologerId,
      },
      create: {
        astrologerId: normalizedAstrologerId,
        isEnabled: dto.isEnabled,
        isFree: dto.isEnabled ? dto.isFree : false,
        pricePerQuestion: price,
        currency,
      },
      update: {
        isEnabled: dto.isEnabled,
        isFree: dto.isEnabled ? dto.isFree : false,
        pricePerQuestion: price,
        currency,
      },
    });

    return {
      success: true,
      message: 'AI Astro pricing updated successfully',

      data: {
        astrologerId: pricing.astrologerId,

        astrologerName: astrologer.user.name?.trim() || 'Astrologer',

        configured: true,

        isEnabled: pricing.isEnabled,

        isFree: pricing.isFree,

        pricePerQuestion:
          pricing.pricePerQuestion === null
            ? null
            : Number(pricing.pricePerQuestion),

        currency: pricing.currency,
      },
    };
  }
}







