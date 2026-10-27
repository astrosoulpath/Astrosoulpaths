import { BadRequestException, ConflictException } from '@nestjs/common';

// All inputs are already backend-authoritative INR minor units. No FX or tax rate
// is inferred here. Discount is a product-price reduction, not another liability.
export interface MarketplaceAmounts {
  currency: string;
  productMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  feeMinor: number;
}
export function minor(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw new BadRequestException('Invalid marketplace minor units');
  return BigInt(value);
}
export function allocation(a: MarketplaceAmounts) {
  if (a.currency !== 'INR') throw new BadRequestException('Unsupported settlement currency');
  const product = minor(a.productMinor), discount = minor(a.discountMinor);
  const shipping = minor(a.shippingMinor), tax = minor(a.taxMinor), fee = minor(a.feeMinor);
  if (discount > product) throw new BadRequestException('Discount exceeds product amount');
  const commissionable = product - discount;
  const platform = (commissionable * 30n + 50n) / 100n;
  return { gross: commissionable + shipping + tax, commissionable, seller: commissionable - platform, platform, shipping, tax, fee, discount };
}

// Cumulative allocation prevents many small partial refunds from exploiting
// per-refund rounding. The final refund always reverses the exact original split.
export function refundAllocation(original: MarketplaceAmounts, before: { product: number; shipping: number; tax: number }, requested: { product: number; shipping: number; tax: number }) {
  const base = allocation(original);
  const previous = { product: minor(before.product), shipping: minor(before.shipping), tax: minor(before.tax) };
  const next = { product: previous.product + minor(requested.product), shipping: previous.shipping + minor(requested.shipping), tax: previous.tax + minor(requested.tax) };
  if (next.product > base.commissionable || next.shipping > base.shipping || next.tax > base.tax) throw new ConflictException('Refund exceeds component balance');
  const platform = (next.product * 30n + 50n) / 100n - (previous.product * 30n + 50n) / 100n;
  const product = BigInt(requested.product);
  return { gross: product + BigInt(requested.shipping) + BigInt(requested.tax), product, platform, seller: product - platform, shipping: BigInt(requested.shipping), tax: BigInt(requested.tax) };
}

export function settlementLiability(sellerCaptured: bigint, sellerRefunded: bigint, sellerPaid: bigint) {
  if ([sellerCaptured, sellerRefunded, sellerPaid].some(n => n < 0n) || sellerRefunded > sellerCaptured || sellerPaid > sellerCaptured) throw new ConflictException('Invalid settlement reconciliation');
  const balance = sellerCaptured - sellerRefunded - sellerPaid;
  return { payable: balance > 0n ? balance : 0n, recoverable: balance < 0n ? -balance : 0n };
}
