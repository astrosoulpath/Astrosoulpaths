import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AstrologerEarningStatus,
  AstrologerPayoutStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { NotificationsCampaignService } from '../notifications/notifications.campaign.service';

import {
  AdminAstrologerListParams,
  AdminCallListParams,
  AdminPaymentListParams,
  AdminRepository,
  AdminUserListParams,
} from './admin.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsPushService: NotificationsPushService,
    private readonly notificationsCampaignService: NotificationsCampaignService,
  ) {}
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

  async getCustomers(params: AdminUserListParams = {}) {
    const requestedPage = Math.max(params.page ?? 1, 1);
    const requestedLimit = Math.min(Math.max(params.limit ?? 20, 1), 100);

    const result = await this.adminRepository.findUsers({
      page: 1,
      limit: 100,
      search: params.search,
    });

    const customers = result.items.filter(
      (item) => item.role?.name?.toUpperCase() === 'CUSTOMER',
    );

    const start = (requestedPage - 1) * requestedLimit;
    const items = customers.slice(start, start + requestedLimit);

    return {
      success: true,
      data: items,
      pagination: {
        page: requestedPage,
        limit: requestedLimit,
        total: customers.length,
        totalPages: Math.ceil(customers.length / requestedLimit),
      },
    };
  }
  async getUserById(userId: string) {
    const user = await this.adminRepository.findUserById(userId);

    return {
      success: true,
      data: user,
    };
  }

  private async sendAstrologerStatusNotification(
    userId: string,
    astrologerId: string,
    input: {
      type: string;
      title: string;
      body: string;
    },
  ): Promise<void> {
    try {
      const notification = await this.notificationsService.createForUser({
        userId,
        title: input.title,
        body: input.body,
        type: input.type,
        data: {
          type: input.type,
          astrologerId,
        },
      });

      await this.notificationsPushService.sendToUser(userId, {
        title: input.title,
        body: input.body,
        data: {
          type: input.type,
          astrologerId,
          notificationId: notification.id,
        },
      });
    } catch {
      // An admin status change must remain successful even if
      // notification persistence or FCM delivery temporarily fails.
    }
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
    const astrologers = await this.adminRepository.getPendingAstrologers(limit);

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

  async getAstrologerKyc(astrologerId: string) {
    const response =
      await this.adminRepository.findAstrologerById(astrologerId);

    const documents = response.documents as
      | {
          identityProof?: {
            type?: string;
            name?: string;
            url?: string;
          };
          certificates?: Array<{
            type?: string;
            name?: string;
            url?: string;
          }>;
          experienceProofs?: Array<{
            type?: string;
            name?: string;
            url?: string;
          }>;
        }
      | null
      | undefined;

    const client = this.supabaseService.getStorageClient();

    const bucket = 'astrologer-kyc';

    async function signDocument(
      document:
        | {
            type?: string;
            name?: string;
            url?: string;
          }
        | null
        | undefined,
    ) {
      const storagePath = document?.url?.trim();

      if (!storagePath) {
        return null;
      }

      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 10);

      if (error) {
        return {
          type: document?.type ?? null,

          name: document?.name ?? null,

          path: storagePath,

          signedUrl: null,

          error: error.message,
        };
      }

      return {
        type: document?.type ?? null,

        name: document?.name ?? null,

        path: storagePath,

        signedUrl: data.signedUrl,
      };
    }

    const identityProof = await signDocument(documents?.identityProof);

    const certificates = await Promise.all(
      (documents?.certificates ?? []).map((document) => signDocument(document)),
    );

    const experienceProofs = await Promise.all(
      (documents?.experienceProofs ?? []).map((document) =>
        signDocument(document),
      ),
    );

    return {
      success: true,

      data: {
        astrologerId: response.id,

        identityProof,

        certificates: certificates.filter(Boolean),

        experienceProofs: experienceProofs.filter(Boolean),

        expiresInSeconds: 600,
      },
    };
  }


  async sendAstrologerOnlineCampaign(
    customerUserId: string,
    astrologerId: string,
  ) {
    const astrologer =
      await this.adminRepository.findAstrologerById(astrologerId);

    const astrologerName =
      astrologer.user.name?.trim() || 'Astrologer';

    const astrologerAvatarUrl =
      astrologer.user.avatarUrl?.trim() || undefined;

    return this.notificationsCampaignService.sendCampaignToUser(
      customerUserId,
      {
        type: 'astrologer_online',
        title: `${astrologerName} is online`,
        body: `${astrologerName} is available now. Chat with them for personalized guidance.`,
        astrologerId: astrologer.id,
        astrologerName,
        astrologerAvatarUrl,
      },
    );
  }

  async approveAstrologer(astrologerId: string) {
    const target = await this.adminRepository.findAstrologerById(astrologerId);

    const astrologer =
      await this.adminRepository.approveAstrologer(astrologerId);

    await this.sendAstrologerStatusNotification(target.user.id, astrologerId, {
      type: 'astrologer_approved',
      title: 'Application approved',
      body: 'Your astrologer application has been approved and verified. You can now access your astrologer dashboard.',
    });

    return {
      success: true,
      message: 'Astrologer approved successfully',
      data: astrologer,
    };
  }

  async rejectAstrologer(astrologerId: string) {
    const target = await this.adminRepository.findAstrologerById(astrologerId);

    const astrologer =
      await this.adminRepository.rejectAstrologer(astrologerId);

    await this.sendAstrologerStatusNotification(target.user.id, astrologerId, {
      type: 'astrologer_rejected',
      title: 'Application status updated',
      body: 'Your astrologer application was not approved. Please review your application status before trying again.',
    });

    return {
      success: true,
      message: 'Astrologer rejected successfully',
      data: astrologer,
    };
  }

  async verifyAstrologer(astrologerId: string) {
    const target = await this.adminRepository.findAstrologerById(astrologerId);

    const astrologer =
      await this.adminRepository.verifyAstrologer(astrologerId);

    await this.sendAstrologerStatusNotification(target.user.id, astrologerId, {
      type: 'astrologer_verified',
      title: 'Verification complete',
      body: 'Your astrologer account verification has been completed.',
    });

    return {
      success: true,
      message: 'Astrologer verified successfully',
      data: astrologer,
    };
  }

  async suspendAstrologer(astrologerId: string) {
    const target = await this.adminRepository.findAstrologerById(astrologerId);

    const astrologer =
      await this.adminRepository.suspendAstrologer(astrologerId);

    await this.sendAstrologerStatusNotification(target.user.id, astrologerId, {
      type: 'astrologer_suspended',
      title: 'Astrologer account suspended',
      body: 'Your astrologer access has been suspended. Please check your account status for further action.',
    });

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

  async getSubscriptions(
    params: {
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          subscriptionPlan: true,
        },
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async getCallSessions(params: AdminCallListParams = {}) {
    const result = await this.adminRepository.findCallSessions(params);

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
    const result = await this.adminRepository.findPaymentOrders(params);

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
    const result = await this.adminRepository.findRefundedPayments({
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

    const summary = await this.adminRepository.getRevenueSummary(
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
    const result = await this.adminRepository.findWalletLedger({
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
      throw new Error(`${fieldName} must be a valid ISO date string`);
    }

    return date;
  }

  async getPlatformSettings() {
    const settings = await this.adminRepository.getPlatformSettings();

    const platformCommissionPercent = Number(
      settings.platformCommissionPercent.toString(),
    );

    const appConfig = await this.prisma.appConfig.findFirst({
      where: {
        key: 'PUBLIC_APP_CONFIG',
        isActive: true,
      },
      select: {
        shareMessage: true,
        androidStoreUrl: true,
        iosStoreUrl: true,
        websiteUrl: true,
        aboutTitle: true,
        aboutDescription: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: {
        platformCommissionPercent,
        astrologerSharePercent: Number(
          (100 - platformCommissionPercent).toFixed(2),
        ),
        androidStoreUrl: appConfig?.androidStoreUrl ?? null,
        iosStoreUrl: appConfig?.iosStoreUrl ?? null,
        websiteUrl: appConfig?.websiteUrl ?? null,
        shareMessage: appConfig?.shareMessage ?? '',
        aboutTitle: appConfig?.aboutTitle ?? null,
        aboutDescription: appConfig?.aboutDescription ?? null,
        updatedAt: settings.updatedAt,
        appConfigUpdatedAt: appConfig?.updatedAt ?? null,
      },
    };
  }

  async updatePlatformSettings(input: {
    platformCommissionPercent?: number;
    androidStoreUrl?: string | null;
    iosStoreUrl?: string | null;
    websiteUrl?: string | null;
    shareMessage?: string;
    aboutTitle?: string | null;
    aboutDescription?: string | null;
  }) {
    let settings = await this.adminRepository.getPlatformSettings();

    if (input.platformCommissionPercent !== undefined) {
      if (
        !Number.isFinite(input.platformCommissionPercent) ||
        input.platformCommissionPercent < 0 ||
        input.platformCommissionPercent > 100
      ) {
        throw new Error('platformCommissionPercent must be between 0 and 100');
      }

      settings = await this.adminRepository.updatePlatformSettings(
        input.platformCommissionPercent,
      );
    }

    const normalizeOptionalUrl = (
      value: string | null | undefined,
    ): string | null | undefined => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value.trim() === '') {
        return null;
      }

      const trimmed = value.trim();

      let parsed: URL;

      try {
        parsed = new URL(trimmed);
      } catch {
        throw new Error('Store and website URLs must be valid URLs');
      }

      if (parsed.protocol !== 'https:') {
        throw new Error('Store and website URLs must use HTTPS');
      }

      return trimmed;
    };

    const androidStoreUrl = normalizeOptionalUrl(input.androidStoreUrl);
    const iosStoreUrl = normalizeOptionalUrl(input.iosStoreUrl);
    const websiteUrl = normalizeOptionalUrl(input.websiteUrl);

    const existingConfig = await this.prisma.appConfig.findUnique({
      where: {
        key: 'PUBLIC_APP_CONFIG',
      },
    });

    if (!existingConfig) {
      throw new Error(
        'PUBLIC_APP_CONFIG must exist before platform settings can be updated',
      );
    }

    const shareMessage =
      input.shareMessage === undefined ? undefined : input.shareMessage.trim();

    if (shareMessage !== undefined && shareMessage.length === 0) {
      throw new Error('shareMessage cannot be empty');
    }

    const aboutTitle =
      input.aboutTitle === undefined
        ? undefined
        : input.aboutTitle === null
          ? null
          : input.aboutTitle.trim();

    const aboutDescription =
      input.aboutDescription === undefined
        ? undefined
        : input.aboutDescription === null
          ? null
          : input.aboutDescription.trim();

    if (
      aboutTitle !== undefined &&
      aboutTitle !== null &&
      aboutTitle.length === 0
    ) {
      throw new Error('aboutTitle cannot be empty');
    }

    if (
      aboutDescription !== undefined &&
      aboutDescription !== null &&
      aboutDescription.length === 0
    ) {
      throw new Error('aboutDescription cannot be empty');
    }
    const appConfig = await this.prisma.appConfig.update({
      where: {
        key: 'PUBLIC_APP_CONFIG',
      },
      data: {
        ...(androidStoreUrl !== undefined ? { androidStoreUrl } : {}),
        ...(iosStoreUrl !== undefined ? { iosStoreUrl } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        ...(shareMessage !== undefined ? { shareMessage } : {}),
        ...(aboutTitle !== undefined ? { aboutTitle } : {}),
        ...(aboutDescription !== undefined ? { aboutDescription } : {}),
        isActive: true,
      },
      select: {
        shareMessage: true,
        androidStoreUrl: true,
        iosStoreUrl: true,
        websiteUrl: true,
        aboutTitle: true,
        aboutDescription: true,
        updatedAt: true,
      },
    });

    const storedCommission = Number(
      settings.platformCommissionPercent.toString(),
    );

    return {
      success: true,
      message: 'Platform settings updated successfully',
      data: {
        platformCommissionPercent: storedCommission,
        astrologerSharePercent: Number((100 - storedCommission).toFixed(2)),
        androidStoreUrl: appConfig.androidStoreUrl,
        iosStoreUrl: appConfig.iosStoreUrl,
        websiteUrl: appConfig.websiteUrl,
        shareMessage: appConfig.shareMessage,
        aboutTitle: appConfig.aboutTitle,
        aboutDescription: appConfig.aboutDescription,
        updatedAt: settings.updatedAt,
        appConfigUpdatedAt: appConfig.updatedAt,
      },
    };
  }

  async getKundliSettings() {
    const planName = 'ASTROLOGER_KUNDLI_YEARLY';

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: planName,
      },
    });

    if (!plan) {
      throw new NotFoundException(
        'Professional Kundli yearly subscription plan was not found',
      );
    }

    const features =
      plan.features &&
      typeof plan.features === 'object' &&
      !Array.isArray(plan.features)
        ? (plan.features as Record<string, unknown>)
        : {};

    return {
      success: true,
      data: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        durationDays: plan.durationDays,
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        razorpayPlanConfigured: Boolean(plan.razorpayPlanId),

        features: {
          portal: 'astrologer',

          includedCharts: Array.isArray(features.includedCharts)
            ? features.includedCharts
            : ['D1', 'D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D60'],

          printReports: features.printReports !== false,

          downloadPdfReports: features.downloadPdfReports !== false,

          saveCustomerCharts: features.saveCustomerCharts !== false,

          detailedKundliReports: features.detailedKundliReports !== false,

          unlimitedKundliGeneration:
            features.unlimitedKundliGeneration !== false,

          worldwideAccess: features.worldwideAccess !== false,

          advancedDashaAnalysis: features.advancedDashaAnalysis !== false,
        },

        updatedAt: plan.updatedAt,
      },
    };
  }

  async updateKundliSettings(body: {
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
  }) {
    const planName = 'ASTROLOGER_KUNDLI_YEARLY';

    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: planName,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Professional Kundli yearly subscription plan was not found',
      );
    }

    if (
      body.price !== undefined &&
      (!Number.isInteger(body.price) || body.price < 0 || body.price > 1000000)
    ) {
      throw new BadRequestException(
        'price must be an integer between 0 and 1000000',
      );
    }

    if (
      body.durationDays !== undefined &&
      (!Number.isInteger(body.durationDays) ||
        body.durationDays < 1 ||
        body.durationDays > 3650)
    ) {
      throw new BadRequestException('durationDays must be between 1 and 3650');
    }

    const displayName = body.displayName?.trim();

    if (body.displayName !== undefined && !displayName) {
      throw new BadRequestException('displayName cannot be empty');
    }

    const allowedCharts = new Set([
      'D1',
      'D2',
      'D3',
      'D7',
      'D9',
      'D10',
      'D12',
      'D60',
    ]);

    if (body.features?.includedCharts !== undefined) {
      const charts = body.features.includedCharts;

      if (
        !Array.isArray(charts) ||
        charts.length === 0 ||
        charts.some(
          (chart) => typeof chart !== 'string' || !allowedCharts.has(chart),
        )
      ) {
        throw new BadRequestException(
          'includedCharts contains an unsupported Vedic chart',
        );
      }
    }

    const oldFeatures =
      existing.features &&
      typeof existing.features === 'object' &&
      !Array.isArray(existing.features)
        ? (existing.features as Record<string, unknown>)
        : {};

    const currentIncludedCharts = Array.isArray(oldFeatures.includedCharts)
      ? oldFeatures.includedCharts.filter(
          (value): value is string =>
            typeof value === 'string' && allowedCharts.has(value),
        )
      : ['D1', 'D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D60'];

    const mergedFeatures: Record<string, unknown> = {
      ...oldFeatures,

      portal: 'astrologer',

      includedCharts: body.features?.includedCharts ?? currentIncludedCharts,

      printReports:
        body.features?.printReports ?? oldFeatures.printReports !== false,

      downloadPdfReports:
        body.features?.downloadPdfReports ??
        oldFeatures.downloadPdfReports !== false,

      saveCustomerCharts:
        body.features?.saveCustomerCharts ??
        oldFeatures.saveCustomerCharts !== false,

      detailedKundliReports:
        body.features?.detailedKundliReports ??
        oldFeatures.detailedKundliReports !== false,

      unlimitedKundliGeneration:
        body.features?.unlimitedKundliGeneration ??
        oldFeatures.unlimitedKundliGeneration !== false,

      worldwideAccess:
        body.features?.worldwideAccess ?? oldFeatures.worldwideAccess !== false,

      advancedDashaAnalysis:
        body.features?.advancedDashaAnalysis ??
        oldFeatures.advancedDashaAnalysis !== false,
    };

    const updated = await this.prisma.subscriptionPlan.update({
      where: {
        id: existing.id,
      },

      data: {
        ...(displayName !== undefined
          ? {
              displayName,
            }
          : {}),

        ...(body.description !== undefined
          ? {
              description: body.description?.trim() || null,
            }
          : {}),

        ...(body.price !== undefined
          ? {
              price: body.price,
            }
          : {}),

        ...(body.durationDays !== undefined
          ? {
              durationDays: body.durationDays,
            }
          : {}),

        ...(body.isActive !== undefined
          ? {
              isActive: body.isActive,
            }
          : {}),

        ...(body.isFeatured !== undefined
          ? {
              isFeatured: body.isFeatured,
            }
          : {}),

        features: mergedFeatures as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Professional Kundli settings updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        price: updated.price,
        currency: updated.currency,
        durationDays: updated.durationDays,
        features: updated.features,
        isActive: updated.isActive,
        isFeatured: updated.isFeatured,
        razorpayPlanConfigured: Boolean(updated.razorpayPlanId),
        updatedAt: updated.updatedAt,
      },
    };
  }

  async getDailyHoroscopeSettings() {
    const planName = 'DAILY_HOROSCOPE_MONTHLY';

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: planName,
      },
    });

    if (!plan) {
      throw new NotFoundException(
        'Personalized Daily Horoscope monthly subscription plan was not found',
      );
    }

    const features =
      plan.features &&
      typeof plan.features === 'object' &&
      !Array.isArray(plan.features)
        ? (plan.features as Record<string, unknown>)
        : {};

    return {
      success: true,
      data: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        durationDays: plan.durationDays,
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        razorpayPlanConfigured: Boolean(plan.razorpayPlanId),

        features: {
          portal: 'customer',

          personalizedDailyHoroscope:
            features.personalizedDailyHoroscope !== false,

          dailyPushNotification: features.dailyPushNotification !== false,

          worldwideAccess: features.worldwideAccess !== false,
        },

        updatedAt: plan.updatedAt,
      },
    };
  }

  async updateDailyHoroscopeSettings(body: {
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
  }) {
    const planName = 'DAILY_HOROSCOPE_MONTHLY';

    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: planName,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Personalized Daily Horoscope monthly subscription plan was not found',
      );
    }

    if (
      body.price !== undefined &&
      (!Number.isFinite(body.price) || body.price < 0 || body.price > 1000000)
    ) {
      throw new BadRequestException(
        'price must be a number between 0 and 1000000',
      );
    }

    if (
      body.durationDays !== undefined &&
      (!Number.isInteger(body.durationDays) ||
        body.durationDays < 1 ||
        body.durationDays > 3650)
    ) {
      throw new BadRequestException('durationDays must be between 1 and 3650');
    }

    const displayName = body.displayName?.trim();

    if (body.displayName !== undefined && !displayName) {
      throw new BadRequestException('displayName cannot be empty');
    }

    const oldFeatures =
      existing.features &&
      typeof existing.features === 'object' &&
      !Array.isArray(existing.features)
        ? (existing.features as Record<string, unknown>)
        : {};

    const mergedFeatures: Record<string, unknown> = {
      ...oldFeatures,

      portal: 'customer',

      personalizedDailyHoroscope:
        body.features?.personalizedDailyHoroscope ??
        oldFeatures.personalizedDailyHoroscope !== false,

      dailyPushNotification:
        body.features?.dailyPushNotification ??
        oldFeatures.dailyPushNotification !== false,

      worldwideAccess:
        body.features?.worldwideAccess ?? oldFeatures.worldwideAccess !== false,
    };

    const updated = await this.prisma.subscriptionPlan.update({
      where: {
        id: existing.id,
      },

      data: {
        ...(displayName !== undefined
          ? {
              displayName,
            }
          : {}),

        ...(body.description !== undefined
          ? {
              description: body.description?.trim() || null,
            }
          : {}),

        ...(body.price !== undefined
          ? {
              price: body.price,
            }
          : {}),

        ...(body.durationDays !== undefined
          ? {
              durationDays: body.durationDays,
            }
          : {}),

        ...(body.isActive !== undefined
          ? {
              isActive: body.isActive,
            }
          : {}),

        ...(body.isFeatured !== undefined
          ? {
              isFeatured: body.isFeatured,
            }
          : {}),

        features: mergedFeatures as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Daily Horoscope settings updated successfully',

      data: {
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        price: updated.price,
        currency: updated.currency,
        durationDays: updated.durationDays,
        features: updated.features,
        isActive: updated.isActive,
        isFeatured: updated.isFeatured,
        razorpayPlanConfigured: Boolean(updated.razorpayPlanId),
        updatedAt: updated.updatedAt,
      },
    };
  }
  async processPayout(payoutId: string, providerReference?: string) {
    const id = payoutId?.trim();

    if (!id) {
      throw new BadRequestException('Payout ID is required');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const payout = await tx.astrologerPayout.findUnique({
          where: { id },
        });

        if (!payout) {
          throw new NotFoundException('Payout not found');
        }

        if (payout.status !== AstrologerPayoutStatus.REQUESTED) {
          throw new ConflictException(
            'Only a requested payout can move to processing',
          );
        }

        const updated = await tx.astrologerPayout.update({
          where: { id },
          data: {
            status: AstrologerPayoutStatus.PROCESSING,
            processedAt: new Date(),
            providerReference:
              providerReference?.trim() || payout.providerReference,
            failureReason: null,
          },
        });

        return {
          success: true,
          data: updated,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async completePayout(payoutId: string, providerReference?: string) {
    const id = payoutId?.trim();

    if (!id) {
      throw new BadRequestException('Payout ID is required');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const payout = await tx.astrologerPayout.findUnique({
          where: { id },
          include: {
            earnings: true,
          },
        });

        if (!payout) {
          throw new NotFoundException('Payout not found');
        }

        if (payout.status !== AstrologerPayoutStatus.PROCESSING) {
          throw new ConflictException(
            'Only a processing payout can be completed',
          );
        }

        if (payout.earnings.length === 0) {
          throw new ConflictException('Payout has no reserved earnings');
        }

        const paidAt = new Date();

        const earningIds = payout.earnings.map((earning) => earning.id);

        const paid = await tx.astrologerEarning.updateMany({
          where: {
            id: {
              in: earningIds,
            },
            payoutId: payout.id,
            status: AstrologerEarningStatus.AVAILABLE,
          },
          data: {
            status: AstrologerEarningStatus.PAID,
            paidAt,
          },
        });

        if (paid.count !== earningIds.length) {
          throw new ConflictException(
            'Some reserved earnings are not eligible for completion',
          );
        }

        const updated = await tx.astrologerPayout.update({
          where: { id },
          data: {
            status: AstrologerPayoutStatus.COMPLETED,
            completedAt: paidAt,
            processedAt: payout.processedAt ?? paidAt,
            providerReference:
              providerReference?.trim() || payout.providerReference,
            failureReason: null,
          },
          include: {
            earnings: {
              select: {
                id: true,
                status: true,
                payoutId: true,
                paidAt: true,
                netAmount: true,
              },
            },
          },
        });

        return {
          success: true,
          data: updated,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async failPayout(payoutId: string, failureReason?: string) {
    const id = payoutId?.trim();

    if (!id) {
      throw new BadRequestException('Payout ID is required');
    }

    return this.releaseFailedOrCancelledPayout(
      id,
      AstrologerPayoutStatus.FAILED,
      failureReason,
    );
  }

  async cancelPayout(payoutId: string, failureReason?: string) {
    const id = payoutId?.trim();

    if (!id) {
      throw new BadRequestException('Payout ID is required');
    }

    return this.releaseFailedOrCancelledPayout(
      id,
      AstrologerPayoutStatus.CANCELLED,
      failureReason,
    );
  }

  private async releaseFailedOrCancelledPayout(
    payoutId: string,
    targetStatus: AstrologerPayoutStatus,
    failureReason?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const payout = await tx.astrologerPayout.findUnique({
          where: {
            id: payoutId,
          },
          include: {
            earnings: true,
          },
        });

        if (!payout) {
          throw new NotFoundException('Payout not found');
        }

        const allowed =
          payout.status === AstrologerPayoutStatus.REQUESTED ||
          payout.status === AstrologerPayoutStatus.PROCESSING;

        if (!allowed) {
          throw new ConflictException(
            'Only requested or processing payouts can be released',
          );
        }

        if (
          targetStatus === AstrologerPayoutStatus.CANCELLED &&
          payout.status !== AstrologerPayoutStatus.REQUESTED
        ) {
          throw new ConflictException(
            'Only a requested payout can be cancelled',
          );
        }

        await tx.astrologerEarning.updateMany({
          where: {
            payoutId: payout.id,
            status: AstrologerEarningStatus.AVAILABLE,
          },
          data: {
            payoutId: null,
          },
        });

        const updated = await tx.astrologerPayout.update({
          where: {
            id: payout.id,
          },
          data: {
            status: targetStatus,
            failureReason:
              failureReason?.trim() ||
              (targetStatus === AstrologerPayoutStatus.FAILED
                ? 'Payout failed'
                : 'Payout cancelled'),
          },
        });

        return {
          success: true,
          data: updated,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async getQualificationSettings() {
    const settings = await this.prisma.astrologerQualificationSettings.upsert({
      where: {
        id: 'default',
      },
      update: {},
      create: {
        id: 'default',
      },
    });

    return {
      success: true,
      data: settings,
    };
  }

  async updateQualificationSettings(data: {
    isEnabled?: boolean;
    questionCount?: number;
    passingPercentage?: number;
    allowRetake?: boolean;
    maxAttempts?: number;
    retakeCooldownMins?: number;
    randomizeQuestions?: boolean;
    randomizeOptions?: boolean;
    showScore?: boolean;
    showCorrectAnswers?: boolean;
  }) {
    const settings = await this.prisma.astrologerQualificationSettings.upsert({
      where: {
        id: 'default',
      },
      update: data,
      create: {
        id: 'default',
        ...data,
      },
    });

    return {
      success: true,
      message: 'Qualification settings updated successfully',
      data: settings,
    };
  }

  async getQualificationQuestions() {
    const questions =
      await this.prisma.astrologerQualificationQuestion.findMany({
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
      });

    return {
      success: true,
      data: questions,
    };
  }

  async createQualificationQuestion(data: {
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    category?: string;
    explanation?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const question = await this.prisma.astrologerQualificationQuestion.create({
      data: {
        question: data.question.trim(),
        optionA: data.optionA.trim(),
        optionB: data.optionB.trim(),
        optionC: data.optionC.trim(),
        optionD: data.optionD.trim(),
        correctOption: data.correctOption.toUpperCase(),
        category: data.category?.trim() || null,
        explanation: data.explanation?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Qualification question created successfully',
      data: question,
    };
  }

  async updateQualificationQuestion(
    id: string,
    data: {
      question?: string;
      optionA?: string;
      optionB?: string;
      optionC?: string;
      optionD?: string;
      correctOption?: string;
      category?: string;
      explanation?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const existing =
      await this.prisma.astrologerQualificationQuestion.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException('Qualification question not found');
    }

    const question = await this.prisma.astrologerQualificationQuestion.update({
      where: {
        id,
      },
      data: {
        ...(data.question !== undefined
          ? { question: data.question.trim() }
          : {}),
        ...(data.optionA !== undefined ? { optionA: data.optionA.trim() } : {}),
        ...(data.optionB !== undefined ? { optionB: data.optionB.trim() } : {}),
        ...(data.optionC !== undefined ? { optionC: data.optionC.trim() } : {}),
        ...(data.optionD !== undefined ? { optionD: data.optionD.trim() } : {}),
        ...(data.correctOption !== undefined
          ? { correctOption: data.correctOption.toUpperCase() }
          : {}),
        ...(data.category !== undefined
          ? { category: data.category.trim() || null }
          : {}),
        ...(data.explanation !== undefined
          ? { explanation: data.explanation.trim() || null }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return {
      success: true,
      message: 'Qualification question updated successfully',
      data: question,
    };
  }

  async deleteQualificationQuestion(id: string) {
    const existing =
      await this.prisma.astrologerQualificationQuestion.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException('Qualification question not found');
    }

    await this.prisma.astrologerQualificationQuestion.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
      message: 'Qualification question deleted successfully',
    };
  }
}

