import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  /*
   * ============================================================
   * CONSULTATION / CALL MANAGEMENT
   * ============================================================
   */

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
}