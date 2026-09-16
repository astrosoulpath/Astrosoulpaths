import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { AstrologerPayoutWebhookService } from './astrologer-payout-webhook.service';

@Controller('astrologer/payout-webhook')
export class AstrologerPayoutWebhookController {
  constructor(
    private readonly webhookService: AstrologerPayoutWebhookService,
  ) {}

  @Post()
  async webhook(
    @Req()
    req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature')
    signature?: string,
  ) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!secret) {
      throw new BadRequestException('Payout webhook secret is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing Razorpay webhook signature');
    }

    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException('Webhook raw body is unavailable');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');

    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    return this.webhookService.process(payload);
  }
}
