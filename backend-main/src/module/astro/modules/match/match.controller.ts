// modules/match/match.controller.ts

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Logger,
} from '@nestjs/common';

import { MatchService } from './match.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { Public } from '../../../../common/decorators/public.decorator';

@Public()
@Controller('match')
export class MatchController {
  private readonly logger = new Logger(MatchController.name);

  constructor(private readonly matchService: MatchService) {}

  // 🔥 CREATE MATCH
  @Post()
  async create(@Body() dto: CreateMatchDto) {
    this.logger.log(
      `📥 Create match request: ${dto.profile1Id}, ${dto.profile2Id}`,
    );

    return this.matchService.createMatch(dto.profile1Id, dto.profile2Id);
  }

  // 🔥 GET SINGLE MATCH
  @Get(':id')
  async getMatch(@Param('id') id: string) {
    this.logger.log(`📤 Fetch match: ${id}`);
    return this.matchService.getMatchById(id);
  }

  // 🔥 GET ALL MATCHES (HISTORY)
  @Get()
  async getAll() {
    this.logger.log('📤 Fetch all matches');
    return this.matchService.getAllMatches();
  }

  // ⭐ SAVE MATCH (IMPORTANT UX)
  @Patch(':id/save')
  async save(@Param('id') id: string) {
    this.logger.log(`⭐ Save match: ${id}`);
    return this.matchService.saveMatch(id);
  }

  @Get('allsaved')
  async getSaved() {
    this.logger.log('📤 Fetch saved matches');
    return this.matchService.getSavedMatches();
  }
}
