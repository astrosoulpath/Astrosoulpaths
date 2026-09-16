import { MarketplaceService } from '../marketplace/marketplace.service';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
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
import { LocalizedPricingService } from './pricing/localized-pricing.service';
import {
  RazorpayOrder,
  RazorpayPaymentEntity,
  RazorpayWebhookPayload,
} from './razorpay-verification.service';

interface WebhookProcessingResult {
  status: 'success' | 'failed' | 'duplicate' | 'ignored';

  paymentOrderId?: string;
  reason?: ReconciliationReason;
}

type ReconciliationReason =
  | 'reconciled_from_gateway'
  | 'already_processed'
  | 'gateway_payment_failed'
  | 'amount_mismatch'
  | 'currency_mismatch';

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
  ) {}

  async createOrder(
    supabaseUserId: string,
    dto: CreatePaymentOrderDto,
  ): Promise<RazorpayOrder> {
    return this.createWalletRechargeOrder(supabaseUserId, dto);
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

    return this.createTypedPaymentOrder({
      userId: user.id,
      walletId: wallet.id,
      amount,
      currency: this.defaultCurrency,
      type: PaymentType.WALLET_RECHARGE,
      metadata: undefined,
    });
  }

  async createKundliReportOrder(
    supabaseUserId: string,
    dto: CreateKundliReportOrderDto,
  ): Promise<RazorpayOrder> {
    const amount = this.normalizeAmount(dto.amount);

    const user = await this.findUserBySupabaseId(supabaseUserId);

    await this.kundliOrderService.assertKundliExists(dto.kundliId);

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
    const user = await this.findUserBySupabaseId(supabaseUserId);

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {
        name: dto.planName,
      },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

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

    const localizedQuote = await this.localizedPricingService.quotePrice({
      baseAmount: plan.price,
      baseCurrency: plan.currency,
      countryCode: userProfile?.countryCode ?? null,
    });

    const localizedAmount = new Prisma.Decimal(localizedQuote.amount);
    const localizedCurrency = localizedQuote.currency;

    this.logger.log(
      `subscription_pricing.quoted userId=${user.id} plan=${plan.name} baseAmount=${plan.price.toString()} baseCurrency=${plan.currency} countryCode=${localizedQuote.countryCode ?? 'unknown'} localizedAmount=${localizedQuote.amount} localizedCurrency=${localizedQuote.currency} fxSource=${localizedQuote.fxSource}`,
    );
    const existingActiveSubscription = await this.prisma.subscription.findFirst(
      {
        where: {
          userId: user.id,
          subscriptionPlanId: plan.id,
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

    const startDate = new Date();

    const endDate = new Date(startDate);

    endDate.setDate(endDate.getDate() + plan.durationDays);

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
      },
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

    this.logger.log(
      `reconciliation.payment_found paymentOrderId=${paymentOrder.id} type=${paymentOrder.type} status=${paymentOrder.status} razorpayOrderId=${paymentOrder.razorpayOrderId}`,
    );

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

    const payments = await this.fetchOrderPaymentsFromRazorpay(razorpayOrderId);

    const capturedPayment = payments.find(
      (payment) => payment.status === 'captured',
    );

    if (!capturedPayment) {
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
  }): Promise<RazorpayOrder> {
    const currency =
      input.currency?.trim().toUpperCase() || this.defaultCurrency;

    let razorpayOrder: RazorpayOrder;

    try {
      razorpayOrder = (await getRazorpayInstance().orders.create({
        amount: this.convertMajorUnitsToSubunits(input.amount),
        currency,
        receipt: this.buildReceipt(input.userId, input.type),
        notes: {
          paymentType: input.type,
          userId: input.userId,
          ...(input.walletId
            ? {
                walletId: input.walletId,
              }
            : {}),
          ...this.buildRazorpayMetadataNotes(input.metadata),
        },
      })) as RazorpayOrder;
    } catch (error: unknown) {
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
          `statusCode=${statusCode ?? 'unknown'}`,
          `razorpayCode=${razorpayCode ?? 'unknown'}`,
          `reason=${message}`,
        ].join(' '),
      );

      throw new BadGatewayException('Unable to create payment order');
    }

    try {
      await this.persistPaymentOrder({
        userId: input.userId,
        walletId: input.walletId,
        razorpayOrderId: razorpayOrder.id,
        amount: input.amount,
        currency,
        type: input.type,
        metadata: input.metadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `payment_order.persist_failed userId=${input.userId} type=${input.type} razorpayOrderId=${razorpayOrder.id} reason=${message}`,
      );

      throw new InternalServerErrorException('Unable to save payment order');
    }

    this.logger.log(
      `payment_order.created userId=${input.userId} type=${input.type} razorpayOrderId=${razorpayOrder.id} amount=${input.amount.toFixed(2)} currency=${currency}`,
    );

    return razorpayOrder;
  }

  private async handleCapturedPayment(
    event: RazorpayWebhookPayload,
    paymentOrder: PaymentOrderWithRelations,
    payment: RazorpayPaymentEntity,
  ): Promise<WebhookProcessingResult> {
    if (this.isPaymentAlreadyProcessed(paymentOrder)) {
      this.logger.warn(
        `duplicate.ignored paymentOrderId=${paymentOrder.id} razorpayPaymentId=${payment.id} reason=already_success`,
      );

      return {
        status: 'duplicate',
        paymentOrderId: paymentOrder.id,
      };
    }

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

    const durationDays = subscription.subscriptionPlan?.durationDays ?? 30;

    const endDate = new Date(startDate);

    endDate.setDate(endDate.getDate() + durationDays);

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
        `subscription.failure_update_failed paymentOrderId=${paymentOrder.id} reason=${message}`,
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
      `transaction.failed paymentOrderId=${paymentOrderId} razorpayPaymentId=${razorpayPaymentId} reason=${message}`,
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
        `reconciliation.fetch_failed razorpayOrderId=${razorpayOrderId} reason=${message}`,
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
  ): Promise<PaymentOrder> {
    return this.prisma.paymentOrder.create({
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
        status: {
          not: PaymentStatus.SUCCESS,
        },
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
        status: {
          not: PaymentStatus.SUCCESS,
        },
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
  ): Promise<WalletCreditResult> {
    const wallet = await transaction.wallet.findUnique({
      where: {
        id: walletId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balanceBefore = new Prisma.Decimal(wallet.balance);
    const paidBalanceBefore = new Prisma.Decimal(wallet.paidBalance);
    const freeBalanceBefore = new Prisma.Decimal(wallet.freeBalance);

    const amount = new Prisma.Decimal(rechargeAmount);
    const paidCredit = new Prisma.Decimal(paidAmount);
    const freeCredit = new Prisma.Decimal(freeAmount);

    const balanceAfter = balanceBefore.plus(amount);
    const paidBalanceAfter = paidBalanceBefore.plus(paidCredit);
    const freeBalanceAfter = freeBalanceBefore.plus(freeCredit);

    if (!paidCredit.plus(freeCredit).equals(amount)) {
      throw new BadRequestException(
        'Wallet recharge credit breakdown does not match total credit',
      );
    }

    const updatedWallet = await transaction.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: balanceAfter,
        paidBalance: paidBalanceAfter,
        freeBalance: freeBalanceAfter,
      },
    });

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
    return amount.mul(100).toDecimalPlaces(0).toNumber();
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
      return;
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

