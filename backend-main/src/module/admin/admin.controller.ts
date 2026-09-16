import {
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { Response } from 'express';

import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { NotificationsCampaignService } from '../notifications/notifications.campaign.service';

import { CreateQualificationQuestionDto } from './dto/create-qualification-question.dto';
import { UpdateQualificationQuestionDto } from './dto/update-qualification-question.dto';
import { UpdateQualificationSettingsDto } from './dto/update-qualification-settings.dto';
import { AdminService } from './admin.service';
import { AdminReportService } from './admin-report.service';
import type { GenerateAdminReportInput } from './admin-report.service';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminReportService: AdminReportService,
    private readonly notificationsCampaignService: NotificationsCampaignService,
  ) {}

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  /*
   * ============================================================
   * USER MANAGEMENT
   * ============================================================
   */

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('search')
    search?: string,
  ) {
    return this.adminService.getUsers({
      page,
      limit,
      search,
    });
  }

  @Get('customers')
  getCustomers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('search')
    search?: string,
  ) {
    return this.adminService.getCustomers({
      page,
      limit,
      search,
    });
  }
  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  /*
   * ============================================================
   * ASTROLOGER MANAGEMENT
   * ============================================================
   */

  @Get('astrologers')
  getAstrologers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('search')
    search?: string,
    @Query('approval')
    approval?: 'ALL' | 'PENDING' | 'APPROVED',
    @Query('onlineOnly')
    onlineOnly?: string,
  ) {
    return this.adminService.getAstrologers({
      page,
      limit,
      search,
      approval,
      onlineOnly: onlineOnly === 'true',
    });
  }

  @Get('astrologers/pending')
  getPendingAstrologers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getPendingAstrologers(limit);
  }

  @Get('astrologers/:id')
  getAstrologerById(@Param('id') id: string) {
    return this.adminService.getAstrologerById(id);
  }

  @Get('astrologers/:id/kyc')
  getAstrologerKyc(@Param('id') id: string) {
    return this.adminService.getAstrologerKyc(id);
  }

  @Patch('astrologers/:id/approve')
  approveAstrologer(@Param('id') id: string) {
    return this.adminService.approveAstrologer(id);
  }

  @Patch('astrologers/:id/reject')
  rejectAstrologer(@Param('id') id: string) {
    return this.adminService.rejectAstrologer(id);
  }

  @Patch('astrologers/:id/verify')
  verifyAstrologer(@Param('id') id: string) {
    return this.adminService.verifyAstrologer(id);
  }

  @Patch('astrologers/:id/suspend')
  suspendAstrologer(@Param('id') id: string) {
    return this.adminService.suspendAstrologer(id);
  }


  @Post('notifications/astrologer-online')
  sendAstrologerOnlineCampaign(
    @Body()
    body: {
      customerUserId: string;
      astrologerId: string;
    },
  ) {
    return this.adminService.sendAstrologerOnlineCampaign(
      body.customerUserId,
      body.astrologerId,
    );
  }

  /*
   * ============================================================
   * CONSULTATION / CALL MANAGEMENT
   * ============================================================
   */

  @Get('subscriptions')
  getSubscriptions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getSubscriptions({
      page,
      limit,
    });
  }

  @Get('consultations')
  getConsultations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getCallSessions({
      page,
      limit,
    });
  }
  @Get('calls')
  getCallSessions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getCallSessions({
      page,
      limit,
    });
  }

  @Get('calls/:id')
  getCallSessionById(@Param('id') id: string) {
    return this.adminService.getCallSessionById(id);
  }

  /*
   * ============================================================
   * PAYMENT MANAGEMENT
   * ============================================================
   */

  @Get('payments')
  getPaymentOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('status')
    status?: PaymentStatus,
  ) {
    return this.adminService.getPaymentOrders({
      page,
      limit,
      status,
    });
  }

  @Get('payments/successful')
  getSuccessfulPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getSuccessfulPayments(page, limit);
  }

  @Get('payments/pending')
  getPendingPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getPendingPayments(page, limit);
  }

  @Get('payments/failed')
  getFailedPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getFailedPayments(page, limit);
  }

  @Get('payments/refunded')
  getRefundedPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getRefundedPayments(page, limit);
  }

  @Get('payments/revenue-summary')
  getRevenueSummary(
    @Query('startDate')
    startDate?: string,
    @Query('endDate')
    endDate?: string,
  ) {
    return this.adminService.getRevenueSummary(startDate, endDate);
  }

  @Get('payments/:id')
  getPaymentOrderById(@Param('id') id: string) {
    return this.adminService.getPaymentOrderById(id);
  }

  /*
   * ============================================================
   * ASTROLOGER PAYOUT MANAGEMENT
   * ============================================================
   */

  // DISABLED_SELF_WITHDRAWAL_FLOW: @Patch('payouts/:id/processing')
  processPayout(
    @Param('id') id: string,
    @Body() body: { providerReference?: string },
  ) {
    return this.adminService.processPayout(id, body.providerReference);
  }

  // DISABLED_SELF_WITHDRAWAL_FLOW: @Patch('payouts/:id/completed')
  completePayout(
    @Param('id') id: string,
    @Body() body: { providerReference?: string },
  ) {
    return this.adminService.completePayout(id, body.providerReference);
  }

  // DISABLED_SELF_WITHDRAWAL_FLOW: @Patch('payouts/:id/failed')
  failPayout(
    @Param('id') id: string,
    @Body() body: { failureReason?: string },
  ) {
    return this.adminService.failPayout(id, body.failureReason);
  }

  // DISABLED_SELF_WITHDRAWAL_FLOW: @Patch('payouts/:id/cancelled')
  cancelPayout(
    @Param('id') id: string,
    @Body() body: { failureReason?: string },
  ) {
    return this.adminService.cancelPayout(id, body.failureReason);
  }
  /*
   * ============================================================
   * WALLET MANAGEMENT
   * ============================================================
   */

  @Get('wallets')
  getWallets(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getWallets(page, limit);
  }

  @Get('wallet-ledger')
  getWalletLedger(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.adminService.getWalletLedger(page, limit);
  }

  /*
   * ============================================================
   * PLATFORM SETTINGS
   * ============================================================
   */

  @Get('platform-settings')
  getPlatformSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Patch('platform-settings')
  updatePlatformSettings(
    @Body()
    body: {
      platformCommissionPercent?: number;
      androidStoreUrl?: string | null;
      iosStoreUrl?: string | null;
      websiteUrl?: string | null;
      shareMessage?: string;
      aboutTitle?: string | null;
      aboutDescription?: string | null;
    },
  ) {
    return this.adminService.updatePlatformSettings(body);
  }

  /*
   * ============================================================
   * PROFESSIONAL KUNDLI SETTINGS
   * Website admin only.
   * ============================================================
   */

  @Get('kundli-settings')
  getKundliSettings() {
    return this.adminService.getKundliSettings();
  }

  @Patch('kundli-settings')
  updateKundliSettings(
    @Body()
    body: {
      displayName?: string;
      description?: string | null;
      price?: number;
      durationDays?: number;
      isActive?: boolean;
      isFeatured?: boolean;

      features?: {
        printReports?: boolean;
        downloadPdfReports?: boolean;
        saveCustomerCharts?: boolean;
        detailedKundliReports?: boolean;
        unlimitedKundliGeneration?: boolean;
        worldwideAccess?: boolean;
        advancedDashaAnalysis?: boolean;
        includedCharts?: string[];
      };
    },
  ) {
    return this.adminService.updateKundliSettings(body);
  }

  /*
   * ============================================================
   * DAILY HOROSCOPE SETTINGS
   * Website admin only.
   * ============================================================
   */

  @Get('daily-horoscope-settings')
  getDailyHoroscopeSettings() {
    return this.adminService.getDailyHoroscopeSettings();
  }

  @Patch('daily-horoscope-settings')
  updateDailyHoroscopeSettings(
    @Body()
    body: {
      displayName?: string;
      description?: string | null;
      price?: number;
      durationDays?: number;
      isActive?: boolean;
      isFeatured?: boolean;

      features?: {
        personalizedDailyHoroscope?: boolean;
        dailyPushNotification?: boolean;
        worldwideAccess?: boolean;
      };
    },
  ) {
    return this.adminService.updateDailyHoroscopeSettings(body);
  }
  @Get('qualification/settings')
  getQualificationSettings() {
    return this.adminService.getQualificationSettings();
  }

  @Patch('qualification/settings')
  updateQualificationSettings(@Body() body: UpdateQualificationSettingsDto) {
    return this.adminService.updateQualificationSettings(body);
  }

  @Get('qualification/questions')
  getQualificationQuestions() {
    return this.adminService.getQualificationQuestions();
  }

  @Post('qualification/questions')
  createQualificationQuestion(@Body() body: CreateQualificationQuestionDto) {
    return this.adminService.createQualificationQuestion(body);
  }

  @Patch('qualification/questions/:id')
  updateQualificationQuestion(
    @Param('id') id: string,
    @Body() body: UpdateQualificationQuestionDto,
  ) {
    return this.adminService.updateQualificationQuestion(id, body);
  }

  @Delete('qualification/questions/:id')
  deleteQualificationQuestion(@Param('id') id: string) {
    return this.adminService.deleteQualificationQuestion(id);
  }

  /*
   * ============================================================
   * PROFESSIONAL CSV REPORT EXPORT
   * ============================================================
   */

  @Post('reports')
  async generateReport(
    @Body() body: GenerateAdminReportInput,
    @Res() response: Response,
  ) {
    const result =
      await this.adminReportService.generateReport(body);

    response.setHeader(
      'Content-Type',
      result.contentType,
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );

    response.setHeader(
      'X-Report-Records',
      String(result.totalRecords),
    );

    return response
      .status(200)
      .send(result.data);
  }
}




