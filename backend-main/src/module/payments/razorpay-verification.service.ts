import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

// Always use the server-owned order ID and the API secret, never the webhook secret.
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
      !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) throw new InternalServerErrorException('Payment verification configuration is missing');
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

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

    // A parsed object cannot reproduce the exact bytes signed by Razorpay.
    throw new BadRequestException('Original webhook payload is required');
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
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

    const expectedBuffer = Buffer.from(generatedSignature, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  parseWebhookPayload(
    rawBody: Buffer,
    parsedBody?: unknown,
  ): RazorpayWebhookPayload {
    try {
      // Process only the signed bytes, never an independently supplied object.
      const event: unknown = JSON.parse(rawBody.toString('utf-8'));
      if (!event || typeof event !== 'object' || Array.isArray(event) ||
          typeof (event as RazorpayWebhookPayload).event !== 'string' ||
          !(event as RazorpayWebhookPayload).event.trim()) {
        throw new Error();
      }
      return event as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
  }
}
