import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { assertDailyCheckoutAvailable, assertDailyPlan, exactPeriodEnd, DAILY_PLAN } from './daily-horoscope-policy';
import { durableHoroscopeEnabled } from './horoscope-durable.store';
import { randomUUID } from 'node:crypto';
import { assertKundliPlan } from './kundli-plan-policy';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        price: 'asc',
      },
    });

    return {
      success: true,
      data: plans.filter(plan => { try { assertDailyPlan(plan); return true; } catch { return false; } }),
    };
  }

  async getCurrentSubscription(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.prisma.subscription.findFirst({
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
      data: subscription?.subscriptionStatus==='ACTIVE' && subscription.endDate && subscription.endDate.getTime()<=Date.now()
        ? {...subscription,subscriptionStatus:SubscriptionStatus.EXPIRED} : subscription,
      billing: subscription?.subscriptionPlan?.name===DAILY_PLAN ? { renewalMode:subscription.razorpaySubscriptionId?'PROVIDER_MANAGED_UNVERIFIED':'MANUAL', automaticRenewalSupported:false,periodEndCancellationSupported:durableHoroscopeEnabled()&&!subscription.razorpaySubscriptionId,
        cancelAtPeriodEnd: durableHoroscopeEnabled() ? (await this.prisma.$queryRaw<Array<{cancelAtPeriodEnd:boolean}>>`SELECT "cancelAtPeriodEnd" FROM public."HoroscopeSubscriptionControl" WHERE "subscriptionId"=${subscription.id}`)[0]?.cancelAtPeriodEnd ?? false : false } : undefined,
    };
  }

  async createSubscription(supabaseId: string, dto: CreateSubscriptionDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: dto.planName,
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    assertDailyPlan(plan);
    assertKundliPlan(plan);
    assertDailyCheckoutAvailable(plan.name);
    if(plan.name===DAILY_PLAN && dto.autoRenew===true) throw new BadRequestException('Automatic horoscope billing is not supported');

    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        ...(plan.name===DAILY_PLAN ? {subscriptionPlanId:plan.id,endDate:{gt:new Date()}} : {}),
      },
    });

    if (existing) {
      throw new BadRequestException('Active subscription already exists');
    }

    const startDate = new Date();

    const endDate = new Date();

    endDate.setTime(exactPeriodEnd(startDate, plan.durationDays).getTime());

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        subscriptionPlanId: plan.id,

        amount: plan.price,
        currency: plan.currency,

        subscriptionStatus: SubscriptionStatus.PENDING,

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
      message: 'Subscription created successfully',
      data: subscription,
    };
  }

  async cancelSubscription(supabaseId: string, dto: CancelSubscriptionDto) {
    if (dto.cancelAtPeriodEnd !== false && !durableHoroscopeEnabled()) {
      throw new BadRequestException('Period-end cancellation is not supported by the current billing contract; explicit immediate cancellation is required');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Active subscription not found');
    }
    if(dto.cancelAtPeriodEnd!==false) {
      await this.prisma.$transaction(async tx=>{
        const active=await tx.subscription.findFirst({where:{id:subscription.id,userId:user.id,subscriptionStatus:'ACTIVE',endDate:{gt:new Date()}}});
        if(!active) throw new BadRequestException('Subscription is no longer active');
        const activePlan=active.subscriptionPlanId ? await tx.subscriptionPlan.findUnique({where:{id:active.subscriptionPlanId}}) : null;
        if(activePlan?.name!==DAILY_PLAN) throw new BadRequestException('Period-end cancellation for this plan is not supported');
        // Provider-backed mandates require provider cancellation, never a local-only promise.
        if(active.razorpaySubscriptionId) throw new BadRequestException('Provider mandate cancellation requires verified provider integration');
        const changed=await tx.$executeRaw`INSERT INTO public."HoroscopeSubscriptionControl" ("subscriptionId","renewalMode","cancelAtPeriodEnd")
          VALUES (${subscription.id},'MANUAL',true) ON CONFLICT ("subscriptionId") DO UPDATE SET "cancelAtPeriodEnd"=true,"updatedAt"=CURRENT_TIMESTAMP
          WHERE "HoroscopeSubscriptionControl"."cancelAtPeriodEnd"=false`;
        if(changed===1) await tx.$executeRaw`INSERT INTO public."HoroscopeSubscriptionAudit" ("id","subscriptionId","action") VALUES (${randomUUID()},${subscription.id},'CANCEL_AT_PERIOD_END')`;
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      return {success:true,message:'No further automatic charge is scheduled; access remains until the paid expiry.',data:subscription,cancelAtPeriodEnd:true};
    }

    const updated = await this.prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
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
