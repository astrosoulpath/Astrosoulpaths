import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  KUNDLI_INR_PRICE,
  KUNDLI_YEAR_DAYS,
} from '../../subscription/kundli-plan-policy';

const KUNDLI_PLAN_NAME = 'ASTROLOGER_KUNDLI_YEARLY';

type KundliPlanFeatures = {
  unlimitedKundliGeneration?: boolean;
  saveCustomerCharts?: boolean;
  detailedKundliReports?: boolean;
  downloadPdfReports?: boolean;
  printReports?: boolean;
  advancedDashaAnalysis?: boolean;
  worldwideAccess?: boolean;
  includedCharts?: string[];
};

@Injectable()
export class KundliSubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const supabaseId =
      typeof request.user?.sub === 'string' ? request.user.sub : null;

    if (!supabaseId) {
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
      });
    }

    const now = new Date();
    const method = String(request.method ?? '').toUpperCase();
    const path = String(
      request.route?.path ?? request.path ?? request.url ?? '',
    );
    const isGenerateRequest =
      method === 'POST' &&
      (path.endsWith('/generate') || path.endsWith('/regenerate'));

    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
        isAstrologer: true,

        astrologer: {
          select: {
            id: true,
            isApproved: true,
            isVerified: true,
          },
        },

        subscriptions: {
          where: {
            subscriptionStatus: {
              in: isGenerateRequest
                ? [SubscriptionStatus.ACTIVE]
                : [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
            },

            subscriptionPlan: {
              name: KUNDLI_PLAN_NAME,
              isActive: true,
              ...(isGenerateRequest
                ? {
                    price: KUNDLI_INR_PRICE,
                    currency: 'INR',
                    durationDays: KUNDLI_YEAR_DAYS,
                  }
                : {}),
            },
            ...(isGenerateRequest
              ? { amount: KUNDLI_INR_PRICE, currency: 'INR' }
              : {}),

            AND: isGenerateRequest
              ? [{ startDate: { lte: now } }, { endDate: { gt: now } }]
              : [
                  {
                    OR: [
                      {
                        startDate: null,
                      },
                      {
                        startDate: {
                          lte: now,
                        },
                      },
                    ],
                  },
                  {
                    OR: [
                      {
                        endDate: null,
                      },
                      {
                        endDate: {
                          gt: now,
                        },
                      },
                    ],
                  },
                ],
          },

          select: {
            id: true,
            subscriptionStatus: true,
            startDate: true,
            endDate: true,
            amount: true,
            currency: true,

            subscriptionPlan: {
              select: {
                id: true,
                name: true,
                isActive: true,
                features: true,
                price: true,
                currency: true,
                durationDays: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: 1,
        },
      },
    });

    if (!user) {
      throw new ForbiddenException({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'User account was not found',
      });
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException({
        success: false,
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'User account is inactive or blocked',
      });
    }

    if (!user.isAstrologer || !user.astrologer) {
      throw new ForbiddenException({
        success: false,
        code: 'ASTROLOGER_ACCESS_REQUIRED',
        message: 'Professional Kundli generation is available to astrologers',
      });
    }

    if (!user.astrologer.isApproved || !user.astrologer.isVerified) {
      throw new ForbiddenException({
        success: false,
        code: 'ASTROLOGER_APPROVAL_REQUIRED',
        message:
          'Astrologer account must be approved and verified before generating Kundlis',
      });
    }

    if (user.subscriptions.length === 0) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_SUBSCRIPTION_REQUIRED',
        message:
          'An active Professional Kundli yearly subscription is required',
      });
    }

    const subscription = user.subscriptions[0];
    // New calculations require a current paid entitlement. Historical read access
    // keeps its existing compatibility rules; no records are modified here.
    if (
      isGenerateRequest &&
      (subscription.subscriptionStatus !== SubscriptionStatus.ACTIVE ||
        !subscription.startDate ||
        subscription.startDate > now ||
        !subscription.endDate ||
        subscription.endDate <= now ||
        subscription.subscriptionPlan?.isActive !== true ||
        Number(subscription.amount) !== KUNDLI_INR_PRICE ||
        subscription.currency !== 'INR' ||
        Number(subscription.subscriptionPlan.price) !== KUNDLI_INR_PRICE ||
        subscription.subscriptionPlan.currency !== 'INR' ||
        subscription.subscriptionPlan.durationDays !== KUNDLI_YEAR_DAYS)
    ) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_SUBSCRIPTION_REQUIRED',
        message:
          'A current active Professional Kundli subscription is required for new calculations',
      });
    }

    const rawFeatures = subscription.subscriptionPlan?.features;

    const features: KundliPlanFeatures =
      rawFeatures &&
      typeof rawFeatures === 'object' &&
      !Array.isArray(rawFeatures)
        ? (rawFeatures as KundliPlanFeatures)
        : {};

    /*
     * Admin-controlled Professional Kundli permissions.
     *
     * Missing flags remain enabled for backward compatibility.
     * Explicit false from Admin disables that feature immediately.
     */
    const isSavedPdfRequest =
      method === 'GET' && (path.includes('/pdf') || path.endsWith('/pdf'));

    const isSavedRecordsRequest =
      method === 'GET' &&
      !isSavedPdfRequest &&
      (path.includes('/saved') || path.startsWith('/saved'));

    if (isGenerateRequest && features.unlimitedKundliGeneration === false) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_GENERATION_DISABLED',
        message:
          'Professional Kundli generation is currently disabled by the administrator',
      });
    }

    if (isGenerateRequest && features.detailedKundliReports === false) {
      throw new ForbiddenException({
        success: false,
        code: 'DETAILED_KUNDLI_REPORTS_DISABLED',
        message:
          'Professional Kundli reports are currently disabled by the administrator',
      });
    }

    if (isSavedRecordsRequest && features.saveCustomerCharts === false) {
      throw new ForbiddenException({
        success: false,
        code: 'SAVED_KUNDLI_DISABLED',
        message:
          'Saved customer Kundlis are currently disabled by the administrator',
      });
    }

    if (isSavedPdfRequest && features.downloadPdfReports === false) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_PDF_DOWNLOAD_DISABLED',
        message:
          'Kundli PDF downloads are currently disabled by the administrator',
      });
    }

    request.kundliAccess = {
      userId: user.id,
      astrologerId: user.astrologer.id,
      subscriptionId: subscription.id,
      planName: KUNDLI_PLAN_NAME,
    };

    return true;
  }
}
