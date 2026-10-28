import { MarketplaceService } from '../marketplace/marketplace.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentCreationCommands, paymentCreationEnabled, configuredPaymentMode, CreationClaim, isIsolatedFinancialTestDatabase } from './payment-creation-command';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  LedgerReferenceType,
  LedgerType,
  PaymentOrder,
  PaymentStatus,
  PaymentType,
  Prisma,
  SubscriptionStatus,
  User,
  Wallet,
} from '@prisma/client';

import { getRazorpayInstance } from '../../config/razorpay.config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KundliOrderService } from '../kundli/kundli-order.service';
import { CreateKundliReportOrderDto } from './dto/create-kundli-report-order.dto';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';
import { legacyReportPrice } from './legacy-report-policy';
import { assertDailyPlan, assertDailyCheckoutAvailable, DAILY_PLAN, DAILY_DAYS, exactPeriodEnd } from '../subscription/daily-horoscope-policy';
import { ACTIVATION_COPY, requireHoroscopeLocale } from '../subscription/horoscope-localization';
import { assertKundliCheckoutAvailable, assertKundliPlan, KUNDLI_YEARLY_PLAN } from '../subscription/kundli-plan-policy';
import { LocalizedPricingService } from './pricing/localized-pricing.service';
import {
  RazorpayOrder,
  RazorpayPaymentEntity,
  RazorpayWebhookPayload,
  verifyCheckoutSignature,
} from './razorpay-verification.service';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';

export interface WebhookProcessingResult {
  status: 'success' | 'failed' | 'pending' | 'duplicate' | 'ignored';

  paymentOrderId?: string;
  reason?: ReconciliationReason;
}

type ReconciliationReason =
  | 'reconciled_from_gateway'
  | 'already_processed'
  | 'gateway_payment_failed'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'gateway_payment_pending';

interface RazorpayOrderPaymentsResponse {
  entity?: string;
  count?: number;
  items?: RazorpayPaymentEntity[];
}

interface WalletCreditResult {
  wallet: Wallet;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

interface CapturedPaymentTransactionResult {
  status: 'success' | 'duplicate';
  paymentOrderId: string;
  kundliOrderId?: string;
  subscriptionId?: string;
}

interface CreatePaymentOrderRecordInput {
  userId: string;
  walletId?: string;
  razorpayOrderId: string;
  amount: Prisma.Decimal;
  currency: string;
  type: PaymentType;
  metadata?: Prisma.InputJsonValue;
}

type PaymentOrderWithRelations = Prisma.PaymentOrderGetPayload<{
  include: {
    wallet: true;
    kundliOrder: true;
  };
}>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private readonly defaultCurrency = 'INR';

  constructor(
    private readonly prisma: PrismaService,
    private readonly kundliOrderService: KundliOrderService,
    private readonly localizedPricingService: LocalizedPricingService,
    private readonly marketplaceService: MarketplaceService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsPushService: NotificationsPushService,
  ) {}

  async createOrder(
    supabaseUserId: string,
    dto: CreatePaymentOrderDto,
  ): Promise<RazorpayOrder> {
    return this.createWalletRechargeOrder(supabaseUserId, dto);
  }

