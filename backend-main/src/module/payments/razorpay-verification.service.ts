import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  attempts: number;
  created_at: number;
  notes?: Record<string, string>;
}

export interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency?: string;
  method?: string;
  signature?: string | null;
  status?: string;
  error_description?: string | null;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
}

@Injectable()
export class RazorpayVerificationService {
  private readonly logger = new Logger(RazorpayVerificationService.name);

  extractWebhookRawBody(rawBody: Buffer | undefined, body: unknown): Buffer {
    if (rawBody && rawBody.length > 0) {
      return rawBody;
    }

    if (Buffer.isBuffer(body)) {
      return body;
    }

    if (typeof body === 'string') {
      return Buffer.from(body);
    }

    if (body && typeof body === 'object') {
      return Buffer.from(JSON.stringify(body));
    }

    throw new BadRequestException('Webhook payload is empty');
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error('webhook.secret_missing');
      throw new InternalServerErrorException(
        'Webhook configuration is missing',
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature);
    const receivedBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  parseWebhookPayload(
    rawBody: Buffer,
    parsedBody?: unknown,
  ): RazorpayWebhookPayload {
    if (
      parsedBody &&
      !Buffer.isBuffer(parsedBody) &&
      typeof parsedBody === 'object'
    ) {
      return parsedBody as RazorpayWebhookPayload;
    }

    try {
      return JSON.parse(rawBody.toString('utf-8')) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
  }
}
