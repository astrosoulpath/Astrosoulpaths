import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { AiAstroService } from './ai-astro.service';
import { AskAiAstroDto } from './dto/ask-ai-astro.dto';
import { StartAiAstroSessionDto } from './dto/start-ai-astro-session.dto';
import { AiAstroSessionActionDto } from './dto/ai-astro-session-action.dto';
import { AiAstroOpeningMessageDto } from './dto/ai-astro-opening-message.dto';

@Controller('ai-astro')
export class AiAstroController {
  constructor(private readonly service: AiAstroService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Get('catalog')
  catalog() {
    return this.service.catalog();
  }

  @Post('opening-message')
  @UseGuards(SupabaseAuthGuard)
  async openingMessage(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AiAstroOpeningMessageDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.getOpeningMessage(supabaseUserId, dto);
  }
  @Post('session/start')
  @UseGuards(SupabaseAuthGuard)
  async startSession(
    @CurrentUser() user: JWTPayload,
    @Body() dto: StartAiAstroSessionDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.startSession(supabaseUserId, dto);
  }
  @Post('session/activate')
  @UseGuards(SupabaseAuthGuard)
  async activateSession(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AiAstroSessionActionDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.activateSession(supabaseUserId, dto);
  }
  @Post('session/heartbeat')
  @UseGuards(SupabaseAuthGuard)
  async heartbeatSession(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AiAstroSessionActionDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.heartbeatSession(supabaseUserId, dto);
  }

  @Post('session/end')
  @UseGuards(SupabaseAuthGuard)
  async endSession(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AiAstroSessionActionDto,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.endSession(supabaseUserId, dto);
  }
  @Post('ask/stream')
  @UseGuards(SupabaseAuthGuard)
  async askStream(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AskAiAstroDto,
    @Res() response: Response,
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    response.status(200);

    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');

    response.setHeader('Cache-Control', 'no-cache, no-transform');

    response.setHeader('Connection', 'keep-alive');

    response.setHeader('X-Accel-Buffering', 'no');

    response.flushHeaders();

    try {
      response.write(
        JSON.stringify({
          type: 'ready',
        }) + '\n',
      );

      const result = await this.service.ask(
        supabaseUserId,
        dto,
        async (chunk) => {
          if (response.writableEnded) {
            return;
          }

          response.write(
            JSON.stringify({
              type: 'delta',
              delta: chunk,
            }) + '\n',
          );
        },
      );

      if (!response.writableEnded) {
        response.write(
          JSON.stringify({
            type: 'done',
            result,
          }) + '\n',
        );

        response.end();
      }
    } catch (error) {
      console.error('[AI_ASTRO_STREAM_ERROR]', error);

      if (response.writableEnded) {
        return;
      }

      const message =
        error instanceof Error && error.message
          ? error.message
          : 'AI_ASTRO_STREAM_FAILED';

      response.write(
        JSON.stringify({
          type: 'error',
          message,
        }) + '\n',
      );

      response.end();
    }
  }
  @Post('ask')
  @UseGuards(SupabaseAuthGuard)
  async ask(@CurrentUser() user: JWTPayload, @Body() dto: AskAiAstroDto) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return this.service.ask(supabaseUserId, dto);
  }
}
