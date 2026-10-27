import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { allocation, minor } from './marketplace-accounting';
import { MarketplaceQuote, validateMarketplaceQuote } from './marketplace-quote';

// Server-only input: callers must load prices and quote evidence from trusted
// repositories/adapters. Never pass a checkout DTO here as authoritative input.
export function checkoutSnapshot(input: {
  orderId: string; customerUserId: string; sellerOrderId: string;
  items: { productId: string; quantity: number; unitPriceMinor: number }[];
  quote: MarketplaceQuote;
}, now = Date.now()) {
  if (!input.orderId || !input.customerUserId || !input.sellerOrderId || !input.items.length || input.items.length > 100) throw new ConflictException('Checkout ownership and items required');
  const quote = validateMarketplaceQuote(input.quote, now);
  const ids = new Set<string>();
  let listed = 0n;
  const items = input.items.map(item => {
    if (!item.productId || ids.has(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 10000) throw new ConflictException('Invalid checkout quantity or duplicate product');
    ids.add(item.productId);
    listed += minor(item.unitPriceMinor) * BigInt(item.quantity);
    return { productId: item.productId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor };
  }).sort((a,b)=>a.productId.localeCompare(b.productId));
  const product = listed - (quote.taxMode === 'INCLUSIVE' ? minor(quote.productTaxMinor) : 0n);
  const shipping = minor(quote.shippingMinor) - (quote.taxMode === 'INCLUSIVE' ? minor(quote.shippingTaxMinor) : 0n);
  const tax = minor(quote.productTaxMinor) + minor(quote.shippingTaxMinor);
  if ([product,shipping,tax].some(x=>x<0n || x>BigInt(Number.MAX_SAFE_INTEGER))) throw new ConflictException('Invalid tax-inclusive checkout components');
  const amounts = {currency:quote.currency,productMinor:Number(product),discountMinor:0,shippingMinor:Number(shipping),taxMinor:Number(tax),feeMinor:0};
  const totals=allocation(amounts);
  if (totals.gross<=0n || totals.gross>BigInt(Number.MAX_SAFE_INTEGER)) throw new ConflictException('Invalid checkout total');
  const snapshot = {
    version:1, orderId:input.orderId,customerUserId:input.customerUserId,sellerOrderId:input.sellerOrderId,items,
    amounts,totalMinor:Number(totals.gross),
    evidence:{policyRevision:quote.policyRevision,providerQuoteId:quote.providerQuoteId,taxEvidenceRef:quote.taxEvidenceRef,
      methodId:quote.methodId,taxCategory:quote.taxCategory,taxMode:quote.taxMode,expiresAt:quote.expiresAt,
      productTaxMinor:quote.productTaxMinor,shippingTaxMinor:quote.shippingTaxMinor,
      destinationCountry:quote.destinationCountry,dispatchCountry:quote.dispatchCountry,
      destinationPostalCode:quote.destinationPostalCode,dispatchPostalCode:quote.dispatchPostalCode,package:{...quote.package}},
  };
  // Detached canonical representation, suitable for immutable persistence. Hash
  // is an integrity comparison, NOT a signature or proof of provider authority.
  const canonical=JSON.stringify(snapshot);
  return {canonical,sha256:createHash('sha256').update(canonical).digest('hex')};
}
