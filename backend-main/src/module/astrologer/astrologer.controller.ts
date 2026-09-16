import {
  AstrologerWithdrawalDto,
  UpsertAstrologerBankAccountDto,
} from './dto/astrologer-bank-account.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import type { JWTPayload } from 'jose';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologerService } from './astrologer.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';
import { UpdateAstrologerProfileDto } from './dto/update-astrologer-profile.dto';
import { UpdateAstrologerAvailabilityDto } from './dto/update-astrologer-availability.dto';
import { SubmitQualificationDto } from './dto/submit-qualification.dto';

@Controller('astrologer')
export class AstrologerController {
  constructor(private readonly astrologerService: AstrologerService) {}

  @Get('public')
  getPublicAstrologers(
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Query('expertise') expertise?: string,
    @Query('category') category?: string,
    @Query('online') online?: string,
  ) {
    let onlineFilter: boolean | undefined;

    if (online === 'true') {
      onlineFilter = true;
    } else if (online === 'false') {
      onlineFilter = false;
    }

    return this.astrologerService.getPublicAstrologers({
      search,
      language,
      expertise,
      category,
      online: onlineFilter,
    });
  }

  @Get('public/:id')
  getPublicAstrologerById(@Param('id') id: string) {
    return this.astrologerService.getPublicAstrologerById(id);
  }

  @Post('register')
  @UseGuards(SupabaseAuthGuard)
  register(
    @CurrentUser() user: JWTPayload,
    @Body() dto: RegisterAstrologerDto,
  ) {
    return this.astrologerService.register(user.sub as string, dto);
  }

  @Post('kyc/upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  uploadKycDocument(
    @CurrentUser() user: JWTPayload,
    @UploadedFile()
    file: Express.Multer.File | undefined,
    @Body('documentType')
    documentType: string,
  ) {
    return this.astrologerService.uploadKycDocument(
      user.sub as string,
      file,
      documentType,
    );
  }

  @Get('onboarding-status')
  @UseGuards(SupabaseAuthGuard)
  getOnboardingStatus(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getOnboardingStatus(user.sub as string);
  }

  @Get('dashboard')
  @UseGuards(SupabaseAuthGuard)
  getDashboard(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getDashboard(user.sub as string);
  }

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  getProfile(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getProfile(user.sub as string);
  }

  @Patch('profile')
  @UseGuards(SupabaseAuthGuard)
  updateProfile(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdateAstrologerProfileDto,
  ) {
    return this.astrologerService.updateProfile(user.sub as string, dto);
  }

  @Get('earnings/bank-account')
  @UseGuards(SupabaseAuthGuard)
  getPayoutBankAccount(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getPayoutBankAccount(user.sub as string);
  }

  @Post('earnings/bank-account')
  @UseGuards(SupabaseAuthGuard)
  savePayoutBankAccount(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpsertAstrologerBankAccountDto,
  ) {
    return this.astrologerService.savePayoutBankAccount(
      user.sub as string,
      dto,
    );
  }

  @Get('earnings/payouts')
  @UseGuards(SupabaseAuthGuard)
  getPayoutHistory(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getPayoutHistory(user.sub as string);
  }
  @Get('earnings/summary')
  @UseGuards(SupabaseAuthGuard)
  getEarningsSummary(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getEarningsSummary(user.sub as string);
  }

  @Get('earnings/transactions')
  @UseGuards(SupabaseAuthGuard)
  getEarningsTransactions(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getEarningsTransactions(user.sub as string);
  }
  @Post('earnings/payout-request')
  @UseGuards(SupabaseAuthGuard)
  requestPayout(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AstrologerWithdrawalDto,
  ) {
    return this.astrologerService.requestPayout(
      user.sub as string,
      dto.mode ?? 'IMPS',
    );
  }
  @Get('availability')
  @UseGuards(SupabaseAuthGuard)
  getAvailability(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getAvailability(user.sub as string);
  }

  @Patch('availability')
  @UseGuards(SupabaseAuthGuard)
  updateAvailability(
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateAstrologerAvailabilityDto,
  ) {
    return this.astrologerService.updateAvailability(user.sub as string, body);
  }
  @Patch('status')
  @UseGuards(SupabaseAuthGuard)
  updateStatus(
    @CurrentUser() user: JWTPayload,
    @Body() body: { isOnline: boolean },
  ) {
    return this.astrologerService.updateStatus(
      user.sub as string,
      body.isOnline,
    );
  }

  @Get('qualification/status')
  @UseGuards(SupabaseAuthGuard)
  getQualificationStatus(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getQualificationStatus(user.sub as string);
  }

  @Get('qualification/questions')
  @UseGuards(SupabaseAuthGuard)
  getQualificationQuestions(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getQualificationQuestions(user.sub as string);
  }

  @Post('qualification/submit')
  @UseGuards(SupabaseAuthGuard)
  submitQualification(
    @CurrentUser() user: JWTPayload,
    @Body() body: SubmitQualificationDto,
  ) {
    return this.astrologerService.submitQualification(
      user.sub as string,
      body.answers,
    );
  }
}
