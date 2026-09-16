const fs = require('fs');

const controllerPath =
  'src/module/ai-astro/ai-astro.controller.ts';

const servicePath =
  'src/module/ai-astro/ai-astro.service.ts';

let controller =
  fs.readFileSync(controllerPath, 'utf8');

let service =
  fs.readFileSync(servicePath, 'utf8');


/* ---------------------------------------------------------
   CONTROLLER IMPORT
--------------------------------------------------------- */

const controllerImport =
  "import { StartAiAstroSessionDto } from './dto/start-ai-astro-session.dto';";

if (!controller.includes(controllerImport)) {
  controller = controllerImport + '\n' + controller;
}


/* ---------------------------------------------------------
   CONTROLLER ENDPOINT
--------------------------------------------------------- */

if (!controller.includes("@Post('session/start')")) {

  const askAnchor = "@Post('ask')";

  if (!controller.includes(askAnchor)) {
    throw new Error(
      'CONTROLLER_ASK_ANCHOR_NOT_FOUND'
    );
  }

  const method = [
    "  @Post('session/start')",
    "  @UseGuards(SupabaseAuthGuard)",
    "  async startSession(",
    "    @CurrentUser() user: JWTPayload,",
    "    @Body() dto: StartAiAstroSessionDto,",
    "  ) {",
    "    return this.service.startSession(",
    "      String((user as any).sub),",
    "      dto,",
    "    );",
    "  }",
    "",
  ].join('\n');

  controller =
    controller.replace(
      askAnchor,
      method + '  ' + askAnchor
    );
}


/* ---------------------------------------------------------
   SERVICE DTO IMPORT
--------------------------------------------------------- */

const serviceImport =
  "import { StartAiAstroSessionDto } from './dto/start-ai-astro-session.dto';";

if (!service.includes(serviceImport)) {
  service = serviceImport + '\n' + service;
}


/* ---------------------------------------------------------
   SERVICE START SESSION METHOD
--------------------------------------------------------- */

