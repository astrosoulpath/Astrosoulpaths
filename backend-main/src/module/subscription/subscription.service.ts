import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getPlans() {
    const plans =
      await this.prisma.subscriptionPlan.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          price: 'asc',
        },
      });

    return {
      success: true,
      data: plans,
    };
  }

  async getCurrentSubscription(
    supabaseId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const subscription =
      await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
        },
        include: {
          subscriptionPlan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return {
      success: true,
      data: subscription,
    };
  }

  async createSubscription(
    supabaseId: string,
    dto: CreateSubscriptionDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const plan =
      await this.prisma.subscriptionPlan.findUnique({
        where: {
          name: dto.planName,
        },
      });

    if (!plan) {
      throw new NotFoundException(
        'Subscription plan not found',
      );
    }

    const existing =
      await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          subscriptionStatus:
            SubscriptionStatus.ACTIVE,
        },
      });

    if (existing) {
      throw new BadRequestException(
        'Active subscription already exists',
      );
    }

    const startDate = new Date();

    const endDate = new Date();

    endDate.setDate(
      endDate.getDate() +
        plan.durationDays,
    );

    const subscription =
      await this.prisma.subscription.create({
        data: {
          userId: user.id,
          subscriptionPlanId: plan.id,

          amount: plan.price,
          currency: plan.currency,

          subscriptionStatus:
            SubscriptionStatus.PENDING,

          startDate,
          endDate,
          nextBillingAt: endDate,
        },
        include: {
          subscriptionPlan: true,
        },
      });

    return {
      success: true,
      message:
        'Subscription created successfully',
      data: subscription,
    };
  }

  async cancelSubscription(
    supabaseId: string,
    dto: CancelSubscriptionDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const subscription =
      await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          subscriptionStatus:
            SubscriptionStatus.ACTIVE,
        },
      });

    if (!subscription) {
      throw new NotFoundException(
        'Active subscription not found',
      );
    }

    const updated =
      await this.prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          subscriptionStatus:
            SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

    return {
      success: true,
      message:
        dto.cancelAtPeriodEnd === false
          ? 'Subscription cancelled immediately'
          : 'Subscription will remain active until the current billing period ends.',
      data: updated,
    };
  }
}