  async getPendingSubscriptionOrder(subject: string, orderId: string): Promise<RazorpayOrder> {
    if (!/^order_[A-Za-z0-9_]{1,80}$/.test(orderId)) throw new BadRequestException('Invalid payment order');
    const user = await this.findUserBySupabaseId(subject);
    const row = await this.prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId } });
    if (!row || row.userId !== user.id || row.type !== PaymentType.SUBSCRIPTION) throw new NotFoundException('Subscription payment not found');
    const metadata = row.metadata as Record<string, unknown> | null;
    const mode = configuredPaymentMode();
    if (row.status !== PaymentStatus.PENDING || mode === 'UNKNOWN' || metadata?.providerMode !== mode)
      throw new ConflictException('Payment requires reconciliation; checkout cannot be resumed');
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId: user.id, razorpayOrderId: orderId, subscriptionStatus: SubscriptionStatus.PENDING },
      include: { subscriptionPlan: true },
    });
    const plan = subscription?.subscriptionPlan;
    if (!subscription || !plan?.isActive || metadata?.subscriptionId !== subscription.id ||
        ![KUNDLI_YEARLY_PLAN, DAILY_PLAN].includes(plan.name) ||
        subscription.currency !== row.currency || !subscription.amount?.equals(row.amount))
      throw new ConflictException('Pending subscription binding requires review');
    assertKundliCheckoutAvailable(plan.name); assertDailyCheckoutAvailable(plan.name);
    assertKundliPlan(plan); assertDailyPlan(plan);
    if (plan.name === KUNDLI_YEARLY_PLAN) {
      if (!row.amount.equals(plan.price) || row.currency !== 'INR') throw new ConflictException('Professional subscription quote mismatch');
      const astrologer = await this.prisma.astrologer.findUnique({ where: { userId: user.id } });
      if (!user.isAstrologer || !astrologer?.isApproved || !astrologer.isVerified)
        throw new ForbiddenException('Approved verified astrologer required');
    }
    const provider = getRazorpayInstance();
    const order = await provider.orders.fetch(orderId);
    const payments = await this.fetchOrderPaymentsFromRazorpay(orderId);
    const amount = this.convertMajorUnitsToSubunits(row.amount);
    if (order.id !== orderId || !['created', 'attempted'].includes(order.status) || Number(order.amount) !== amount ||
        order.currency !== row.currency || Number(order.amount_paid) !== 0 || Number(order.amount_due) !== amount ||
        payments.some(payment => ['authorized', 'captured'].includes(payment.status || '')))
      throw new ConflictException('Existing payment must be reconciled before retrying checkout');
    return { id: order.id, amount, currency: row.currency } as RazorpayOrder;
  }

  async createWalletRechargeOrder(
    supabaseUserId: string,
    dto: CreatePaymentOrderDto,
  ): Promise<RazorpayOrder> {
    const amount = this.normalizeAmount(dto.amount);

    if (amount.lt(new Prisma.Decimal(50))) {
      throw new BadRequestException('Minimum wallet recharge amount is INR 50');
    }

    const user = await this.findUserBySupabaseId(supabaseUserId);

    const wallet = await this.getOrCreateWallet(user.id);

    if (wallet.currency !== this.defaultCurrency) {
      throw new BadRequestException('Wallet recharge requires an INR wallet');
    }

    return this.createTypedPaymentOrder({
      userId: user.id,
      walletId: wallet.id,
      amount,
      currency: this.defaultCurrency,
      type: PaymentType.WALLET_RECHARGE,
      metadata: undefined,
    });
  }

  async getPendingWalletOrder(subject: string, orderId: string): Promise<RazorpayOrder> {
    if (!/^order_[A-Za-z0-9]+$/.test(orderId)) throw new BadRequestException('Invalid payment order');
    const user = await this.findUserBySupabaseId(subject);
    const row = await this.prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId } });
    if (!row || row.userId !== user.id || row.type !== PaymentType.WALLET_RECHARGE)
      throw new NotFoundException('Wallet payment not found');
    const mode = configuredPaymentMode();
    if (row.status !== PaymentStatus.PENDING || mode === 'UNKNOWN' || (row.metadata as any)?.providerMode !== mode)
      throw new ConflictException('Payment requires reconciliation before checkout');
    const provider = getRazorpayInstance();
    const order = await provider.orders.fetch(orderId);
    const payments = await this.fetchOrderPaymentsFromRazorpay(orderId);
    const amount = this.convertMajorUnitsToSubunits(row.amount);
    if (order.id !== orderId || !['created', 'attempted'].includes(order.status) || Number(order.amount) !== amount ||
        order.currency !== row.currency || Number(order.amount_paid) !== 0 || Number(order.amount_due) !== amount ||
        payments.some(payment => ['authorized', 'captured'].includes(payment.status || '')))
      throw new ConflictException('Existing payment must be reconciled before retrying checkout');
    return { id: order.id, amount, currency: row.currency } as RazorpayOrder;
  }

  async createKundliReportOrder(
    supabaseUserId: string,
    dto: CreateKundliReportOrderDto,
  ): Promise<RazorpayOrder> {
    const amount = legacyReportPrice();

    const user = await this.findUserBySupabaseId(supabaseUserId);

    // Kundli calculations are globally deduplicated, so existence is not access.
    const owned = await this.prisma.kundliSavedRecord.findFirst({
      where: { kundliId: dto.kundliId, OR: [
        { customerUserId: user.id },
        { createdByAstrologer: { userId: user.id } },
      ] }, select: { id: true },
    });
    if (!owned) throw new NotFoundException('Authorized Kundli report not found');

    return this.createTypedPaymentOrder({
      userId: user.id,
      amount,
      currency: this.defaultCurrency,
      type: PaymentType.KUNDLI_REPORT,
      metadata: {
        kundliId: dto.kundliId,
        lang: dto.lang ?? 'en',
      },
    });
  }

  async createSubscriptionOrder(
    supabaseUserId: string,
    dto: CreateSubscriptionOrderDto,
  ): Promise<RazorpayOrder> {
    assertKundliCheckoutAvailable(dto.planName);
    const user = await this.findUserBySupabaseId(supabaseUserId);

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: dto.planName,
      },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

    assertDailyPlan(plan);
    assertKundliPlan(plan);
    assertDailyCheckoutAvailable(plan.name);

    if (dto.planName === 'ASTROLOGER_KUNDLI_YEARLY') {
      if (!user.isAstrologer) {
        throw new BadRequestException(
          'This subscription is available only for astrologers',
        );
      }

      const astrologer = await this.prisma.astrologer.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          isApproved: true,
          isVerified: true,
        },
      });

      if (!astrologer) {
        throw new NotFoundException('Astrologer profile was not found');
      }

      if (!astrologer.isApproved || !astrologer.isVerified) {
        throw new BadRequestException(
          'Astrologer must be approved and verified before purchasing this plan',
        );
      }
    }

    const userProfile = await this.prisma.userProfile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        countryCode: true,
      },
    });

    const localizedQuote = plan.name === KUNDLI_YEARLY_PLAN
      ? { amount: plan.price.toString(), currency: plan.currency, countryCode: userProfile?.countryCode ?? null, fxSource: 'fixed-inr' }
      : await this.localizedPricingService.quotePrice({
      baseAmount: plan.price,
      baseCurrency: plan.currency,
      countryCode: userProfile?.countryCode ?? null,
    });

    const localizedAmount = new Prisma.Decimal(localizedQuote.amount);
    const localizedCurrency = localizedQuote.currency;
    // Do not silently turn the approved USD total into an unapproved FX charge.
    assertDailyPlan({ ...plan, price: localizedAmount, currency: localizedCurrency });

    this.logger.log(
      `subscription_pricing.quoted userId=${user.id} plan=${plan.name} baseAmount=${plan.price.toString()} baseCurrency=${plan.currency} countryCode=${localizedQuote.countryCode ?? 'unknown'} localizedAmount=${localizedQuote.amount} localizedCurrency=${localizedQuote.currency} fxSource=${localizedQuote.fxSource}`,
    );
    const existingActiveSubscription = await this.prisma.subscription.findFirst(
      {
        where: {
          userId: user.id,
          subscriptionPlanId: plan.id,
          endDate:{gt:new Date()},
          subscriptionStatus: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        },
      },
    );

    if (existingActiveSubscription) {
      throw new BadRequestException('This subscription is already active');
    }

    const existingPendingSubscription =
      await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          subscriptionPlanId: plan.id,
          subscriptionStatus: SubscriptionStatus.PENDING,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    // Preserve the provider binding of an outstanding purchase. A new checkout
    // must not overwrite it while a delayed capture may still arrive.
    if (existingPendingSubscription?.razorpayOrderId) {
      throw new ConflictException(
        'An existing subscription payment requires reconciliation before starting another checkout.',
      );
    }

    const creation = paymentCreationEnabled() ? await new PaymentCreationCommands(this.prisma).reserve({
      userId:user.id, purpose:'SUBSCRIPTION', reference:plan.name,
      amountMinor:this.convertMajorUnitsToSubunits(localizedAmount), currency:localizedCurrency,
    }) : undefined;
    if (creation?.reused && creation.providerOrderId) return {
      id:creation.providerOrderId, amount:Number(creation.amountMinor), currency:creation.currency,
    } as RazorpayOrder;

    const startDate = new Date();

    const endDate = new Date(startDate);

    endDate.setTime(exactPeriodEnd(startDate, plan.durationDays).getTime());

    const subscription = existingPendingSubscription
      ? await this.prisma.subscription.update({
          where: {
            id: existingPendingSubscription.id,
          },
          data: {
            amount: localizedAmount,
            currency: localizedCurrency,
            startDate,
            endDate,
            nextBillingAt: endDate,
            cancelledAt: null,
            expiredAt: null,
            subscriptionStatus: SubscriptionStatus.PENDING,
          },
        })
      : await this.prisma.subscription.create({
          data: {
            userId: user.id,
            subscriptionPlanId: plan.id,
            subscriptionStatus: SubscriptionStatus.PENDING,
            amount: localizedAmount,
            currency: localizedCurrency,
            startDate,
            endDate,
            nextBillingAt: endDate,
          },
        });

    const amount = this.normalizeAmount(Number(localizedQuote.amount));

    const razorpayOrder = await this.createTypedPaymentOrder({
      userId: user.id,
      amount,
      currency: localizedCurrency,
      type: PaymentType.SUBSCRIPTION,
      metadata: {
        subscriptionId: subscription.id,
        subscriptionPlanId: plan.id,
        planName: plan.name,
        planSnapshot: { name: plan.name, durationDays: plan.durationDays, amount: amount.toString(), currency: localizedCurrency },
      },
      creation,
    });

    await this.prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        razorpayOrderId: razorpayOrder.id,
      },
    });

    this.logger.log(
      `subscription_payment_order.created userId=${user.id} subscriptionId=${subscription.id} plan=${plan.name} razorpayOrderId=${razorpayOrder.id}`,
    );

    return razorpayOrder;
  }

  async processVerifiedWebhook(
    event: RazorpayWebhookPayload,
  ): Promise<WebhookProcessingResult> {
    const payment = this.extractPaymentEntity(event);

    this.logger.log(
      `webhook.received event=${event.event} razorpayOrderId=${payment?.order_id ?? 'unknown'} razorpayPaymentId=${payment?.id ?? 'unknown'}`,
    );

    if (!payment) {
      this.logger.warn(`webhook.payment_missing event=${event.event}`);

      return {
        status: 'ignored',
      };
    }

    /*
     * Marketplace Razorpay orders are stored on MarketplaceOrder rather
     * than the generic PaymentOrder table.
     *
     * Detect them before the legacy PaymentOrder lookup so a valid
     * marketplace webhook is not incorrectly returned as "ignored".
     */
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const marketplaceOrder =
        await this.marketplaceService.findMarketplaceOrderForRazorpayWebhook(
          payment.order_id,
        );

      if (marketplaceOrder) {
        // A signed webhook is not proof that this order belongs to the currently
        // configured TEST/LIVE merchant. Bind it through that provider account
        // (including the default-off LIVE gate) before marketplace mutation.
        if (!/^pay_[A-Za-z0-9]+$/.test(payment.id ?? '')) throw new BadRequestException('Invalid marketplace payment reference');
        let evidence: RazorpayPaymentEntity & { captured?: boolean };
        try { evidence = await getRazorpayInstance().payments.fetch(payment.id) as RazorpayPaymentEntity & { captured?: boolean }; }
        catch { throw new BadGatewayException('Marketplace payment evidence unavailable; retry webhook safely'); }
        if (evidence.id !== payment.id || evidence.order_id !== payment.order_id || evidence.status !== 'captured' ||
            evidence.captured !== true || evidence.amount !== payment.amount || evidence.currency !== payment.currency)
          throw new BadRequestException('Marketplace webhook payment does not match configured provider capture');
        this.logger.log(
          `webhook.marketplace_detected marketplaceOrderId=${marketplaceOrder.id} orderNumber=${marketplaceOrder.orderNumber} razorpayOrderId=${payment.order_id} razorpayPaymentId=${payment.id}`,
        );

        let marketplaceResult: Awaited<
          ReturnType<MarketplaceService['finalizeMarketplaceRazorpayWebhook']>
        >;

        try {
          marketplaceResult =
            await this.marketplaceService.finalizeMarketplaceRazorpayWebhook({
              razorpayOrderId: payment.order_id,
              razorpayPaymentId: payment.id,
              amount: payment.amount,
              currency: payment.currency ?? '',
              status: payment.status ?? '',
            });
        } catch (error) {
          /*
           * Only deterministic fulfillment/business conflicts may become
           * REFUND_REQUIRED after Razorpay reports captured/paid.
           *
           * Database, network, timeout and unknown internal errors must
           * propagate so the webhook can be retried safely.
           */
          if (
            !this.marketplaceService.isMarketplaceRefundRequiredFinalizationError(
              error,
            )
          ) {
            throw error;
          }

          const message =
            error instanceof Error
              ? error.message
              : 'Marketplace captured payment requires compensation';

          await this.marketplaceService.recordMarketplaceCapturedPaymentException(
            {
              razorpayOrderId: payment.order_id,
              razorpayPaymentId: payment.id,
              amount: payment.amount,
              currency: payment.currency ?? '',
              reason: message,
            },
          );

          this.logger.error(
            `webhook.marketplace_compensation_required marketplaceOrderId=${marketplaceOrder.id} razorpayOrderId=${payment.order_id} razorpayPaymentId=${payment.id}`,
          );

          /*
           * Known deterministic fulfillment failure has now been durably
           * recorded for compensation. Do not retry the same finalization
           * indefinitely.
           */
          return {
            status: 'failed',
          };
        }
        if (!marketplaceResult) {
          throw new NotFoundException(
            'Marketplace Razorpay order disappeared during webhook processing',
          );
        }

        this.logger.log(
          `webhook.marketplace_finalized marketplaceOrderId=${marketplaceResult.marketplaceOrderId} razorpayPaymentId=${payment.id} status=${marketplaceResult.status}`,
        );

        return marketplaceResult;
      }
    }
    const paymentOrder = await this.findPaymentOrderByRazorpayOrderId(
      payment.order_id,
    );

    if (!paymentOrder) {
      this.logger.warn(
        `payment_order.missing razorpayOrderId=${payment.order_id} event=${event.event}`,
      );

      return {
        status: 'ignored',
      };
    }

    this.logger.log(
      `payment_order.found paymentOrderId=${paymentOrder.id} type=${paymentOrder.type} status=${paymentOrder.status} razorpayOrderId=${paymentOrder.razorpayOrderId}`,
    );

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      return this.handleCapturedPayment(event, paymentOrder, payment);
    }

    if (event.event === 'payment.failed') {
      if (!this.isPaymentAlreadyProcessed(paymentOrder)) this.assertKnownPaymentEnvironment(paymentOrder);
      return this.handleFailedPayment(event, paymentOrder, payment);
    }

    this.logger.log(
      `webhook.ignored event=${event.event} paymentOrderId=${paymentOrder.id}`,
    );

    return {
      status: 'ignored',
      paymentOrderId: paymentOrder.id,
    };
  }

  async verifyCheckout(subject: string, proof: VerifyCheckoutDto): Promise<WebhookProcessingResult> {
    const user = await this.findUserBySupabaseId(subject);
    const order = await this.findPaymentOrderByRazorpayOrderId(proof.orderId);
    if (!order || order.userId !== user.id) throw new NotFoundException('Payment order not found');
    const mode = configuredPaymentMode();
    if (mode === 'UNKNOWN' || (order.metadata as any)?.providerMode !== mode) {
      throw new BadRequestException('Payment environment does not match the order');
    }
    if (!verifyCheckoutSignature(order.razorpayOrderId, proof.paymentId, proof.signature)) {
      throw new BadRequestException('Invalid checkout signature');
    }
    // Replays never rewrite a completed order or backfill historical audit evidence.
    if (this.isPaymentAlreadyProcessed(order)) return { status: 'duplicate', paymentOrderId: order.id };
    const payment = await getRazorpayInstance().payments.fetch(proof.paymentId).catch(() => {
      // SDK transport errors may contain request credentials; never log/rethrow them.
      throw new BadGatewayException('Payment verification provider is unavailable');
    });
    if (payment.id !== proof.paymentId || payment.order_id !== order.razorpayOrderId) {
      throw new BadRequestException('Payment does not match the order');
    }
    this.assertCapturedAmountMatchesOrder(order, payment as RazorpayPaymentEntity);
    this.assertCapturedCurrencyMatchesOrder(order, payment as RazorpayPaymentEntity);
    if (payment.status !== 'captured' || payment.captured !== true) {
      return { status: 'pending', paymentOrderId: order.id };
    }
    // Persist only the verification method and sanitized provider facts for FUTURE fulfillment.
    // Do not persist callback signatures, API secrets, contact details or payment instruments.
    const entity: RazorpayPaymentEntity = {
      id: payment.id, order_id: payment.order_id, amount: Number(payment.amount),
      currency: payment.currency, status: payment.status, method: payment.method,
    };
    const event = {
      event: 'payment.checkout_verified', payload: { payment: { entity } },
      verification: { method: 'CHECKOUT_HMAC_AND_PROVIDER_CAPTURE', signatureVerified: true },
    };
    return this.handleCapturedPayment(event, order, entity);
  }

  async reconcileOrder(
    supabaseUserId: string,
    razorpayOrderId: string,
  ): Promise<WebhookProcessingResult> {
    const user = await this.findUserBySupabaseId(supabaseUserId);

    this.logger.log(
      `reconciliation.started userId=${user.id} razorpayOrderId=${razorpayOrderId}`,
    );

    const paymentOrder =
      await this.findPaymentOrderByRazorpayOrderId(razorpayOrderId);

    if (!paymentOrder || paymentOrder.userId !== user.id) {
      this.logger.warn(
        `reconciliation.order_missing userId=${user.id} razorpayOrderId=${razorpayOrderId}`,
      );

      throw new NotFoundException('Payment order not found');
    }

    return this.reconcileKnownOrder(paymentOrder);
  }

  async reconcileTestPaymentForAdmin(paymentOrderId: string) {
    if (process.env.ADMIN_FINANCE_TEST_OPERATIONS_ENABLED !== 'true' || configuredPaymentMode() !== 'TEST')
      throw new ServiceUnavailableException('Admin test payment operations are not activated');
    if(!await isIsolatedFinancialTestDatabase(this.prisma))throw new ServiceUnavailableException('Designated isolated financial test database required');
    const record = await this.prisma.paymentOrder.findUnique({where:{id:paymentOrderId}});
    const metadata = record?.metadata as Record<string,unknown>|null;
    if (!record || metadata?.providerMode !== 'TEST' ||
        ![PaymentType.WALLET_RECHARGE,PaymentType.SUBSCRIPTION].includes(record.type as any))
      throw new ConflictException('An explicitly TEST-tagged supported payment is required; historical mode is not inferred');
    const paymentOrder = await this.findPaymentOrderByRazorpayOrderId(record.razorpayOrderId);
    if (!paymentOrder) throw new NotFoundException('Payment order not found');
    return this.reconcileKnownOrder(paymentOrder);
  }

  private async reconcileKnownOrder(paymentOrder: PaymentOrderWithRelations): Promise<WebhookProcessingResult> {
    const razorpayOrderId = paymentOrder.razorpayOrderId;

    if (this.isPaymentAlreadyProcessed(paymentOrder)) {
      this.logger.warn(
        `reconciliation.duplicate_ignored paymentOrderId=${paymentOrder.id} reason=already_success`,
      );

      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
        reason: 'already_processed',
      };
    }

    this.assertKnownPaymentEnvironment(paymentOrder);
    const payments = await this.fetchOrderPaymentsFromRazorpay(razorpayOrderId);

    const capturedPayment = payments.find(
      (payment) => payment.status === 'captured',
    );

    if (!capturedPayment) {
      // No attempt, or an authorized/created attempt, is not proof of failure.
      // Keep the order recoverable for a later capture/webhook.
      if (payments.length === 0 || payments.some(payment => payment.status !== 'failed')) {
        return { status: 'pending', paymentOrderId: paymentOrder.id, reason: 'gateway_payment_pending' };
      }
      return this.markFailedFromReconciliation(paymentOrder, payments);
    }

    let result: WebhookProcessingResult;

    try {
      result = await this.handleCapturedPayment(
        this.buildCapturedReconciliationEvent(capturedPayment, payments),
        paymentOrder,
        capturedPayment,
      );
    } catch (error) {
      const mismatchReason = this.getReconciliationMismatchReason(error);

      if (!mismatchReason) {
        throw error;
      }

      this.logger.warn(
        `reconciliation.validation_failed paymentOrderId=${paymentOrder.id} razorpayPaymentId=${capturedPayment.id} reason=${mismatchReason}`,
      );

      return {
        status: 'failed',
        paymentOrderId: paymentOrder.id,
        reason: mismatchReason,
      };
    }

    if (result.status === 'duplicate') {
      this.logger.warn(
        `reconciliation.duplicate_ignored paymentOrderId=${paymentOrder.id} reason=race_already_processed`,
      );

      return {
        ...result,
        reason: 'already_processed',
      };
    }

    this.logger.log(
      `reconciliation.success paymentOrderId=${paymentOrder.id} razorpayPaymentId=${capturedPayment.id} reason=reconciled_from_gateway`,
    );

    return {
      ...result,
      reason: 'reconciled_from_gateway',
    };
  }

  async createWalletRechargePackOrder(supabaseUserId: string, packId: string) {
    if (!packId?.trim()) {
      throw new BadRequestException('Recharge pack ID is required');
    }

    const user = await this.findUserBySupabaseId(supabaseUserId);

    const pack = await this.prisma.rechargePack.findFirst({
      where: {
        id: packId.trim(),
        isActive: true,
      },
    });

    if (!pack) {
      throw new NotFoundException(
        'Recharge pack was not found or is no longer available',
      );
    }

    const paidAmount = new Prisma.Decimal(pack.amount).toDecimalPlaces(2);

    const bonusPercent = new Prisma.Decimal(pack.bonusPercent);
    const bonusAmount = new Prisma.Decimal(pack.bonusAmount).toDecimalPlaces(2);
    const walletCreditAmount = paidAmount.plus(bonusAmount).toDecimalPlaces(2);

    const wallet = await this.getOrCreateWallet(user.id);

    if (wallet.currency !== this.defaultCurrency) {
      throw new BadRequestException('Wallet recharge requires an INR wallet');
    }

    return this.createTypedPaymentOrder({
      userId: user.id,
      walletId: wallet.id,
      amount: paidAmount,
      currency: wallet.currency,
      type: PaymentType.WALLET_RECHARGE,
      metadata: {
        rechargeMode: 'PACK',
        rechargePackId: pack.id,
        paidAmount: paidAmount.toFixed(2),
        bonusPercent: bonusPercent.toFixed(2),
        bonusAmount: bonusAmount.toFixed(2),
        walletCreditAmount: walletCreditAmount.toFixed(2),
      },
    });
  }
  private async createTypedPaymentOrder(input: {
    userId: string;
    amount: Prisma.Decimal;
    currency?: string;
    type: PaymentType;
    walletId?: string;
    metadata?: Prisma.InputJsonValue;
    creation?: CreationClaim;
  }): Promise<RazorpayOrder> {
    const currency =
      input.currency?.trim().toUpperCase() || this.defaultCurrency;

    if (currency !== 'INR' && process.env.RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED !== 'true') {
      throw new ServiceUnavailableException('International checkout is disabled pending merchant approval');
    }

    // Validate gates even when a caller supplies an already-reserved command.
    const creationEnabled = paymentCreationEnabled();
    const commands = new PaymentCreationCommands(this.prisma);
    const creation = input.creation ?? (creationEnabled ? await commands.reserve({
      userId:input.userId, purpose:input.type, reference:input.walletId ?? input.type,
      amountMinor:this.convertMajorUnitsToSubunits(input.amount), currency,
    }) : undefined);
    if (creation?.state === 'READY' && creation.providerOrderId) return {
      id:creation.providerOrderId,amount:Number(creation.amountMinor),currency:creation.currency,
    } as RazorpayOrder;

    let razorpayOrder: RazorpayOrder;

    try {
      razorpayOrder = (await getRazorpayInstance().orders.create({
        amount: this.convertMajorUnitsToSubunits(input.amount),
        currency,
        receipt: this.buildReceipt(input.userId, input.type),
        notes: {
          paymentType: input.type,
          userId: input.userId,
          ...(creation?{creationCommandId:creation.id}:{}),
          ...(input.walletId
            ? {
                walletId: input.walletId,
              }
            : {}),
          ...this.buildRazorpayMetadataNotes(input.metadata),
        },
      })) as RazorpayOrder;
    } catch (error: unknown) {
      if (creation) await commands.unknown(creation.id);
      let message = 'Unknown Razorpay error';
      let statusCode: number | undefined;
      let razorpayCode: string | undefined;
      let razorpayDescription: string | undefined;

      if (error instanceof Error) {
        message = error.message;
      }

      if (error && typeof error === 'object') {
        const razorpayError = error as {
          statusCode?: number;
          error?: {
            code?: string;
            description?: string;
            reason?: string;
            source?: string;
            step?: string;
          };
          message?: string;
        };

        statusCode = razorpayError.statusCode;

        razorpayCode = razorpayError.error?.code;

        razorpayDescription = razorpayError.error?.description;

        if (razorpayDescription) {
          message = razorpayDescription;
        } else if (razorpayError.message) {
          message = razorpayError.message;
        }
      }

      this.logger.error(
        [
          'payment_order.create_failed',
          `userId=${input.userId}`,
          `type=${input.type}`,
          `currency=${currency}`,
          // Do not log provider-controlled descriptions/codes or raw errors.
          `statusCode=${Number.isInteger(statusCode) && statusCode! >= 400 && statusCode! <= 599 ? statusCode : 'unknown'}`,
        ].join(' '),
      );

      throw new BadGatewayException('Unable to create payment order');
    }

    if (typeof razorpayOrder.id !== 'string' || !razorpayOrder.id.trim() ||
        razorpayOrder.amount !== this.convertMajorUnitsToSubunits(input.amount) || razorpayOrder.currency !== currency) {
      if (creation) await commands.unknown(creation.id);
      throw new BadGatewayException('Provider order does not match approved payment amount and currency');
    }

    try {
      const record = {
        userId: input.userId,
        walletId: input.walletId,
        razorpayOrderId: razorpayOrder.id,
        amount: input.amount,
        currency,
        type: input.type,
        metadata: { ...(typeof input.metadata==='object' && input.metadata && !Array.isArray(input.metadata) ? input.metadata : {}),
          providerMode:configuredPaymentMode(), ...(creation?{creationCommandId:creation.id}:{}) },
      };
      if (creation) await this.prisma.$transaction(async tx => {
        await this.persistPaymentOrder(record, tx);
        await commands.bind(tx, creation.id, razorpayOrder.id);
      });
      else await this.persistPaymentOrder(record);
    } catch (error) {
      if (creation) await commands.unknown(creation.id);
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `payment_order.persist_failed type=${input.type}`,
      );

      throw new InternalServerErrorException('Unable to save payment order');
    }

    this.logger.log(
      `payment_order.created userId=${input.userId} type=${input.type} razorpayOrderId=${razorpayOrder.id} amount=${input.amount.toFixed(2)} currency=${currency}`,
    );

    return razorpayOrder;
  }

  private assertKnownPaymentEnvironment(order: PaymentOrderWithRelations): void {
    const mode = configuredPaymentMode();
    if (mode === 'UNKNOWN' || (order.metadata as Record<string, unknown> | null)?.providerMode !== mode) {
      throw new ConflictException('Payment environment is unknown or mismatched; operator review required.');
    }
    if (mode === 'LIVE' && process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Live payment fulfillment is disabled pending explicit approval.');
    }
  }

  private async handleCapturedPayment(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    // Reconciliation and webhook callers share this boundary. Never trust an
    // upstream lookup alone to bind captured funds to the expected local order.
    if (payment.order_id !== paymentOrder.razorpayOrderId ||
        !/^pay_[A-Za-z0-9]+$/.test(payment.id ?? '')) {
      throw new BadRequestException('Captured payment does not match the order');
    }
    if (paymentOrder.status === PaymentStatus.REFUNDED || paymentOrder.status === PaymentStatus.EXPIRED) {
      throw new BadRequestException('Terminal payment requires reconciliation review');
    }
    if (this.isPaymentAlreadyProcessed(paymentOrder)) {
      this.logger.warn(
        `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=already_success`,
      );

      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    this.assertKnownPaymentEnvironment(paymentOrder);
    this.assertCapturedAmountMatchesOrder(paymentOrder, payment);

    this.assertCapturedCurrencyMatchesOrder(paymentOrder, payment);

    if (paymentOrder.type === PaymentType.WALLET_RECHARGE) {
      return this.handleCapturedWalletRecharge(event, paymentOrder, payment);
    }

    if (paymentOrder.type === PaymentType.KUNDLI_REPORT) {
      return this.handleCapturedKundliReport(event, paymentOrder, payment);
    }

    if (paymentOrder.type === PaymentType.SUBSCRIPTION) {
      return this.handleCapturedSubscription(event, paymentOrder, payment);
    }

    this.logger.warn(
      `webhook.unhandled_payment_type paymentOrderId=${paymentOrder.id} type=${paymentOrder.type}`,
    );

    return {
      status: 'ignored',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async handleCapturedWalletRecharge(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    try {
      const result = await this.prisma.$transaction((transaction) =>
        this.processWalletRechargeTransaction(
          transaction,
          paymentOrder,
          payment,
          event,
        ),
      );

      if (result.status === 'duplicate') {
        this.logger.warn(
          `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=race_already_processed`,
        );

        return result;
      }
    } catch (error) {
      return this.handleCapturedPaymentError(
        paymentOrder.id,
        payment.id,
        error,
      );
    }

    this.logger.log(
      `payment.success paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} type=${paymentOrder.type}`,
    );

    this.logger.log(
      `transaction.completed paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id}`,
    );

    return {
      status: 'success',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async handleCapturedKundliReport(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    let result: CapturedPaymentTransactionResult;

    try {
      result = await this.prisma.$transaction((transaction) =>
        this.processKundliReportTransaction(
          transaction,
          paymentOrder,
          payment,
          event,
        ),
      );

      if (result.status === 'duplicate') {
        this.logger.warn(
          `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=race_already_processed`,
        );

        return result;
      }
    } catch (error) {
      return this.handleCapturedPaymentError(
        paymentOrder.id,
        payment.id,
        error,
      );
    }

    if (result.kundliOrderId) {
      await this.triggerKundliPdfGeneration(result.kundliOrderId, paymentOrder);
    }

    this.logger.log(
      `payment.success paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} type=${paymentOrder.type}`,
    );

    this.logger.log(
      `transaction.completed paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id}`,
    );

    return {
      status: 'success',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async handleCapturedSubscription(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    let result: CapturedPaymentTransactionResult;

    try {
      result = await this.prisma.$transaction((transaction) =>
        this.processSubscriptionTransaction(
          transaction,
          paymentOrder,
          payment,
          event,
        ),
      );

      if (result.status === 'duplicate') {
        this.logger.warn(
          `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=subscription_already_processed`,
        );

        return result;
      }
    } catch (error) {
      return this.handleCapturedPaymentError(
        paymentOrder.id,
        payment.id,
        error,
      );
    }

    if (result.subscriptionId) {
      await this.sendSubscriptionActivatedNotification(
        paymentOrder.userId,
        result.subscriptionId,
      );
    }

    this.logger.log(
      `subscription.activated paymentOrderId=${paymentOrder.id} subscriptionId=${result.subscriptionId ?? 'unknown'} razorpayPaymentId=${payment.id}`,
    );

    this.logger.log(
      `payment.success paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} type=${paymentOrder.type}`,
    );

    return {
      status: 'success',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async handleFailedPayment(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    if (this.isPaymentAlreadyProcessed(paymentOrder)) {
      this.logger.warn(
        `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=failed_after_success`,
      );

      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    const updatedPaymentOrder = await this.handleFailedPaymentUpdate(
      paymentOrder,
      payment,
      event,
    );

    if (!updatedPaymentOrder) {
      this.logger.warn(
        `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=failed_race_already_processed`,
      );

      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    if (paymentOrder.type === PaymentType.SUBSCRIPTION) {
      await this.markSubscriptionFailed(paymentOrder, payment);
    }

    this.logger.log(
      `payment.failure paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} type=${paymentOrder.type}`,
    );

    return {
      status: 'failed',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async processWalletRechargeTransaction(
    transaction: Prisma.TransactionClient,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
    event: RazorpayWebhookPayload,
  ): Promise<CapturedPaymentTransactionResult> {
    const updatedOrder = await this.markPaymentSuccess(
      transaction,
      paymentOrder,
      payment,
      event,
    );

    if (!updatedOrder) {
      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    const walletCreditAmount = this.getWalletRechargeCreditAmount(paymentOrder);

    const rechargeBreakdown = this.getWalletRechargeBreakdown(paymentOrder);

    const walletCredit = await this.creditWallet(
      transaction,
      this.getWalletIdForRecharge(paymentOrder),
      walletCreditAmount,
      rechargeBreakdown.paidAmount,
      rechargeBreakdown.freeAmount,
      paymentOrder.currency,
      paymentOrder.userId,
    );

    await this.createLedgerEntry(
      transaction,
      paymentOrder,
      updatedOrder,
      walletCredit,
    );

    this.logger.log(
      `wallet.credited walletId=${walletCredit.wallet.id} paymentOrderId=${paymentOrder.id} balanceBefore=${walletCredit.balanceBefore.toFixed(2)} balanceAfter=${walletCredit.balanceAfter.toFixed(2)}`,
    );

    this.logger.log(`ledger.created paymentOrderId=${paymentOrder.id}`);

    return {
      status: 'success',
      paymentOrderId: paymentOrder.id,
    };
  }

  private async processKundliReportTransaction(
    transaction: Prisma.TransactionClient,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
    event: RazorpayWebhookPayload,
  ): Promise<CapturedPaymentTransactionResult> {
    const updatedOrder = await this.markPaymentSuccess(
      transaction,
      paymentOrder,
      payment,
      event,
    );

    if (!updatedOrder) {
      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    const metadata =
      this.kundliOrderService.getKundliPaymentMetadata(updatedOrder);

    const kundliOrder = await this.kundliOrderService.createProcessingOrder(
      transaction,
      {
        paymentOrderId: updatedOrder.id,
        userId: updatedOrder.userId,
        kundliId: metadata.kundliId,
      },
    );

    this.logger.log(
      `kundli_order.created kundliOrderId=${kundliOrder.id} paymentOrderId=${updatedOrder.id}`,
    );

    return {
      status: 'success',
      paymentOrderId: updatedOrder.id,
      kundliOrderId: kundliOrder.id,
    };
  }

  private async processSubscriptionTransaction(
    transaction: Prisma.TransactionClient,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
    event: RazorpayWebhookPayload,
  ): Promise<CapturedPaymentTransactionResult> {
    const updatedOrder = await this.markPaymentSuccess(
      transaction,
      paymentOrder,
      payment,
      event,
    );

    if (!updatedOrder) {
      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

    const metadata = this.getSubscriptionPaymentMetadata(updatedOrder);

    const subscription = await transaction.subscription.findUnique({
      where: {
        id: metadata.subscriptionId,
      },
      include: {
        subscriptionPlan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record was not found');
    }

    if (subscription.userId !== paymentOrder.userId) {
      throw new BadRequestException(
        'Subscription does not belong to payment user',
      );
    }

    const startDate = new Date();

    const rawMetadata = paymentOrder.metadata as Record<string, unknown> | null;
    const snapshot = rawMetadata?.planSnapshot as Record<string, unknown> | undefined;
    let durationDays = subscription.subscriptionPlan?.name === DAILY_PLAN ? DAILY_DAYS : subscription.subscriptionPlan?.durationDays ?? 30;
    if (snapshot !== undefined) {
      if (!snapshot || typeof snapshot !== 'object' || snapshot.name !== metadata.planName ||
          !Number.isInteger(snapshot.durationDays) || Number(snapshot.durationDays) <= 0 || Number(snapshot.durationDays) > 3660 ||
          snapshot.currency !== paymentOrder.currency || typeof snapshot.amount !== 'string' ||
          !new Prisma.Decimal(snapshot.amount).equals(paymentOrder.amount)) {
        throw new BadRequestException('Invalid subscription purchase snapshot');
      }
      durationDays = Number(snapshot.durationDays);
    }

    const endDate = new Date(startDate);

    endDate.setTime(exactPeriodEnd(startDate, durationDays).getTime());

    const activatedSubscription = await transaction.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        razorpayPaymentId: payment.id,
        razorpayOrderId: paymentOrder.razorpayOrderId,
        startDate,
        endDate,
        nextBillingAt: endDate,
        cancelledAt: null,
        expiredAt: null,
      },
    });

    await transaction.user.update({
      where: {
        id: paymentOrder.userId,
      },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionPlanId: subscription.subscriptionPlanId,
      },
    });

    return {
      status: 'success',
      paymentOrderId: updatedOrder.id,
      subscriptionId: activatedSubscription.id,
    };
  }


  private async sendSubscriptionActivatedNotification(
    userId: string,
    subscriptionId: string,
  ): Promise<void> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true, subscriptionPlan: { select: { name: true } } },
      });
      // Horoscope copy and navigation are not valid for a professional Kundli purchase.
      if (subscription?.userId !== userId || subscription.subscriptionPlan?.name !== DAILY_PLAN) {
        return;
      }
      const profile = await this.prisma.userProfile.findUnique({ where: { userId }, select: { lang: true } });
      const locale = requireHoroscopeLocale(profile?.lang?.trim().toLowerCase() ?? '');
      const [title, body] = ACTIVATION_COPY[locale];

      const notification = await this.notificationsService.createForUser({
        userId,
        title,
        body,
        type: 'subscription',
        data: {
          type: 'subscription',
          screen: 'horoscope',
          subscriptionId,
          status: 'ACTIVE',
          source: 'subscription-activation',
          locale,
        },
      });

      await this.notificationsPushService.sendToUser(userId, {
        title: notification.title,
        body: notification.body,
        data: {
          type: 'subscription',
          screen: 'horoscope',
          subscriptionId,
          notificationId: notification.id,
          status: 'ACTIVE',
          source: 'subscription-activation',
          locale,
        },
      });
    } catch (error) {
      this.logger.warn(
        'subscription.activation_notification_failed',
      );
    }
  }
  private async markSubscriptionFailed(
    paymentOrder: PaymentOrder,
    payment: RazorpayPaymentEntity,
  ): Promise<void> {
    try {
      const metadata = this.getSubscriptionPaymentMetadata(paymentOrder);

      await this.prisma.subscription.updateMany({
        where: {
          id: metadata.subscriptionId,
          userId: paymentOrder.userId,
          subscriptionStatus: {
            not: SubscriptionStatus.ACTIVE,
          },
        },
        data: {
          subscriptionStatus: SubscriptionStatus.FAILED,
          razorpayPaymentId: payment.id,
          razorpayOrderId: paymentOrder.razorpayOrderId,
        },
      });

      this.logger.log(
        `subscription.payment_failed subscriptionId=${metadata.subscriptionId} paymentOrderId=${paymentOrder.id}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        'subscription.failure_update_failed',
      );
    }
  }

  private getSubscriptionPaymentMetadata(paymentOrder: PaymentOrder): {
    subscriptionId: string;
    planName?: string;
    subscriptionPlanId?: string;
  } {
    const metadata = paymentOrder.metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new BadRequestException('Subscription payment metadata is missing');
    }

    const subscriptionId = metadata['subscriptionId'];

    const planName = metadata['planName'];

    const subscriptionPlanId = metadata['subscriptionPlanId'];

    if (typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
      throw new BadRequestException(
        'Subscription ID is missing from payment metadata',
      );
    }

    return {
      subscriptionId: subscriptionId.trim(),
      planName: typeof planName === 'string' ? planName : undefined,
      subscriptionPlanId:
        typeof subscriptionPlanId === 'string' ? subscriptionPlanId : undefined,
    };
  }

  private async triggerKundliPdfGeneration(
    kundliOrderId: string,
    paymentOrder: PaymentOrder,
  ): Promise<void> {
    try {
      await this.kundliOrderService.triggerPdfGeneration(
        kundliOrderId,
        paymentOrder,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.kundliOrderService.markGenerationFailed(
        kundliOrderId,
        message,
      );
    }
  }

  private handleCapturedPaymentError(
    paymentOrderId: string,
    razorpayPaymentId: string,
    error: unknown,
  ): never {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(
      'transaction.failed',
    );

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    throw new InternalServerErrorException('Failed to process payment webhook');
  }

  private async fetchOrderPaymentsFromRazorpay(
    razorpayOrderId: string,
  ): Promise<RazorpayPaymentEntity[]> {
    try {
      const response = (await getRazorpayInstance().orders.fetchPayments(
        razorpayOrderId,
      )) as RazorpayOrderPaymentsResponse | RazorpayPaymentEntity[];

      if (Array.isArray(response)) {
        return response;
      }

      return Array.isArray(response.items) ? response.items : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        'reconciliation.fetch_failed',
      );

      throw new BadGatewayException(
        'Unable to fetch payment status from Razorpay',
      );
    }
  }

  private extractPaymentEntity(
    event: RazorpayWebhookPayload,
  ): RazorpayPaymentEntity | null {
    return event.payload?.payment?.entity ?? null;
  }

  private async findUserBySupabaseId(supabaseUserId: string): Promise<User> {
    const normalizedSupabaseUserId = supabaseUserId?.trim();

    if (!normalizedSupabaseUserId) {
      throw new NotFoundException('User not found');
    }

    // Canonical production identity:
    // Supabase JWT subject -> UserAuthIdentity -> ASP User.id.
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedSupabaseUserId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (identity?.userId) {
      const legacyOwner = await this.prisma.user.findUnique({where: {supabaseId: normalizedSupabaseUserId}, select: {id: true}});
      if (legacyOwner && legacyOwner.id !== identity.userId) throw new ForbiddenException('Conflicting payment identity');
    }

    const user = identity?.userId
      ? await this.prisma.user.findUnique({
          where: {
            id: identity.userId,
          },
        })
      : await this.prisma.user.findUnique({
          where: {
            supabaseId: normalizedSupabaseUserId,
          },
        });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException('User account is not active');
    }

    return user;
  }

  private async getOrCreateWallet(userId: string): Promise<Wallet> {
    return this.prisma.wallet.upsert({
      where: {
        userId,
      },
      update: {},
      create: {
        userId,
        currency: this.defaultCurrency,
      },
    });
  }

  private async persistPaymentOrder(
    data: CreatePaymentOrderRecordInput,
    database: Pick<Prisma.TransactionClient, 'paymentOrder'> = this.prisma,
  ): Promise<PaymentOrder> {
    return database.paymentOrder.create({
      data: {
        userId: data.userId,
        walletId: data.walletId,
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        metadata: data.metadata,
        status: PaymentStatus.PENDING,
      },
    });
  }

  private async findPaymentOrderByRazorpayOrderId(
    razorpayOrderId: string,
  ): Promise<PaymentOrderWithRelations | null> {
    return this.prisma.paymentOrder.findUnique({
      where: {
        razorpayOrderId,
      },
      include: {
        wallet: true,
        kundliOrder: true,
      },
    });
  }

  private isPaymentAlreadyProcessed(paymentOrder: PaymentOrder): boolean {
    return paymentOrder.status === PaymentStatus.SUCCESS;
  }

  private async markPaymentSuccess(
    transaction: Prisma.TransactionClient,
    paymentOrder: PaymentOrder,
    payment: RazorpayPaymentEntity,
    event: RazorpayWebhookPayload,
  ): Promise<PaymentOrder | null> {
    const updateResult = await transaction.paymentOrder.updateMany({
      where: {
        id: paymentOrder.id,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      },
      data: {
        status: PaymentStatus.SUCCESS,
        razorpayPaymentId: payment.id,
        razorpaySignature: payment.signature ?? paymentOrder.razorpaySignature,
        paymentMethod: payment.method ?? paymentOrder.paymentMethod,
        rawWebhook: event as unknown as Prisma.InputJsonObject,
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    return transaction.paymentOrder.findUniqueOrThrow({
      where: {
        id: paymentOrder.id,
      },
    });
  }

  private async handleFailedPaymentUpdate(
    paymentOrder: PaymentOrder,
    payment: RazorpayPaymentEntity,
    event: RazorpayWebhookPayload,
  ): Promise<PaymentOrder | null> {
    const updateResult = await this.prisma.paymentOrder.updateMany({
      where: {
        id: paymentOrder.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        razorpayPaymentId: payment.id,
        razorpaySignature: payment.signature ?? paymentOrder.razorpaySignature,
        paymentMethod: payment.method ?? paymentOrder.paymentMethod,
        rawWebhook: event as unknown as Prisma.InputJsonObject,
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    return this.prisma.paymentOrder.findUnique({
      where: {
        id: paymentOrder.id,
      },
    });
  }

  private async markFailedFromReconciliation(
    paymentOrder: PaymentOrderWithRelations,
    payments: RazorpayPaymentEntity[],
  ): Promise<WebhookProcessingResult> {
    if (paymentOrder.status === PaymentStatus.FAILED) {
      this.logger.log(
        `reconciliation.failed paymentOrderId=${paymentOrder.id} reason=gateway_payment_failed`,
      );

      return {
        status: 'failed',
        paymentOrderId: paymentOrder.id,
        reason: 'gateway_payment_failed',
      };
    }

    const latestPayment = payments[0];

    const updateResult = await this.prisma.paymentOrder.updateMany({
      where: {
        id: paymentOrder.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        razorpayPaymentId: latestPayment?.id ?? paymentOrder.razorpayPaymentId,
        paymentMethod: latestPayment?.method ?? paymentOrder.paymentMethod,
        rawWebhook: this.buildFailedReconciliationEvent(
          paymentOrder.razorpayOrderId,
          payments,
        ) as unknown as Prisma.InputJsonObject,
      },
    });

    if (paymentOrder.type === PaymentType.SUBSCRIPTION) {
      try {
        const metadata = this.getSubscriptionPaymentMetadata(paymentOrder);

        await this.prisma.subscription.updateMany({
          where: {
            id: metadata.subscriptionId,
            userId: paymentOrder.userId,
            subscriptionStatus: {
              not: SubscriptionStatus.ACTIVE,
            },
          },
          data: {
            subscriptionStatus: SubscriptionStatus.FAILED,
          },
        });
      } catch {
        // Reconciliation result should still return
        // even if subscription metadata is damaged.
      }
    }

    if (updateResult.count === 0) {
      const refreshedOrder = await this.prisma.paymentOrder.findUnique({
        where: {
          id: paymentOrder.id,
        },
      });

      if (refreshedOrder?.status === PaymentStatus.SUCCESS) {
        this.logger.warn(
          `reconciliation.duplicate_ignored paymentOrderId=${paymentOrder.id} reason=race_already_processed`,
        );

        return {
          status: 'duplicate',
          paymentOrderId: paymentOrder.id,
          reason: 'already_processed',
        };
      }
    }

    this.logger.log(
      `reconciliation.failed paymentOrderId=${paymentOrder.id} reason=gateway_payment_failed`,
    );

    return {
      status: 'failed',
      paymentOrderId: paymentOrder.id,
      reason: 'gateway_payment_failed',
    };
  }

  private getReconciliationMismatchReason(
    error: unknown,
  ): ReconciliationReason | null {
    if (!(error instanceof BadRequestException)) {
      return null;
    }

    const response = error.getResponse();

    const message =
      typeof response === 'string'
        ? response
        : typeof response === 'object' && response && 'message' in response
          ? Array.isArray(response.message)
            ? response.message.join(', ')
            : String(response.message)
          : error.message;

    if (message === 'Captured amount does not match payment order') {
      return 'amount_mismatch';
    }

    if (message === 'Captured currency does not match payment order') {
      return 'currency_mismatch';
    }

    return null;
  }

  private getWalletRechargeCreditAmount(
    paymentOrder: PaymentOrder,
  ): Prisma.Decimal {
    const fallbackAmount = new Prisma.Decimal(
      paymentOrder.amount,
    ).toDecimalPlaces(2);

    const metadata = paymentOrder.metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return fallbackAmount;
    }

    const rawCreditAmount = (metadata as Record<string, unknown>)
      .walletCreditAmount;

    if (
      typeof rawCreditAmount !== 'string' &&
      typeof rawCreditAmount !== 'number'
    ) {
      return fallbackAmount;
    }

    try {
      const creditAmount = new Prisma.Decimal(rawCreditAmount).toDecimalPlaces(
        2,
      );

      if (!creditAmount.isFinite() || creditAmount.lte(0)) {
        return fallbackAmount;
      }

      return creditAmount;
    } catch {
      return fallbackAmount;
    }
  }
  private getWalletRechargeBreakdown(paymentOrder: PaymentOrder): {
    paidAmount: Prisma.Decimal;
    freeAmount: Prisma.Decimal;
  } {
    const fallbackPaidAmount = new Prisma.Decimal(
      paymentOrder.amount,
    ).toDecimalPlaces(2);

    const metadata = paymentOrder.metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {
        paidAmount: fallbackPaidAmount,
        freeAmount: new Prisma.Decimal(0),
      };
    }

    const rawPaidAmount = (metadata as Record<string, unknown>).paidAmount;

    const rawBonusAmount = (metadata as Record<string, unknown>).bonusAmount;

    try {
      const paidAmount =
        typeof rawPaidAmount === 'string' || typeof rawPaidAmount === 'number'
          ? new Prisma.Decimal(rawPaidAmount).toDecimalPlaces(2)
          : fallbackPaidAmount;

      const freeAmount =
        typeof rawBonusAmount === 'string' || typeof rawBonusAmount === 'number'
          ? new Prisma.Decimal(rawBonusAmount).toDecimalPlaces(2)
          : new Prisma.Decimal(0);

      if (
        !paidAmount.isFinite() ||
        paidAmount.lte(0) ||
        !freeAmount.isFinite() ||
        freeAmount.lt(0)
      ) {
        return {
          paidAmount: fallbackPaidAmount,
          freeAmount: new Prisma.Decimal(0),
        };
      }

      return {
        paidAmount,
        freeAmount,
      };
    } catch {
      return {
        paidAmount: fallbackPaidAmount,
        freeAmount: new Prisma.Decimal(0),
      };
    }
  }

  private async creditWallet(
    transaction: Prisma.TransactionClient,
    walletId: string,
    rechargeAmount: Prisma.Decimal,
    paidAmount: Prisma.Decimal,
    freeAmount: Prisma.Decimal,
    expectedCurrency: string,
    expectedUserId: string,
  ): Promise<WalletCreditResult> {
    const wallet = await transaction.wallet.findUnique({
      where: {
        id: walletId,
      },
    });

    if (!wallet || wallet.userId !== expectedUserId) {
      throw new NotFoundException('Wallet not found');
    }

    if (!expectedCurrency || wallet.currency !== expectedCurrency) {
      throw new BadRequestException('Payment and wallet currency must match');
    }

    const amount = new Prisma.Decimal(rechargeAmount);
    const paidCredit = new Prisma.Decimal(paidAmount);
    const freeCredit = new Prisma.Decimal(freeAmount);

    if (!paidCredit.plus(freeCredit).equals(amount)) {
      throw new BadRequestException(
        'Wallet recharge credit breakdown does not match total credit',
      );
    }

    const updatedWallet = await transaction.wallet.update({
      where: {
        id: wallet.id,
        userId: expectedUserId,
        currency: expectedCurrency,
      },
      data: {
        balance: { increment: amount },
        paidBalance: { increment: paidCredit },
        freeBalance: { increment: freeCredit },
      },
    });

    // PostgreSQL serializes the UPDATE on the wallet row. Derive ledger bounds
    // from that UPDATE's returned balance, not a stale pre-update SELECT.
    const balanceAfter = new Prisma.Decimal(updatedWallet.balance);
    const balanceBefore = balanceAfter.minus(amount);

    return {
      wallet: updatedWallet,
      amount,
      balanceBefore,
      balanceAfter,
    };
  }

  private async createLedgerEntry(
    transaction: Prisma.TransactionClient,
    paymentOrder: PaymentOrder,
    updatedOrder: PaymentOrder,
    walletCredit: WalletCreditResult,
  ) {
    return transaction.walletLedger.create({
      data: {
        walletId: walletCredit.wallet.id,
        userId: paymentOrder.userId,
        type: LedgerType.RECHARGE,
        amount: walletCredit.amount,
        balanceBefore: walletCredit.balanceBefore,
        balanceAfter: walletCredit.balanceAfter,
        referenceType: LedgerReferenceType.WALLET_RECHARGE,
        referenceId: updatedOrder.id,
        description: this.buildRechargeDescription(updatedOrder),
      },
    });
  }

  private getWalletIdForRecharge(
    paymentOrder: PaymentOrderWithRelations,
  ): string {
    if (!paymentOrder.walletId) {
      throw new NotFoundException(
        'Wallet recharge payment order is missing wallet',
      );
    }

    return paymentOrder.walletId;
  }

  private buildRechargeDescription(paymentOrder: PaymentOrder): string {
    return `Wallet recharge via Razorpay order ${paymentOrder.razorpayOrderId}`;
  }

  private normalizeAmount(amount: number): Prisma.Decimal {
    const decimalAmount = new Prisma.Decimal(amount);

    if (!decimalAmount.isFinite() || decimalAmount.lte(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (!decimalAmount.mul(100).isInteger()) {
      throw new BadRequestException(
        'Amount must have at most two decimal places',
      );
    }

    return decimalAmount.toDecimalPlaces(2);
  }

  private convertMajorUnitsToSubunits(amount: Prisma.Decimal): number {
    const minor = amount.mul(100);
    if (!minor.isFinite() || !minor.isInteger() || minor.lte(0) || minor.gt(Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException('Invalid payment amount in minor units');
    }
    return minor.toNumber();
  }

  private buildReceipt(userId: string, paymentType: PaymentType): string {
    let prefix = 'payment';

    if (paymentType === PaymentType.KUNDLI_REPORT) {
      prefix = 'kundli';
    } else if (paymentType === PaymentType.WALLET_RECHARGE) {
      prefix = 'wallet';
    } else if (paymentType === PaymentType.SUBSCRIPTION) {
      prefix = 'subscription';
    }

    return `${prefix}_${userId.slice(0, 12)}_${Date.now()}`.slice(0, 40);
  }

  private buildRazorpayMetadataNotes(
    metadata?: Prisma.InputJsonValue,
  ): Record<string, string> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    const notes: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        notes[key] = value;
      }
    }

    return notes;
  }

  private buildCapturedReconciliationEvent(
    payment: RazorpayPaymentEntity,
    payments: RazorpayPaymentEntity[],
  ): RazorpayWebhookPayload {
    return {
      event: 'payment.reconciled',
      payload: {
        payment: {
          entity: payment,
        },
      },
      metadata: undefined,
    } as RazorpayWebhookPayload & {
      metadata?: {
        source: 'reconciliation';
        payments: RazorpayPaymentEntity[];
      };
    };
  }

  private buildFailedReconciliationEvent(
    razorpayOrderId: string,
    payments: RazorpayPaymentEntity[],
  ): Record<string, unknown> {
    return {
      event: 'payment.reconciled_failed',
      source: 'reconciliation',
      razorpayOrderId,
      payments,
    };
  }

  private assertCapturedAmountMatchesOrder(
    paymentOrder: PaymentOrder,
    payment: RazorpayPaymentEntity,
  ) {
    const expectedAmountInSubunits = this.convertMajorUnitsToSubunits(
      new Prisma.Decimal(paymentOrder.amount),
    );

    if (payment.amount !== expectedAmountInSubunits) {
      this.logger.error(
        `payment_order.amount_mismatch paymentOrderId=${paymentOrder.id} expected=${expectedAmountInSubunits} actual=${payment.amount}`,
      );

      throw new BadRequestException(
        'Captured amount does not match payment order',
      );
    }
  }

  private assertCapturedCurrencyMatchesOrder(
    paymentOrder: PaymentOrder,
    payment: RazorpayPaymentEntity,
  ) {
    if (!payment.currency) {
      throw new BadRequestException('Captured payment currency is required');
    }

    const expectedCurrency = paymentOrder.currency.toUpperCase();

    const actualCurrency = payment.currency.toUpperCase();

    if (actualCurrency !== expectedCurrency) {
      this.logger.error(
        `payment_order.currency_mismatch paymentOrderId=${paymentOrder.id} expected=${expectedCurrency} actual=${actualCurrency}`,
      );

      throw new BadRequestException(
        'Captured currency does not match payment order',
      );
    }
  }
}
