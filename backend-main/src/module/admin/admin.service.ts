import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import {
  AdminAstrologerListParams,
  AdminCallListParams,
  AdminPaymentListParams,
  AdminRepository,
  AdminUserListParams,
} from './admin.repository';

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  async getStats() {
    const stats = await this.adminRepository.getDashboardStats();

    return {
      success: true,
      data: stats,
    };
  }

  /*
   * ============================================================
   * USER MANAGEMENT
   * ============================================================
   */

  async getUsers(params: AdminUserListParams = {}) {
    const result = await this.adminRepository.findUsers(params);

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getUserById(userId: string) {
    const user = await this.adminRepository.findUserById(userId);

    return {
      success: true,
      data: user,
    };
  }

  /*
   * ============================================================
   * ASTROLOGER MANAGEMENT
   * ============================================================
   */

  async getAstrologers(params: AdminAstrologerListParams = {}) {
    const result = await this.adminRepository.findAstrologers(params);

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getPendingAstrologers(limit = 10) {
    const astrologers =
      await this.adminRepository.getPendingAstrologers(limit);

    return {
      success: true,
      data: astrologers,
    };
  }

  async getAstrologerById(astrologerId: string) {
    const astrologer =
      await this.adminRepository.findAstrologerById(astrologerId);

    return {
      success: true,
      data: astrologer,
    };
  }

  async approveAstrologer(astrologerId: string) {
    const astrologer =
      await this.adminRepository.approveAstrologer(astrologerId);

    return {
      success: true,
      message: 'Astrologer approved successfully',
      data: astrologer,
    };
  }

  async rejectAstrologer(astrologerId: string) {
    const astrologer =
      await this.adminRepository.rejectAstrologer(astrologerId);

    return {
      success: true,
      message: 'Astrologer rejected successfully',
      data: astrologer,
    };
  }

  async verifyAstrologer(astrologerId: string) {
    const astrologer =
      await this.adminRepository.verifyAstrologer(astrologerId);

    return {
      success: true,
      message: 'Astrologer verified successfully',
      data: astrologer,
    };
  }

  async suspendAstrologer(astrologerId: string) {
    const astrologer =
      await this.adminRepository.suspendAstrologer(astrologerId);

    return {
      success: true,
      message: 'Astrologer suspended successfully',
      data: astrologer,
    };
  }

  /*
   * ============================================================
   * CONSULTATION / CALL MANAGEMENT
   * ============================================================
   */

  async getCallSessions(params: AdminCallListParams = {}) {
    const result =
      await this.adminRepository.findCallSessions(params);

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getCallSessionById(callSessionId: string) {
    const callSession =
      await this.adminRepository.findCallSessionById(callSessionId);

    return {
      success: true,
      data: callSession,
    };
  }

  /*
   * ============================================================
   * PAYMENT MANAGEMENT
   * ============================================================
   */

  async getPaymentOrders(params: AdminPaymentListParams = {}) {
    const result =
      await this.adminRepository.findPaymentOrders(params);

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getPaymentOrderById(paymentOrderId: string) {
    const paymentOrder =
      await this.adminRepository.findPaymentOrderById(paymentOrderId);

    return {
      success: true,
      data: paymentOrder,
    };
  }

  async getRefundedPayments(page = 1, limit = 20) {
    const result =
      await this.adminRepository.findRefundedPayments({
        page,
        limit,
      });

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getRevenueSummary(startDate?: string, endDate?: string) {
    const parsedStartDate = startDate
      ? this.parseDate(startDate, 'startDate')
      : undefined;

    const parsedEndDate = endDate
      ? this.parseDate(endDate, 'endDate')
      : undefined;

    const summary =
      await this.adminRepository.getRevenueSummary(
        parsedStartDate,
        parsedEndDate,
      );

    return {
      success: true,
      data: summary,
    };
  }

  async getSuccessfulPayments(page = 1, limit = 20) {
    return this.getPaymentOrders({
      page,
      limit,
      status: PaymentStatus.SUCCESS,
    });
  }

  async getFailedPayments(page = 1, limit = 20) {
    return this.getPaymentOrders({
      page,
      limit,
      status: PaymentStatus.FAILED,
    });
  }

  async getPendingPayments(page = 1, limit = 20) {
    return this.getPaymentOrders({
      page,
      limit,
      status: PaymentStatus.PENDING,
    });
  }

  /*
   * ============================================================
   * WALLET MANAGEMENT
   * ============================================================
   */

  async getWallets(page = 1, limit = 20) {
    const result = await this.adminRepository.findWallets({
      page,
      limit,
    });

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  async getWalletLedger(page = 1, limit = 20) {
    const result =
      await this.adminRepository.findWalletLedger({
        page,
        limit,
      });

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  private parseDate(value: string, fieldName: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error(
        `${fieldName} must be a valid ISO date string`,
      );
    }

    return date;
  }
}