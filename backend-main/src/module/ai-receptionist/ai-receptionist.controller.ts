import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { AiReceptionistService } from './ai-receptionist.service';
import { CreateAiReceptionistSessionDto } from './dto/create-ai-receptionist-session.dto';
import { SendAiReceptionistMessageDto } from './dto/send-ai-receptionist-message.dto';

@Controller('ai-receptionist')
export class AiReceptionistController {
  constructor(private readonly aiReceptionistService: AiReceptionistService) {}

  @Get('status')
  getStatus() {
    return this.aiReceptionistService.getStatus();
  }

  @Get('provider-health')
  providerHealth() {
    return this.aiReceptionistService.providerHealth();
  }

  @Post('sessions')
  createSession(@Body() dto: CreateAiReceptionistSessionDto) {
    return this.aiReceptionistService.createSession(dto);
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.aiReceptionistService.getSession(sessionId);
  }

  @Get('sessions/:sessionId/transcript')
  getTranscript(@Param('sessionId') sessionId: string) {
    return this.aiReceptionistService.getTranscript(sessionId);
  }

  @Post('sessions/:sessionId/messages')
  sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendAiReceptionistMessageDto,
  ) {
    return this.aiReceptionistService.sendMessage(sessionId, dto);
  }

  @Post('sessions/:sessionId/end')
  @HttpCode(HttpStatus.OK)
  endSession(@Param('sessionId') sessionId: string) {
    return this.aiReceptionistService.endSession(sessionId);
  }
}
