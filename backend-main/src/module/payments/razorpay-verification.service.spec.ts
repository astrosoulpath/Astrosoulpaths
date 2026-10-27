import { createHmac } from 'crypto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { RazorpayVerificationService } from './razorpay-verification.service';

describe('Razorpay signed webhook boundary', () => {
  const service = new RazorpayVerificationService();
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const bytes = Buffer.from('{ "event": "payment.captured", "payload": {} }\n');
  const secret = 'synthetic-webhook-secret';
  beforeEach(() => { process.env.RAZORPAY_WEBHOOK_SECRET = secret; });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
  });
  const sign = (body: Buffer) => createHmac('sha256', secret).update(body).digest('hex');

  it('accepts the original signed bytes', () => {
    expect(service.verifyWebhookSignature(bytes, sign(bytes))).toBe(true);
    expect(service.extractWebhookRawBody(bytes, {})).toBe(bytes);
  });
  it('rejects changed whitespace and forged signatures', () => {
    expect(service.verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(bytes.toString()))), sign(bytes))).toBe(false);
    expect(service.verifyWebhookSignature(bytes, '0'.repeat(64))).toBe(false);
  });
  it.each(['', 'x'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])('rejects malformed signature %s', signature => {
    expect(service.verifyWebhookSignature(bytes, signature)).toBe(false);
  });
  it('fails closed without configuration', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(() => service.verifyWebhookSignature(bytes, sign(bytes))).toThrow(InternalServerErrorException);
  });
  it('never reconstructs bytes from parsed JSON', () => {
    expect(() => service.extractWebhookRawBody(undefined, {event: 'payment.captured'})).toThrow(BadRequestException);
  });
  it('processes signed bytes rather than conflicting parsed input', () => {
    expect(service.parseWebhookPayload(bytes, {event: 'payment.failed'}).event).toBe('payment.captured');
  });
  it.each(['null', '[]', '{}', '{"event":1}', '{"event":""}', 'invalid'])('rejects invalid signed event shape %s', body => {
    expect(() => service.parseWebhookPayload(Buffer.from(body))).toThrow(BadRequestException);
  });
  it('retains duplicate signed bytes for downstream durable idempotency', () => {
    expect(service.parseWebhookPayload(bytes)).toEqual(service.parseWebhookPayload(bytes));
  });
});
