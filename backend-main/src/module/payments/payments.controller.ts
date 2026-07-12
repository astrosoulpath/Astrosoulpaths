import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { CreateKundliReportOrderDto } from './dto/create-kundli-report-order.dto';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';

import { PaymentsService } from './payments.service';
import { RazorpayVerificationService } from './razorpay-verification.service';

type RazorpayWebhookRequest = Request & {
  rawBody?: Buffer;
};

type ReconciliationApiStatus =
  | 'SUCCESS'
  | 'FAILED';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(
    PaymentsController.name,
  );

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpayVerificationService: RazorpayVerificationService,
  ) {}

  /**
   * Legacy wallet recharge endpoint.
   * Kept for frontend backward compatibility.
   */
  @Post('create-order')
  @UseGuards(SupabaseAuthGuard)
  createOrder(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.paymentsService.createWalletRechargeOrder(
      user.sub as string,
      dto,
    );
  }

  /**
   * Create Razorpay order for wallet recharge.
   */
  @Post('create-wallet-recharge-order')
  @UseGuards(SupabaseAuthGuard)
  createWalletRechargeOrder(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.paymentsService.createWalletRechargeOrder(
      user.sub as string,
      dto,
    );
  }

  /**
   * Create Razorpay order for an individual
   * paid Kundli PDF/report.
   */
  @Post('create-kundli-report-order')
  @UseGuards(SupabaseAuthGuard)
  createKundliReportOrder(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateKundliReportOrderDto,
  ) {
    return this.paymentsService.createKundliReportOrder(
      user.sub as string,
      dto,
    );
  }

  /**
   * Create Razorpay order for:
   *
   * 1. DAILY_HOROSCOPE_MONTHLY
   * 2. ASTROLOGER_KUNDLI_YEARLY
   *
   * Webhook payment capture will activate
   * the matching Subscription record.
   */
  @Post('create-subscription-order')
  @UseGuards(SupabaseAuthGuard)
  createSubscriptionOrder(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateSubscriptionOrderDto,
  ) {
    return this.paymentsService.createSubscriptionOrder(
      user.sub as string,
      dto,
    );
  }

  /**
   * Checks Razorpay directly when:
   * - webhook arrives late,
   * - browser closes,
   * - payment success response is lost,
   * - network connection drops.
   */
  @Post('reconcile/:orderId')
  @UseGuards(SupabaseAuthGuard)
  async reconcileOrder(
    @CurrentUser() user: JWTPayload,
    @Param('orderId') orderId: string,
  ) {
    const result =
      await this.paymentsService.reconcileOrder(
        user.sub as string,
        orderId,
      );

    return {
      success: true,
      status: this.mapReconciliationStatus(
        result.status,
      ),
      reason:
        result.reason ??
        this.getFallbackReconciliationReason(
          result.status,
        ),
    };
  }

  /**
   * Razorpay webhook is public because Razorpay,
   * not the logged-in frontend user, calls it.
   *
   * The signature is verified before processing.
   */
  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: RazorpayWebhookRequest,
  ) {
    try {
      const signature =
        this.extractWebhookSignature(req);

      const rawBody =
        this.razorpayVerificationService.extractWebhookRawBody(
          req.rawBody,
          req.body,
        );

      const signatureValid =
        this.razorpayVerificationService.verifyWebhookSignature(
          rawBody,
          signature,
        );

      if (!signatureValid) {
        this.logger.warn(
          'webhook.signature_invalid',
        );

        throw new BadRequestException(
          'Invalid webhook signature',
        );
      }

      const event =
        this.razorpayVerificationService.parseWebhookPayload(
          rawBody,
          req.body,
        );

      const result =
        await this.paymentsService.processVerifiedWebhook(
          event,
        );

      return {
        success: true,
        status: result.status,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `webhook.unhandled_error reason=${message}`,
      );

      throw new InternalServerErrorException(
        'Failed to process webhook',
      );
    }
  }

  private extractWebhookSignature(
    req: Request,
  ): string {
    const signature =
      req.headers['x-razorpay-signature'];

    if (
      typeof signature !== 'string' ||
      signature.length === 0
    ) {
      throw new BadRequestException(
        'Missing webhook signature',
      );
    }

    return signature;
  }

  private mapReconciliationStatus(
    status: string,
  ): ReconciliationApiStatus {
    return status === 'failed'
      ? 'FAILED'
      : 'SUCCESS';
  }

  private getFallbackReconciliationReason(
    status: string,
  ): string {
    if (status === 'failed') {
      return 'gateway_payment_failed';
    }

    if (status === 'duplicate') {
      return 'already_processed';
    }

    return 'reconciled_from_gateway';
  }
}