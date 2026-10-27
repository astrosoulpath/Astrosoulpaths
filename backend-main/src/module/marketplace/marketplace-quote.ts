import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { minor } from './marketplace-accounting';

// Adapter contracts only: policy rates and courier estimates must be approved,
// server-provided and versioned; no default zero-tax or free shipping assumption.
export interface MarketplaceQuote {
  policyRevision: string;
  providerQuoteId: string;
  taxEvidenceRef: string;
  dispatchPostalCode: string;
  package: { weightGrams: number; lengthMm: number; widthMm: number; heightMm: number };
  destinationCountry: string;
  dispatchCountry: string;
  destinationPostalCode: string;
  methodId: string;
  currency: string;
  shippingMinor: number;
  productTaxMinor: number;
  shippingTaxMinor: number;
  taxMode: 'INCLUSIVE' | 'EXCLUSIVE';
  taxCategory: string;
  expiresAt: number;
  estimate?: string;
}
export interface MarketplaceShippingTaxPort {
  quote(input: { sellerId: string; addressId: string; productIds: string[] }): Promise<MarketplaceQuote>;
}
export function validateMarketplaceQuote(quote: MarketplaceQuote | undefined, now = Date.now()) {
  if (!quote) throw new ServiceUnavailableException('Approved shipping and tax quote unavailable');
  if (quote.currency !== 'INR' || quote.dispatchCountry !== 'IN' || quote.destinationCountry !== 'IN') throw new BadRequestException('Unsupported delivery or settlement route');
  if (!/^\d{6}$/.test(quote.destinationPostalCode) || !quote.policyRevision?.trim() || !quote.methodId?.trim() || !quote.taxCategory?.trim() || !['INCLUSIVE','EXCLUSIVE'].includes(quote.taxMode) || !Number.isFinite(quote.expiresAt) || quote.expiresAt <= now) throw new BadRequestException('Invalid or expired shipping/tax quote');
  if (!/^\d{6}$/.test(quote.dispatchPostalCode) || !quote.providerQuoteId?.trim() || !quote.taxEvidenceRef?.trim() || !quote.package || [quote.package.weightGrams,quote.package.lengthMm,quote.package.widthMm,quote.package.heightMm].some(n=>!Number.isSafeInteger(n)||n<=0)) throw new BadRequestException('Verified provider, tax evidence and package measurements required');
  minor(quote.shippingMinor);minor(quote.productTaxMinor);minor(quote.shippingTaxMinor);
  return quote;
}
