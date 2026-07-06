import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /** POST /profile — create a new profile for the authenticated user */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(@CurrentUser() user: JWTPayload, @Body() dto: CreateProfileDto) {
    return this.profileService.create(user.sub as string, dto);
  }

  /** GET /profile — list all profiles belonging to the authenticated user */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  findAll(@CurrentUser() user: JWTPayload) {
    return this.profileService.findAll(user.sub as string);
  }

  /** GET /profile/:id — fetch a single profile by ID */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  findOne(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profileService.getOwnedProfileById(user.sub as string, id);
  }

  /** GET /profile/:id/astro — generate astro data for a profile */
  @Get(':id/astro')
  @UseGuards(SupabaseAuthGuard)
  generateAstro(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lang') lang?: string,
  ) {
    return this.profileService.generateAstro(user.sub as string, id, lang);
  }

  /** DELETE /profile/:id — soft-delete a profile */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  delete(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profileService.delete(user.sub as string, id);
  }
}
