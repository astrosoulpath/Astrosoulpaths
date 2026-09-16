import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { JWTPayload } from 'jose';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ProfileService } from './profile.service';
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /** POST /profile - create profile for authenticated user */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(@CurrentUser() user: JWTPayload, @Body() dto: CreateProfileDto) {
    return this.profileService.create(user.sub as string, dto);
  }

  /** GET /profile - list authenticated user's profiles */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  findAll(@CurrentUser() user: JWTPayload) {
    return this.profileService.findAll(user.sub as string);
  }

  /** GET /profile/preferences - fetch authenticated user's app preferences */
  @Get('preferences')
  @UseGuards(SupabaseAuthGuard)
  getPreferences(@CurrentUser() user: JWTPayload) {
    return this.profileService.getPreferences(user.sub as string);
  }

  /** PATCH /profile/preferences - update authenticated user's app preferences */
  @Patch('preferences')
  @UseGuards(SupabaseAuthGuard)
  updatePreferences(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.profileService.updatePreferences(user.sub as string, dto);
  }

  /** GET /profile/:id - fetch owned profile */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  findOne(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profileService.getOwnedProfileById(user.sub as string, id);
  }

  /** PATCH /profile/:id - update owned profile */
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  update(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.update(user.sub as string, id, dto);
  }

  /** GET /profile/:id/astro - generate astro data */
  @Get(':id/astro/pdf')
  @UseGuards(SupabaseAuthGuard)
  async generateAstroPdf(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lang') lang?: string,
  ) {
    const pdf = await this.profileService.generateAstroPdf(
      user.sub as string,
      id,
      lang,
    );

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="kundli-${id}.pdf"`,
      length: pdf.length,
    });
  }
  @Get(':id/astro')
  @UseGuards(SupabaseAuthGuard)
  generateAstro(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lang') lang?: string,
  ) {
    return this.profileService.generateAstro(user.sub as string, id, lang);
  }

  @Post('avatar')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: JWTPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.uploadAvatar(user.sub as string, file);
  }

  @Delete('avatar')
  @UseGuards(SupabaseAuthGuard)
  removeAvatar(@CurrentUser() user: JWTPayload) {
    return this.profileService.removeAvatar(user.sub as string);
  }
  /** DELETE /profile/:id - soft delete owned profile */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  delete(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profileService.delete(user.sub as string, id);
  }
}