if (!service.includes('async startSession(')) {

  const askRegex =
    /\n\s{2}async ask\s*\(/;

  const match = service.match(askRegex);

  if (!match || match.index === undefined) {
    throw new Error(
      'SERVICE_ASK_METHOD_ANCHOR_NOT_FOUND'
    );
  }

  const method = 

  async startSession(
    supabaseUserId: string,
    dto: StartAiAstroSessionDto,
  ) {
    const cleanSupabaseUserId =
      supabaseUserId?.trim();

    if (
      !cleanSupabaseUserId ||
      cleanSupabaseUserId === 'undefined'
    ) {
      throw new BadRequestException(
        'AUTHENTICATED_USER_ID_MISSING',
      );
    }

    const clientSessionId =
      dto.clientSessionId.trim();

    const consultantTypeCode =
      dto.consultantTypeCode.trim().toUpperCase();

    const personaId =
      dto.personaId.trim();

    /*
     * Resolve authenticated customer exactly from backend DB.
     */
    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId: cleanSupabaseUserId,
        },
        select: {
          id: true,
          isActive: true,
          isBlocked: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'Customer account not found',
      );
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException(
        'Customer account is inactive or blocked',
      );
    }

    /*
     * Idempotency first.
     * Repeating same clientSessionId must return same session.
     */
    const existing =
      await this.prisma.aiAstroSession.findUnique({
        where: {
          clientSessionId,
        },
      });

    if (existing) {
      if (
        existing.userId !== user.id ||
        existing.astrologerId !== personaId ||
        existing.consultantTypeCode !==
          consultantTypeCode
      ) {
        throw new BadRequestException(
          'AI_ASTRO_SESSION_ID_CONFLICT',
        );
      }

      return {
        success: true,
        idempotent: true,
        session: {
          id: existing.id,
          clientSessionId:
            existing.clientSessionId,
          astrologerId:
            existing.astrologerId,
          consultantTypeCode:
            existing.consultantTypeCode,
          pricingMode:
            existing.pricingMode,
          ratePerMinute:
            Number(existing.ratePerMinute),
          currency:
            existing.currency,
          status:
            existing.status,
          startedAt:
            existing.startedAt,
          lastHeartbeatAt:
            existing.lastHeartbeatAt,
        },
      };
    }

    /*
     * Only one active timed AI session per customer.
     */
    const activeSession =
      await this.prisma.aiAstroSession.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
        orderBy: {
          startedAt: 'desc',
        },
      });

    if (activeSession) {
      throw new BadRequestException(
        'AI_ASTRO_ACTIVE_SESSION_EXISTS',
      );
    }

    /*
     * Resolve selected AI astrologer/persona
     * and current DB-backed pricing.
     */
    const astrologer =
      await this.prisma.astrologer.findUnique({
        where: {
          id: personaId,
        },
        include: {
          aiAstroPricing: true,
        },
      });

    if (!astrologer) {
      throw new NotFoundException(
        'AI_ASTRO_PERSONA_NOT_FOUND',
      );
    }

    const pricing =
      astrologer.aiAstroPricing;

    if (!pricing || !pricing.isEnabled) {
      throw new BadRequestException(
        'AI_ASTRO_CURRENTLY_UNAVAILABLE',
      );
    }

    if (
      pricing.pricingMode !== 'PER_MINUTE'
    ) {
      throw new BadRequestException(
        'AI_ASTRO_PER_MINUTE_PRICING_REQUIRED',
      );
    }

    if (
      pricing.pricePerMinute === null ||
      pricing.pricePerMinute.lte(0)
    ) {
      throw new BadRequestException(
        'AI_ASTRO_PER_MINUTE_PRICE_NOT_CONFIGURED',
      );
    }

    /*
     * Wallet availability check.
     *
     * Reservation/deduction is deliberately NOT done here.
     * 100F owns atomic lockedBalance reservation + settlement.
     */
    const wallet =
      await this.prisma.wallet.findUnique({
        where: {
          userId: user.id,
        },
      });

    if (!wallet) {
      throw new BadRequestException(
        'WALLET_NOT_FOUND',
      );
    }

    const availableBalance =
      wallet.balance.minus(
        wallet.lockedBalance,
      );

    if (availableBalance.lte(0)) {
      throw new BadRequestException(
        'INSUFFICIENT_WALLET_BALANCE',
      );
    }

    /*
     * Server-authoritative session creation.
     * Prisma/default DB timestamps establish session time.
     */
    const session =
      await this.prisma.aiAstroSession.upsert({
        where: {
          clientSessionId,
        },
        update: {},
        create: {
          clientSessionId,
          userId: user.id,
          astrologerId: astrologer.id,
          consultantTypeCode,
          pricingMode:
            pricing.pricingMode,
          ratePerMinute:
            pricing.pricePerMinute,
          currency:
            pricing.currency,
          reservedAmount:
            new Prisma.Decimal(0),
          chargedAmount:
            new Prisma.Decimal(0),
          status: 'ACTIVE',
        },
      });

    if (
      session.userId !== user.id ||
      session.astrologerId !== personaId ||
      session.consultantTypeCode !==
        consultantTypeCode
    ) {
      throw new BadRequestException(
        'AI_ASTRO_SESSION_ID_CONFLICT',
      );
    }

    return {
      success: true,
      idempotent: false,
      session: {
        id: session.id,
        clientSessionId:
          session.clientSessionId,
        astrologerId:
          session.astrologerId,
        consultantTypeCode:
          session.consultantTypeCode,
        pricingMode:
          session.pricingMode,
        ratePerMinute:
          Number(session.ratePerMinute),
        currency:
          session.currency,
        status:
          session.status,
        startedAt:
          session.startedAt,
        lastHeartbeatAt:
          session.lastHeartbeatAt,
      },
      wallet: {
        availableBalance:
          Number(availableBalance),
        currency:
          wallet.currency,
      },
    };
  }
;

  service =
    service.slice(0, match.index) +
    method +
    service.slice(match.index);
}


fs.writeFileSync(
  controllerPath,
  controller,
  'utf8'
);

fs.writeFileSync(
  servicePath,
  service,
  'utf8'
);

console.log(
  'SOURCE_PATCH=PASS'
);