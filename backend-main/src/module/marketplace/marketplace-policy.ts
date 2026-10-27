import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Marketplace policy is independent of consultation commission settings.
export function marketplaceCommission(subtotal: Prisma.Decimal.Value, currency: string) {
  if (currency.trim().toUpperCase() !== 'INR') {
    throw new BadRequestException('Marketplace settlement currently supports INR only');
  }
  const grossAmount = new Prisma.Decimal(subtotal);
  if (!grossAmount.isFinite() || grossAmount.lt(0) || grossAmount.decimalPlaces() > 2) {
    throw new BadRequestException('Invalid marketplace commissionable amount');
  }
  // Product subtotal after item discounts; shipping is excluded. No tax/FX is invented.
  const platformFeePercent = new Prisma.Decimal(30);
  const platformFeeAmount = grossAmount.mul(30).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { grossAmount, platformFeePercent, platformFeeAmount, netAmount: grossAmount.sub(platformFeeAmount) };
}

export function marketplacePage(page?: string, limit?: string) {
  const number = (value: string | undefined, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw new BadRequestException('Invalid marketplace pagination');
    }
    return Number(value);
  };
  return { page: number(page, 1, 10000), limit: number(limit, 24, 100) };
}

export function validateMarketplaceImage(file: { mimetype: string; buffer: Buffer; size: number }) {
  const b = file.buffer;
  const valid = b && (
    (file.mimetype === 'image/jpeg' && b.length >= 3 && b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (file.mimetype === 'image/png' && b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (file.mimetype === 'image/webp' && b.length >= 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP')
  );
  if (!valid || file.size !== b.length || b.length > 8 * 1024 * 1024) {
    throw new BadRequestException('Invalid product image content or size');
  }
}
